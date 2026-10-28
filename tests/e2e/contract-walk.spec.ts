import { expect, test, type Page } from "@playwright/test";

/**
 * Opens a screen for every kind of person and fails on any that could not be drawn. Started against a server run with
 * `CONTRACT_MODE=strict`, a read whose answer no longer matches the type the page was written against stops that page — so the page, and
 * the read, are named here instead of the difference sitting unnoticed in a log. Without that setting it is a plain "does every screen open".
 *
 *   CONTRACT_MODE=strict npm run dev:web      # then:  npx playwright test tests/e2e/contract-walk.spec.ts
 */
const password = "FutureRealm123!";
test.describe.configure({ timeout: 1_800_000 });

const MODS: Record<string, string[]> = {
  "command-center": ["today", "oversight"], "school-configuration": ["profile", "calendar", "curriculum", "allocations", "policies"],
  "class-timetable": ["classes", "subjects", "teaching", "timetable", "lesson-notes", "homework", "coverage"], attendance: ["register", "mark", "compliance", "log"],
  "score-entry-results": ["review", "enter", "results"], "report-cards": ["remarks", "completion", "archive"],
  "staff-access": ["directory", "permissions", "payroll", "leave", "appraisal", "learning", "activity"], "student-records": ["registry", "admissions", "changes"],
  "parents-guardians": ["guardians", "submissions", "consent"], "fee-management": ["collections", "structures", "review", "history"],
  "subscription-billing": ["plan", "credits", "account"], "communication-center": ["compose", "sent", "automation"],
  "approvals-workflow": ["queue", "workflow", "performance"], "analytics-reports": ["insights", "reports", "compliance"],
  "audit-security": ["audit-log", "monitoring", "data-protection", "integrations"], "sync-support": ["sync", "help-support"],
  "lesson-notes": ["curriculum", "notes", "review", "coverage"], "my-employment": ["leave", "my-assignments", "appraisal", "payslips"], training: ["for-you", "catalogue", "certificates"],
};
const school = Object.entries(MODS).flatMap(([module, tabs]) => tabs.map((tab) => `/${module}/${tab}`));
const student = ["today", "timetable", "subjects", "assignments", "results", "attendance", "calendar", "messages", "profile", "notifications", "account"].map((page) => `/portals/student/${page}`);
const parent = ["", "/announcements", "/children", "/curriculum", "/messages", "/notifications", "/profile", "/tell-the-school"].map((page) => `/portals/parent${page}`);
const admin = ["", "analytics", "audit-logs", "billing", "communications", "config-library", "crm", "feature-flags", "help", "internal-team", "migration", "my-work", "partners", "profile", "schools", "security", "settings", "standards", "support", "system", "users"].map((page) => `/super-admin${page ? `/${page}` : ""}`);

async function walk(page: Page, email: string, paths: string[]) {
  expect((await page.request.post("/api/v1/auth/login", { data: { email, identifier: email, password } })).ok()).toBeTruthy();
  const broken: string[] = [];
  for (const path of paths) {
    // A page being compiled for the first time can drop the first request; asked again, a page that is really there answers.
    const open = () => page.goto(path, { waitUntil: "load", timeout: 90_000 }).catch(() => null);
    const response = (await open()) ?? (await open());
    if (!response || response.status() >= 500) {
      broken.push(`${path}: ${response ? `answered ${response.status()}` : "did not load"}`);
      continue;
    }
    const text = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
    if (/differs from its type|shape the page does not expect/.test(text)) broken.push(`${path}: ${(text.match(/.*(differs from its type|shape the page does not expect).*/)?.[0] ?? "").slice(0, 200)}`);
  }
  expect(broken).toEqual([]);
}

test("proprietor", async ({ page }) => walk(page, "proprietor@greenfieldcollege.ng", school));
test("teacher", async ({ page }) => walk(page, "teacher@greenfieldcollege.ng", ["/command-center/today", "/lesson-notes/notes", "/attendance/mark", "/score-entry-results/enter", "/my-employment/leave", "/training/for-you", "/student-records/registry", "/parents-guardians/guardians"]));
test("student", async ({ page }) => walk(page, "std-ss3-04@students.greenfieldcollege.ng", student));
test("parent", async ({ page }) => walk(page, "kemi-adeyemi-0001@parents.greenfieldcollege.ng", parent));
test("platform admin", async ({ page }) => walk(page, "admin@futurerealm.sms", admin));
