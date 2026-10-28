import { expect, test, type Page } from "@playwright/test";

/**
 * What a person using only a keyboard meets. Automated axe finds missing names and roles; it cannot tell whether you can get to a
 * control, see where you are, or get out again. These walk the page with Tab the way that person would.
 */
const password = "FutureRealm123!";
test.describe.configure({ timeout: 120_000 });

async function signIn(page: Page, email: string) {
  const response = await page.request.post("/api/v1/auth/login", { data: { email, identifier: email, password } });
  expect(response.ok()).toBeTruthy();
}

/** Tab through the page, noting each control that takes focus and whether it shows where it is. */
async function walk(page: Page, presses: number) {
  // Borders ease from one colour to the next; read them settled, not half-way.
  await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important}" });
  const hidden: string[] = [];
  const seen = new Set<string>();
  for (let step = 0; step < presses; step += 1) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      const outlined = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
      let shadow = style.boxShadow !== "none";
      // A field marks focus by changing its border (or its wrapper's); compare with the same field out of focus.
      if (!outlined && !shadow && ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)) {
        const chain = [el, el.parentElement, el.parentElement?.parentElement].filter(Boolean) as HTMLElement[];
        const look = () => chain.map((node) => `${getComputedStyle(node).borderColor}|${getComputedStyle(node).boxShadow}`).join("/");
        const focused = look();
        el.blur();
        const resting = look();
        el.focus();
        shadow = focused !== resting;
      }
      const label = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || el.getAttribute("placeholder") || el.getAttribute("type") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
      const box = el.getBoundingClientRect();
      return { key: `${el.tagName}|${label}|${Math.round(box.x)},${Math.round(box.y)}`, label: `${el.tagName.toLowerCase()} “${label}”`, visible: outlined || shadow, onScreen: box.width > 0 && box.height > 0 };
    });
    if (!info || seen.has(info.key)) continue;
    seen.add(info.key);
    if (info.onScreen && !info.visible) hidden.push(info.label);
  }
  return { hidden, count: seen.size };
}

test("sign-in can be done from the keyboard alone, and every stop shows where focus is", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  const { hidden, count } = await walk(page, 14);
  expect(count).toBeGreaterThan(3);
  expect(hidden).toEqual([]);

  await page.goto("/login");
  await page.getByLabel(/email|user id/i).first().fill("proprietor@greenfieldcollege.ng");
  // The "forgot password" link sits between the two fields, so Tab on until the password field has focus.
  for (let step = 0; step < 4 && (await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.type)) !== "password"; step += 1) await page.keyboard.press("Tab");
  await page.keyboard.type(password);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/command-center|dashboard/, { timeout: 60_000 });
});

test("a school page: every control reachable by Tab shows focus,", async ({ page }) => {
  await signIn(page, "proprietor@greenfieldcollege.ng");
  await page.goto("/attendance/register");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 60_000 });
  const { hidden, count } = await walk(page, 45);
  expect(count).toBeGreaterThan(10);
  expect(hidden).toEqual([]);
});

test("a drawer takes focus, keeps it, and gives it back on Escape", async ({ page }) => {
  await signIn(page, "std-ss3-04@students.greenfieldcollege.ng");
  await page.goto("/portals/student/account");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  const opener = page.getByRole("button", { name: "Change password" }).first();
  const dialog = page.getByRole("dialog");
  // Pressed until it opens: on a cold page the press can land before the page has taken hold, as it could for a person.
  await expect(async () => {
    await opener.focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000 });
  for (let step = 0; step < 12; step += 1) await page.keyboard.press("Tab");
  expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("a wide table can be scrolled from the keyboard", async ({ page }) => {
  await signIn(page, "proprietor@greenfieldcollege.ng");
  await page.goto("/score-entry-results/review");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 60_000 });
  const regions = page.getByRole("region", { name: /scrolls sideways/ });
  expect(await regions.count()).toBeGreaterThan(0);
  await regions.first().focus();
  await expect(regions.first()).toBeFocused();
});
