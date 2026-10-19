import { structureDrawer } from "@/lib/modules/live/documents";
import { apiGet } from "@/lib/api/server";
import { plural } from "@/lib/modules/live/m7-format";
import { FEES, createStructureDrawer, deleteStructureDrawer, duplicateDrawer, editItemsDrawer, mapClassDrawer, naira, nairaShort, publishDrawer, raiseDrawer, ruleDrawer, unmapDrawer } from "@/lib/modules/live/m10-forms";
import type { PublishPreview, StructureDetail, Structures } from "@/lib/modules/live/m10-types";
import type { FeePage } from "@/lib/modules/live/m10-collections";
import { pill, text, type KpiCard, type PanelFact, type PanelTone, type TabContent, type TableRow } from "@/lib/modules/panels";

/**
 * Structures: what each group of classes is charged, item by item. Several structures run side by
 * side — a class is mapped to one of each kind — and the fee items live inside them.
 */

export const loadStructures = () => apiGet<Structures>(`${FEES}/structures`);
export const loadStructureOptions = () => apiGet<{ terms: string[]; kinds: string[] }>(`${FEES}/structures/options`);
export const loadStructure = (id: string) => apiGet<StructureDetail>(`${FEES}/structures/${id}`);
export const loadPreview = (id: string) => apiGet<PublishPreview>(`${FEES}/structures/${id}/preview`);

const STATE_TONE: Record<string, PanelTone> = { Published: "positive", Draft: "attention", Archived: "neutral" };
const TYPE_TONE: Record<string, PanelTone> = { Mandatory: "positive", Optional: "neutral", Concession: "progress" };
const token = (kind: string, value: string) => `${kind}:${value}|`;
export const structureHref = (id: string) => `/fee-management/structures/${id}`;

export function structuresTab(data: Structures, terms: string[]): TabContent {
  const { totals, structures } = data;
  const create = createStructureDrawer(data, terms);
  const cards: KpiCard[] = [
    { label: "Structures", value: String(totals.count), sub: `${totals.published} published · ${totals.draft} draft` },
    { label: "Expected this term", value: nairaShort(totals.expected), sub: "Across every published structure" },
    { label: "Classes mapped", value: String(totals.classesMapped), unit: `of ${totals.classes}`, tone: totals.classesMapped >= totals.classes ? "positive" : "attention", sub: totals.classesMapped >= totals.classes ? "Every class is on one" : "A class on none is billed nothing" },
    { label: "Structure placements", value: totals.placements.toLocaleString("en-NG"), sub: totals.boarders ? `${totals.boarders} boarders carry two` : "Students billed on a structure" },
    { label: "Adjustment rules", value: String(totals.rules), sub: "An explicit line on each invoice", link: "See the rules", href: "/fee-management/structures/rules" },
    { label: "Discount exposure", value: nairaShort(totals.discount), tone: totals.discount ? "attention" : "neutral", sub: totals.expected ? `${((totals.discount / Math.max(1, totals.expected)) * 100).toFixed(1)}% of expected` : "Given on invoices so far" },
  ];
  const kinds = Array.from(new Set(structures.map((row) => row.kind)));
  const rows: TableRow[] = structures.map((row) => ({
    id: row.id,
    cells: [
      text(row.name, { strong: true }),
      text(row.ref, { mono: true }),
      row.mapped ? text(row.classes.join(", ")) : text("Not mapped to any class", { tone: "attention" }),
      text(String(row.items)),
      row.students ? text(String(row.students)) : text("—"),
      text(naira(row.termly), { mono: true, strong: true }),
      row.students ? text(naira(row.expected), { mono: true }) : text("Nothing billed", { tone: "attention" }),
      pill(row.state, STATE_TONE[row.state]),
      { kind: "action", label: "Open", href: structureHref(row.id) },
    ],
    href: structureHref(row.id),
    keywords: `${token("state", row.state)}${token("kind", row.kind)} ${row.classes.join(" ")}`,
  }));
  return {
    title: "Structures",
    desc: "Every fee structure, and the classes mapped to each.",
    primary: { label: "Create a structure", drawer: create },
    launchers: [
      { label: "Duplicate for next session", drawer: duplicateDrawer(data, terms) },
      { label: "Apply a percentage increase", drawer: raiseDrawer(data) },
      { label: "Adjustment rules", href: "/fee-management/structures/rules" },
    ],
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: "Fee structures", sub: data.term?.label, per: 6, cards }] },
      ...(data.unmappedStructures
        ? [{ cols: "1fr", panels: [{ type: "note" as const, tone: "attention" as PanelTone, title: `${plural(data.unmappedStructures, "published structure")} ${data.unmappedStructures === 1 ? "is" : "are"} not mapped to any class`, body: "A structure with no class bills nobody. Open it and map the classes it charges, and the next publication bills them.", acts: [{ label: "Open the first", href: structureHref(structures.find((row) => !row.mapped && row.state === "Published")!.id) }] }] }]
        : []),
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Every fee structure",
            tag: plural(totals.count, "structure"),
            sub: "Open a structure for the classes mapped to it and every fee item it charges.",
            meta: `${totals.published} published · ${totals.draft} draft · ${nairaShort(totals.expected)} expected this term`,
            noun: "structure",
            nounPlural: "structures",
            search: "Find a structure or a class",
            filters: [
              { label: "State", value: "All", options: ["All", "Published", "Draft", "Archived"], match: Object.fromEntries(["Published", "Draft", "Archived"].map((name) => [name, token("state", name)])) },
              { label: "Kind", value: "All", options: ["All", ...kinds], match: Object.fromEntries(kinds.map((name) => [name, token("kind", name)])) },
            ],
            acts: [{ label: "Compare two structures", drawer: duplicateDrawer(data, terms) }, { label: "Create a structure", primary: true, drawer: create }],
            head: ["Structure", "Ref", "Classes mapped", "Items", "Students", "Per term", "Expected", "State", ""],
            rows,
            per: 10,
            emptyTitle: "No fee structure yet",
            emptyBody: "Create the first one: the classes it charges and every item on it. Nothing is billed until you publish it.",
            foot: "A class sits on one structure of each kind at a time. A boarding student is billed their class structure plus the boarding supplement.",
          },
        ],
      },
      {
        cols: "1.1fr 1fr",
        panels: [
          {
            type: "table",
            title: "Adjustment rules",
            tuck: "Adjustment rules",
            sub: "Rules live here.",
            meta: `${plural(data.rules.length, "rule")}`,
            head: ["Rule", "Basis", "Value", "Families"],
            rows: data.rules.map((rule): TableRow => ({ cells: [{ kind: "name", name: rule.name, sub: rule.appliesTo, avatar: false }, text(rule.valueIs.replace("A ", "")), text(/percent/i.test(rule.valueIs) ? `${rule.value}%` : naira(rule.value)), text(rule.families === null ? "By hand" : String(rule.families))] })),
          },
          {
            type: "note",
            tone: "submitted",
            icon: "M6.5 3.5h8L18.5 8v12.5h-12zM14.5 3.5V8h4M9 12.5h6M9 16h4",
            title: "Publishing a structure generates invoices and notifies guardians",
            body: "The preview shows exactly what will happen before it happens — how many invoices, for whom, and how much. Open a draft structure and choose Preview and publish.",
            acts: structures.find((row) => row.state === "Draft") ? [{ label: "Open the first draft", href: structureHref(structures.find((row) => row.state === "Draft")!.id) }] : [],
          },
        ],
      },
    ],
  };
}

/** The adjustment rules, as a page of their own: add, change and remove. */
export function rulesPage(data: Structures): FeePage {
  const rows: TableRow[] = data.rules.map((rule) => ({
    id: rule.code,
    cells: [
      { kind: "name", name: rule.name, sub: rule.appliesTo, avatar: false },
      text(rule.valueIs.replace("A ", "")),
      text(/percent/i.test(rule.valueIs) ? `${rule.value}%` : naira(rule.value), { mono: true, strong: true }),
      text(rule.items.join(", ")),
      text(rule.families === null ? "Applied by hand" : String(rule.families)),
      text(rule.until),
      { kind: "action", label: "Edit", drawer: ruleDrawer(rule) },
    ],
    drawer: ruleDrawer(rule),
  }));
  return {
    title: "Adjustment rules",
    desc: "Discounts and concessions that appear as an explicit line on every invoice they touch.",
    crumb: { label: "Back to Structures", href: "/fee-management/structures" },
    primary: { label: "Add an adjustment rule", drawer: ruleDrawer() },
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "table" as const,
            title: "Every rule",
            tag: plural(data.rules.length, "rule"),
            sub: "“Second child onward” and “Every family” are applied automatically when a structure is published. A rule that depends on an event — paying early, topping the class — is applied by hand, and says so.",
            noun: "rule",
            nounPlural: "rules",
            head: ["Rule", "Basis", "Value", "Which items", "Families it touches", "Runs until", ""],
            rows,
            emptyTitle: "No adjustment rule",
            emptyBody: "Add one — a sibling discount, say — and it is applied as an explicit line on every invoice it touches.",
            foot: "An adjustment is always a visible line on an invoice, never a quietly reduced amount.",
          },
        ],
      },
    ],
  };
}

/* ───────────────────────────── one structure ───────────────────────────── */

export function structurePage(detail: StructureDetail, preview: PublishPreview, data: Structures, terms: string[]): FeePage {
  const draft = detail.state === "Draft";
  const optional = detail.items.filter((item) => item.type !== "Mandatory");
  const edit = editItemsDrawer(detail);
  const publish = publishDrawer(preview);
  const cards: KpiCard[] = [
    { label: "Compulsory a term", value: naira(detail.termly), sub: `${detail.items.filter((item) => item.type === "Mandatory").length} mandatory items` },
    { label: detail.kind === "Boarding supplement" ? "Boarders on it" : "Students on it", value: String(detail.students), tone: detail.students ? "neutral" : "attention", sub: detail.kind === "Boarding supplement" ? "Charged on top of their class" : detail.students ? "Billed so far" : "Nobody yet" },
    { label: "Classes mapped", value: String(detail.classes.length), sub: detail.classes.slice(0, 3).join(", ") || "None" },
    { label: "Fee items", value: String(detail.items.length), sub: `${detail.items.length - optional.length} mandatory · ${optional.length} optional` },
    { label: "Termly total", value: naira(detail.termlyAll), sub: "If every item is taken" },
    { label: "Sessional items", value: naira(detail.sessional), sub: "Charged once a session" },
  ];
  const itemRows: TableRow[] = detail.items.map((item) => ({
    id: item.id,
    cells: [
      text(item.name, { strong: true }),
      pill(item.type, TYPE_TONE[item.type] ?? "neutral"),
      text(item.freq),
      text(naira(item.amount), { mono: true, strong: true }),
      text(naira(item.expected), { mono: true }),
      item.pct === null ? text("—") : text(`${item.pct}% · ${naira(item.collected)}`, { strong: true, tone: item.pct >= 80 ? "positive" : "attention" }),
      { kind: "action", label: "Edit", drawer: edit },
    ],
    drawer: edit,
    keywords: `${item.type} ${item.freq}`,
  }));
  const levelRows: TableRow[] = detail.levels.map((level) => ({
    id: level.id,
    cells: [text(level.name, { strong: true }), text(String(level.students)), text(naira(level.billed), { mono: true }), level.pct === null ? text("—") : text(`${level.pct}%`, { strong: true, tone: level.pct >= 80 ? "positive" : "attention" }), { kind: "action", label: "Unmap", drawer: unmapDrawer(detail, level) }],
  }));
  const facts: PanelFact[] = [
    ["Reference", detail.ref, "Quoted on every invoice generated from it"],
    ["Kind", detail.kind, detail.kind === "Boarding supplement" ? "Charged on top of the class structure" : "A class sits on one of each kind"],
    ["State", detail.state, detail.state === "Published" ? "Invoices have been generated" : "Nothing has been billed"],
    ["Applies from", detail.termLabel ?? "The current term"],
    ["Applies to", detail.classes.join(", ") || "No class yet"],
    ...detail.rules.map((rule): PanelFact => [rule.name, /percent/i.test(rule.valueIs) ? `${rule.value}%` : naira(rule.value), rule.appliesTo]),
    ["Currency", "₦ Nigerian naira", "Set once for the school, never per structure"],
    ["Changes mid-term", "Restate the invoice", "Every affected family is told what changed and why"],
  ];
  return {
    title: detail.name,
    desc: `${detail.ref} · ${plural(detail.classes.length, "class", "classes")} · ${plural(detail.students, "student")} · ${naira(detail.termly)} a term.`,
    crumb: { label: "Back to Structures", href: "/fee-management/structures" },
    primary: draft ? { label: "Publish this structure", icon: "M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 19.5h15", drawer: publish } : { label: "Edit the fee items", icon: "M4 20h4L20 8l-4-4L4 16z", drawer: edit },
    launchers: [
      { label: "Preview and print", drawer: structureDrawer(detail.id, detail.name) },
      { label: "Map another class", drawer: mapClassDrawer(detail) },
      { label: "Duplicate for next session", drawer: duplicateDrawer(data, terms, detail) },
      { label: "Delete this structure", drawer: deleteStructureDrawer(detail) },
    ],
    rows: [
      ...(draft
        ? [{ cols: "1fr", panels: [{ type: "note" as const, tone: "attention" as PanelTone, icon: "M6.5 3.5h8L18.5 8v12.5h-12zM9 12.5h6M9 16h4", title: "This structure is a draft and nobody has been billed on it", body: "Publishing generates an invoice for every student in the mapped classes and notifies their guardians. The preview shows exactly what will happen before it happens.", acts: [{ label: "Preview and publish", drawer: publish }] }] }]
        : []),
      { cols: "1fr", panels: [{ type: "kpi", title: detail.name, per: 6, cards }] },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Fee items in this structure",
            tag: plural(detail.items.length, "item"),
            sub: "What a family on this structure is actually charged, item by item.",
            meta: `${naira(detail.termly)} compulsory a term · ${naira(detail.termlyAll + detail.sessional)} if every item is taken`,
            noun: "fee item",
            nounPlural: "items",
            search: "Find a fee item",
            filters: [
              { label: "Type", value: "All", options: ["All", "Mandatory", "Optional", "Concession"] },
              { label: "Frequency", value: "All", options: ["All", "Termly", "Sessional", "Once"] },
            ],
            acts: [{ label: "Apply a percentage increase", drawer: raiseDrawer(data, detail) }, { label: "Preview and print", drawer: structureDrawer(detail.id, detail.name) }, { label: "Add, edit or remove items", primary: true, drawer: edit }],
            head: ["Fee item", "Type", "Frequency", "Amount", "Expected", "Collected", ""],
            rows: itemRows,
            per: 12,
            emptyTitle: "No fee item",
            emptyBody: "A structure charges at least one item.",
            foot: "An optional item is only billed to the families who elect it, so its expected figure is lower than the roll.",
          },
        ],
      },
      {
        cols: "1.05fr 1fr",
        panels: [
          {
            type: "table",
            title: "Classes mapped to this structure",
            sub: "Every student in these classes is billed on it automatically.",
            meta: `${plural(detail.levels.length || detail.classes.length, "class", "classes")} · ${plural(detail.students, "student")}`,
            noun: "class",
            nounPlural: "classes",
            acts: [{ label: "Map another class", primary: true, drawer: mapClassDrawer(detail) }],
            head: ["Class", "Students", "Billed", "Collected", ""],
            rows: levelRows,
            emptyTitle: detail.classes[0] === "All classes" ? "Every class" : "No class mapped",
            emptyBody: detail.classes[0] === "All classes" ? "This structure charges every class." : "Map the classes it charges, and the next publication bills them.",
            foot: "A class can only be on one structure of this kind at a time — mapping it here removes it from wherever it was.",
          },
          { type: "facts", title: "How this structure behaves", tuck: "How this structure behaves", sub: "The rules that sit around the amounts.", per: 1, facts },
        ],
      },
    ],
  };
}
