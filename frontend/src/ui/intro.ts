import { getState } from "../state.ts";
import { sfx } from "./sound.ts";

/**
 * "The Sealing" — controller for the static intro/loading veil in index.html.
 * The choreography is pure CSS (animation delays); this module owns only the
 * DATA-GATED beats: the seal slam fires when the chain read actually settles
 * (never before ~1.6s, never lying about progress). Once sealed the veil is a
 * gate — "press any key to enter" is literal: any key/click/tap enters
 * immediately, and only an idle player is auto-entered (30s fallback). Skip
 * is instant at any time, and the veil can never wedge (30s hard cap,
 * unconditional removal timers).
 *
 * Sequencing uses setTimeout exclusively — prefers-reduced-motion flattens
 * animation durations to ~0ms, so animation/transition end events would race.
 */

const MIN_CEREMONY_MS = 1_600;
const ENTER_FALLBACK_MS = 30_000;
const SLOW_LABEL_MS = 4_000;
const HARD_CAP_MS = 30_000;
const REMOVE_FALLBACK_MS = 600;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface IntroHandle {
  /** Resolves once the veil is fully gone (app visible + entrance replayed). */
  done: Promise<void>;
  /** Force-dismiss immediately (e.g. the not-deployed modal must show). */
  dismiss: () => void;
}

export function startIntro(load: Promise<unknown>): IntroHandle {
  const el = document.getElementById("intro");
  if (!el) {
    document.body.classList.remove("pre-intro");
    return { done: Promise.resolve(), dismiss: () => {} };
  }

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const seen = document.body.classList.contains("intro-seen");
  // Written at ceremony START so a mid-intro reload never replays it.
  try {
    sessionStorage.setItem("cw-intro-seen", "1");
  } catch {
    /* storage may be unavailable — the ceremony just replays */
  }

  const statusText = document.getElementById("intro-status-text");
  let finished = false;
  let resolveDone!: () => void;
  const done = new Promise<void>((r) => (resolveDone = r));

  const dismiss = (fast = false): void => {
    if (finished) return;
    finished = true;
    document.removeEventListener("keydown", onKey, true);
    el.removeEventListener("pointerdown", onPointer);
    if (fast) el.classList.add("intro-fast");
    el.classList.add("intro-done");
    // Reveal the app and replay its rise-1..rise-5 entrance as the veil lifts.
    document.body.classList.remove("pre-intro");
    window.setTimeout(() => {
      el.remove();
      resolveDone();
    }, REMOVE_FALLBACK_MS);
  };

  // Skip: swallow the triggering keystroke so it never reaches main.ts's
  // global handler (it would type a letter into the grid). Browser chords
  // (Ctrl/Cmd+R), function keys (F5) and bare modifiers pass through — the
  // veil must never block a refresh. Same filter as main.ts's key handler.
  const onKey = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key.length > 1 && e.key !== "Escape" && e.key !== "Enter") return;
    e.preventDefault();
    e.stopPropagation();
    dismiss(true);
  };
  const onPointer = (): void => dismiss(true);
  document.addEventListener("keydown", onKey, true);
  el.addEventListener("pointerdown", onPointer);
  document.getElementById("intro-skip")?.addEventListener("click", () => dismiss(true));

  const settled = load.then(
    () => undefined,
    () => "error" as const,
  );

  // Slow-RPC narration. The veil now outlives this timer when sealed (the
  // gate holds for input), so never overwrite the sealed round label.
  window.setTimeout(() => {
    if (!finished && !el.classList.contains("sealed") && statusText) {
      statusText.textContent = "The ledger is slow to answer — still retrieving";
    }
  }, SLOW_LABEL_MS);

  const minShow = reduced ? 600 : seen ? 0 : MIN_CEREMONY_MS;

  void Promise.race([
    Promise.all([settled, delay(minShow)]).then(([outcome]) => outcome),
    delay(HARD_CAP_MS).then(() => "timeout" as const),
  ]).then((outcome) => {
    if (finished) return;
    if (outcome === "error" || outcome === "timeout") {
      // Loading continues (or failed) underneath; the app's own status line
      // and toast take over. Don't stage a seal that would lie.
      dismiss(true);
      return;
    }
    const round = getState().round;
    if (!round) {
      // Nothing is sealed yet — don't pretend otherwise.
      if (statusText) statusText.textContent = "Preparing the first round — the vault is being sealed";
      window.setTimeout(() => dismiss(), 350);
      return;
    }
    if (seen || reduced) {
      dismiss();
      return;
    }
    // The ceremony's payoff: the chain answered — slam the seal, then hold
    // the gate for the player. Any key/click enters instantly (the handlers
    // registered above); the timer only rescues an idle screen.
    el.classList.add("sealed");
    const caption = document.getElementById("intro-caption");
    const subline = document.getElementById("intro-subline");
    if (caption) caption.hidden = false;
    if (subline) subline.hidden = false;
    if (statusText) statusText.textContent = `Round № ${round.id} · in session`;
    sfx.seal();
    window.setTimeout(() => dismiss(), ENTER_FALLBACK_MS);
  });

  return { done, dismiss: () => dismiss(true) };
}
