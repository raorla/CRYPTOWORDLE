# CryptoWordle — demo video script (≤ 4:00)

Target runtime: **3:50**. One continuous screen recording, webcam bubble optional, voice-over throughout. Record at 1080p, browser at 125% zoom so calldata and event fields are legible. Record in the **default light "specimen paper" theme**; the certificate look reads best there (optionally flip the ☾ toggle once, briefly). Have everything pre-staged (shot checklist at the end) so no beat waits on the chain.

Conventions: **[SCREEN]** = what's on screen, **[DO]** = presenter action, **VO** = exact spoken line.

> UI note: the app is a "Treasury Certificate". Gold wax **seal** panel (right) reading **WORD SEALED IN A TEE**, with an **Inspect the vault** micro-link under it. **THE POT** panel (left) with the Cinzel pot figure, and a **LEDGER** panel below it (contract, house treasury, enclave, ops per guess). Under the board, the **Enclave Docket**: an I–IV stepper (*Guess submitted / Transaction mined / TDX enclave · ≈95 ciphertext ops / KMS decrypting colours*). In the header, **≣** opens the **Hall of Records**. No emoji anywhere in the UI. Guesses go in with the **gold ENTER key** or physical Enter. Wins pop a **"Certificate of Claim"** modal; claiming pops **"Pot Claimed"**.

---

## 0:00 — The hook: The Sealing

**[SCREEN]** Open the app in a fresh session (see checklist) so the intro ceremony plays: wordmark, the engraving disc, five "?" tiles, then the gold seal **slams** and the caption lands: **THE WORD IS SEALED · NOT THE CHAIN · NOT THE SERVER · NOT US**, with **ROUND № N · IN SESSION** under it. Hold on **PRESS ANY KEY TO ENTER**.

**VO:**
> "This is Wordle. Except the word is encrypted inside a TEE, and nobody on Earth can read it… not the server, not the devs, not the chain. That seal didn't slam on a timer; it slammed because the app just read the live round from Ethereum Sepolia. The word sits there as five encrypted handles in iExec's Nox confidential compute layer, and the only thing that ever comes out is the colors."

**[DO]** At "the only thing that ever comes out", press a key. The veil lifts onto the board.

---

## 0:25 — The dApp, the vault, and a live guess

**[SCREEN]** Full app view. Point out, in order: **THE POT** ("0.01 ETH to whoever guesses it"), the **ROUND ENDS** countdown, then the **LEDGER** panel: contract `0xaa6f…9fc9`, **House treasury** (the bankroll is on-chain too), Enclave `Intel TDX`, `≈ 95 on ciphertext` ops per guess.

**VO:**
> "Every round has a real ETH pot, escrowed by the contract, funded from an on-chain treasury. The word was picked by a generator that encrypted it straight into the TEE and threw the plaintext away. And you don't have to take our word for it."

**[DO]** Click **Inspect the vault** under the seal. The modal lists the five sealed `bytes32` handles, live from the chain, captioned *"This is everything the chain knows about the word."* Hold 4 seconds, then close with **Sealed it stays**.

**VO (over the vault modal):**
> "These five handles are everything the chain knows about the word. You are looking at the secret right now… and you still can't read it. Neither can we."

**[DO]** Type a real guess (pre-verified to yield at least one ochre and one green against the staged secret). Press the **gold ENTER key**. MetaMask pops.

**VO (while MetaMask is open):**
> "My guess is public. I typed it; it goes in calldata. Note the gas: wallets can't estimate transactions that touch encrypted ops, so the app sets it explicitly."

**[DO]** Confirm. Let the **Enclave Docket** under the board carry the wait: step I stamps ✓ (*Guess submitted*), then II (*Transaction mined*), then III glows with the gold scanline (*TDX enclave · ≈95 ciphertext ops*), then IV (*KMS decrypting colours*). The pending row shimmers above it.

**VO (over the docket):**
> "Watch the docket. On-chain, my guess is being compared letter by letter against the secret: about ninety-five operations, all on ciphertext, executed inside an Intel TDX enclave. Then the KMS decrypts exactly five values. The colors. Nothing else."

**[DO]** The colors land; the tiles **stamp in** one by one (grey/ochre/green with their ×/≈/✓ corner marks) and the keyboard keys colour.

**VO:**
> "Green, present, absent. Stamped like a certificate. Hints out, word still sealed."

---

## 1:35 — Etherscan: nothing leaks

**[SCREEN]** Switch tab to the guess transaction on Sepolia Etherscan (pre-opened).

**[DO]** Scroll to **Input Data**, click *Decode*. Point at the `letters` array.

**VO:**
> "Here's that guess transaction on Etherscan. In the calldata: my five letters, public, as expected."

**[DO]** Scroll to the **Logs** tab. Point at the `Guessed` event: `colorHandles` and `winHandle`, five 32-byte values.

**VO:**
> "And in the events: only handles. Opaque thirty-two-byte pointers. No letter of the secret appears in this transaction, or any transaction. You can grep the whole chain; the word simply isn't on it. And on the Nox contract you can check the secret's access list: the only address allowed to touch it is the game contract itself."

**[DO]** (Optional, ≤5s if pacing allows) Flash the pre-opened NoxCompute `isPubliclyDecryptable` read returning `false` for one of the handles you just showed in the vault.

---

## 2:15 — The win

**[SCREEN]** Back to the app. The staged winning row is ready to submit (or fast-cut: submit the winning word, jump-cut through the docket states).

**[DO]** Submit the correct word. Docket runs → all five tiles **stamp green** (winning-row glow) → **gold/green/ivory confetti** → status line: *"All green — the vault is yours. Claim the pot."*

**VO (as the greens land):**
> "And when you find it… all five green."

**[SCREEN]** The **"Certificate of Claim"** modal: kicker *"Round № N · KMS-signed"*, the winning word in green stamped tiles, the pot figure in gold, a **CLAIM THE POT** button.

**[DO]** Click **CLAIM THE POT**. MetaMask pops; confirm. On success the **"Pot Claimed"** modal appears. Cut briefly to the claim transaction on Etherscan (pre-opened), highlighting the `RoundSolved` event and the pot transfer to the winner.

**VO:**
> "The payout is trustless. The KMS signs a decryption proof that the win flag is true, and the contract verifies that signature on-chain before releasing the pot. Anyone can submit the claim, but the money can only ever go to the player who made the winning guess. No admin key, no oracle, no trust."

---

## 3:00 — Post-round: the app audits itself

**[SCREEN]** The settled view. The gold seal has flipped to its **unsealed** state: green ring, caption *"Unsealed — it was "…""*, and under it the audit line stamps in: *"✓ every hint verified — 10 colours replayed"* (count depends on your rows). Status line: *"Round settled — the word is unsealed for audit."*

**VO:**
> "Round over, and the secret itself becomes publicly decryptable. But look at that line: the app didn't just reveal the word. It replayed every colour it was ever shown against the unsealed answer, in your own browser, and stamped the verdict. If we had lied… wrong word, rigged hints… this is where it would show, on your screen, publicly and permanently. That's the answer to 'trust the server': you don't have to."

---

## 3:30 — Records, share, close

**[SCREEN]** The **"Pot Claimed"** modal: the revealed word in green tiles, the same audit strip, a **payout tx ↗** micro-link, the **Share on 𝕏** button. Click Share; the pre-filled X post appears tagging **@iEx_ec**, carrying the emoji-square grid of the winning game.

**[DO]** Close the modal, click **≣** in the header. The **Hall of Records** opens: *Rounds struck*, *ETH in live pots*, *Words unsealed*, then *"Champions — by pots claimed"* and the full round archive. Hold 3 seconds.

**VO:**
> "Every round ever played, every champion, every pot in escrow, all read straight from the chain. CryptoWordle: built on iExec Nox, tested end to end against a real TEE stack, and provably fair, because the only thing that ever leaves the enclave is the colors. Come play. The pot's live."

**[SCREEN]** End card (2s):
> **Play: raorla.github.io/CRYPTOWORDLE** · **Code: github.com/raorla/CRYPTOWORDLE** · Contract `0xaa6f76b4dc7d2df17ff73c7162523f0985289fc9` (ETH Sepolia) · iExec WTF hackathon

---

## Shot checklist (stage before recording)

- [ ] **Fresh session for the intro**: The Sealing only plays once per browser session. Record in a fresh incognito window, or run `sessionStorage.removeItem("cw-intro-seen")` and reload. Verify the seal slam lands before you hit record for real.
- [ ] Round daemon paused during staging so your demo round stays the featured one (`./daemon-ctl.sh stop`, restart it after). Create the demo round yourself with the `service` tooling **so you know the secret** and the win is schedulable; say nothing false on camera, production rounds are generator-made.
- [ ] A losing-but-colorful guess word chosen and pre-verified against the demo secret (≥1 green, ≥1 present/ochre).
- [ ] **The audit line needs your own rows**: it replays the colours *you* were shown, so the recording wallet must have played the guesses. Spectators get no audit strip.
- [ ] App in the **default light theme**; MetaMask on Sepolia, funded, unlocked, single account visible; other extensions hidden.
- [ ] Pre-opened tabs, in order: ① dApp, ② guess tx on Etherscan (from a rehearsal run; swap for the live one if timing allows), ③ claim tx on Etherscan, ④ NoxCompute read-contract page with one secret handle pasted into `isPubliclyDecryptable`.
- [ ] Rehearse the KMS wait once at the same time of day. If Sepolia decryption runs long, record the docket states in real time and jump-cut; **do not fake the states**.
- [ ] Confetti, the **Certificate of Claim** / **Pot Claimed** modals, the audit strip and **Share on 𝕏** all verified in the exact frontend build being recorded (record against the live Pages URL: it is the same artifact the judges will click).
- [ ] Reveal beat: after claiming, close the **Pot Claimed** modal so the unsealed seal, the green solved row and the audit line are all on screen for the 3:00 segment.
- [ ] Browser zoom 125%, 1080p capture, OS notifications off, mic check.
- [ ] Timer visible to presenter; hard stop at 4:00.
