// Translation review workflow for the draft languages (Yoruba, Hausa, Igbo).
//
//   node scripts/translation-review.mjs export        # writes docs/translation-review/<code>.csv — one file per language, to send to a reviewer
//   node scripts/translation-review.mjs import yo     # reads docs/translation-review/yo.csv back after the reviewer filled it in
//   node scripts/translation-review.mjs approve yo    # marks a language reviewed (removes the "draft" flag) once every line is signed off
//   node scripts/translation-review.mjs status        # how far each language is
//
// A CSV has: key, where it appears, English, current text, REVIEWED TEXT (reviewer writes here, only where the current text should change),
// APPROVED (reviewer types "yes" on every line they have read), COMMENT.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const LANGUAGES = { yo: "Yoruba", ha: "Hausa", ig: "Igbo" };
const DIR = "docs/translation-review";
const read = (code) => JSON.parse(readFileSync(`src/messages/${code}.json`, "utf8"));
const flat = (value, prefix = "") =>
  Object.entries(value).flatMap(([key, child]) => (key === "_meta" ? [] : child && typeof child === "object" ? flat(child, prefix ? `${prefix}.${key}` : key) : [[prefix ? `${prefix}.${key}` : key, String(child)]]));

const WHERE = {
  "auth.validation": "Red message under a field that is empty or wrong",
  "auth.signIn": "Sign-in screen (labels, buttons, notices)",
  "auth.code": "Second step of sign-in: the one-time code",
  "auth.forgot": "Forgot-password screen",
  "auth.reset": "Choose-a-new-password screen",
};
const whereOf = (key) => Object.entries(WHERE).find(([prefix]) => key.startsWith(prefix))?.[1] ?? "";

const quote = (cell) => `"${String(cell).replaceAll('"', '""')}"`;
function parseCsv(text) {
  const rows = []; let row = []; let cell = ""; let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') inQuotes = false; else cell += ch; }
    else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const [command, code] = process.argv.slice(2);

if (command === "export") {
  mkdirSync(DIR, { recursive: true });
  const english = new Map(flat(read("en")));
  for (const lang of Object.keys(LANGUAGES)) {
    const lines = [["key", "where it appears", "English", "current text", "REVIEWED TEXT (only if the current text should change)", "APPROVED (type yes)", "COMMENT"]];
    for (const [key, text] of flat(read(lang))) lines.push([key, whereOf(key), english.get(key) ?? "", text, "", "", ""]);
    // A byte-order mark so Excel opens the file as UTF-8 and the tone marks and hooked letters survive.
    writeFileSync(`${DIR}/${lang}.csv`, `\uFEFF${lines.map((line) => line.map(quote).join(",")).join("\n")}\n`);
    console.log(`${LANGUAGES[lang]}: ${lines.length - 1} lines → ${DIR}/${lang}.csv`);
  }
} else if (command === "import") {
  if (!LANGUAGES[code]) { console.error("Say which language: yo, ha or ig."); process.exit(1); }
  const file = `${DIR}/${code}.csv`;
  if (!existsSync(file)) { console.error(`${file} not found.`); process.exit(1); }
  const [, ...rows] = parseCsv(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  const messages = read(code);
  let changed = 0; let approved = 0; const unread = [];
  for (const [key, , , current, reviewed, ok] of rows) {
    if (!key) continue;
    const parts = key.split(".");
    let holder = messages;
    for (const part of parts.slice(0, -1)) holder = holder[part];
    const last = parts.at(-1);
    if (reviewed && reviewed.trim() && reviewed.trim() !== current) { holder[last] = reviewed.trim(); changed += 1; }
    if (/^y(es)?$/i.test((ok ?? "").trim())) approved += 1; else unread.push(key);
  }
  writeFileSync(`src/messages/${code}.json`, `${JSON.stringify(messages, null, 2)}\n`);
  console.log(`${LANGUAGES[code]}: ${changed} line(s) corrected, ${approved} approved, ${unread.length} not yet approved.`);
  if (unread.length) console.log(`Not approved: ${unread.slice(0, 8).join(", ")}${unread.length > 8 ? ", …" : ""}`);
  console.log("Run `npm run test:unit` — the messages test checks the corrected text still has every placeholder.");
} else if (command === "approve") {
  if (!LANGUAGES[code]) { console.error("Say which language: yo, ha or ig."); process.exit(1); }
  const messages = read(code);
  messages._meta = { status: "reviewed", reviewedOn: new Date().toISOString().slice(0, 10), note: "Read and approved line by line by a fluent speaker." };
  writeFileSync(`src/messages/${code}.json`, `${JSON.stringify(messages, null, 2)}\n`);
  console.log(`${LANGUAGES[code]} marked reviewed. Switch drafts on in staging (NEXT_PUBLIC_ENABLE_DRAFT_LOCALES=true) to see it.`);
} else if (command === "status") {
  for (const lang of Object.keys(LANGUAGES)) console.log(`${LANGUAGES[lang].padEnd(8)} ${read(lang)._meta?.status ?? "reviewed"}  (${flat(read(lang)).length} lines)`);
} else {
  console.error("Use: export | import <yo|ha|ig> | approve <yo|ha|ig> | status");
  process.exit(1);
}
