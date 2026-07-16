import "./style.css";
import { connectWallet, disconnectWallet, hasWallet } from "./chain.ts";
import { BLOCKSCOUT, CONTRACT_ADDRESS, ETHERSCAN, isDeployed } from "./config.ts";
import {
  backspace,
  loadLatestRound,
  startPolling,
  submitGuess,
  typeLetter,
} from "./game.ts";
import { getState, subscribe, update } from "./state.ts";
import { events } from "./ui/events.ts";
import { launchConfetti } from "./ui/confetti.ts";
import {
  fillRevealedWord,
  showHelpModal,
  showNotDeployedModal,
  showPaidModal,
  showRoundOverModal,
  showWinModal,
} from "./ui/modals.ts";
import {
  buildGrid,
  buildKeyboard,
  renderBanner,
  renderCountdown,
  renderGrid,
  renderKeyboard,
  renderStatus,
  showToast,
} from "./ui/render.ts";
import { sfx, soundEnabled, toggleSound } from "./ui/sound.ts";
import { currentTheme, initTheme, toggleTheme } from "./ui/theme.ts";

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

initTheme();
buildGrid(document.getElementById("grid")!);
buildKeyboard(document.getElementById("keyboard")!, handleKey);

const connectBtn = document.getElementById("btn-connect") as HTMLButtonElement;
const soundBtn = document.getElementById("btn-sound") as HTMLButtonElement;
const themeBtn = document.getElementById("btn-theme") as HTMLButtonElement;
const helpBtn = document.getElementById("btn-help") as HTMLButtonElement;

soundBtn.textContent = soundEnabled() ? "♪" : "∅";
themeBtn.textContent = currentTheme() === "dark" ? "☾" : "☀";

const contractHref = `${ETHERSCAN}/address/${CONTRACT_ADDRESS}`;
const ledgerLink = document.getElementById("contract-link") as HTMLAnchorElement;
ledgerLink.href = contractHref;
ledgerLink.textContent = `${CONTRACT_ADDRESS.slice(0, 6)}…${CONTRACT_ADDRESS.slice(-4)} ↗`;
(document.getElementById("footer-contract-link") as HTMLAnchorElement).href = contractHref;
// "Is the money really there?" — one click to the source-verified explorer
// showing the contract's ETH balance and a Read Contract tab for getRound.
(document.getElementById("pot-proof-link") as HTMLAnchorElement).href =
  `${BLOCKSCOUT}/address/${CONTRACT_ADDRESS}`;

soundBtn.addEventListener("click", () => {
  soundBtn.textContent = toggleSound() ? "♪" : "∅";
});
themeBtn.addEventListener("click", () => {
  themeBtn.textContent = toggleTheme() === "dark" ? "☾" : "☀";
});
helpBtn.addEventListener("click", showHelpModal);

// The win/claim flow's only trigger is the certificate modal, shown once. If a
// claim fails (or the modal is dismissed), the phase returns to "won" — make
// the status line a persistent way back into the claim so the win is never a
// dead end.
const statusLine = document.getElementById("status-line")!;
statusLine.addEventListener("click", () => {
  if (getState().phase === "won") showWinModal();
});

// React to wallet account / network changes: the handle client is bound to one
// account+chain, so the simplest correct reset is a reload.
if (hasWallet() && window.ethereum?.on) {
  window.ethereum.on("accountsChanged", () => window.location.reload());
  window.ethereum.on("chainChanged", () => window.location.reload());
}

connectBtn.addEventListener("click", async () => {
  if (getState().account) {
    // Connected: the same button disconnects (labelled so on hover/focus).
    connectBtn.textContent = "Disconnecting…";
    await disconnectWallet();
    return;
  }
  try {
    connectBtn.textContent = "Connecting…";
    const account = await connectWallet();
    update({ account, phase: "idle", error: null });
    await loadLatestRound();
  } catch (error: any) {
    connectBtn.textContent = "Connect wallet";
    showToast(`${error?.shortMessage ?? error?.message ?? error}`.slice(0, 90));
  }
});

// While connected the button shows the address; reveal its second job on
// hover/focus so disconnecting is discoverable without cluttering the bar.
const showDisconnectHint = () => {
  if (getState().account) connectBtn.textContent = "Disconnect";
};
const hideDisconnectHint = () => {
  const account = getState().account;
  if (account) connectBtn.textContent = `${account.slice(0, 6)}…${account.slice(-4)}`;
};
connectBtn.addEventListener("mouseenter", showDisconnectHint);
connectBtn.addEventListener("focus", showDisconnectHint);
connectBtn.addEventListener("mouseleave", hideDisconnectHint);
connectBtn.addEventListener("blur", hideDisconnectHint);

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function handleKey(key: string): void {
  if (key === "Enter") {
    void submitGuess();
  } else if (key === "Backspace") {
    backspace();
  } else if (/^[a-z]$/.test(key)) {
    typeLetter(key);
  }
}

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.querySelector(".modal-backdrop")) return; // modal open
  // If an on-screen key has focus, let its own click handle Enter/Space —
  // otherwise the guess would be submitted twice (button click + this handler).
  const active = document.activeElement;
  if (
    active instanceof HTMLElement &&
    active.classList.contains("key") &&
    (e.key === "Enter" || e.key === " ")
  ) {
    return;
  }
  handleKey(e.key.length === 1 ? e.key.toLowerCase() : e.key);
});

// ---------------------------------------------------------------------------
// Reactive rendering
// ---------------------------------------------------------------------------

subscribe((state) => {
  renderGrid(state);
  renderKeyboard(state);
  renderBanner(state);
  renderStatus(state);

  const hintActive =
    connectBtn.matches(":hover") || document.activeElement === connectBtn;
  if (!(state.account && hintActive)) {
    // Don't clobber the "Disconnect" hover/focus hint mid-interaction.
    connectBtn.textContent = state.account
      ? `${state.account.slice(0, 6)}…${state.account.slice(-4)}`
      : "Connect wallet";
  }
  connectBtn.classList.toggle("connected", Boolean(state.account));
  connectBtn.setAttribute(
    "aria-label",
    state.account ? `Connected as ${state.account} — disconnect` : "Connect wallet",
  );

  if (state.error) {
    showToast(state.error);
    sfx.error();
    update({ error: null });
  }
});

window.setInterval(() => renderCountdown(getState()), 1000);

// Dev-only hook for driving state from the console / e2e tests.
if (import.meta.env.DEV) {
  (window as any).__cw = { getState, update };
}

// ---------------------------------------------------------------------------
// Game events → juice
// ---------------------------------------------------------------------------

events.on("key-tap", () => sfx.tap());
events.on("tile-color", ({ color }) => sfx.flip(color));
events.on("win", () => {
  sfx.win();
  launchConfetti();
  window.setTimeout(showWinModal, 900);
});
events.on("paid", ({ txHash }) => {
  launchConfetti(220);
  showPaidModal(txHash);
});
events.on("revealed", ({ word }) => {
  const phase = getState().phase;
  if (phase === "solved-by-other" || phase === "expired") {
    showRoundOverModal(phase, word);
  } else {
    // Winner's "Pot Claimed" modal opened before the reveal resolved — fill it now.
    fillRevealedWord(word);
  }
  renderBanner(getState());
});
events.on("new-round", () => {
  sfx.seal();
  const ring = document.getElementById("seal-ring")!;
  ring.classList.add("sealing");
  window.setTimeout(() => ring.classList.remove("sealing"), 800);
  showToast("New word sealed into the TEE — good luck!", false);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

if (!isDeployed) {
  showNotDeployedModal();
} else {
  update({ phase: "no-wallet" });
  void loadLatestRound()
    .then(() => {
      startPolling();
      if (!getState().account) {
        update({
          statusNote: hasWallet()
            ? "Connect your wallet to play — reads are live."
            : "Install MetaMask to play — spectating for now.",
        });
      }
    })
    .catch((error) => {
      showToast(`Failed to load round: ${`${error?.message ?? error}`.slice(0, 80)}`);
    });
}
