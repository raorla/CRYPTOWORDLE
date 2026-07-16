# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CryptoWordle is an on-chain Wordle on ETH Sepolia where the secret five-letter word lives **encrypted as five handles inside a TEE** (iExec Nox / Intel TDX — not FHE). While a round is open, only the game contract can access the secret; hints (green/yellow/grey) are computed on ciphertext, the winner is settled by an on-chain KMS decryption proof, and the word is revealed after the round for public audit. The full privacy walkthrough and threat model are in `README.md` — read it before touching the contract or the Nox flow.

## Commands

All commands run from the repo root unless noted. **Node 22+ required** (scripts run `.ts` files directly via Node's native type stripping — there is no build step for the Node side).

| Task | Command |
|------|---------|
| Typecheck (Node side) | `npm run typecheck` |
| Compile contract | `npm run compile` |
| Node unit tests (fast, no Docker) | `npm run test:unit` |
| Integration tests (real Nox stack) | `npm test` |
| Run one integration file | `npx hardhat test test/integration/gas-probe.test.ts` |
| Frontend unit/component tests | `cd frontend && npm test` |
| Frontend e2e (Playwright) | `cd frontend && npm run test:e2e` |
| Deploy to Sepolia | `npm run deploy:sepolia` |
| Regenerate frontend ABI | `npm run export-abi` |
| Live-testnet end-to-end probe | `npm run sanity:sepolia` |
| Create one round | `npm run round:create` |
| Round-keeper daemon | `npm run round:daemon` |
| Frontend dev server | `cd frontend && npm run dev` |
| Frontend typecheck + build | `cd frontend && npm run build` |

There is **no linter**. Tests come in three tiers:

- **Unit** — `npm run test:unit` (root, `node --test test/unit/*.test.ts`): pure logic, no Docker/network. `frontend/` has its own unit + component layer via Vitest + jsdom (`cd frontend && npm test`) covering the store, the idempotent DOM renderer and the certificate modals.
- **Integration** — `npm test` (Hardhat 3 + real Nox stack, see below).
- **E2E** — `cd frontend && npm run test:e2e` (Playwright): boots the built bundle and smoke-tests the UI shell (render, help modal, theme toggle) — no wallet/chain, so the on-chain guess/claim flow stays covered by integration. One-time: `npx playwright install chromium`.

### About `npm test` (integration)
`npm test` boots the **entire real Nox off-chain stack in Docker** (KMS, handle gateway, TDX runner, NATS, MinIO) via `@iexec-nox/nox-hardhat-plugin` — no mocks. First run pulls large images (slow); a single guess executes ~95 TEE ops sequentially, so the suite takes several minutes. On failure, stack logs land in `offchain-services.log`. Requires Docker running. `test/integration/gas-probe.test.ts` is separate from the main `cryptowordle.test.ts` suite and only measures per-function gas. Bare `hardhat test` also discovers `test/unit/` — that's harmless (those tests need no Docker), but `npm run test:unit` is the fast Docker-free path.

### Environment (`.env`, see `.env.example`)
`SEPOLIA_RPC_URL` and `DEPLOYER_PRIVATE_KEY` (fresh funded dev key) are required for any deploy/service/sanity command. `ROUND_POT_ETH` / `ROUND_DURATION_SECONDS` configure the round generator. `CRYPTOWORDLE_ADDRESS` overrides the deployed address from `deployments/sepolia.json`.

## Architecture

Three deliverables share one contract across **two separate TypeScript worlds**:

1. **Contract** — `contracts/CryptoWordle.sol` (single file). Secret is `euint256[5]` ACL'd to the contract **only** while the round is Open. `guess()` emits ~95 encrypted ops → 5 color handles + a win handle; a row's colors sum to 10 iff all-green, so `colorSum == 10 ⇔ win`. `claim(roundId, guessIndex, proof)` verifies the KMS `decryptionProof` **on-chain** and pays the *guesser* (never the caller — anyone can crank it). `revealExpired()` / post-solve reveal migrate the secret letters to publicly-decryptable handles for audit.
2. **Node side** (root, ESM, `type: module`) — `scripts/` (deploy, export-abi, sanity-check), `service/` (round generator + daemon), `test/`. All share `service/common.ts` (viem + Nox handle clients, gas budgets, KMS retry, word↔letters codecs, `encryptWord`).
3. **Frontend** — `frontend/` Vite + TypeScript + viem, **no framework**. It imports `../shared` and `../deployments` directly (`vite.config.ts` whitelists `fs.allow: ['..']`).

### Two files are the contract between the worlds
- **`shared/abi.ts`** — committed ABI so the frontend builds without compiling. **Regenerate with `npm run export-abi` (reads the compiled artifact) after any contract change.**
- **`deployments/sepolia.json`** — the single source of truth for the deployed address. `npm run deploy:sepolia` rewrites it; the frontend (`frontend/src/config.ts`) and services (`service/common.ts loadDeployment`) both read it.

So the correct sequence after editing the contract is: `npm run compile` → `npm run export-abi` → (redeploy if address changed).

### Two cross-cutting Nox constraints (both duplicated on the Node and frontend sides — keep them consistent)
- **Explicit gas on every Nox-touching write.** Wallets and RPCs mis-estimate Nox precompile calls to ~block gas limit (rejected by public RPCs), so gas is hardcoded from `gas-probe.test.ts` measurements. Budgets live in **`service/common.ts` `GAS`** and **`frontend/src/config.ts` `GAS`** — update both if the measured values change.
- **KMS decryption is latency-tolerant, not instant.** `publicDecrypt` results materialize seconds-to-minutes after the tx; "not yet computed" is a normal state, not an error. Wrapped by `frontend/src/nox.ts publicDecryptWithRetry` and `service/common.ts withKmsRetry`. State is read via **view functions, never `eth_getLogs`** (public RPCs cap log ranges).

### Frontend internals (`frontend/src/`)
- `chain.ts` — viem read/write; reads work over a public RPC **without a wallet**, writes and decryption need a connected wallet (`nox.ts` handle client is wallet-backed).
- `state.ts` — tiny observable store (`getState`/`update`/`subscribe`); `Phase` union drives the whole UI.
- `game.ts` — orchestration: round loading, 12s polling, per-tile color decryption (fire-and-forget, each tile paints as its handle decrypts), win detection, claim flow, post-round reveal.
- `ui/render.ts` — **idempotent** DOM mutation (grid/keyboard built once, mutated in place so CSS animations survive re-renders); `ui/events.ts` is a typed event bus for juice (sound/confetti/animations); `ui/modals.ts`, `theme.ts`, `sound.ts`, `confetti.ts`.
- `main.ts` — wires DOM ↔ store ↔ game. The UI is a "Treasury Certificate" visual theme (light default / dark alternate); design references live in `CryptoWordle design improvement/`.

### Notable behaviors
- **Duplicate-letter simplification**: Nox lacks encrypted OR / per-position budgets, so "present" is a counting argument — *every* duplicate guess letter shows yellow if the letter appears anywhere in the secret (differs from classic Wordle, never affects the all-green win). Pinned by a dedicated test.
- **Un-leakability is asserted in tests**, not just claimed: the ACL of each secret handle is checked on the NoxCompute contract.
- Six guesses per wallet per round; expired rounds refund the creator after a 15-minute claim grace period.

## Toolchain
Solidity 0.8.35 (viaIR, optimizer, evmVersion cancun) · Hardhat 3 (ESM) · `@iexec-nox/nox-protocol-contracts` · `@iexec-nox/handle` · `@iexec-nox/nox-hardhat-plugin` · viem · Vite. Root `tsconfig.json` excludes `frontend/` (it has its own).
