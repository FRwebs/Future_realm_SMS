import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Automated accessibility checks (axe, WCAG 2.2 A/AA rules) on the screens people meet first, and on the dialogs, drawers and menus that
 * are built on Radix. Automation finds roughly a third of real accessibility problems — the rest needs a keyboard and a screen reader —
 * but those it finds are never worth shipping. Only serious and critical violations fail the run.
 */
const password = "FutureRealm123!";
// A cold dev server compiles each route on first visit, so give the first look at a screen room.
test.describe.configure({ timeout: 90_000 });
const SLOW = { timeout: 30_000 };
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function serious(page: Page) {
  // Dialogs fade and slide in; scanning mid-animation reads half-transparent text as low contrast.
  await page.waitForTimeout(500);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => {
      const where = violation.nodes.slice(0, 3).map((node) => `${node.target.join(" ")} — ${(node.any[0]?.message ?? node.failureSummary ?? "").slice(0, 140)}`);
      return `${violation.id} (${violation.impact}) — ${violation.nodes.length} element(s): ${violation.help}\n    ${where.join("\n    ")}`;
    });
}

async function signIn(page: Page, email: string) {
  const response = await page.request.post("/api/v1/auth/login", { data: { email, identifier: email, password } });
  expect(response.ok()).toBeTruthy();
}

test.describe("public screens", () => {
  for (const path of ["/login", "/forgot-password"]) {
    test(`${path} has no serious violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await serious(page)).toEqual([]);
    });
  }
});

test.describe("signed-in screens", () => {
  test("Back Office schools list, its row menu and its bulk dialog", async ({ page }) => {
    await signIn(page, "admin@futurerealm.sms");
    await page.goto("/super-admin/schools");
    await expect(page.getByRole("heading", { name: "School Accounts" })).toBeVisible(SLOW);
    expect(await serious(page)).toEqual([]);

    // The row menu is a Radix popover: it must open, be reachable, and give focus back on Escape.
    const menuButton = page.getByRole("button", { name: /^Actions for / }).first();
    await menuButton.click();
    await expect(page.getByRole("menuitem", { name: "Open school profile" })).toBeVisible();
    expect(await serious(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(menuButton).toBeFocused();

    // The bulk dialog is a Radix dialog: labelled, focus kept inside, focus returned to the button that opened it.
    await page.getByRole("button", { name: "Select all schools" }).click();
    const opener = page.getByRole("button", { name: "Batch status change" });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Batch status change" });
    await expect(dialog).toBeVisible();
    for (let step = 0; step < 15; step += 1) await page.keyboard.press("Tab");
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    expect(await serious(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("parent dashboard and its quick-view drawer", async ({ page }) => {
    await signIn(page, "kemi-adeyemi-0001@parents.greenfieldcollege.ng");
    await page.goto("/portals/parent");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible(SLOW);
    expect(await serious(page)).toEqual([]);

    // The drawer is a Radix dialog too: announced by its title, closed by Escape, focus returned to the button that opened it.
    const opener = page.getByRole("button", { name: "Open quick view" });
    await opener.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    expect(await serious(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(opener).toBeFocused();
  });
});
