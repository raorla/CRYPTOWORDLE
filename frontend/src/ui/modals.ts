import { CONTRACT_ADDRESS, ETHERSCAN } from "../config.ts";
import { claimPot, shareOnX } from "../game.ts";
import { getState } from "../state.ts";

const root = () => document.getElementById("modal-root")!;

function open(html: string, frameGold = false): HTMLElement {
  close();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<div class="modal${frameGold ? " frame-gold" : ""}" role="dialog" aria-modal="true">${html}</div>`;
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  root().appendChild(backdrop);
  document.addEventListener("keydown", escClose);
  return backdrop;
}

export function close(): void {
  root().innerHTML = "";
  document.removeEventListener("keydown", escClose);
}

function escClose(e: KeyboardEvent): void {
  if (e.key === "Escape") close();
}

/** The winning / revealed word as five green "stamped" certificate tiles. */
function stampWordHtml(word: string): string {
  return `<div class="stamp-word">${[...word]
    .map((l) => `<div class="stamp-tile">${l.toUpperCase()}</div>`)
    .join("")}</div>`;
}

function revealedWordHtml(word: string | null): string {
  if (!word) return `<p class="modal-sub">Unsealing the word from the TEE…</p>`;
  return stampWordHtml(word);
}

export function showWinModal(): void {
  const s = getState();
  const potEth = s.round ? `${Number(s.round.pot) / 1e18}` : "";
  const roundId = s.round ? String(s.round.id) : "?";
  const winWord = s.myRows.find((r) => r.win)?.letters ?? null;
  const backdrop = open(
    `
    <div class="modal-kicker">✦&nbsp;&nbsp;Round № ${roundId} · KMS-signed&nbsp;&nbsp;✦</div>
    <h2>Certificate of Claim</h2>
    <p class="modal-sub">
      This certifies that the bearer produced an <strong class="green">all-green row</strong>
      inside the enclave. The proof is verified on-chain — the pot pays your wallet directly.
      Nobody can take it from you.
    </p>
    ${winWord ? stampWordHtml(winWord) : ""}
    <div class="pot-line">${potEth} <span class="unit">ETH</span></div>
    <button class="btn-primary" id="modal-claim">Claim the pot</button>
    <button class="btn-secondary" id="modal-later">Later</button>
  `,
    true,
  );
  backdrop.querySelector("#modal-claim")!.addEventListener("click", async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = "Claiming…";
    close();
    await claimPot();
  });
  backdrop.querySelector("#modal-later")!.addEventListener("click", close);
}

export function showPaidModal(txHash: string): void {
  const s = getState();
  const roundId = s.round ? String(s.round.id) : "?";
  const backdrop = open(
    `
    <div class="modal-kicker">✦&nbsp;&nbsp;Round № ${roundId} · Claimed&nbsp;&nbsp;✦</div>
    <h2>Pot Claimed</h2>
    <p class="modal-sub">Proof verified on-chain. The word is now unsealed for everyone to audit.</p>
    ${revealedWordHtml(s.round?.revealedWord ?? null)}
    <button class="btn-primary" id="modal-share">Share on 𝕏</button>
    <button class="btn-secondary" id="modal-close">Close</button>
    <a class="tx-link" href="${ETHERSCAN}/tx/${txHash}" target="_blank" rel="noopener">payout tx ↗</a>
  `,
    true,
  );
  backdrop.querySelector("#modal-share")!.addEventListener("click", () => shareOnX());
  backdrop.querySelector("#modal-close")!.addEventListener("click", close);
}

export function showRoundOverModal(kind: "solved-by-other" | "expired", word: string | null): void {
  const s = getState();
  const roundId = s.round ? String(s.round.id) : "?";
  const sub =
    kind === "solved-by-other"
      ? `Another player cracked the word and took the pot. The secret is unsealed for everyone — replay your hints against it and check every colour was honest.`
      : `Nobody found the word in time. The pot returns to the round creator and the secret is unsealed — replay your hints against it and check every colour was honest.`;
  open(`
    <div class="modal-kicker">✦&nbsp;&nbsp;Round № ${roundId} · Settled&nbsp;&nbsp;✦</div>
    <h2>The Vault Is Open</h2>
    <p class="modal-sub">${sub}</p>
    ${revealedWordHtml(word)}
    <button class="btn-primary compact" id="modal-close2">Wait for the next round</button>
    <a class="tx-link" href="${ETHERSCAN}/address/${CONTRACT_ADDRESS}" target="_blank" rel="noopener">audit on etherscan ↗</a>
  `).querySelector("#modal-close2")!.addEventListener("click", close);
}

export function showHelpModal(): void {
  open(`
    <div class="modal-kicker">✦&nbsp;&nbsp;Rules of play&nbsp;&nbsp;✦</div>
    <h2 class="title-light">How to Play</h2>
    <p class="modal-sub body-left">
      Guess the five-letter word in six tries. Six guesses per wallet, per round.
      First all-green row takes the pot.
    </p>
    <div class="legend-tiles">
      <div class="stamp-tile">✓</div>
      <div class="stamp-tile c1">≈</div>
      <div class="stamp-tile c0">×</div>
    </div>
    <p class="legend-caption">✓ right letter, right spot · ≈ in the word · × absent</p>
    <div class="modal-divider"></div>
    <p class="modal-sub body-left">
      The twist: the secret lives <strong>encrypted inside a TEE</strong> (iExec Nox).
      The chain, the server, even the developers cannot read it — hints are computed
      <em>on ciphertext</em> and only the colours decrypt. Wins are verified on-chain
      with a KMS proof, and when the round ends the word is unsealed so anyone can
      audit every hint.
    </p>
    <button class="btn-primary compact" id="modal-help-close">Got it</button>
  `).querySelector("#modal-help-close")!.addEventListener("click", close);
}

export function showNotDeployedModal(): void {
  open(`
    <div class="modal-kicker">✦&nbsp;&nbsp;Setup&nbsp;&nbsp;✦</div>
    <h2 class="title-light">Not Deployed Yet</h2>
    <p class="modal-sub">
      The CryptoWordle contract address is missing. Run
      <code>npm run deploy:sepolia</code> in the repo root, then rebuild the frontend.
    </p>
  `);
}
