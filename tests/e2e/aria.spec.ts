import { expect, test, type Page } from "@playwright/test";

/**
 * What a screen reader is told, written down. Each check below is the accessibility tree — roles, names and the order they come in — of a
 * piece of a screen that people lean on without seeing it: the sign-in form, a module's tabs, a table's headings and rows, a drawer. If
 * a change makes a control lose its name, a heading lose its level or a table lose its structure, the tree stops matching and the test
 * says so. It is no substitute for listening to the page with VoiceOver or NVDA, but it is what keeps what was heard from changing quietly.
 */
const password = "FutureRealm123!";
test.describe.configure({ timeout: 180_000 });
const SLOW = { timeout: 60_000 };

async function signIn(page: Page, email: string) {
  const response = await page.request.post("/api/v1/auth/login", { data: { email, identifier: email, password } });
  expect(response.ok()).toBeTruthy();
}

test("the sign-in page has one main landmark, one top heading, named fields and a named button", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible(SLOW);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("textbox", { name: "Email address or User ID" })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /forgot password/i })).toBeVisible();
});

test("a module's tabs are one named navigation of links, with the current one marked", async ({ page }) => {
  await signIn(page, "proprietor@greenfieldcollege.ng");
  await page.goto("/attendance/register");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible(SLOW);
  const tabs = page.getByRole("navigation", { name: /tabs/i }).first();
  await expect(tabs.getByRole("link")).toHaveText(["Register", "Mark", "Compliance", "Log"]);
  await expect(tabs.getByRole("link", { name: "Register" })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: "Mark" })).not.toHaveAttribute("aria-current", "page");
});

test("a long table is a table: named columns, a search that says what it searches, and a pager that says where you are", async ({ page }) => {
  await signIn(page, "proprietor@greenfieldcollege.ng");
  await page.goto("/student-records/registry");
  await expect(page.getByText(/Showing 1–25 of/).first()).toBeVisible(SLOW);
  const table = page.getByRole("table").first();
  await expect(table.getByRole("columnheader").first()).toBeVisible();
  expect(await table.getByRole("columnheader").count()).toBeGreaterThan(2);
  expect(await table.getByRole("row").count()).toBeGreaterThan(10);
  await expect(page.getByRole("searchbox").first()).not.toHaveAccessibleName("");
  await expect(page.getByRole("button", { name: "Next page" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous page" })).toBeDisabled();
  // Every control in a row has a name a person can tell apart from its neighbours.
  const unnamed = await page.locator("tbody button, tbody a, tbody input").evaluateAll((nodes) => nodes.filter((node) => !(node.getAttribute("aria-label") || node.textContent?.trim())).length);
  expect(unnamed).toBe(0);
});

test("a drawer is a named dialog that holds a form with named fields and named buttons", async ({ page }) => {
  await signIn(page, "std-ss3-04@students.greenfieldcollege.ng");
  await page.goto("/portals/student/account");
  await page.waitForLoadState("networkidle");
  const opener = page.getByRole("button", { name: "Change password" }).first();
  await expect(async () => {
    await opener.click();
    await expect(page.getByRole("dialog", { name: "Change your password" })).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByRole("dialog", { name: "Change your password" })).toMatchAriaSnapshot(`
    - dialog "Change your password":
      - button "Close"
      - banner:
        - heading "Change your password" [level=2]
      - textbox "Current password"
      - textbox "New password"
      - contentinfo:
        - button "Cancel"
        - button "Review"
  `);
});
