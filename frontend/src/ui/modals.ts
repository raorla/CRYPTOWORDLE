import { ETHERSCAN } from "../config.ts";
import { buildShareText, claimPot, shareOnX } from "../game.ts";
import { getState } from "../state.ts";

const root = () => document.getElementById("modal-root")!;

function open(html: string): HTMLElement {
  close();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
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

function revealedWordHtml(word: string | null): string {
  if (!word) return `<p class="modal-sub">Unsealing the word from the TEE…</p>`;
  return `<div class="revealed-word">${[...word]
    .map((l) => `<div class="tile c2" data-sym="✓">${l.toUpperCase()}</div>`)
    .join("")}</div>`;
}

export function showWinModal(): void {
  const s = getState();
  const pot = s.round ? `${Number(s.round.pot) / 1e18} ETH` : "the pot";
  const backdrop = open(`
    <h2>🏆 You cracked the vault!</h2>
    <p class="modal-sub">
      Your row went all-green inside the TEE. The win is a KMS-signed fact —
      claim it and the contract verifies the proof <em>on-chain</em>, then pays
      you <strong>${pot}</strong>. Nobody can take it from you.
    </p>
    <button class="btn-primary" id="modal-claim">Claim ${pot}</button>
    <button class="btn-secondary" id="modal-later">Later</button>
  `);
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
  const grid = buildShareText().split("\n\n")[1] ?? "";
  const backdrop = open(`
    <h2>💰 Pot claimed!</h2>
    <p class="modal-sub">Proof verified on-chain. The word is now unsealed for everyone to audit:</p>
    ${revealedWordHtml(s.round?.revealedWord ?? null)}
    <div class="emoji-grid">${grid}</div>
    <button class="btn-primary" id="modal-share">Share on 𝕏</button>
    <button class="btn-secondary" id="modal-close">Close</button>
    <a class="tx-link" href="${ETHERSCAN}/tx/${txHash}" target="_blank" rel="noopener">payout tx ↗</a>
  `);
  backdrop.querySelector("#modal-share")!.addEventListener("click", () => shareOnX());
  backdrop.querySelector("#modal-close")!.addEventListener("click", close);
}

export function showRoundOverModal(kind: "solved-by-other" | "expired", word: string | null): void {
  const s = getState();
  const title = kind === "solved-by-other" ? "🔓 Vault cracked!" : "⌛ Round expired";
  const sub =
    kind === "solved-by-other"
      ? `Another player found the word and took the pot. The secret is unsealed — check the hints you got were honest.`
      : `Nobody found the word in time. The pot returns to the round creator and the secret is unsealed for audit.`;
  const grid = s.myRows.length
    ? `<div class="emoji-grid">${s.myRows
        .map((r) => r.colors.map((c) => (c === 2 ? "🟩" : c === 1 ? "🟨" : "⬜")).join(""))
        .join("\n")}</div>`
    : "";
  const backdrop = open(`
    <h2>${title}</h2>
    <p class="modal-sub">${sub}</p>
    ${revealedWordHtml(word)}
    ${grid}
    <button class="btn-primary" id="modal-close2">Wait for the next round</button>
  `);
  backdrop.querySelector("#modal-close2")!.addEventListener("click", close);
}

export function showHelpModal(): void {
  open(`
    <h2>How to play</h2>
    <p class="modal-sub" style="text-align:left">
      Guess the 5-letter word in 6 tries. 🟩 right letter, right spot ·
      🟨 letter is in the word · ⬜ not in the word.<br/><br/>
      The twist: the secret lives <strong>encrypted inside a TEE</strong>
      (iExec Nox). The blockchain, the server, even the developers cannot read
      it — your hints are computed <em>on ciphertext</em> and only the colors
      are decrypted. First correct guess wins the ETH pot, verified on-chain
      with a KMS proof. When the round ends, the word is unsealed so anyone
      can audit that every hint was honest.<br/><br/>
      <strong>Symbols</strong> (color-blind safe): ✓ correct · ≈ present · × absent.
    </p>
    <button class="btn-primary" id="modal-help-close">Got it</button>
  `).querySelector("#modal-help-close")!.addEventListener("click", close);
}

export function showNotDeployedModal(): void {
  open(`
    <h2>🚧 Not deployed yet</h2>
    <p class="modal-sub">
      The CryptoWordle contract address is missing. Run
      <code>npm run deploy:sepolia</code> in the repo root, then rebuild the
      frontend.
    </p>
  `);
}
