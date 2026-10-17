import { apiGet } from "@/lib/api/server";
import { dayLabel, plural } from "@/lib/modules/live/m7-format";
import { consentTypeDrawer, familyConsentDrawer, requestConsentDrawer, viewDrawer, PG } from "@/lib/modules/live/m9-forms";
import type { ConsentOverview, FamilyRow } from "@/lib/modules/live/m9-types";
import { name as nameCell, pill, text, type KpiCard, type PanelTone, type TabContent, type TableRow } from "@/lib/modules/panels";

/**
 * Consent is the evidence a school produces when a regulator asks on what basis it holds a
 * child's data. Each consent here is one the school itself defined, recorded against the family —
 * one guardian answers once, however many children they have here.
 */

export const loadConsent = () => apiGet<ConsentOverview>(`${PG}/consent`);

const mark = (ok: boolean) => ({ kind: "mark" as const, ok });
const kids = (row: Pick<FamilyRow, "children">) => row.children.map((child) => `${child.name.split(" ")[0]} · ${child.arm}`).join("  ·  ");

export function consentTab(data: ConsentOverview): TabContent {
  const { types, rows, totals } = data;
  const request = requestConsentDrawer(data);
  const noCore = rows.filter((row) => row.consents.core !== "GIVEN");

  const cards: KpiCard[] = [
    { label: "Consent types", value: String(types.length), sub: `${totals.required} required · ${totals.optional} optional`, tone: "neutral", link: "Define one", drawer: consentTypeDrawer() },
    { label: "Complete", value: String(totals.complete), unit: `of ${totals.families}`, sub: "Everything on file", tone: "positive" },
    { label: "With a gap", value: String(totals.gaps), sub: totals.gaps ? "At least one missing" : "None", tone: totals.gaps ? "attention" : "positive", link: totals.gaps ? "Request it" : undefined, drawer: totals.gaps ? request : undefined },
    { label: "No core consent", value: String(totals.noCore), sub: totals.noCore ? `${plural(totals.noCoreChildren, "child", "children")} affected` : "None", tone: totals.noCore ? "negative" : "positive" },
  ];

  const typeRows: TableRow[] = types.map((type) => ({
    cells: [text(type.name, { strong: true }), text(type.who), pill(type.required ? "Required" : "Optional", type.required ? "attention" : "neutral"), text(type.covers), text(type.blocks), text(`${type.given} of ${totals.families}`, { mono: true }), type.gaps ? text(String(type.gaps), { mono: true, strong: true, tone: type.required ? "negative" : "attention" }) : text("—"), { kind: "action" as const, label: "Edit", drawer: consentTypeDrawer(type) }],
  }));
  const families: TableRow[] = rows.map((row) => ({
    id: row.id,
    drawer: familyConsentDrawer(row, types),
    keywords: `${row.name} ${row.phone} ${row.children.map((child) => `${child.name} level:${child.level} arm:${child.arm}`).join(" ")} coverage:${row.consent} noncore:${row.consents.core !== "GIVEN" ? "yes" : "no"}`,
    cells: [nameCell(row.name, `${row.relation} · ${row.phone}`), text(kids(row)), ...types.map((type) => mark(row.consents[type.code] === "GIVEN")), text(row.givenBy), { kind: "action" as const, label: "Open", drawer: familyConsentDrawer(row, types) }],
  }));

  return {
    title: "Consent",
    desc: "The consents this school needs, and which families have given them.",
    primary: { label: "Request the missing consent", icon: "M4 5.5h16v10.5H9l-5 4z", drawer: request },
    launchers: [{ label: "Define a consent type", drawer: consentTypeDrawer() }, { label: "Export the consent register", href: "/parents-guardians/consent/export" }],
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: `Across ${totals.families} families`, per: 4, cards }] },
      ...(noCore.length ? [{ cols: "1fr", panels: [{ type: "note" as const, tone: "negative" as PanelTone, title: `${plural(noCore.length, "family", "families")} ${noCore.length === 1 ? "has" : "have"} not given core record processing consent`, body: `This is the one that matters legally: without it the school has no recorded basis for holding these children's records at all, and nothing can be published to those families — not a report card, not an invoice. ${plural(totals.noCoreChildren, "child", "children")} ${totals.noCoreChildren === 1 ? "is" : "are"} affected.`, acts: [{ label: "Request it now", drawer: request }] }] }] : []),
      { cols: "1fr", panels: [{ type: "table", title: "The consents this school needs", tag: `${types.length} types`, tagTone: "neutral", sub: "Define a new one and it appears on every family's register.", meta: `${totals.required} required · ${totals.optional} optional`, filters: [{ label: "Standing", value: "All", options: ["All", "Required", "Optional"], column: 2 }], acts: [{ label: "Export the register", href: "/parents-guardians/consent/export" }, { label: "Define a consent type", primary: true, drawer: consentTypeDrawer() }], head: ["Consent", "Who gives it", "Standing", "What it covers", "What a gap blocks", "Given", "Gaps", ""], noun: "consent type", nounPlural: "consent types", noRowOpen: true, rows: typeRows, foot: "A consent is recorded against the family, not the child — one guardian answers once, however many children they have here." }] },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "What each family has given",
            tag: `${totals.gaps} with gaps`,
            tagTone: totals.gaps ? "attention" : "positive",
            sub: "Open a family to change a status or ask them for what is missing.",
            meta: `${totals.families} families · ${totals.complete} complete`,
            search: "Find by guardian, phone or child",
            filters: [
              { label: "Class", value: "All", options: ["All", ...data.options.levels], match: Object.fromEntries(data.options.levels.map((level) => [level, `level:${level}`])) },
              { label: "Arm", value: "All", options: ["All", ...data.options.arms], match: Object.fromEntries(data.options.arms.map((arm) => [arm, `arm:${arm}`])) },
              { label: "Coverage", value: "All", options: ["All", "Complete", "Any gap", "Nothing on file"], match: { Complete: "coverage:Complete", "Any gap": "coverage:Gaps", "Nothing on file": "coverage:None" } },
            ],
            acts: [{ label: "Export coverage", export: true }, { label: "Request the missing consent", primary: true, drawer: request }],
            head: ["Guardian", "Children · class and arm", ...types.map((type) => type.short), "Given by", ""],
            noun: "family",
            nounPlural: "families",
            per: 10,
            noRowOpen: true,
            rows: families,
            foot: "Opening a family shows every consent, lets you change a status, and tells them in the app in the same action.",
          },
        ],
      },
      {
        cols: "1fr",
        panels: [{ type: "list", tuck: "Withdrawals", title: "Withdrawals", sub: "A withdrawal is a decision, not a gap — it is never chased.", items: data.withdrawals.length ? data.withdrawals.map((entry) => ({ label: `${plural(entry.count, "family", "families")} · ${entry.name.toLowerCase()}`, sub: `${entry.who.join(", ")}${entry.latest ? ` · latest ${dayLabel(entry.latest)}` : ""}`, pill: "Withdrawn", tone: "withheld" as PanelTone, viewLabel: "Open", drawer: viewDrawer("Consent · withdrawals", entry.name, `${plural(entry.count, "family", "families")} withdrew it`, entry.who.map((who) => [who, "Withdrawn"] as [string, string]), "A withdrawal takes effect immediately, everywhere, and is never chased.") })) : [{ label: "Nobody has withdrawn any consent", sub: "A withdrawal is a decision, not a gap.", pill: "None", tone: "positive" as PanelTone }] }],
      },
      {
        cols: "1fr",
        panels: [{ type: "facts", tuck: "How consent is evidenced", title: "How consent is evidenced here", sub: "What this school can show if it is ever asked.", per: 3, facts: [["Recorded against", "The family, never the child", "One guardian answers once for every child they have here"], ["Captured by", "In person, on paper, or in the guardian portal", "The means is stored with the consent"], ["Evidence held", "Who, when, and by what means", "Every grant and withdrawal is logged with who recorded it"], ["Withdrawal", "Any time, from the portal or in person", "Takes effect immediately, everywhere"], ["Emergency broadcast", "Exempt from notification consent", "A school can always reach a family about safety"], ["Audit", "Every grant and withdrawal is logged", "Including who recorded it"]] }],
      },
    ],
  };
}
