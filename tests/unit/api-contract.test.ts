import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { API_ROUTES } from "@/lib/api/api-routes";

/**
 * Every endpoint the web app names in its source must be one the API really has. The list of endpoints is generated from the API's own
 * OpenAPI document (`npm run api:types`), so a misspelt path — or a route someone renamed on the server — fails here, not for a customer.
 * (The landing page once posted to a newsletter endpoint that did not exist yet; this is the test that would have said so.)
 */

const routes = API_ROUTES.map((route) => {
  const [method, path] = route.split(" ") as [string, string];
  return { method, path, pattern: new RegExp(`^${path.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{[^}]+\}/g, "[^/]+")}$`) };
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (name === "node_modules") return [];
    return statSync(full).isDirectory() ? sourceFiles(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

// "/api/v1/…" written as a string or template literal; ${…} stands for one path segment (or, at the end, a query string).
const LITERAL = /["'`](\/api\/(?:v1|super-admin|partner-portal)\/[^"'`\s]*)["'`]/g;

type Found = { file: string; path: string };
const found: Found[] = [];
for (const file of sourceFiles(join(process.cwd(), "src"))) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(LITERAL)) {
    const raw = match[1]!.replace(/\$\{[^}]*\}/g, "\uE000").split("?")[0]!;
    found.push({ file: file.replace(process.cwd() + "/", ""), path: raw });
  }
}

const concreteRoutes = routes.map((route) => route.path.replace(/\{[^}]+\}/g, "x"));

/**
 * A call is fine when it names a whole endpoint, or when it names the start of one — modules keep a base such as "/api/v1/class-structure"
 * in a constant and add the rest where they call. Either way the beginning must belong to a real endpoint, so a typo still fails.
 */
const matches = (path: string) => {
  // A segment made of a template placeholder stands for any one segment.
  const concrete = path.replace(/\uE000/g, "x").replace(/\/+$/, "");
  if (routes.some((route) => route.pattern.test(concrete))) return true;
  const start = concrete.replace(/x$/, "").replace(/\/+$/, "");
  return concreteRoutes.some((route) => route === start || route.startsWith(`${start}/`));
};

describe("API calls in the web app", () => {
  it("has a generated route list", () => {
    expect(routes.length).toBeGreaterThan(500);
  });

  it("only names endpoints that exist", () => {
    const missing = found.filter((item) => !matches(item.path)).map((item) => `${item.path}  (${item.file})`);
    expect([...new Set(missing)].sort()).toEqual([]);
  });
});
