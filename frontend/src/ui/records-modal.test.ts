import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Records } from "../records.ts";
import { getState, update } from "../state.ts";

// showRecordsModal reads the chain via fetchRecords — stub the data layer,
// keep the pure helpers real.
vi.mock("../records.ts", async (importOriginal) => {
  const real = (await importOriginal()) as object;
  return { ...real, fetchRecords: vi.fn(), fetchSecretHandles: vi.fn() };
});

import { fetchRecords } from "../records.ts";
import { auditStripHtml, close, recordsBodyHtml, showRecordsModal, showRoundOverModal } from "./modals.ts";

const ALICE = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" as const;
const BOB = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" as const;

const records: Records = {
  rounds: [
    { id: 2n, status: 0, pot: 50_000_000_000_000_000n, deadline: 0, winner: "0x0000000000000000000000000000000000000000", guessCount: 3 },
    { id: 1n, status: 2, pot: 0n, deadline: 0, winner: "0x0000000000000000000000000000000000000000", guessCount: 12 },
    { id: 0n, status: 1, pot: 0n, deadline: 0, winner: ALICE, guessCount: 9 },
  ],
  champions: [{ address: ALICE, wins: 1, lastWinRound: 0n }],
  openPotWei: 50_000_000_000_000_000n,
  solvedCount: 1,
};

beforeEach(() => {
  document.body.innerHTML = `<div id="modal-root"></div>`;
  history.replaceState(null, "", "/");
  update({ round: null, myRows: [], audit: null, account: null, phase: "idle" });
});

describe("recordsBodyHtml", () => {
  it("renders honors, champions and the archive with status chips", () => {
    const html = recordsBodyHtml(records, null);
    expect(html).toContain("Rounds struck");
    expect(html).toContain("0.05"); // ETH in live pots
    expect(html).toContain("paid out"); // settled pots are zeroed on-chain
    expect(html).toContain("Champions — by pots claimed");
    expect(html).toContain("0xAAAA…AAAA");
    expect(html).toContain("chip-solved");
    expect(html).toContain("chip-expired");
    expect(html).toContain("chip-open");
    expect(html).toContain("nothing indexed");
  });

  it("tags the connected account in the champions list", () => {
    expect(recordsBodyHtml(records, ALICE.toLowerCase())).toContain("you-tag");
    expect(recordsBodyHtml(records, BOB)).not.toContain("you-tag");
  });

  it("shows the empty state when nobody has won yet", () => {
    const html = recordsBodyHtml({ ...records, champions: [] }, null);
    expect(html).toContain("No champions yet");
    expect(html).toContain("It could bear your address.");
  });
});

describe("showRecordsModal", () => {
  it("opens instantly, routes the hash, fills from the chain, and clears on close", async () => {
    vi.mocked(fetchRecords).mockResolvedValue(records);
    showRecordsModal();
    expect(location.hash).toBe("#records");
    expect(document.querySelector(".modal.modal-wide")).not.toBeNull();
    expect(document.querySelector("#records-body")!.textContent).toContain("Reading the ledger");

    await vi.waitFor(() =>
      expect(document.querySelector("#records-body")!.textContent).toContain("Champions"),
    );

    close();
    expect(document.querySelector(".modal")).toBeNull();
    expect(location.hash).toBe("");
  });

  it("offers a retry when the ledger is unreachable", async () => {
    vi.mocked(fetchRecords).mockRejectedValueOnce(new Error("rpc"));
    vi.mocked(fetchRecords).mockResolvedValueOnce(records);
    showRecordsModal();
    await vi.waitFor(() =>
      expect(document.querySelector("#records-body")!.textContent).toContain("unreachable"),
    );
    (document.querySelector("#records-retry") as HTMLButtonElement).click();
    await vi.waitFor(() =>
      expect(document.querySelector("#records-body")!.textContent).toContain("Champions"),
    );
    close();
  });
});

describe("independent audit strip", () => {
  it("stamps the verdict into the settled modal", () => {
    update({
      round: {
        id: 1n, pot: 0n, deadline: 0, status: 1,
        winner: ALICE, guessCount: 1, revealedWord: "vapor",
      },
      audit: { checked: 2, colorsChecked: 10, honest: true },
    });
    showRoundOverModal("solved-by-other", "vapor");
    const strip = document.querySelector(".audit-strip")!;
    expect(strip.textContent).toContain("10 of 10 colours verified honest");
    expect(strip.classList.contains("failed")).toBe(false);
    close();
  });

  it("flags a dishonest replay in danger ink", () => {
    update({ audit: { checked: 1, colorsChecked: 5, honest: false } });
    expect(auditStripHtml()).toContain("Audit failed");
    expect(auditStripHtml()).toContain("failed");
  });

  it("renders nothing when there was nothing to audit", () => {
    update({ audit: null });
    expect(auditStripHtml()).not.toContain("audit-strip");
    update({ audit: { checked: 0, colorsChecked: 0, honest: true } });
    expect(auditStripHtml()).not.toContain("audit-strip");
    expect(getState().audit?.colorsChecked).toBe(0);
  });
});
