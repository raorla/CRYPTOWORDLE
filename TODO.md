# TODO — CryptoWordle (iExec WTF hackathon)

The contract, services, tests and frontend are **done and deployed** (Sepolia `0xaa6f…9fc9`, 16/16 integration tests, certificate UI + intro + records). What's left is submission-facing. Ordered by priority.

_Last updated: 2026-07-17._

## Must-have (submission-blocking)

- [x] **Deploy the frontend to a public, playable URL.** Live at <https://raorla.github.io/CRYPTOWORDLE/> — GitHub Pages, rebuilt and redeployed on every push to `main` by `.github/workflows/deploy-pages.yml` (Vite `base: "./"` makes the bundle path-independent). Still to do: add the URL to the demo end card.
- [ ] **Keep a live, funded round open on Sepolia during judging.** Run `npm run round:daemon` (pot from `ROUND_POT_ETH`, funded deployer key) so the public app is actually playable and the pot is real. Confirm the daemon points at the address in `deployments/sepolia.json`.
- [ ] **Record the ≤4:00 demo video** following `docs/demo-video-script.md` (updated for the certificate UI — new beats available: The Sealing intro, the Vault Inspector, the Hall of Records, the Enclave Docket, the audit strip). Stage everything per the shot checklist; do not fake the KMS-wait states.
- [ ] **Fill the submission page**: play URL + repo + contract address (from `deployments/sepolia.json`) + the tooling write-up in `feedback.md` (a plus for the sponsor track).

## Shipped since the redesign

- [x] **"The Sealing" animated intro/loading veil** — static-HTML first paint, seal slam gated on the real chain read, any-key skip (keystroke swallowed), 8s hard cap, session-aware (no ceremony on reload), reduced-motion static frame, honest zero-round/error branches (`frontend/src/ui/intro.ts` + tests).
- [x] **Hall of Records** (`≣` header button, `#records` deep link, back-button closes) — honors plaques, champions by wins, full round archive with shimmering OPEN chips; one multicall, 30s cache, view-functions only (`frontend/src/records.ts`, `showRecordsModal`). Note: the contract zeroes `pot` on settle, so settled rounds honestly read "paid out"/"refunded" — paid totals are NOT recoverable from views.
- [x] **The Vault Inspector** — "Inspect the vault" under the seal opens the five real sealed `bytes32` handles (`getSecretHandles`), click-to-copy, "you are looking at it — and you still cannot read it".
- [x] **Independent audit** — on reveal, every decrypted colour is replayed locally against the unsealed word (`frontend/src/audit.ts`, exact contract semantics incl. duplicate-letter rule); verdict stamped on the seal panel and in the settled/paid modals.
- [x] **Enclave Docket** — I–IV stepper under the board making the TEE round-trip visible (sealing → mined → enclave ops → KMS).
- [x] **Read-path fix**: spectator reads always use the public Sepolia RPC — a wallet parked on another chain no longer blanks the whole app (`frontend/src/chain.ts`).
- [x] **Paid modal shows the revealed word** (fillable `.reveal-slot`, late-fill on reveal).
- [x] **Surface the 5 secret handle hashes** — shipped as the Vault Inspector (above).

## Tests (all green)

- [x] **Unit** — `npm run test:unit` (word-list integrity + letter codec, 7) and `cd frontend && npm test` (Vitest + jsdom, 52: store, renderer, modals, intro controller, records aggregation/modal, audit replay).
- [x] **Integration** — `npm test` (16 end-to-end tests against the real Nox Docker stack: 10 game + 6 treasury, plus the gas probe).
- [x] **E2E** — `cd frontend && npm run test:e2e` (Playwright, 6: intro skip, shell, help modal, theme, connect CTA, hash-routed records). Future: a wallet/chain-mocked e2e to drive the full guess→win→claim flow in-browser.

## Nice-to-have

- [ ] **Prod build sanity**: confirm fonts (Google Fonts), confetti and all modals render in the hosted `frontend/dist`; if the host injects a strict CSP, allow `fonts.googleapis.com`/`fonts.gstatic.com`.
- [ ] **Refresh README media**: add a current certificate-UI screenshot (intro seal + registry make good hero shots).
- [ ] **Share certificate PNG** (canvas-rendered banknote-style card for the win tweet) — deferred from the design panel as M-effort.
