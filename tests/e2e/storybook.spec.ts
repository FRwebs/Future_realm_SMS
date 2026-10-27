import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Every story is a component in a known state; each must render without errors and pass axe. Run against a built Storybook:
 *
 *   npm run build-storybook && npx http-server storybook-static -p 6006   # or any static server
 *   STORYBOOK_URL=http://127.0.0.1:6006 npx playwright test tests/e2e/storybook.spec.ts
 *
 * Skipped unless STORYBOOK_URL is set.
 */
const base = process.env.STORYBOOK_URL;
test.skip(!base, "needs a running Storybook — see the note at the top of this file");
test.describe.configure({ mode: "parallel", timeout: 180_000 });

type Entry = { id: string; title: string; name: string; type: string };

test("every story renders and has no serious accessibility violations", async ({ page, request }) => {
  const index = (await (await request.get(`${base}/index.json`)).json()) as { entries: Record<string, Entry> };
  const stories = Object.values(index.entries).filter((entry) => entry.type === "story");
  expect(stories.length).toBeGreaterThan(5);

  const problems: string[] = [];
  for (const story of stories) {
    const errors: string[] = [];
    page.removeAllListeners("pageerror");
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/iframe.html?id=${story.id}&viewMode=story`);
    await page.waitForSelector("body.sb-show-main, body.sb-show-errordisplay", { timeout: 15_000 });
    await page.waitForTimeout(400);
    if (await page.locator("body.sb-show-errordisplay").count()) errors.push(`story failed to render: ${(await page.locator(".sb-errordisplay").innerText()).slice(0, 200)}`);
    const results = await new AxeBuilder({ page }).include("#storybook-root").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    for (const violation of results.violations.filter((item) => item.impact === "serious" || item.impact === "critical")) {
      errors.push(`${violation.id}: ${violation.nodes[0]?.failureSummary?.split("\n")[1]?.trim() ?? violation.help}`);
    }
    if (errors.length) problems.push(`${story.title} / ${story.name}: ${errors.join("; ")}`);
  }
  expect(problems).toEqual([]);
});
