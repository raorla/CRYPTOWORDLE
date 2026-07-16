# TODO — CryptoWordle (iExec WTF hackathon)

The contract, services, tests and frontend are **done and deployed** (Sepolia `0x5246…490f`, 10/10 integration tests, redesigned UI). What's left is submission-facing. Ordered by priority.

_Last updated: 2026-07-16._

## Must-have (submission-blocking)

- [ ] **Deploy the frontend to a public, playable URL.** Right now it only runs via `cd frontend && npm run dev` — judges can't try it. Build (`cd frontend && npm run build`) and host `frontend/dist` (Vercel/Netlify/IPFS/GitHub Pages). `frontend/dist` is gitignored, so wire the host to run the build. Then add the URL to `README.md` and the demo end card.
- [ ] **Keep a live, funded round open on Sepolia during judging.** Run `npm run round:daemon` (pot from `ROUND_POT_ETH`, funded deployer key) so the public app is actually playable and the pot is real. Confirm the daemon points at the address in `deployments/sepolia.json`.
- [ ] **Record the ≤4:00 demo video** following `docs/demo-video-script.md` (updated for the certificate UI). Stage everything per the shot checklist; do not fake the KMS-wait states.
- [ ] **Fill the submission page**: play URL + repo + contract address (`0x5246befd9bc31b44d90e274c758cce3d24a0490f`) + the tooling write-up in `feedback.md` (a plus for the sponsor track).

## Should-have (visible in the demo)

- [x] **Paid modal shows the revealed word.** The "Pot Claimed" modal now renders a fillable `.reveal-slot`; the `"revealed"` handler in `frontend/src/main.ts` calls `fillRevealedWord()` so the word appears once the KMS reveal lands (covered by `frontend/src/ui/modals.test.ts`).
- [ ] **(Optional, great on camera) Surface the 5 secret handle hashes** on the seal panel (hover/click) so "five encrypted handles" is tangible in the hook. No such tooltip exists today; the original script assumed one.

## Tests (now in place)

- [x] **Unit** — `npm run test:unit` (word-list integrity + letter codec) and `cd frontend && npm test` (Vitest + jsdom: store, DOM renderer, certificate modals).
- [x] **Integration** — `npm test` (unchanged: 10 end-to-end tests against the real Nox Docker stack).
- [x] **E2E** — `cd frontend && npm run test:e2e` (Playwright smoke of the UI shell). Future: a wallet/chain-mocked e2e to drive the full guess→win→claim flow in-browser.

## Nice-to-have

- [ ] **Prod build sanity**: confirm fonts (Google Fonts), confetti and all modals render in the hosted `frontend/dist`; if the host injects a strict CSP, allow `fonts.googleapis.com`/`fonts.gstatic.com`.
- [ ] **Refresh README media**: the committed screenshots under `CryptoWordle design improvement/` include `08/09-OLD-design-*` (pre-redesign); add a current certificate-UI shot to `README.md` if judges skim it.
