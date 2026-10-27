import { expect, test } from "@playwright/test";

/**
 * One sign-in per kind of person, and a look at where they land: the page loads, says what it is, throws nothing in the browser, and is the
 * right place for that role (a teacher is not dropped into the Back Office). Cheap, broad, and the first thing to go red when a deploy is
 * broken. Accounts are the seeded demo school's (SEEDED_ACCOUNTS.md); the web app (:3000) and API (:4000) must be running.
 */
const password = "FutureRealm123!";
test.describe.configure({ timeout: 120_000 });

const people = [
  { who: "platform admin", email: "admin@futurerealm.sms", landsUnder: /\/super-admin/ },
  { who: "proprietor", email: "proprietor@greenfieldcollege.ng", landsUnder: /\/(command-center|dashboard)/ },
  { who: "teacher", email: "teacher@greenfieldcollege.ng", landsUnder: /\/(command-center|portals\/teacher)/ },
  { who: "parent", email: "kemi-adeyemi-0001@parents.greenfieldcollege.ng", landsUnder: /\/portals\/parent/ },
  { who: "student", email: "std-ss3-04@students.greenfieldcollege.ng", landsUnder: /\/portals\/student/ },
];

for (const person of people) {
  test(`${person.who} signs in and lands somewhere sensible`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    // A script or style the Content-Security-Policy refused shows up in the console; none should, on any screen.
    page.on("console", (message) => { if (/content security policy/i.test(message.text())) pageErrors.push(message.text()); });

    await page.goto("/login");
    await page.getByLabel("Email address or User ID").fill(person.email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(person.landsUnder, { timeout: 60_000 });
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/application error|something went wrong|internal server error/i)).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });
}

test("someone signed in as a teacher cannot open the Back Office", async ({ page }) => {
  const response = await page.request.post("/api/v1/auth/login", { data: { email: "teacher@greenfieldcollege.ng", identifier: "teacher@greenfieldcollege.ng", password } });
  expect(response.ok()).toBeTruthy();
  await page.goto("/super-admin");
  await expect(page).not.toHaveURL(/\/super-admin/);
});

test("wrong details are refused with a reason, in place", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address or User ID").fill("teacher@greenfieldcollege.ng");
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Sign-in failed" })).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/login/);
});

test("an empty sign-in says what is missing under each field", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Enter your email address or User ID.")).toBeVisible();
  await expect(page.getByText("Enter your password.")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("aria-invalid", "true");
});

test("a Back Office decision dialog says what is missing beside the field, not in a browser bubble", async ({ page }) => {
  await page.request.post("/api/v1/auth/login", { data: { email: "admin@futurerealm.sms", identifier: "admin@futurerealm.sms", password } });
  await page.goto("/super-admin/schools");
  await expect(page.getByRole("heading", { name: "School Accounts" })).toBeVisible({ timeout: 90_000 });
  await page.getByRole("button", { name: /^Actions for / }).first().click();
  await page.getByRole("menuitem", { name: /Suspend|Reactivate/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("button[type=submit]").click();
  await expect(dialog.getByRole("alert").filter({ hasText: "Reason is needed." })).toBeVisible();
  await expect(dialog).toBeVisible();
});

test("a saved preference takes effect at once and follows the person to another device", async ({ page, browser }) => {
  const email = "proprietor@greenfieldcollege.ng";
  await page.request.post("/api/v1/auth/login", { data: { email, identifier: email, password } });
  await page.goto("/account/preferences");
  await expect(page.getByLabel("Open on")).toBeVisible({ timeout: 90_000 });
  await page.getByLabel("Open on").selectOption("Approvals · Queue");
  await page.getByRole("button", { name: "Comfortable" }).click();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Saved to your account.").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("html")).toHaveAttribute("data-density", "comfortable");

  // A second device signs in and opens where the person asked, as roomy as they asked.
  const other = await browser.newContext({ baseURL: page.url().split("/account")[0] });
  const second = await other.newPage();
  await second.goto("/login");
  await second.getByLabel("Email address or User ID").fill(email);
  await second.getByLabel("Password", { exact: true }).fill(password);
  await second.getByRole("button", { name: "Sign in" }).click();
  await expect(second).toHaveURL(/approvals-workflow\/queue/, { timeout: 90_000 });
  await expect(second.locator("html")).toHaveAttribute("data-density", "comfortable");
  await other.close();

  // Leave nothing behind for the next run.
  const csrf = (await page.context().cookies()).find((cookie) => cookie.name === "fr_csrf")!.value;
  await page.request.patch("/api/v1/profile/me", { data: { preferences: { openOn: "Command Center · Today", density: "Compact" } }, headers: { "x-csrf-token": csrf } });
});
