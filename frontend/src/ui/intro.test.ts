import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { update, type RoundView } from "../state.ts";
import { startIntro } from "./intro.ts";

const round: RoundView = {
  id: 42n,
  pot: 0n,
  deadline: 0,
  status: 0,
  winner: "0x0000000000000000000000000000000000000000",
  guessCount: 0,
  revealedWord: null,
};

function mountIntro(): HTMLElement {
  document.body.className = "pre-intro";
  document.body.innerHTML = `
    <div id="intro">
      <div id="intro-caption" hidden>The word is sealed</div>
      <div id="intro-subline" hidden></div>
      <span id="intro-status-text">Retrieving round № — · Eth Sepolia</span>
      <button id="intro-skip">Press any key to enter</button>
    </div>`;
  return document.getElementById("intro")!;
}

beforeEach(() => {
  vi.useFakeTimers();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any;
  sessionStorage.clear();
  update({ round: null, audit: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("startIntro — The Sealing", () => {
  it("seals when the chain read settles, then holds the gate until input", async () => {
    update({ round });
    const el = mountIntro();
    startIntro(Promise.resolve());

    await vi.advanceTimersByTimeAsync(1_600);
    expect(el.classList.contains("sealed")).toBe(true);
    expect(document.getElementById("intro-caption")!.hidden).toBe(false);
    expect(document.getElementById("intro-status-text")!.textContent).toContain("№ 42");

    // "Press any key to enter" is literal — no auto-dismiss while the player reads,
    // and the slow-RPC narration (4s timer) must not overwrite the sealed label.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(el.classList.contains("intro-done")).toBe(false);
    expect(document.getElementById("intro-status-text")!.textContent).toContain("№ 42");

    el.dispatchEvent(new Event("pointerdown")); // a click enters immediately
    expect(el.classList.contains("intro-done")).toBe(true);
    expect(document.body.classList.contains("pre-intro")).toBe(false);

    await vi.advanceTimersByTimeAsync(600); // removal fallback
    expect(document.getElementById("intro")).toBeNull();
  });

  it("auto-enters 30s after the seal if the player never touches anything", async () => {
    update({ round });
    const el = mountIntro();
    startIntro(Promise.resolve());

    await vi.advanceTimersByTimeAsync(1_600);
    expect(el.classList.contains("sealed")).toBe(true);
    await vi.advanceTimersByTimeAsync(29_000);
    expect(el.classList.contains("intro-done")).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(el.classList.contains("intro-done")).toBe(true);
  });

  it("marks the session so the ceremony never replays", () => {
    mountIntro();
    startIntro(new Promise(() => {}));
    expect(sessionStorage.getItem("cw-intro-seen")).toBe("1");
  });

  it("skip swallows the keystroke so it never types into the grid", async () => {
    update({ round });
    const el = mountIntro();
    startIntro(new Promise(() => {})); // load never settles — skip must still work

    const key = new KeyboardEvent("keydown", { key: "v", cancelable: true, bubbles: true });
    document.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true);
    expect(el.classList.contains("intro-done")).toBe(true);
    expect(document.body.classList.contains("pre-intro")).toBe(false);

    // Listener is gone: the next key must NOT be swallowed.
    const next = new KeyboardEvent("keydown", { key: "a", cancelable: true, bubbles: true });
    document.dispatchEvent(next);
    expect(next.defaultPrevented).toBe(false);
    await vi.advanceTimersByTimeAsync(600);
    expect(document.getElementById("intro")).toBeNull();
  });

  it("lets F5, bare modifiers and browser chords through — refresh must work", () => {
    update({ round });
    const el = mountIntro();
    startIntro(new Promise(() => {}));

    const passthrough: KeyboardEventInit[] = [
      { key: "F5" },
      { key: "Shift" },
      { key: "Control" },
      { key: "r", ctrlKey: true },
      { key: "r", metaKey: true },
    ];
    for (const init of passthrough) {
      const ev = new KeyboardEvent("keydown", { ...init, cancelable: true, bubbles: true });
      document.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(false);
    }
    expect(el.classList.contains("intro-done")).toBe(false);

    // Escape (the e2e's skip key) still enters.
    const esc = new KeyboardEvent("keydown", { key: "Escape", cancelable: true, bubbles: true });
    document.dispatchEvent(esc);
    expect(esc.defaultPrevented).toBe(true);
    expect(el.classList.contains("intro-done")).toBe(true);
  });

  it("dismisses without sealing when the load fails", async () => {
    const el = mountIntro();
    startIntro(Promise.reject(new Error("rpc down")));
    await vi.advanceTimersByTimeAsync(1_600);
    expect(el.classList.contains("sealed")).toBe(false);
    expect(el.classList.contains("intro-done")).toBe(true);
  });

  it("stays honest when no round exists yet (nothing is sealed)", async () => {
    update({ round: null });
    const el = mountIntro();
    startIntro(Promise.resolve());
    await vi.advanceTimersByTimeAsync(1_600);
    expect(el.classList.contains("sealed")).toBe(false);
    expect(document.getElementById("intro-status-text")!.textContent).toContain(
      "Preparing the first round",
    );
    await vi.advanceTimersByTimeAsync(350);
    expect(el.classList.contains("intro-done")).toBe(true);
  });

  it("force-releases at the 30s hard cap even if the RPC hangs", async () => {
    update({ round });
    const el = mountIntro();
    startIntro(new Promise(() => {})); // never settles
    await vi.advanceTimersByTimeAsync(29_000);
    expect(el.classList.contains("intro-done")).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(el.classList.contains("intro-done")).toBe(true);
    expect(el.classList.contains("sealed")).toBe(false);
  });
});
