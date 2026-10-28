// Fails the build when a page ships more JavaScript than it is allowed to. "First load" is what a browser must fetch and run before the page
// works: the framework and shared chunks plus the page's own, gzipped as they travel. Run it after `next build`:
//
//   npm run budget                     # uses the limits below
//   BUDGET_ROUTE_KB=400 npm run budget
//
// The limits sit a little above where the app is today, so they only ever move down: a change that adds a heavy dependency to a page shows
// up here, with the page named, instead of as a slow screen on a school's phone.
import { existsSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const ROUTE_KB = Number(process.env.BUDGET_ROUTE_KB ?? 0) || null;
const manifestPath = ".next/app-build-manifest.json";
if (!existsSync(manifestPath)) {
  console.error("No build to measure — run `npm run build:web` first.");
  process.exit(1);
}
const { pages } = JSON.parse(readFileSync(manifestPath, "utf8"));
const sizeCache = new Map();
const gz = (file) => {
  if (!sizeCache.has(file)) sizeCache.set(file, gzipSync(readFileSync(`.next/${file}`)).length);
  return sizeCache.get(file);
};

const rows = Object.entries(pages)
  .filter(([route]) => route.endsWith("/page"))
  .map(([route, files]) => ({ route: route.replace(/\/page$/, "") || "/", kb: [...new Set(files.filter((file) => file.endsWith(".js")))].reduce((sum, file) => sum + gz(file), 0) / 1024 }))
  .sort((a, b) => b.kb - a.kb);

// Pages the Back Office and school workspaces are allowed to be heavier than the public ones, which are what a stranger meets first.
const limitFor = (route) => ROUTE_KB ?? (route.startsWith("/login") || route.startsWith("/forgot") || route.startsWith("/reset") || route.startsWith("/partner/login") || route === "/" ? 300 : 380);

console.log("First-load JavaScript (gzipped), heaviest first\n");
for (const row of rows.slice(0, 12)) console.log(`${row.kb.toFixed(0).padStart(5)} kB  ${row.route}`);
const over = rows.filter((row) => row.kb > limitFor(row.route));
if (over.length) {
  console.error(`\n${over.length} page(s) over their limit:`);
  for (const row of over) console.error(`  ${row.route}: ${row.kb.toFixed(0)} kB, limit ${limitFor(row.route)} kB`);
  process.exit(1);
}
console.log(`\nAll ${rows.length} pages are within their limits.`);
