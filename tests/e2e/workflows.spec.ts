import { expect, test, type Page } from "@playwright/test";

/**
 * Whole tasks, done the way a person does them, in the browser: what they choose changes what they see, a record opens from a list, a
 * form refuses what it cannot take. Anything a test changes it puts back, so the next run starts from the same place.
 */
const password = "FutureRealm123!";
test.describe.configure({ timeout: 180_000 });
const SLOW = { timeout: 60_000 };

async function signIn(page: Page, email: string) {
  const response = await page.request.post("/api/v1/auth/login", { data: { email, identifier: email, password } });
  expect(response.ok()).toBeTruthy();
}

async function patchProfile(page: Page, data: Record<string, unknown>) {
  const csrf = (await page.context().cookies()).find((cookie) => cookie.name === "fr_csrf")!.value;
  const response = await page.request.patch("/api/v1/profile/me", { data, headers: { "x-csrf-token": csrf } });
  expect(response.ok()).toBeTruthy();
}

test("choosing a date format rewrites the dates on other pages, and choosing the first puts them back", async ({ page }) => {
  await signIn(page, "proprietor@greenfieldcollege.ng");
  try {
    await page.goto("/account/preferences");
    await expect(page.getByLabel("Date format")).toBeVisible(SLOW);
    await page.getByLabel("Date format").selectOption("2026-09-04");
    await page.getByRole("button", { name: "Save preferences" }).click();
    await expect(page.getByText("Saved to your account.").first()).toBeVisible(SLOW);

    await page.goto("/student-records/admissions");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible(SLOW);
    await page.waitForLoadState("networkidle");
    const written = await page.locator("main").innerText();
    expect(written).toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
    expect(written).not.toMatch(/\b\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec) \d{4}\b/);

    await page.goto("/account/preferences");
    await page.getByLabel("Date format").selectOption("4 Sep 2026");
    await page.getByRole("button", { name: "Save preferences" }).click();
    await expect(page.getByText("Saved to your account.").first()).toBeVisible(SLOW);
    await page.goto("/student-records/admissions");
    await page.waitForLoadState("networkidle");
    expect(await page.locator("main").innerText()).toMatch(/\b\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec) \d{4}\b/);
  } finally {
    await patchProfile(page, { preferences: {} });
  }
});

test("a parent chooses a language and the whole page changes to it", async ({ page }) => {
  await signIn(page, "kemi-adeyemi-0001@parents.greenfieldcollege.ng");
  try {
    await page.goto("/portals/parent/account");
    await expect(page.getByLabel("Language").first()).toBeVisible(SLOW);
    await page.getByLabel("Language").first().selectOption({ label: "Yorùbá" });
    await page.getByRole("button", { name: /Save language|Fi èdè pamọ́/i }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "yo", SLOW);
  } finally {
    await patchProfile(page, { locale: "en" });
  }
});

test("a list can be searched, and clearing the search brings the rows back", async ({ page }) => {
  await signIn(page, "proprietor@greenfieldcollege.ng");
  await page.goto("/student-records/registry");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible(SLOW);
  const search = page.getByRole("searchbox").first();
  await expect(search).toBeVisible(SLOW);
  const rows = page.locator("tbody tr");
  await expect.poll(() => rows.count(), SLOW).toBeGreaterThan(1);
  const before = await rows.count();
  // Typing before the page has taken hold is lost, as it would be for a person: type again until it is heard.
  await expect(async () => {
    await search.fill("zzzz-nobody-has-this-name");
    expect(await rows.count()).toBeLessThan(before);
  }).toPass({ timeout: 60_000 });
  await search.fill("");
  await expect.poll(() => rows.count(), SLOW).toBe(before);
});

test("a student opens a subject from the keyboard and closes it with Escape", async ({ page }) => {
  await signIn(page, "std-ss3-04@students.greenfieldcollege.ng");
  await page.goto("/portals/student/subjects");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible(SLOW);
  await page.waitForLoadState("networkidle");
  const first = page.locator("section button.after\\:absolute").first();
  await first.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(first).toBeFocused();
});

test("a password change the server refuses says why, in the drawer, which stays open", async ({ page }) => {
  await signIn(page, "std-ss3-04@students.greenfieldcollege.ng");
  await page.goto("/portals/student/account");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Change password" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Current password").fill("not-my-password");
  await dialog.getByLabel("New password").fill("AnotherLongPassword9!");
  await dialog.getByRole("button", { name: "Review" }).click();
  // A password read back for checking is never written out on the screen.
  await expect(dialog.getByText("AnotherLongPassword9!")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Update password" }).click();
  await page.getByRole("button", { name: "Update password" }).last().click();
  await expect(dialog.getByText("Password changed")).toHaveCount(0);
  await expect(page.getByRole("alert").first()).toBeVisible(SLOW);
});

test("a long list turns its pages without redrawing the page, keeps the address in step, and a link to page 2 lands there", async ({ page }) => {
  await signIn(page, "proprietor@greenfieldcollege.ng");
  const documents: string[] = [];
  const windows: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "document") documents.push(request.url());
    if (request.url().includes("/table-window")) windows.push(request.url());
  });
  await page.goto("/student-records/registry");
  await expect(page.getByText(/Showing 1–25 of/).first()).toBeVisible(SLOW);
  documents.length = 0;

  // Pressed until it is heard: the page may not have taken hold on the first press.
  await expect(async () => {
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByText(/Showing 26–50 of/).first()).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 60_000 });
  expect(documents).toEqual([]);
  expect(windows.length).toBeGreaterThan(0);
  expect(page.url()).toMatch(/t\d+_\d+_p=2/);

  const address = new URL(page.url());
  await page.goto(`${address.pathname}${address.search}`);
  await expect(page.getByText(/Showing 26–50 of/).first()).toBeVisible(SLOW);
});
