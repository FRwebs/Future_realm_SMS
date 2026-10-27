import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { LOCALES } from "@/i18n/locales";
import en from "@/messages/en.json";

const flatten = (value: unknown, prefix = ""): string[] =>
  value && typeof value === "object" ? Object.entries(value).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key)) : [prefix];
const englishKeys = new Set(flatten(en));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("translations", () => {
  it("gives every language exactly the keys English has", async () => {
    for (const locale of LOCALES.filter((code) => code !== "en")) {
      const other = (await import(`../../src/messages/${locale}.json`)).default;
      expect(new Set(flatten(other)), locale).toEqual(englishKeys);
    }
  });

  it("has a message for every key the code asks for", () => {
    const missing: string[] = [];
    for (const file of sourceFiles(join(process.cwd(), "src"))) {
      const text = readFileSync(file, "utf8");
      const hooks = [...text.matchAll(/const (\w+) = useTranslations\("([^"]+)"\)/g)].map((hook) => ({ name: hook[1]!, namespace: hook[2]! }));
      // A file can hold several hooks (one per component); a key must exist under at least one namespace the file opens.
      for (const name of new Set(hooks.map((hook) => hook.name))) {
        const namespaces = hooks.filter((hook) => hook.name === name).map((hook) => hook.namespace);
        for (const call of text.matchAll(new RegExp(`\\b${name}\\("([^"]+)"`, "g"))) {
          if (!namespaces.some((namespace) => englishKeys.has(`${namespace}.${call[1]}`))) missing.push(`${namespaces.join("|")} → ${call[1]}  (${file.replace(process.cwd() + "/", "")})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
