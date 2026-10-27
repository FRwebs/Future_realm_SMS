import { expect, test, type Page } from "@playwright/test";

/**
 * Visual regression: the screens people see most, captured once and compared on every run, so a change to styling infrastructure (a
 * Tailwind upgrade, a shared component rewrite) cannot quietly move things. Baselines live next to this file and are per-platform —
 * generate them on the machine that will compare them:
 *
 *   npm run test:visual -- --update-snapshots     # (re)write the baselines
 *   npm run test:visual                           # compare
 *
 * The web app (:3000) and API (:4000) must be running with the seeded demo school.
 */
const password = "FutureRealm123!";
test.describe.configure({ timeout: 120_000 });
test.use({ viewport: { width: 1280, height: 900 } });

async function signIn(page: Page, email: string) {
  const response = await page.request.post("/api/v1/auth/login", { data: { email, identifier: email, password } });
  expect(response.ok()).toBeTruthy();
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important} nextjs-portal,[data-testid=language-picker]{display:none!important}" });
  await page.waitForTimeout(600);
}

const shot = (name: string) => `${name}.png`;
const options = { fullPage: false, maxDiffPixelRatio: 0.0005, animations: "disabled" as const };
// The dev server draws its own build indicator in the corner; it is not part of the product.
const devOverlay = (page: Page) => page.locator("nextjs-portal");

test("login", async ({ page }) => {
  await page.goto("/login");
  await settle(page);
  await expect(page).toHaveScreenshot(shot("login"), { ...options, mask: [devOverlay(page)] });
});

test("forgot password", async ({ page }) => {
  await page.goto("/forgot-password");
  await settle(page);
  await expect(page).toHaveScreenshot(shot("forgot-password"), { ...options, mask: [devOverlay(page)] });
});

test("landing", async ({ page }) => {
  await page.goto("/");
  await settle(page);
  // The marketing page animates (a rotating highlight, a typed line), so it gets a wider tolerance than the product screens.
  await expect(page).toHaveScreenshot(shot("landing"), { ...options, maxDiffPixelRatio: 0.02, mask: [devOverlay(page)] });
});

test("back office schools", async ({ page }) => {
  await signIn(page, "admin@futurerealm.sms");
  await page.goto("/super-admin/schools");
  await expect(page.getByRole("heading", { name: "School Accounts" })).toBeVisible({ timeout: 40_000 });
  await settle(page);
  await expect(page).toHaveScreenshot(shot("back-office-schools"), { ...options, mask: [devOverlay(page), page.getByText(/ago|minutes|hours|days/)] });
});

test("back office overview", async ({ page }) => {
  await signIn(page, "admin@futurerealm.sms");
  await page.goto("/super-admin");
  await expect(page.getByRole("complementary")).toBeVisible({ timeout: 40_000 });
  await settle(page);
  await expect(page).toHaveScreenshot(shot("back-office-overview"), { ...options, mask: [devOverlay(page), page.getByText(/ago|minutes|hours|days/)] });
});

test("parent dashboard", async ({ page }) => {
  await signIn(page, "kemi-adeyemi-0001@parents.greenfieldcollege.ng");
  await page.goto("/portals/parent");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 40_000 });
  await settle(page);
  await expect(page).toHaveScreenshot(shot("parent-dashboard"), { ...options, mask: [devOverlay(page)] });
});

test("teacher workspace", async ({ page }) => {
  await signIn(page, "teacher@greenfieldcollege.ng");
  await page.goto("/command-center/today");
  await expect(page.getByRole("complementary")).toBeVisible({ timeout: 40_000 });
  await settle(page);
  await expect(page).toHaveScreenshot(shot("teacher-today"), { ...options, mask: [devOverlay(page), page.getByText(/ago|minutes|hours|days|:\d\d/)] });
});
