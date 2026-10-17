import { apiGet } from "@/lib/api/server";
import { API } from "@/lib/modules/live/m7-forms";
import { dayLong, plural } from "@/lib/modules/live/m7-format";
import {
  completeReviewDrawer,
  copySetDrawer,
  deadlineDrawer,
  defineKpiDrawer,
  flowPanel,
  flowStageDrawer,
  kpiDrawer,
  moderationDrawer,
  publishCycleDrawer,
  remindDrawer,
  resetSetDrawer,
  returnReviewDrawer,
  reviewDrawer,
} from "@/lib/modules/live/m7-pay-forms";
import type { AppraisalOne, AppraisalOverview, Moderation } from "@/lib/modules/live/m7-types";
import { isAutomaticSource, type KpiSetName } from "@/lib/modules/staff-policy";
import {
  name as nameCell,
  pill,
  text,
  type GridCell,
  type KpiCard,
  type PanelFact,
  type PanelTone,
  type TabContent,
  type TableRow,
} from "@/lib/modules/panels";

/**
 * Appraisal: a KPI set per kind of role, published to the people on it, completed by them,
 * reviewed by their manager, then moderated. A KPI is read from a figure the product holds,
 * or rated by a named person — never a number somebody simply types.
 */

export const loadAppraisal = () => apiGet<AppraisalOverview>(`${API}/appraisal`);
export const loadModeration = () => apiGet<Moderation>(`${API}/appraisal/moderation`);
export const loadAppraisalOne = (id: string) => apiGet<AppraisalOne>(`${API}/appraisal/people/${id}`);

const STAGE_TONE: Record<string, PanelTone> = { Complete: "positive", "With you": "attention", "Self-assessment": "progress", "Not started": "neutral" };
const REGISTER = "/staff-access/appraisal/export";
const cap = (value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
const five = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)} of 5`);
const token = (kind: string, value: string) => `${kind}:${value}|`;

export const roleHref = (role: string) => `/staff-access/appraisal/roles/${encodeURIComponent(role)}`;
export const reviewHref = (id: string) => `/staff-access/appraisal/people/${id}`;

export function appraisalTab(data: AppraisalOverview, moderation: Moderation): TabContent {
  const { cycle, kpis, people, roles, sets, flow } = data;
  const mine = people.filter((person) => person.stage === "With you" && person.isReviewer && person.appraisalId);
  const first = mine[0];
  const publish = publishCycleDrawer(data);
  const setNames = Object.keys(sets);

  const cards: KpiCard[] = [
    { label: "Cycle", value: cycle.name.split(" ").slice(0, 2).join(" "), sub: cycle.published ? `Published ${cycle.publishedAt ? dayLong(cycle.publishedAt) : ""}${cycle.deadline ? ` · closes ${dayLong(cycle.deadline)}` : ""}` : `${cycle.name} · not yet published`, tone: cycle.published ? "neutral" : "attention", ...(cycle.published ? {} : { link: "Publish it", drawer: publish }) },
    { label: "Published to", value: String(kpis.published), unit: "staff", sub: `Across ${plural(setNames.length, "KPI set")}` },
    { label: "Completed by staff", value: String(kpis.completed), unit: `of ${kpis.published}`, tone: "progress", sub: `${kpis.writing} still writing theirs` },
    { label: "Waiting on your review", value: String(kpis.withMe), tone: kpis.withMe ? "attention" : "positive", sub: kpis.withMe ? "They have come back to you" : "Nothing waiting", ...(kpis.withMe && first ? { link: "Review them", href: reviewHref(first.appraisalId as string) } : {}) },
    { label: "Average rating", value: kpis.average === null ? "—" : kpis.average.toFixed(1), unit: kpis.average === null ? undefined : "of 5", sub: moderation.reviewed ? `${moderation.reviewed} reviews so far` : "No review is complete yet" },
  ];

  const roleRows: TableRow[] = roles.map((role) => ({
    id: role.role,
    cells: [
      text(role.role, { strong: true }),
      text(cap(role.set)),
      text(String(role.kpis)),
      text(`${Math.round(role.weight)}%`, { mono: true, strong: true, tone: role.publishable ? "positive" : "negative" }),
      text(`${role.automatic} read from the product · ${role.kpis - role.automatic} rated by the manager`),
      text(String(role.people)),
      pill(role.people ? (role.publishable ? "Publishable" : "Weights off") : "Not in use", role.people ? (role.publishable ? "positive" : "negative") : "neutral"),
      { kind: "action", label: "Open", href: roleHref(role.role) },
    ],
    href: roleHref(role.role),
    keywords: `${token("set", cap(role.set))}${token("pub", role.people ? (role.publishable ? "Publishable" : "Weights off") : "Not in use")}`,
  }));

  const personRows: TableRow[] = people.map((person) => {
    const href = person.appraisalId ? reviewHref(person.appraisalId) : undefined;
    const rating = person.mine;
    return {
      id: person.id,
      cells: [
        nameCell(person.name, person.department),
        text(person.role),
        text(cap(person.set)),
        person.stage === "Not started" ? text("Not started", { tone: "negative", strong: true }) : person.selfScore ? text("Submitted", { tone: "positive" }) : person.stage === "Complete" ? text("Not recorded") : text("In progress", { tone: "attention" }),
        person.evidence ? text(String(person.evidence)) : text("—"),
        text(five(person.selfScore), { mono: true }),
        text(five(person.mine), { mono: true, strong: Boolean(person.mine) }),
        pill(person.stage, STAGE_TONE[person.stage] ?? "neutral"),
        href ? { kind: "action", label: person.stage === "With you" && person.isReviewer ? "Review" : "Open", href } : { kind: "action", label: "Publish", drawer: publish },
      ],
      href,
      keywords: `${token("stage", person.stage)}${token("set", cap(person.set))}${token("rating", rating === null ? "Not rated" : rating >= 4 ? "4 and above" : rating >= 3 ? "3 to 4" : "Below 3")}`,
    };
  });

  return {
    title: "Appraisal",
    desc: "KPIs per role: published, self-assessed, then reviewed by the manager.",
    ...(first ? { primary: { label: `Review the ${mine.length} that ${mine.length === 1 ? "has" : "have"} come back`, icon: "M5 12h13M13 6.5l5.5 5.5L13 17.5", href: reviewHref(first.appraisalId as string) } } : {}),
    launchers: [
      { label: "Define a KPI", drawer: defineKpiDrawer() },
      { label: "Publish the cycle to staff", drawer: publish },
      { label: "Change how the cycle runs", drawer: flowStageDrawer("appraisal", flow, 0) },
      { label: "Moderate the ratings", drawer: moderationDrawer(moderation) },
      { label: "Export the cycle", href: REGISTER },
    ],
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: "Where the cycle stands", sub: cycle.name, per: 5, cards }] },
      { cols: "1fr", panels: [flowPanel("appraisal", flow, { title: "How this cycle runs", sub: `Where the ${cycle.name} cycle stands. Edit, reorder or remove any stage.`, tag: cycle.published ? "Published" : "Not published", tagTone: cycle.published ? "progress" : "attention", nowIndex: !cycle.published ? 0 : kpis.withMe ? 2 : kpis.writing ? 1 : 3 })] },
      {
        cols: "1fr",
        panels: [
          {
            type: "facts",
            title: "How a rating is arrived at",
            tuck: "How a rating is arrived at",
            sub: "So the same performance gets the same number in every department.",
            per: 1,
            facts: [
              ["Automatic KPIs", "Read from the product", "Registers, score sheets, report-card remarks — where the product holds the figure"],
              ["Where it holds none", "The KPI says so, and the manager rates it", "Never an invented number"],
              ["Rated KPIs", "Scored by the manager, with evidence", "Observations, conduct"],
              ["Weighting", "Each KPI carries its weight", "The set must total 100 to be published"],
              ["The staff member first", "They self-assess against the same KPIs", "They see the automatic figures too"],
              ["Then the manager", "Agrees, or differs with a reason", "A silent disagreement is not a review"],
              ["Then moderation", "Managers compared against each other", "Outliers are a conversation, never an edit"],
              ["Outcome", "Rating, comments, and any step increase", "A step increase is mapped in Payroll as a named variation"],
            ] as PanelFact[],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "KPI sets, by role",
            tag: `${roles.length} roles`,
            sub: "Open a role to set its KPIs. Nothing publishes until the weights total 100.",
            meta: "A person is appraised against their role’s set — never against a set written for somebody else",
            noun: "role",
            nounPlural: "roles",
            search: "Find a role",
            filters: [
              { label: "Set", value: "All", options: ["All", "Teaching", "Leadership", "Support"], match: Object.fromEntries(["Teaching", "Leadership", "Support"].map((name) => [name, token("set", name)])) },
              { label: "Published", value: "All", options: ["All", "Publishable", "Weights off", "Not in use"], match: Object.fromEntries(["Publishable", "Weights off", "Not in use"].map((name) => [name, token("pub", name)])) },
            ],
            acts: [{ label: "Define a KPI", drawer: defineKpiDrawer() }, { label: "Publish the cycle", primary: true, drawer: publish }],
            head: ["Role", "KPI set", "KPIs", "Weight", "Where the numbers come from", "People", "State", ""],
            rows: roleRows,
            per: 11,
            foot: "A KPI a school cannot measure is not a KPI — it is a hope. Every KPI here either reads a figure the product already holds, or is rated by a named person against stated evidence.",
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Where each person is",
            tag: `${mine.length} with you`,
            tagTone: mine.length ? "attention" : "positive",
            sub: "One line per person. Open anyone to read their self-assessment and write the review.",
            meta: `${cycle.name}${cycle.deadline ? ` · closes ${dayLong(cycle.deadline)}` : ""} · ${people.filter((person) => person.stage === "Complete").length} complete`,
            noun: "staff member",
            nounPlural: "staff",
            search: "Find a staff member",
            filters: [
              { label: "Stage", value: "All", options: ["All", "Not started", "Self-assessment", "With you", "Complete"], match: Object.fromEntries(["Not started", "Self-assessment", "With you", "Complete"].map((name) => [name, token("stage", name)])) },
              { label: "KPI set", value: "All", options: ["All", "Teaching", "Leadership", "Support"], match: Object.fromEntries(["Teaching", "Leadership", "Support"].map((name) => [name, token("set", name)])) },
              { label: "Rating", value: "All", options: ["All", "4 and above", "3 to 4", "Below 3", "Not rated"], match: Object.fromEntries(["4 and above", "3 to 4", "Below 3", "Not rated"].map((name) => [name, token("rating", name)])) },
            ],
            acts: [{ label: "Send a reminder", drawer: remindDrawer() }, ...(first ? [{ label: "Review the next one", primary: true, href: reviewHref(first.appraisalId as string) }] : [])],
            selectable: true,
            bulkActs: [
              { label: "Send a reminder", drawer: remindDrawer(), selection: { key: "people", noun: "person" } },
              { label: "Extend the deadline", drawer: deadlineDrawer(cycle.deadline) },
              { label: "Export selected", primary: true, export: true },
            ],
            head: ["Staff member", "Role", "KPI set", "Self-assessment", "Evidence", "Their score", "Reviewer’s score", "Stage", ""],
            rows: personRows,
            per: 10,
            emptyTitle: "The cycle has not been published",
            emptyBody: "Publish it and every person appears here against their role’s KPIs.",
            empty: "Nobody matches.",
            foot: "A self-assessment far above the manager’s rating is not a problem to hide — it is the most useful conversation in the cycle.",
          },
        ],
      },
    ],
  };
}

/* ───────────────────────────── one role's KPIs ───────────────────────────── */

export function roleKpiPage(data: AppraisalOverview, role: string) {
  const summary = data.roles.find((item) => item.role === role);
  if (!summary) return null;
  const setName = summary.set as KpiSetName;
  const set = data.sets[setName];
  const kpis = set.kpis;
  const total = kpis.reduce((sum, item) => sum + item.weight, 0);
  const ok = Math.round(total) === 100;
  const auto = kpis.filter((item) => isAutomaticSource(item.source));
  const sameSet = data.people.filter((person) => person.set === setName);
  const onRole = data.people.filter((person) => person.role === role);
  const publish = publishCycleDrawer(data);
  const cards: KpiCard[] = [
    { label: "KPIs", value: String(kpis.length), sub: `${auto.length} automatic · ${kpis.length - auto.length} rated by a manager` },
    { label: "Weights", value: `${Math.round(total)}%`, tone: ok ? "positive" : "negative", sub: ok ? "Exactly 100 — publishable" : "Must total 100 before publishing" },
    { label: "People on this role", value: String(onRole.length), sub: onRole.length ? onRole.slice(0, 3).map((person) => person.name.split(" ").slice(-1)[0]).join(", ") : "Nobody yet" },
    { label: "Measured by the product", value: `${Math.round(auto.reduce((sum, item) => sum + item.weight, 0))}%`, tone: "positive", sub: "Of the total weight · not open to opinion" },
    { label: "Last changed", value: set.changedAt ? dayLong(set.changedAt).replace(/ \d{4}$/, "") : "Standard", sub: set.changedBy ? `By ${set.changedBy}` : "As the product ships it" },
  ];
  const cells = (index: number): GridCell[] => {
    const item = kpis[index];
    return [
      { value: item.name, bold: true },
      { value: item.measure },
      { value: item.source, static: true },
      { value: String(item.weight), num: true, bold: true, bad: !ok },
      { value: item.target },
    ];
  };
  const peopleRows: TableRow[] = sameSet.map((person) => ({
    id: person.id,
    cells: [nameCell(person.name, person.role), text(person.department), pill(person.stage, STAGE_TONE[person.stage] ?? "neutral"), person.appraisalId ? { kind: "action" as const, label: "Open", href: reviewHref(person.appraisalId) } : text("—")],
    href: person.appraisalId ? reviewHref(person.appraisalId) : undefined,
  }));
  return {
    title: `${role} · KPIs`,
    desc: `${auto.length} of ${kpis.length} KPIs read a figure the product already holds. This is the ${setName} set — it applies to every role on it.`,
    crumb: { label: "Back to Appraisal", href: "/staff-access/appraisal" },
    primary: { label: ok ? `Publish to the ${data.people.length ? plural(sameSet.length, "person", "people") : "staff"}` : "Weights must total 100 to publish", icon: ok ? "M5 12h13M13 6.5l5.5 5.5L13 17.5" : "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z", drawer: publish },
    launchers: [
      { label: "Define a KPI", drawer: kpiDrawer(setName) },
      { label: "Copy this set to another", drawer: copySetDrawer(setName) },
      { label: "Reset to the standard", drawer: resetSetDrawer(setName) },
    ],
    rows: [
      { cols: "1fr" as const, panels: [{ type: "kpi" as const, title: `${cap(setName)} set`, sub: role, per: 5, cards }] },
      {
        cols: "1fr",
        panels: [
          {
            type: "grid" as const,
            title: "The KPIs for this set",
            sub: "One line per KPI: what it is, how it is measured, where the number comes from, what it is worth. Type over any cell and save.",
            cols: "1.15fr 1.4fr 1.05fr 0.5fr 1fr",
            right: [3],
            head: ["KPI", "How it is measured", "Where the number comes from", "Weight", "Target"],
            rows: kpis.map((_, index) => ({ id: String(index), cells: cells(index), remove: { endpoint: `${API}/appraisal/sets/${setName}/kpis/${index}`, method: "DELETE" as const, warn: "It leaves the set. Weights will no longer total 100, so the set cannot publish until you fix them." } })),
            acts: [{ label: "Define a KPI in full", drawer: kpiDrawer(setName) }],
            save: { endpoint: `${API}/appraisal/sets/${setName}`, method: "PATCH" as const, keys: ["name", "measure", "source", "weight", "target"], label: "Save the set", done: "Saved. If the weights no longer total 100, the set cannot publish until they do." },
            draft: {
              label: "Add a KPI",
              cells: [{ value: "", placeholder: "What is being measured" }, { value: "", placeholder: "How it is measured, in a sentence" }, { value: "Manager rating", static: true }, { value: "", num: true, placeholder: "%" }, { value: "", placeholder: "Target" }] as GridCell[],
              add: { endpoint: `${API}/appraisal/sets/${setName}/kpis`, method: "POST" as const, keys: ["name", "measure", "source", "weight", "target"] },
            },
            meter: {
              label: `Weights total ${Math.round(total)}% of 100`,
              column: 3,
              target: 100,
              unit: "%",
              note: total > 100 ? `Over 100 — somebody’s rating would exceed the scale. Reduce ${Math.round(total - 100)}%.` : `${Math.round(100 - total)}% is unallocated, so part of the rating would come from nowhere.`,
              okNote: "Publishable. Every KPI carries its stated share of the rating.",
            },
          },
        ],
      },
      {
        cols: "1.1fr 1fr",
        panels: [
          { type: "table" as const, title: "Who is appraised on this set", tag: plural(sameSet.length, "person", "people"), sub: "Open anyone to see where they are in the cycle.", noun: "person", nounPlural: "people", head: ["Staff member", "Department", "Stage", ""], rows: peopleRows, empty: "Nobody is on this set.", per: 10 },
          {
            type: "facts" as const,
            title: "What makes a KPI usable",
            tuck: "What makes a KPI usable",
            sub: "So it survives moderation.",
            per: 1,
            facts: [
              ["One thing", "Measurable, with a target", "Not “be a good colleague”"],
              ["A named source", "A figure the product holds, or a named rater", "If you cannot say where the number comes from, it is a hope"],
              ["A weight", "Its share of the rating", "The set totals 100"],
              ["No figure yet", "Says so, and the manager rates it", "Never an invented number"],
            ] as PanelFact[],
          },
        ],
      },
    ],
  };
}

/* ───────────────────────────── one appraisal ───────────────────────────── */

export function appraisalOnePage(one: AppraisalOne) {
  const first = one.name.split(" ")[0];
  const draft = one.status === "DRAFT";
  const review = reviewDrawer(one);
  const complete = completeReviewDrawer(one);
  const rated = one.kpis.filter((item) => item.mine || item.auto !== null).length;
  const cards: KpiCard[] = [
    { label: "Their rating", value: one.kpis.some((item) => item.self) ? (one.kpis.reduce((sum, item) => sum + (item.self ?? 0), 0) / Math.max(1, one.kpis.filter((item) => item.self).length)).toFixed(1) : "—", unit: "of 5", sub: one.kpis.some((item) => item.self) ? "Their own self-assessment" : "They have not self-assessed yet" },
    { label: "The product says", value: one.kpis.some((item) => item.auto !== null) ? (one.kpis.filter((item) => item.auto !== null).reduce((sum, item) => sum + (item.auto as number), 0) / one.kpis.filter((item) => item.auto !== null).length).toFixed(1) : "—", unit: "of 5", sub: `${one.kpis.filter((item) => item.auto !== null).length} of ${one.kpis.length} KPIs have a figure behind them` },
    { label: "Reviewer’s rating", value: one.overall ? one.overall.toFixed(1) : "—", unit: "of 5", tone: one.overall ? "positive" : "neutral", sub: one.overall ? `${one.reviewer} · weighted` : `${one.reviewer} has not rated yet` },
    { label: "KPIs covered", value: `${rated}`, unit: `of ${one.kpis.length}`, tone: rated === one.kpis.length ? "positive" : "attention", sub: rated === one.kpis.length ? "Ready to complete" : "Each needs a rating or a figure" },
    { label: "Status", value: draft ? "Draft" : one.status === "ACKNOWLEDGED" ? "Acknowledged" : "Shared", tone: draft ? "attention" : "positive", sub: one.sharedAt ? `Shared ${dayLong(one.sharedAt)}` : "Not shared with them yet" },
  ];
  return {
    title: `${one.name} · ${one.cycle}`,
    desc: `${one.role} · ${one.department} · reviewed by ${one.reviewer}`,
    crumb: { label: "Back to Appraisal", href: "/staff-access/appraisal" },
    primary: draft && one.isReviewer ? { label: "Write your review", drawer: review } : undefined,
    launchers: draft && one.isReviewer ? [{ label: "Complete the review", drawer: complete }, { label: "Return for evidence", drawer: returnReviewDrawer(one) }] : [],
    rows: [
      { cols: "1fr" as const, panels: [{ type: "kpi" as const, title: "Where it stands", sub: `${cap(one.set)} set`, per: 5, cards }] },
      {
        cols: "1fr",
        panels: [
          {
            type: "table" as const,
            title: "KPI by KPI",
            sub: "What they said, what the product says, and what the reviewer says.",
            noun: "KPI",
            nounPlural: "KPIs",
            head: ["KPI", "Target", "Weight", "They said", "The product says", "Reviewer says", "Source"],
            rows: one.kpis.map((kpi): TableRow => ({
              id: kpi.name,
              cells: [
                { kind: "name", name: kpi.name, sub: kpi.measure, avatar: false },
                text(kpi.target),
                text(`${kpi.weight}%`, { mono: true }),
                text(kpi.self ? `${kpi.self} of 5` : "Not yet", { tone: kpi.self ? undefined : "attention" }),
                text(kpi.auto !== null ? `${kpi.auto.toFixed(1)} of 5` : isAutomaticSource(kpi.source) ? "No figure held yet" : "Not measured", { tone: kpi.auto !== null ? "positive" : undefined }),
                text(kpi.mine ? `${kpi.mine} of 5` : "Not rated", { strong: Boolean(kpi.mine), tone: kpi.mine ? undefined : "attention" }),
                text(kpi.source),
              ],
            })),
            foot: "Where the product holds no figure the manager’s rating is the rating. Where it holds one, a differing rating needs a reason in the review.",
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "quotes" as const,
            title: "In their words, and the reviewer’s",
            quotes: [
              { label: `${first}’s own words`, by: one.name, role: one.role, text: one.staffComment ?? undefined, emptyText: `${first} has not written anything yet.` },
              { label: "What they do well", by: one.reviewer, text: one.strengths ?? undefined, emptyText: "Not written yet." },
              { label: "What would help them", by: one.reviewer, text: one.improvements ?? undefined, emptyText: "Not written yet." },
              { label: "The review", by: one.reviewer, pill: draft ? "Draft" : "Shared", tone: (draft ? "attention" : "positive") as PanelTone, text: one.reviewerComment ?? undefined, emptyText: "The reviewer has not written the review yet.", ...(draft && one.isReviewer ? { act: "Write it", trigger: { drawer: review } } : {}) },
            ],
          },
        ],
      },
      {
        cols: "1fr 1fr",
        panels: [
          {
            type: "list" as const,
            title: "What happens next",
            items: [
              { label: draft ? "The reviewer completes the review" : "The outcome is shared", sub: draft ? "Every KPI needs a rating or a figure, and the review needs words" : "It is theirs permanently, and quoted at the next cycle", pill: draft ? "Next" : "Done", tone: (draft ? "attention" : "positive") as PanelTone },
              { label: "Moderation compares managers", sub: "Outliers are a conversation, never an edit", pill: "Then", tone: "neutral" as PanelTone },
              { label: "Any step increase reaches Payroll", sub: "Mapped as a named variation on the next run", pill: "Then", tone: "neutral" as PanelTone },
            ],
          },
          {
            type: "facts" as const,
            title: "Rules on this review",
            tuck: "The rules on this review",
            per: 1,
            facts: [
              ["Nobody reviews themselves", "The reviewer is never the person being reviewed"],
              ["A rating is always explained", "Where it differs from what they said, in the review"],
              ["Evidence", "Returned if it is missing, with what is missing"],
            ] as PanelFact[],
          },
        ],
      },
    ],
  };
}
