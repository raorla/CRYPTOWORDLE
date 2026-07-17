import { expect, test, type Page } from "@playwright/test";

// Smoke tests for the "Treasury Certificate" shell. No wallet/chain
// assertions: these verify the app boots and the UI reacts, not the
// on-chain guess flow (that's the contract integration suite's job).

/** Enter the game past "The Sealing" intro veil (any key skips it). */
async function gotoGame(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator("#intro").waitFor();
  await page.keyboard.press("Escape");
  await expect(page.locator("#intro")).toHaveCount(0);
}

test("plays The Sealing intro and skips on any key", async ({ page }) => {
  await page.goto("/");
  const intro = page.locator("#intro");
  await expect(intro).toBeVisible();
  await expect(intro.locator(".intro-wordmark")).toContainText("CRYPTOWORDLE");
  await expect(intro.locator(".intro-tiles .intro-tile")).toHaveCount(5);
  await page.keyboard.press("x"); // any key skips — and must not type into the grid
  await expect(intro).toHaveCount(0);
  await expect(page.locator("#tile-0-0")).not.toContainText("X");
});

test("boots with the certificate masthead, board and keyboard", async ({ page }) => {
  await gotoGame(page);
  await expect(page.locator(".wordmark")).toContainText("CRYPTOWORDLE");
  // CSS uppercases the caption visually; the DOM text keeps its original case.
  await expect(page.locator(".seal-caption")).toContainText(/word sealed in a tee/i);
  await expect(page.locator("#grid .tile")).toHaveCount(30);
  await expect(page.locator("#keyboard .key")).toHaveCount(28);
  await expect(page.locator(".key.key-enter")).toBeVisible();
});

test("opens the 'How to Play' certificate modal and closes it", async ({ page }) => {
  await gotoGame(page);
  await page.locator("#btn-help").click();
  await expect(page.locator(".modal h2")).toHaveText("How to Play");
  await expect(page.locator(".legend-tiles .stamp-tile")).toHaveCount(3);
  await page.keyboard.press("Escape");
  await expect(page.locator(".modal")).toHaveCount(0);
});

test("toggles between the specimen-paper (light) and midnight-ledger (dark) themes", async ({
  page,
}) => {
  await gotoGame(page);
  await expect(page.locator("body")).toHaveAttribute("data-theme", "light");
  await page.locator("#btn-theme").click();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
});

test("shows a Connect wallet call-to-action", async ({ page }) => {
  await gotoGame(page);
  await expect(page.locator("#btn-connect")).toContainText("Connect wallet");
});

test("opens the hash-routed Hall of Records and closes with Escape", async ({ page }) => {
  await gotoGame(page);
  await page.locator("#btn-records").click();
  await expect(page.locator(".modal.modal-wide h2")).toHaveText("The Registry");
  await expect(page).toHaveURL(/#records$/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".modal")).toHaveCount(0);
  await expect(page).not.toHaveURL(/#records/);
});
