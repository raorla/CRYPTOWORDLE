import { beforeEach, describe, expect, it } from "vitest";
import { getState, update, type RoundView } from "../state.ts";
import {
  close,
  fillRevealedWord,
  showHelpModal,
  showPaidModal,
  showWinModal,
} from "./modals.ts";

const round = (over: Partial<RoundView> = {}): RoundView => ({
  id: 42n,
  pot: 50_000_000_000_000_000n,
  deadline: 0,
  status: 0,
  winner: "0x0000000000000000000000000000000000000000",
  guessCount: 9,
  revealedWord: null,
  ...over,
});

beforeEach(() => {
  document.body.innerHTML = `<div id="modal-root"></div>`;
  update({ round: null, myRows: [], phase: "idle" });
});

describe("help modal", () => {
  it("renders the certificate-styled rules and closes cleanly", () => {
    showHelpModal();
    expect(document.querySelector(".modal h2")?.textContent).toBe("How to Play");
    expect(document.querySelector(".modal-kicker")?.textContent).toContain("Rules of play");
    close();
    expect(document.querySelector(".modal")).toBeNull();
  });
});

describe("win modal", () => {
  it("shows the winning word as stamped tiles and a gold frame", () => {
    update({
      round: round(),
      phase: "won",
      myRows: [
        { letters: "vapor", colors: [2, 2, 2, 2, 2], guessIndex: 0, win: true, mine: true },
      ],
    });
    showWinModal();
    expect(document.querySelector(".modal")?.classList.contains("frame-gold")).toBe(true);
    expect(document.querySelector(".modal h2")?.textContent).toBe("Certificate of Claim");
    const tiles = document.querySelectorAll(".stamp-word .stamp-tile");
    expect(tiles).toHaveLength(5);
    expect(tiles[0].textContent).toBe("V");
    expect(document.querySelector(".pot-line")?.textContent).toContain("0.05");
  });
});

describe("paid modal reveal slot", () => {
  it("starts on the 'unsealing' placeholder then fills with the revealed word", () => {
    update({ round: round({ status: 1 }), phase: "paid" });
    showPaidModal("0xabc");
    const slot = document.querySelector(".reveal-slot")!;
    expect(slot.textContent).toContain("Unsealing");
    expect(slot.querySelector(".stamp-tile")).toBeNull();

    fillRevealedWord("vapor");
    expect(document.querySelectorAll(".reveal-slot .stamp-tile")).toHaveLength(5);
    expect(getState().round?.status).toBe(1);
  });
});
