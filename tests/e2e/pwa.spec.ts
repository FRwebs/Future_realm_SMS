import { expect, test } from "@playwright/test";

/**
 * The offline experience. A service worker only registers in a production build, so this runs against one:
 *
 *   npm run build:web && NEST_API_URL=http://127.0.0.1:4000 npx next start -p 3100
 *   PWA_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/e2e/pwa.spec.ts
 *
 * Without PWA_BASE_URL the tests are skipped (the dev server never registers the worker).
 */
const base = process.env.PWA_BASE_URL;
test.skip(!base, "needs a production build — see the note at the top of this file");
test.use({ baseURL: base });

test("installable: the manifest and icons are served", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  for (const icon of manifest.icons as Array<{ src: string }>) expect((await request.get(icon.src)).ok()).toBeTruthy();
});

test("a page that cannot be reached shows the offline page, and private data is never stored", async ({ page, context }) => {
  await page.goto("/login");
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Reload once so the worker is controlling the page and has stored the static files it saw.
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  const stored = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls: string[] = [];
    for (const name of names) for (const request of await (await caches.open(name)).keys()) urls.push(new URL(request.url).pathname);
    return urls;
  });
  expect(stored).toContain("/offline.html");
  expect(stored.some((path) => path.startsWith("/_next/static/"))).toBe(true);
  expect(stored.some((path) => path.startsWith("/api/"))).toBe(false);

  await context.setOffline(true);
  await page.goto("/forgot-password").catch(() => undefined);
  await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
  await context.setOffline(false);
});
