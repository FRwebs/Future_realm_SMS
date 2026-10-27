import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import IntlMessageFormat from "intl-messageformat";

import { ALL_LOCALES } from "@/i18n/locales";
import en from "@/messages/en.json";

const flatten = (value: unknown, prefix = ""): string[] =>
  value && typeof value === "object" ? Object.entries(value).filter(([key]) => key !== "_meta").flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key)) : [prefix];
const entries = (value: unknown, prefix = ""): Array<[string, string]> =>
  value && typeof value === "object" ? Object.entries(value).filter(([key]) => key !== "_meta").flatMap(([key, child]) => entries(child, prefix ? `${prefix}.${key}` : key)) : [[prefix, String(value)]];
const placeholders = (message: string) => [...message.matchAll(/\{(\w+)\s*[,}]/g)].map((match) => match[1]!).sort();
const englishKeys = new Set(flatten(en));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("translations", () => {
  it("gives every language exactly the keys English has", async () => {
    for (const locale of ALL_LOCALES.filter((code) => code !== "en")) {
      const other = (await import(`../../src/messages/${locale}.json`)).default;
      expect(new Set(flatten(other)), locale).toEqual(englishKeys);
    }
  });

  it("keeps every placeholder, and every message is valid message syntax", async () => {
    const english = new Map(entries(en));
    for (const locale of ALL_LOCALES) {
      const other = locale === "en" ? en : (await import(`../../src/messages/${locale}.json`)).default;
      for (const [key, message] of entries(other)) {
        expect(() => new IntlMessageFormat(message, locale), `${locale} ${key}`).not.toThrow();
        expect(placeholders(message), `${locale} ${key}`).toEqual(placeholders(english.get(key)!));
      }
    }
  });

  it("marks every non-English language a draft until it has been reviewed", async () => {
    for (const locale of ALL_LOCALES.filter((code) => code !== "en")) {
      const other = (await import(`../../src/messages/${locale}.json`)).default as { _meta?: { status?: string } };
      expect(other._meta?.status, locale).toBeDefined();
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
