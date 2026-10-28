import { expect, test, type Page } from "@playwright/test";

/**
 * What a screen reader leans on, which axe's serious/critical rules do not insist on: one page title that says where you are, a language,
 * one main landmark to jump to, one top heading, and headings that go down one level at a time. A person who cannot see the page moves by
 * these, so they are checked on the screens people meet first.
 */
const password = "FutureRealm123!";
test.describe.configure({ timeout: 240_000 });

const SCREENS: Array<{ who: string; email: string; paths: string[] }> = [
  { who: "proprietor", email: "proprietor@greenfieldcollege.ng", paths: ["/command-center/today", "/attendance/register", "/student-records/registry", "/fee-management/collections", "/account/preferences"] },
  { who: "teacher", email: "teacher@greenfieldcollege.ng", paths: ["/command-center/today", "/lesson-notes/notes"] },
  { who: "student", email: "std-ss3-04@students.greenfieldcollege.ng", paths: ["/portals/student/today", "/portals/student/subjects", "/portals/student/account"] },
  { who: "parent", email: "kemi-adeyemi-0001@parents.greenfieldcollege.ng", paths: ["/portals/parent", "/portals/parent/children", "/portals/parent/profile"] },
  { who: "platform admin", email: "admin@futurerealm.sms", paths: ["/super-admin", "/super-admin/schools", "/super-admin/communications"] },
];

async function outline(page: Page) {
  return page.evaluate(() => {
    const levels = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter((h) => (h as HTMLElement).offsetParent !== null).map((h) => Number(h.tagName[1]));
    const skips: string[] = [];
    levels.forEach((level, at) => { if (at > 0 && level > levels[at - 1]! + 1) skips.push(`h${levels[at - 1]}→h${level}`); });
    return { lang: document.documentElement.lang, title: document.title.trim(), mains: document.querySelectorAll("main, [role=main]").length, h1: levels.filter((n) => n === 1).length, skips };
  });
}

for (const { who, email, paths } of SCREENS) {
  test(`${who}: every screen has a title, a language, one main landmark, one h1 and no skipped heading levels`, async ({ page }) => {
    expect((await page.request.post("/api/v1/auth/login", { data: { email, identifier: email, password } })).ok()).toBeTruthy();
    const problems: string[] = [];
    for (const path of paths) {
      await page.goto(path, { waitUntil: "load", timeout: 60_000 });
      await expect(page.locator("h1").first()).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(800);
      const found = await outline(page);
      if (!found.lang) problems.push(`${path}: no language`);
      if (found.title.length < 3) problems.push(`${path}: no page title`);
      if (found.mains !== 1) problems.push(`${path}: ${found.mains} main landmarks`);
      if (found.h1 !== 1) problems.push(`${path}: ${found.h1} top headings`);
      if (found.skips.length) problems.push(`${path}: heading levels skipped ${found.skips.slice(0, 3).join(", ")}`);
    }
    expect(problems).toEqual([]);
  });
}
