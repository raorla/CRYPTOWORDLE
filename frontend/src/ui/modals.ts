import { BLOCKSCOUT, CONTRACT_ADDRESS, ETHERSCAN } from "../config.ts";
import { claimPot, shareOnX } from "../game.ts";
import {
  ethLabel,
  fetchRecords,
  fetchSecretHandles,
  shortAddress,
  shortHandle,
  type Records,
} from "../records.ts";
import { getState } from "../state.ts";

const root = () => document.getElementById("modal-root")!;

/** Element focused before the modal opened, so focus can be restored on close. */
let lastFocused: HTMLElement | null = null;

function open(html: string, frameGold = false, extraClass = ""): HTMLElement {
  close();
  lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  const classes = ["modal", frameGold ? "frame-gold" : "", extraClass].filter(Boolean).join(" ");
  backdrop.innerHTML = `<div class="${classes}" role="dialog" aria-modal="true" tabindex="-1">${html}</div>`;
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  root().appendChild(backdrop);
  document.addEventListener("keydown", onModalKeydown, true);
  // Move focus into the dialog (primary action first) so keyboard and screen
  // reader users land inside it, not on the page behind.
  const focusables = modalFocusables(backdrop);
  (focusables[0] ?? backdrop.querySelector<HTMLElement>(".modal"))?.focus();
  return backdrop;
}

export function close(): void {
  const wasOpen = root().childElementCount > 0;
  root().innerHTML = "";
  document.removeEventListener("keydown", onModalKeydown, true);
  if (wasOpen && lastFocused) lastFocused.focus?.();
  lastFocused = null;
  // The records modal is hash-routed (#records): every close path — Escape,
  // backdrop, buttons — clears the hash. replaceState fires no hashchange,
  // so there are no re-entry loops to guard against.
  if (location.hash === "#records") {
    history.replaceState(null, "", location.pathname + location.search);
  }
}

function modalFocusables(scope: HTMLElement): HTMLElement[] {
  return Array.from(
    scope.querySelectorAll<HTMLElement>(
      'button, a[href], input, [tabindex]:not([tabindex="-1"])',
    ),
  );
}

/** Escape to close, and trap Tab within the open dialog. */
function onModalKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    close();
    return;
  }
  if (e.key !== "Tab") return;
  const backdrop = root().querySelector<HTMLElement>(".modal-backdrop");
  if (!backdrop) return;
  const items = modalFocusables(backdrop);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
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

/**
 * A revealed-word placeholder that can be filled in later. Modals opened before
 * the KMS reveal resolves (e.g. the winner's "Pot Claimed") render the "Unsealing…"
 * text, then `fillRevealedWord` swaps in the stamped word once it lands.
 */
function revealSlotHtml(word: string | null): string {
  return `<div class="reveal-slot">${revealedWordHtml(word)}</div>`;
}

/**
 * The independent-audit strip: the local replay of every decrypted colour
 * against the unsealed word (state.audit, computed in game.ts). Empty when
 * there is nothing to audit — a spectator who never guessed.
 */
export function auditStripHtml(): string {
  const audit = getState().audit;
  if (!audit || audit.colorsChecked === 0) return `<div class="audit-slot"></div>`;
  const failed = !audit.honest;
  const verdict = failed
    ? "Audit failed — colours do not match the unsealed word"
    : `${audit.colorsChecked} of ${audit.colorsChecked} colours verified honest`;
  return `
    <div class="audit-slot">
      <div class="audit-strip${failed ? " failed" : ""}">
        <div class="audit-label">Independent audit — replayed in your browser</div>
        <div class="audit-verdict${failed ? " failed" : ""}">${failed ? "✕" : "✓"} ${verdict}</div>
      </div>
    </div>`;
}

/** Fill any open modal's reveal + audit slots once the KMS reveal lands. */
export function fillRevealedWord(word: string): void {
  const slot = document.querySelector<HTMLElement>(".modal .reveal-slot");
  if (slot) slot.innerHTML = stampWordHtml(word);
  const auditSlot = document.querySelector<HTMLElement>(".modal .audit-slot");
  if (auditSlot) auditSlot.outerHTML = auditStripHtml();
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
    ${revealSlotHtml(s.round?.revealedWord ?? null)}
    ${auditStripHtml()}
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
    ${revealSlotHtml(word)}
    ${auditStripHtml()}
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

// ---------------------------------------------------------------------------
// Hall of Records — every figure read live from the contract
// ---------------------------------------------------------------------------

const ROMANS = ["I.", "II.", "III.", "IV.", "V.", "VI.", "VII.", "VIII.", "IX.", "X."];
const CHAMPIONS_SHOWN = 10;

/** Pure renderer for the records body — exported for tests. */
export function recordsBodyHtml(records: Records, account: string | null): string {
  const honors = `
    <div class="honors">
      <div class="honor"><div class="honor-figure">${records.rounds.length}</div><div class="honor-label">Rounds struck</div></div>
      <div class="honor"><div class="honor-figure">${ethLabel(records.openPotWei)}</div><div class="honor-label">ETH in live pots</div></div>
      <div class="honor"><div class="honor-figure">${records.rounds.filter((r) => r.status !== 0).length}</div><div class="honor-label">Words unsealed</div></div>
    </div>`;

  const me = account?.toLowerCase() ?? null;
  const champions = records.champions.length
    ? `
    <div class="champ-rows">
      ${records.champions
        .slice(0, CHAMPIONS_SHOWN)
        .map((c, i) => {
          const isYou = me !== null && c.address.toLowerCase() === me;
          return `
        <div class="champ-row${i === 0 ? " first" : ""}${isYou ? " champ-you" : ""}">
          <span class="roman">${ROMANS[i] ?? `${i + 1}.`}</span>
          <span class="champ-addr"><a href="${ETHERSCAN}/address/${c.address}" target="_blank" rel="noopener">${shortAddress(c.address)}</a>${isYou ? `<span class="you-tag">You</span>` : ""}</span>
          <span class="champ-wins">${c.wins} ${c.wins === 1 ? "win" : "wins"}</span>
          <span class="champ-eth">last · № ${c.lastWinRound}</span>
        </div>`;
        })
        .join("")}
    </div>
    ${records.champions.length > CHAMPIONS_SHOWN ? `<p class="more-line">— and ${records.champions.length - CHAMPIONS_SHOWN} more —</p>` : ""}`
    : `
    <div class="empty-ring">?</div>
    <div class="empty-label">No champions yet</div>
    <p class="modal-sub" style="text-align:center">The first all-green row in history is still unclaimed. It could bear your address.</p>`;

  const archive = records.rounds.length
    ? `
    <div class="table-scroll">
      <table class="archive">
        <thead><tr><th>№</th><th>Status</th><th>Pot</th><th>Winner</th><th>Guesses</th></tr></thead>
        <tbody>
          ${records.rounds
            .map((r) => {
              const chip =
                r.status === 1
                  ? `<span class="chip chip-solved">Solved</span>`
                  : r.status === 2
                    ? `<span class="chip chip-expired">Expired</span>`
                    : `<span class="chip chip-open">Open</span>`;
              const winner =
                r.status === 1
                  ? `<a href="${ETHERSCAN}/address/${r.winner}" target="_blank" rel="noopener">${shortAddress(r.winner)}</a>`
                  : "—";
              // The contract zeroes the pot when a round settles — show the
              // live escrow for open rounds, "paid out" otherwise.
              const pot =
                r.status === 0 ? `${ethLabel(r.pot)} ETH` : r.status === 1 ? "paid out" : "refunded";
              return `<tr><td>${r.id}</td><td>${chip}</td><td>${pot}</td><td>${winner}</td><td>${r.guessCount}</td></tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>`
    : `<p class="modal-sub" style="text-align:center">The first round is being sealed.</p>`;

  return `
    ${honors}
    <div class="label-rule"><span class="rule"></span><span class="panel-label">Champions — by pots claimed</span><span class="rule"></span></div>
    ${champions}
    <div class="label-rule" style="margin-top:16px"><span class="rule"></span><span class="panel-label">The archive — every round ever struck</span><span class="rule"></span></div>
    ${archive}
    <p class="records-note">every figure read live from the contract · nothing indexed · nothing trusted</p>
    <button class="btn-primary compact" id="records-close">Return to the round</button>
    <a class="tx-link" href="${BLOCKSCOUT}/address/${CONTRACT_ADDRESS}" target="_blank" rel="noopener">audit the contract ↗</a>`;
}

const recordsLoadingHtml = `
  <div class="records-loading"><span class="spinner" aria-hidden="true"></span>Reading the ledger…</div>`;

function recordsErrorHtml(): string {
  return `
    <div class="records-loading">The ledger is unreachable</div>
    <button class="btn-secondary" id="records-retry">Consult again</button>`;
}

export function showRecordsModal(): void {
  const backdrop = open(
    `
    <div class="modal-kicker">✦&nbsp;&nbsp;Hall of Records · Eth Sepolia&nbsp;&nbsp;✦</div>
    <h2>The Registry</h2>
    <p class="modal-sub">Every round is settled on-chain. This register cannot be edited — not even by us.</p>
    <div id="records-body">${recordsLoadingHtml}</div>
  `,
    true,
    "modal-wide",
  );
  // AFTER open() — open() begins with close(), whose hash cleanup would undo
  // this. A real hash assignment (not replaceState) so the browser BACK
  // button closes the registry — the main.ts hashchange listener handles it.
  if (location.hash !== "#records") {
    location.hash = "records";
  }

  const fill = (force = false): void => {
    void fetchRecords(force)
      .then((records) => {
        const body = backdrop.querySelector<HTMLElement>("#records-body");
        if (!body) return; // modal was closed meanwhile
        body.innerHTML = recordsBodyHtml(records, getState().account);
        body.querySelector("#records-close")?.addEventListener("click", close);
      })
      .catch(() => {
        const body = backdrop.querySelector<HTMLElement>("#records-body");
        if (!body) return;
        body.innerHTML = recordsErrorHtml();
        body.querySelector("#records-retry")?.addEventListener("click", () => {
          body.innerHTML = recordsLoadingHtml;
          fill(true);
        });
      });
  };
  fill();
}

// ---------------------------------------------------------------------------
// The Vault Inspector — the secret, as the chain sees it
// ---------------------------------------------------------------------------

const handleCache = new Map<string, string[]>();

export function showVaultModal(roundId: bigint): void {
  const backdrop = open(
    `
    <div class="modal-kicker">✦&nbsp;&nbsp;Round № ${roundId} · The secret, as the chain sees it&nbsp;&nbsp;✦</div>
    <h2 class="title-light">The Sealed Letters</h2>
    <p class="modal-sub">
      Five encrypted handles hold the word — one letter each. While the round is live,
      the <strong>only</strong> principal on their access list is the game contract itself.
    </p>
    <div id="vault-body"><div class="records-loading"><span class="spinner" aria-hidden="true"></span>Reading the vault…</div></div>
    <p class="vault-caption">This is everything the chain knows about the word.<br/>You are looking at it — and you still cannot read it.</p>
    <button class="btn-primary compact" id="vault-close">Sealed it stays</button>
    <a class="tx-link" href="${BLOCKSCOUT}/address/${CONTRACT_ADDRESS}" target="_blank" rel="noopener">verify the ACL on-chain ↗</a>
  `,
    true,
  );
  backdrop.querySelector("#vault-close")?.addEventListener("click", close);

  const key = roundId.toString();
  const render = (handles: string[]): void => {
    const body = backdrop.querySelector<HTMLElement>("#vault-body");
    if (!body) return;
    body.innerHTML = `
      <div class="vault-rows">
        ${handles
          .map(
            (h, i) => `
          <div class="vault-row">
            <span class="roman">${ROMANS[i]}</span>
            <button class="vault-handle" data-handle="${h}" title="Copy the full handle">${shortHandle(h)}</button>
          </div>`,
          )
          .join("")}
      </div>`;
    body.querySelectorAll<HTMLElement>(".vault-handle").forEach((btn) => {
      btn.addEventListener("click", () => {
        void navigator.clipboard?.writeText(btn.dataset.handle ?? "").then(() => {
          btn.textContent = "copied";
          window.setTimeout(() => (btn.textContent = shortHandle(btn.dataset.handle ?? "")), 900);
        });
      });
    });
  };

  const cached = handleCache.get(key);
  if (cached) {
    render(cached);
    return;
  }
  void fetchSecretHandles(roundId)
    .then((handles) => {
      handleCache.set(key, handles);
      render(handles);
    })
    .catch(() => {
      const body = backdrop.querySelector<HTMLElement>("#vault-body");
      if (body) body.innerHTML = `<div class="records-loading">The vault is unreachable — try again</div>`;
    });
}
