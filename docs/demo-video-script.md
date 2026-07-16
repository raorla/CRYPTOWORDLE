# CryptoWordle — demo video script (≤ 4:00)

Target runtime: **3:50**. One continuous screen recording with a webcam bubble optional; voice-over throughout. Record at 1080p, browser at 125% zoom so calldata and event fields are legible. Record in the **default light "specimen paper" theme** — the certificate/banknote look reads best there (optionally flip the ☾ theme toggle once, briefly). Have everything pre-staged (see shot checklist at the end) so no beat waits on the chain.

Conventions: **[SCREEN]** = what's on screen, **[DO]** = presenter action, **VO** = exact spoken line.

> UI note (post-redesign): the app now uses the "Treasury Certificate" look — a gold wax **seal** panel (right) reading **WORD SEALED IN A TEE**, a **THE POT** panel (left) with the Cinzel pot figure, and a board of engraved **stamped tiles**. There is **no emoji anywhere in the UI**. Guesses are submitted with the **gold ENTER key** (on-screen) or the physical Enter. Wins pop a **"Certificate of Claim"** modal; claiming pops a **"Pot Claimed"** modal.

---

## 0:00 — The hook

**[SCREEN]** The CryptoWordle board, mid-round, in the light certificate theme: a couple of played rows showing stamped grey/ochre/green tiles, the **THE POT** figure on the left, and the gold **WORD SEALED IN A TEE** seal (its ring breathing a soft gold glow) on the right. No cursor movement yet.

**VO:**
> "This is Wordle. Except the word is encrypted inside a TEE and nobody on Earth can read it — not the server, not the devs, not the chain. It lives on Ethereum Sepolia as five encrypted handles in iExec's Nox confidential compute layer, and the only thing that ever comes out… is the colors."

**[DO]** At "five encrypted handles", let the cursor rest on the gold seal and its copy — *"…while the round is live, nobody can read it — not the server, not the devs, not us"* — then the **LEDGER** panel below it (Contract `0x5246…490f`, Enclave `Intel TDX`).

---

## 0:20 — The dApp, and a live guess

**[SCREEN]** Full app view. Point out, in order: the pot (**THE POT** figure — "0.01 ETH to whoever guesses it"), the **ROUND ENDS** countdown, and the seal.

**VO:**
> "Every round has a real ETH pot. The word was picked by a generator that encrypted it straight into the TEE and threw the plaintext away — and you don't have to take our word for that; hold that thought."

**[DO]** Type a real guess (pick one that will yield at least one ochre/present and one green against the staged secret — verify beforehand). Press the **gold ENTER key** (or Enter). MetaMask pops.

**VO (while MetaMask is open):**
> "My guess is public — I typed it, it goes in calldata. Note the gas: wallets can't estimate transactions that touch encrypted ops, so the app sets it explicitly."

**[DO]** Confirm. The status line runs through its stages and the pending row shows the **gold scanline shimmer**; let both be clearly visible:
1. *"Computing hints on ciphertext in the TEE…"*
2. *"Decrypting colours via the KMS…"*

**VO (over the pending states):**
> "On-chain, my guess is being compared letter-by-letter against the secret — about ninety-five operations, all on ciphertext, executed inside an Intel TDX enclave. Then the KMS decrypts exactly five values: the colors. Nothing else."

**[DO]** The colors land — the tiles **stamp in** one by one (grey/ochre/green, each with its corner mark ×/≈/✓) and the matching keyboard keys colour.

**VO:**
> "Green, present, absent — stamped like a certificate. Hints out, word still sealed."

---

## 1:30 — Etherscan: nothing leaks

**[SCREEN]** Switch tab to the guess transaction on Sepolia Etherscan (pre-opened).

**[DO]** Scroll to **Input Data**, click *Decode*. Point at the `letters` array.

**VO:**
> "Here's that guess transaction on Etherscan. In the calldata: my five letters — public, as expected."

**[DO]** Scroll to the **Logs** tab. Point at the `Guessed` event: `colorHandles` and `winHandle` fields — five 32-byte values.

**VO:**
> "And in the events: only handles. Opaque thirty-two-byte pointers. No letter of the secret appears anywhere in this transaction — or any transaction. You can grep the whole chain; the word simply isn't on it. And on the Nox contract you can check the secret's access list: the only address allowed to touch it is the game contract itself."

**[DO]** (Optional, if pacing allows, ≤5s) Flash the pre-opened NoxCompute `isPubliclyDecryptable` read returning `false` for a secret handle.

---

## 2:15 — The win

**[SCREEN]** Back to the app. The staged winning row is ready to submit (or fast-cut: submit the winning word, jump-cut through the pending states).

**[DO]** Submit the correct word. Pending states → all five tiles **stamp green** (winning-row glow) → **gold/green/ivory confetti** → the status line reads *"All green — the vault is yours. Claim the pot."*

**VO (as the greens land):**
> "And when you find it — all five green."

**[SCREEN]** The **"Certificate of Claim"** modal appears: kicker *"Round № N · KMS-signed"*, the winning word as five green stamped tiles, the pot figure in gold, and a **CLAIM THE POT** button.

**[DO]** Click **CLAIM THE POT**. MetaMask pops; confirm. On success the **"Pot Claimed"** modal appears (and/or show the balance change), then cut to the claim transaction on Etherscan (pre-opened tab), highlighting the `RoundSolved` event and the pot transfer to the winner.

**VO:**
> "The payout is trustless: the KMS signs a decryption proof that the win flag is true, and the contract verifies that signature on-chain before releasing the pot — so anyone can submit the claim, but the money can only ever go to the player who made the winning guess. No admin key, no oracle, no trust."

---

## 3:00 — Post-round reveal: prove the game was honest

**[SCREEN]** The app's settled view: the gold seal has **flipped to its unsealed state** — a green ring with a ✓ and the caption **UNSEALED — IT WAS "…"** — the solved row sits green on the board, and the status line reads *"Round settled — the word is unsealed for audit."*

**[DO]** Show the unsealed seal and the revealed word. Talk through the audit: anyone can now publicly decrypt the secret and replay every hint of the round against it.

**VO:**
> "Round over — and now the secret itself becomes publicly decryptable. Anyone can decrypt it and replay every hint from the whole round against it. If we had ever lied — wrong word, rigged hints — this is where it would show, publicly and permanently. That's the answer to 'trust the server': you don't have to."

---

## 3:30 — Share and close

**[SCREEN]** The **"Pot Claimed"** certificate modal: the revealed word in green stamped tiles, a **payout tx ↗** micro-link, and the **Share on 𝕏** button. Click it; the pre-filled X post appears tagging **@iEx_ec** — note the post itself carries the emoji-square grid (⬜🟨🟩) of the winning game.

**VO:**
> "Your result, your proof, your pot — and a share card for the flex. CryptoWordle: built on iExec Nox, tested end-to-end against a real TEE stack, and provably fair — because the only thing that ever leaves the enclave is the colors. Come play; the pot's live."

**[SCREEN]** End card (2s): play URL + repo URL + contract address + "iExec WTF hackathon".

---

## Shot checklist (stage before recording)

- [ ] Round generator daemon running; a fresh round open with a visible pot, **and you know the secret** (create this demo round yourself with `service` tooling so the win is schedulable — say nothing false on camera: the production rounds are generator-made).
- [ ] A losing-but-colorful guess word chosen and pre-verified against the demo secret (≥1 green, ≥1 present/ochre).
- [ ] App in the **default light "specimen paper" theme**; MetaMask on Sepolia, funded, unlocked, single account visible; hide other extensions.
- [ ] Pre-opened tabs, in order: ① dApp, ② guess tx on Etherscan (from a rehearsal run — swap for the live one if timing allows), ③ claim tx on Etherscan, ④ NoxCompute read-contract page with a secret handle pasted into `isPubliclyDecryptable`.
- [ ] Rehearse the KMS wait once at the same time of day; if Sepolia decryption runs long, record the pending states (gold scanline) in real time and jump-cut — do not fake the states.
- [ ] Confetti (gold/green/ivory) + the **Certificate of Claim** and **Pot Claimed** modals + **Share on 𝕏** all working in the frontend build being recorded.
- [ ] Reveal beat: after claiming, close the **Pot Claimed** modal so the **unsealed seal** + green solved row are on screen for the 3:00 segment. *(If the Pot Claimed modal still reads "Unsealing the word from the TEE…", that reveal is shown via the seal panel behind it — see TODO.)*
- [ ] Browser zoom 125%, 1080p capture, OS notifications off, mic check.
- [ ] Timer visible to presenter; hard stop at 4:00.
