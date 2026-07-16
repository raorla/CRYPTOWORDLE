# Honest feedback on the iExec Nox developer tooling

*Written after building CryptoWordle — an on-chain Wordle whose secret word lives as encrypted Nox handles — for the iExec WTF hackathon. Everything below was hit first-hand during this project, on these exact versions: `@iexec-nox/nox-hardhat-plugin` 0.1.0, `@iexec-nox/handle` 0.1.0-beta.13, `@iexec-nox/nox-protocol-contracts` 0.2.4, Hardhat 3.4+, Node 22, docs as published at docs.iex.ec on 2026-07-16.*

## Summary verdict

Nox is the most usable confidential-compute toolchain we have tried on an EVM testnet, and the local Hardhat test stack is genuinely excellent — real KMS, real TEE runner, real proofs, in Docker, wired into `hardhat test`. We built a non-trivial game (≈95 encrypted ops per user action, on-chain proof-verified settlement) and shipped it with a fully passing end-to-end suite. That is not something we could say about most confidential-EVM stacks.

The pain is all at the edges: version drift between the starter, the plugin and the docs; a starter that stops at localhost with no path to a testnet; and several behaviours (gas estimation, decryption latency, ACL preconditions on public decryption) that every real dApp hits within hours but that appear nowhere in the documentation. None of these are architectural flaws. All of them are fixable with docs and small SDK additions.

## What's great

- **The Hardhat 3 plugin's local Docker stack is the single best part of the toolchain.** `npm test` boots KMS, handle gateway, ingestor, TDX runner, NATS and MinIO, etches NoxCompute onto the local node, and runs tests against the real thing. Our un-leakability guarantees (ACL assertions on secret handles), our forged-proof rejections and our trustless-claim flow are all tested against genuine KMS decryption proofs — zero mocks. This is the difference between "we think it's confidential" and "we asserted it".
- **`publicDecrypt` returning an on-chain-verifiable `decryptionProof` is a killer primitive.** The `finalizeUnwrap` pattern from ConfidentialToken generalises beautifully: our `claim(roundId, guessIndex, proof)` verifies the KMS proof via `Nox.publicDecrypt` and settles the pot trustlessly — anyone can crank it, forgeries revert, and the winner gets paid even if they close the tab. Genuinely trustless settlement on encrypted state, today.
- **The compile-to-test loop is smooth.** Once the stack is up, iterate on Solidity, `npm test`, watch real ciphertext flow. Failure dumps land in `offchain-services.log`, which saved us more than once.
- **The ACL introspection surface (`isAllowed` / `isViewer` / `isPubliclyDecryptable`) made our core claim testable.** We could prove, in CI, that no wallet on Earth can decrypt the secret while a round is open.
- **`@iexec-nox/handle` auto-configures supported networks.** On Ethereum Sepolia, `createViemHandleClient(walletClient)` just works — gateway, subgraph and NoxCompute address resolved from the chainId (see friction item 3 for the docs-side catch).

## Friction log

Each item: what happened, the impact, and a concrete fix.

### 1. The starter pins a plugin version whose API no longer matches the published one

`nox-hardhat-starter` pins `@iexec-nox/nox-hardhat-plugin@^0.1.0-beta.2`. Between beta.2 and the published 0.1.0, the exported constant `HANDLE_GATEWAY_URL` was renamed to a function, `handleGatewayUrl()` (necessarily so — the gateway's host port is Docker-assigned at runtime). The starter's own `test/utils/handle-gateway.ts` does `import { HANDLE_GATEWAY_URL } from "@iexec-nox/nox-hardhat-plugin"`, so the moment you bump the plugin to latest — the first thing anyone does — the starter's own utility breaks.

**Impact:** the first hour of the hackathon was spent debugging an import error in code we didn't write, in the official starting point.
**Fix:** release the starter in lockstep with the plugin (a CI job in the starter repo that installs `@latest` and runs the tests would catch this automatically); keep a deprecated `HANDLE_GATEWAY_URL` alias for one release with a console warning.

### 2. The starter ends at localhost — going to a testnet is undocumented DIY

The starter ships **no** testnet network config, **no** deploy script, and **no** `.env.example`. Everything deploys inline in tests on the plugin's simulated network. Getting from "tests pass locally" to "contract live on Sepolia with a working handle client" meant hand-assembling: the `networks.sepolia` Hardhat entry, env-var handling, a viem deploy script, a deployment-record convention, and the handle-client wiring — with no reference anywhere in the docs or starter.

**Impact:** hours of undirected work at exactly the moment a hackathon team wants momentum; every team re-invents the same five files.
**Fix:** add to the starter a `networks.sepolia` block, a `.env.example` (RPC URL + private key), one minimal `scripts/deploy.ts`, and a "from local tests to Sepolia" README section. Half a day of work upstream, saved for every downstream team.

### 3. The docs say Ethereum Sepolia auto-config is "upcoming" — but it already shipped

`@iexec-nox/handle` 0.1.0-beta.13's built-in `networks.js` **does** include Ethereum Sepolia (11155111: gateway `https://gateway-testnets.noxprotocol.dev`, NoxCompute `0x24Ef36…77bF`, subgraph URL). The docs' advanced-configuration page still carries an info box saying full SDK support for Ethereum Sepolia "ships with an upcoming `@iexec-nox/handle` release" and that only Arbitrum Sepolia auto-resolves.

**Impact:** we nearly hand-configured all three endpoints (and would have hardcoded a gateway URL that could later drift) for a chain the SDK already supports. Docs that lag npm cost trust: after the first mismatch, you re-verify everything against the package source, which is what we ended up doing.
**Fix:** tie the docs' version-sensitive callouts to actual release checks (even a docs-CI job that imports the published package and asserts the claim), and date-stamp such callouts.

### 4. Nowhere do the docs say that wallets cannot estimate gas for Nox calls

Any transaction touching the Nox precompile defeats `eth_estimateGas`. MetaMask falls back to roughly the block gas limit, and public RPCs (Infura, in our case) then reject the transaction ("gas limit too high"). The failure mode is baffling: the same contract call works in Hardhat and fails from a wallet, with an error that points at the RPC rather than the cause. Every Nox dApp must set explicit gas on every Nox-touching write — we learned this the hard way, then built a gas-probe test to measure real budgets: createRound 416k, guess 1.82M, claim 539k, revealExpired 518k on the local coprocessor, which works out to **~17k gas per Nox op** — a genuinely useful budgeting number.

**Impact:** hours lost on a failure that looks like an RPC/wallet bug; a mandatory workaround that every frontend must discover independently.
**Fix:** a prominent docs section ("Gas for Nox transactions"), a published per-op gas table, and ideally an SDK helper that returns a suggested gas limit given an op count.

### 5. `Nox.allowPublicDecryption` reverts on handles that never went through a computation — undocumented

Calling `allowPublicDecryption` on a handle that came straight from `toEuint256(0)` (e.g. in a constructor) or directly from `fromExternal` reverts with `PublicHandleACLForbidden`. Nothing in the docs mentions this precondition. We hit it when building the post-round reveal: you cannot simply open the original secret-letter input handles. Our workaround — migrate each letter to a fresh computed handle via `Nox.add(secret, Nox.toEuint256(0))`, then `allowPublicDecryption` on that — works and is arguably cleaner (the original handles keep their contract-only ACL), but we found it by trial and error.

**Impact:** a revert with an unexplained custom error, hours from the docs' happy path.
**Fix:** document the precondition next to `allowPublicDecryption`; name the `add(x, 0)` migration idiom in the guides; consider making the error message self-explanatory ("handle must be the result of a computation").

### 6. The primitive inventory is narrow, and it shapes (and taxes) your whole design

Runtime support is exactly five types — `ebool`, `euint16`, `euint256`, `eint16`, `eint256` — and there is no encrypted OR/AND/bitwise op. "Is this letter present anywhere in the secret?" would be one OR-reduction with bitwise ops; instead it costs **5 `eq` + 5 `select` + 4 `add` + 1 `gt`** per guess letter. Multiply by five letters and our guess transaction emits ~95 TEE ops and 1.82M gas. There is also no on-chain randomness primitive, so the secret word must be chosen and encrypted by an off-chain process — forcing a trusted round generator into an otherwise trustless design (we mitigated with CSPRNG + immediate discard + post-round public reveal, but a protocol-level primitive would remove the trust assumption entirely).

**Impact:** op counts (and gas, and runner latency) 3–5× higher than the logic warrants; a trusted component we would rather not have.
**Fix:** encrypted bitwise ops (`and`/`or`/`xor` at minimum), and an encrypted-randomness primitive (TEE-generated random euint with an attested seed would fit the existing trust model).

### 7. Decryption latency is real, undocumented, and the SDK's built-in patience is too short

Results materialise asynchronously: seconds locally, and on Sepolia the gateway can answer "not yet computed" for **minutes** after the transaction that produced a handle. The docs say "asynchronous" but give no numbers and no guidance. The plugin's internal poll before decrypt is 60 × 100ms = **6 seconds** — far too short for a contract that emits ~95 ops into a sequential runner queue; our tests only pass because we vendored the starter's `waitForHandleResolved` gateway-polling util with a 300s timeout, and our Sepolia scripts wrap every `publicDecrypt` in a retry loop (24 × 5s). Every Nox consumer will write this same code.

A second latency shape we hit live on Sepolia: during the lag window `publicDecrypt` on a freshly-`allowPublicDecryption`'d handle returns **HTTP 403 `access_denied` "not publicly decryptable"** (the ACL grant itself hasn't been indexed yet), and occasionally a transient **503 RPC error** — three different error shapes for the same "be patient" condition. A naive client that treats 403 as a hard permission failure (the natural reading) will wrongly conclude its ACL is broken.

**Impact:** flaky-looking tests and scripts until you discover the polling pattern; a helper that clearly belongs in the SDK exists only as an unexported test util in the starter; misleading 403s during ACL-indexing lag send developers down a permissions rabbit hole.
**Fix:** ship `waitForHandleResolved` (and a decrypt-with-retry option: `publicDecrypt(handle, { timeoutMs })`) in `@iexec-nox/handle`; make the plugin's resolve timeout configurable; publish expected-latency figures per network; return a distinct `not_yet_indexed` error (or 425/Retry-After) instead of 403 while a public-decryption grant is still propagating.

### 8. Ecosystem fragmentation: Hardhat 3-only, ESM-only, Node 22+

The plugin is Hardhat 3-only (HH3 plugin API), ESM-only, Node 22+. Most existing Ethereum guides, tutorials and team codebases are still Hardhat 2 / CJS. HH3's changed config format (`defineConfig`, `plugins` array, network `type`/`chainType`) plus ESM test-runner quirks (e.g. we had to pin `@nomicfoundation/hardhat-node-test-runner` via `overrides`) make the first day steeper than it needs to be — before writing a single line of confidential code.

**Impact:** raised entry bar; teams with an existing HH2 repo cannot adopt Nox without a migration.
**Fix:** state the requirements loudly at the top of the getting-started page (they are currently discoverable only by failing); publish a short "HH2 → HH3 for Nox" migration note. A HH2 shim is probably not worth it — but saying so explicitly would also help.

### 9. The cDeFi wizard didn't fit a non-DeFi project

The cDeFi wizard generates confidential-DeFi templates (tokens, wrappers). For a game — encrypted state that isn't a balance, settlement that isn't a transfer — it had nothing for us, and we set it aside early. That is a fair scoping choice, just worth naming: the interesting frontier for confidential compute is precisely the non-token use cases.

**Impact:** minor — but the first-run experience funnels everyone towards tokens.
**Fix:** a "blank canvas" template (contract + test + deploy script, no token assumptions) would serve games, auctions, voting and the rest.

## Docs gaps (consolidated)

1. Gas: no mention that wallets/RPCs cannot estimate Nox transactions; no per-op gas figures (we measured ~17k/op — publish a table).
2. Latency: no numbers for runner/KMS materialisation on any network; no retry guidance; no mention that the plugin's decrypt poll is 6s.
3. `allowPublicDecryption` precondition (computed handles only) and the `PublicHandleACLForbidden` error are undocumented; the `add(x, 0)` migration idiom deserves a named place in the guides.
4. The Ethereum Sepolia auto-config callout is stale (SDK already ships it).
5. The encrypted-types table lists every width (`euint8`…`euint256`, `ebytes1`…`ebytes32`) but only five types work at runtime; the table misleads more than it helps.
6. The handle-status endpoint (`POST {gateway}/v0/public/handles/status`) that the plugin and starter rely on is not in the public docs.
7. Nothing documents the starter → testnet path (network config, deploy, env).

## Wishlist

1. **Encrypted bitwise ops** (`or`/`and`/`xor`) — collapses our per-letter presence check from 15 ops to a handful.
2. **An encrypted randomness primitive** — removes the last trusted component from designs like ours.
3. **Batch ACL grants** — `allowThis` + `allowPublicDecryption` over a `bytes32[]`; our guess does 12 individual ACL calls (2 × 5 colors + 2 × win) that could be one.
4. **A published gas table** per Nox op and per ACL call, per network.
5. **Decrypt-with-retry and `waitForHandleResolved` in `@iexec-nox/handle`** — configurable timeouts, exponential backoff, exported for both Node and browser.
6. **Starter parity with the published plugin**, enforced by CI, plus the testnet deploy path in the box.

---

*Bottom line: the core protocol delivered everything CryptoWordle's design needed — sealed state, on-ciphertext compute, and trustlessly verifiable decryption. Close the version-drift and docs gaps, ship the two SDK helpers everyone is hand-writing, and this becomes a toolchain you can drop a hackathon team into on Friday night and get a confidential dApp by Sunday. We know, because that's roughly what happened — minus the hours listed above.*
