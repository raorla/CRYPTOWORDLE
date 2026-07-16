import { expect, test } from "@playwright/test";

// Smoke tests for the redesigned "Treasury Certificate" shell. No wallet/chain:
// these assert the app boots and the UI reacts, not the on-chain guess flow.

test("boots with the certificate masthead, board and keyboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".wordmark")).toContainText("CRYPTOWORDLE");
  // CSS uppercases the caption visually; the DOM text keeps its original case.
  await expect(page.locator(".seal-caption")).toContainText(/word sealed in a tee/i);
  await expect(page.locator("#grid .tile")).toHaveCount(30);
  await expect(page.locator("#keyboard .key")).toHaveCount(28);
  await expect(page.locator(".key.key-enter")).toBeVisible();
});

test("opens the 'How to Play' certificate modal and closes it", async ({ page }) => {
  await page.goto("/");
  await page.locator("#btn-help").click();
  await expect(page.locator(".modal h2")).toHaveText("How to Play");
  await expect(page.locator(".legend-tiles .stamp-tile")).toHaveCount(3);
  await page.keyboard.press("Escape");
  await expect(page.locator(".modal")).toHaveCount(0);
});

test("toggles between the specimen-paper (light) and midnight-ledger (dark) themes", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-theme", "light");
  await page.locator("#btn-theme").click();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
});

test("shows a Connect wallet call-to-action", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#btn-connect")).toContainText("Connect wallet");
});
