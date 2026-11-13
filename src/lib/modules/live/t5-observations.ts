import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import { area, select } from "@/lib/modules/live/m7-forms";
import type { DrawerSpec, FormField, PanelFact, PanelRow, PanelTone, TabContent, TableCellKind, TableRow } from "@/lib/modules/panels";
import { pill, row, text } from "@/lib/modules/panels";
import { formatDay } from "@/lib/date-format";

/**
 * M05 for an early-years teacher: Observations. What they saw, in words, against the school's own learning areas — never a score.
 * Nothing is averaged, summed or ranked; the class summary counts children at each descriptor.
 */

const API = "/api/v1/teacher-workspace";
const EYE = "M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0-5.2";
const ARROW = "M5 12h13M13 6.5l5.5 5.5L13 17.5";
const PRINT = "M7 8.5V4h10v4.5M7 17.5H5.5v-6h13v6H17M7 14h10v6H7z";
const NOT_SEEN = "Not seen this time";

type Framework = { areas: string[]; bands: string[]; own: boolean };
type List = {
  framework: Framework; term: { name: string; session: string }; half: number; closes: string; daysLeft: number;
  arms: Array<{ id: string; name: string; roll: number; total: number; photos: number; children: Array<{ id: string; name: string; adm: string; roll: number; observed: boolean; count: number; last: string | null; bands: Record<string, string>; areasSeen: number }> }>;
};
type Summary = { framework: Framework; half: number; arms: Array<{ id: string; name: string; roll: number; observed: number; counts: Array<{ area: string; counts: number[]; unseen: number }> }> };
export type ChildPage = {
  framework: Framework; half: number; closes: string; arm: { id: string; name: string }; student: { id: string; name: string; adm: string; position: number; of: number };
  peers: Array<{ id: string; name: string; observed: boolean; now: boolean; index: number }>; nextUnseen: { id: string; name: string } | null; observedThisHalf: boolean; bands: Record<string, string>; attendance: { pct: number; days: number } | null;
  history: Array<{ id: string; at: string; half: number; areas: Record<string, string>; note: string | null; by: string; photos: number }>;
};

const short = (iso: string | null) => (iso ? formatDay(new Date(iso), { day: "numeric", month: "short", timeZone: "Africa/Lagos" }) : "—");
export const observeHref = (studentId: string) => `/score-entry-results/enter/observe/${studentId}`;
export const loadChild = (studentId: string) => apiGet(`${API}/observations/${studentId}`, observe<ChildPage>(localContracts["src/lib/modules/live/t5-observations.ts#eb977ad0"]));

export async function teacherObservationsTab(tabSlug: string): Promise<TabContent | null | undefined> {
  if (tabSlug === "enter") return enterTab(await apiGet(`${API}/observations`, observe<List>(localContracts["src/lib/modules/live/t5-observations.ts#a1fffaaa"])));
  if (tabSlug === "results") return resultsTab(await apiGet(`${API}/observations/summary`, observe<Summary>(localContracts["src/lib/modules/live/t5-observations.ts#12b71c3e"])));
  return undefined;
}

/**
 * One activity, several children — the sand tray, not one child at a time.
 *
 * The words are written once and each child is given their own observation, because a family reads
 * their own child's record and nobody else's. One area and descriptor are chosen for the activity
 * and carried to each child, who can then be opened and changed: where each child is differs even
 * when the activity does not.
 */
function groupDrawer(v: List): DrawerSpec {
  return {
    mode: "form", kicker: "Early years", title: "Record a group observation",
    sub: "What you saw at one activity, written once. Each child chosen gets their own observation, and you can open any of them afterwards to change theirs.",
    commitLabel: "Save it for each child", commitDone: "Observation saved for each child",
    commitDoneBody: "Each child now has their own record of it. Open one to change the area or descriptor you saw for them.",
    reviewNote: "An observation is evidence, not a grade. Nothing is averaged and nothing is ranked.",
    fields: [
      area("What you saw", { rows: 3, required: true, span: 2, placeholder: "Three of them built a tower together and took turns fetching blocks…", hint: "Specific and short. This is what each family reads at the end of term." }),
      select("The area it shows best", v.framework.areas, { hint: "Set for every child chosen. Open a child afterwards to change theirs." }),
      select("Descriptor", v.framework.bands),
    ],
    submit: {
      endpoint: `${API}/observations/group`, method: "POST",
      map: { "What you saw": "note", "The area it shows best": "area", Descriptor: "band" },
    },
  };
}

function enterTab(v: List): TabContent {
  /*
   * The mockup heads one column with two named areas and shows each child's descriptor in them —
   * a glance at where the class is, rather than a count of boxes ticked. It names Literacy and
   * Mathematics; a school that writes its own framework may have neither, so those are taken when
   * they are there and the first two areas otherwise.
   */
  const named = (pattern: RegExp) => v.framework.areas.find((entry) => pattern.test(entry));
  const pair = [named(/literac/i), named(/mathemat/i)].filter((entry): entry is string => Boolean(entry));
  const headline = pair.length === 2 ? pair : v.framework.areas.slice(0, 2);
  const unseen = v.arms.flatMap((arm) => arm.children.filter((child) => !child.observed));
  const total = v.arms.reduce((sum, arm) => sum + arm.roll, 0);
  const first = unseen[0] ?? v.arms[0]?.children[0] ?? null;
  const rows: TableRow[] = v.arms.flatMap((arm) =>
    arm.children.map((child) => ({
      id: child.id, keywords: `${child.name} ${child.adm} ${child.observed ? "Observed" : "Not yet"}`,
      cells: [
        { kind: "name", name: child.name, sub: `${arm.name} · roll ${String(child.roll).padStart(2, "0")}`, avatar: false }, text(child.adm, { mono: true }), pill(child.observed ? "Observed" : "Not yet", child.observed ? "positive" : "attention"),
        text(child.observed ? headline.map((entry) => child.bands[entry] ?? "—").join(" · ") : "—"), text(child.last ? short(child.last) : "—"), { kind: "action", label: child.observed ? "Add" : "Observe", href: observeHref(child.id) },
      ] as TableCellKind[],
    })),
  );
  return {
    title: "Enter observations", desc: `${v.arms.map((arm) => arm.name).join(" and ")} · descriptive, in ${v.framework.areas.length} learning areas. No CA, no examination.`,
    primary: first ? { label: unseen.length ? "Observe the next child not yet seen" : "Add an observation", icon: EYE, href: observeHref(first.id) } : undefined,
    rows: [
      row("1fr", [{
        type: "kpi", sub: `Half-term ${v.half} · the observation window closes ${short(v.closes)}, counted from the term’s dates.`, per: 4,
        cards: [
          { label: "Not yet observed", value: String(unseen.length), unit: `of ${total}`, sub: `${v.daysLeft} day${v.daysLeft === 1 ? "" : "s"} left`, tone: unseen.length ? "negative" : "positive" },
          { label: "Observations this half-term", value: String(v.arms.reduce((sum, arm) => sum + arm.total, 0)), sub: `Across ${v.framework.areas.length} areas` },
          // This device's own figure, not the school's: an observation written with no connection is
          // kept here and sent when there is one, so the count is read off the device after mounting.
          { label: "Saved on this device", value: "0", unit: "notes", sub: "Written with no connection — sent when there is one", tone: "offline", device: "OBSERVATION" },
          { label: "Photographs", value: String(v.arms.reduce((sum, arm) => sum + arm.photos, 0)), sub: "Attached to observations this half-term", tone: "neutral" },
        ],
      }]),
      row("1fr", [{
        type: "table", title: `${v.arms.map((arm) => arm.name).join(" and ")} · every child`, tag: `${total - unseen.length} of ${total} observed`, tagTone: unseen.length ? "attention" : "positive", sub: "Open a child to record what you saw.", meta: `${total} children`, noun: "child", nounPlural: "children", search: "Find a child",
        filters: [{ label: "State", value: "All", options: ["All", "Observed", "Not yet"] }],
        selectable: true,
        bulkActs: [
          { label: "Record a group observation", primary: true, drawer: groupDrawer(v), selection: { key: "studentIds", noun: "child" } },
          { label: "Export selected", export: true },
        ],
        head: ["Child", "Admission no", "State", headline.join(" · "), "Last seen", ""], rows, per: 12, noRowOpen: true, empty: "No children are on the roll.", foot: "An observation is saved on this device the moment you write it, and syncs when you are next online.",
      }]),
    ],
  };
}

function resultsTab(v: Summary): TabContent {
  const arm = v.arms[0];
  if (!arm) return { title: "Results", desc: "Where the class stands in each learning area.", rows: [row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: "No early-years class yet", body: "When you are class teacher of an early-years arm, its summary appears here." }])] };
  const secure = v.framework.bands.length - 2;
  const tables: PanelRow[] = v.arms.map((entry) => {
    const rows: TableRow[] = entry.counts.map((line) => ({ keywords: line.area, cells: [text(line.area, { strong: true }), ...line.counts.map((count) => text(String(count), { mono: true })), text(String(line.unseen), { mono: true, tone: line.unseen ? "attention" : undefined })] as TableCellKind[] }));
    return row("1fr", [{ type: "table", title: `${entry.name} · by learning area`, sub: "How many children sit at each descriptor — counts of children, never an average.", meta: `${v.framework.areas.length} areas`, noun: "area", nounPlural: "areas", head: ["Learning area", ...v.framework.bands, "Not yet seen"], rows, per: 0, noRowOpen: true, foot: v.framework.own ? "The descriptors are your school’s own." : "These descriptors are the usual four. When the school writes its own, they replace them here." }]);
  });
  const bandName = v.framework.bands[secure]?.toLowerCase() ?? "secure";
  const atBand = (line: { counts: number[] }) => line.counts.slice(secure).reduce((sum, count) => sum + count, 0);
  const strongest = arm.counts.map((line) => ({ area: line.area, secure: atBand(line) })).sort((a, b) => b.secure - a.secure)[0];
  /* Below the band the school calls secure — the areas most of the class is still working through. */
  const weakest = arm.counts.map((line) => ({ area: line.area, below: line.counts.slice(0, secure).reduce((sum, count) => sum + count, 0) })).sort((a, b) => b.below - a.below)[0];
  const acrossAreas = arm.counts.length ? Math.round(arm.counts.reduce((sum, line) => sum + atBand(line), 0) / arm.counts.length) : 0;
  const summary: DrawerSpec = {
    mode: "output", kicker: `${arm.name} · half-term ${v.half}`, title: "The class summary",
    sub: "Counts of children at each descriptor, as this page reads them. Nothing here is averaged or ranked.",
    facts: [
      ["Arm", arm.name, `${arm.roll} children`],
      ["Observed", `${arm.observed} of ${arm.roll}`, "At least once this half-term"],
      ["Learning areas", String(v.framework.areas.length), v.framework.own ? "The school’s own" : "The usual seven"],
      ["Descriptors", v.framework.bands.join(", "), v.framework.own ? "The school’s own" : "The usual four"],
      ...arm.counts.map((line): PanelFact => [line.area, v.framework.bands.map((band, index) => `${band} ${line.counts[index] ?? 0}`).join(" · "), line.unseen ? `${line.unseen} not yet seen` : "Every child described"]),
    ],
    readOnly: true, readOnlyNote: "A reading of the counts above. An observation is evidence, not a grade.",
  };
  return {
    title: "Results", desc: `Where ${v.arms.map((entry) => entry.name).join(" and ")} stands in each learning area. Counts of children, never an average.`,
    primary: { label: "Print the class summary", icon: PRINT, drawer: summary },
    rows: [
      row("1fr", [{
        type: "kpi", sub: `Half-term ${v.half} · ${arm.roll} children · nothing here is a score.`, per: 4,
        cards: [
          { label: "Children observed", value: String(arm.observed), unit: `of ${arm.roll}`, sub: "At least once this half-term", tone: arm.observed < arm.roll ? "attention" : "positive" },
          { label: `${v.framework.bands[secure] ?? "Secure"} or beyond`, value: String(acrossAreas), unit: "children", sub: "Average across the learning areas", tone: "positive" },
          { label: "Strongest area", value: strongest && strongest.secure ? strongest.area : "—", sub: strongest && strongest.secure ? `${strongest.secure} children ${bandName} or beyond` : "Nothing observed yet", tone: "positive" },
          { label: "Needs attention", value: weakest && weakest.below ? weakest.area : "—", sub: weakest && weakest.below ? `${weakest.below} children still below ${bandName}` : "Nothing observed yet", tone: weakest && weakest.below ? "attention" : "neutral" },
        ],
      }]),
      ...tables,
    ],
  };
}

export function childPage(p: ChildPage): TabContent & { crumb: { label: string; href: string } } {
  const first = p.student.name.split(" ")[0] ?? p.student.name;
  const fields: FormField[] = [
    ...p.framework.areas.map((areaName) => select(areaName, [NOT_SEEN, ...p.framework.bands], { value: NOT_SEEN })),
    area("What you saw", { required: true, span: 2, placeholder: "Counted six shells aloud and stopped to recount without being asked…", hint: "Specific and short. This is what the family reads at the end of term." }),
    { label: "Photograph", kind: "asset", options: ["No photograph", "Attach a photograph", "Remove it"], hint: "Shrunk on your device before it is sent." } as FormField,
    { label: "A second photograph", kind: "asset", options: ["No photograph", "Attach a photograph", "Remove it"] } as FormField,
  ] as FormField[];
  /* Each area is one entry in the record the endpoint takes, and "not seen this time" is no entry at all. */
  const nest = Object.fromEntries(p.framework.areas.map((areaName): [string, [string, string]] => [areaName, ["areas", areaName]]));
  const encode = Object.fromEntries(p.framework.areas.map((areaName) => [areaName, { [NOT_SEEN]: "" }]));
  const map = { "What you saw": "note", Photograph: "photoA", "A second photograph": "photoB" };
  const next = p.nextUnseen;
  return {
    crumb: { label: "Back to the observations", href: "/score-entry-results/enter" },
    title: p.student.name, tag: p.observedThisHalf ? "Observed this half-term" : "Not yet observed", tagTone: p.observedThisHalf ? "positive" : "attention",
    desc: `${p.arm.name} · ${p.student.adm} · what you saw, in words. There is no score.`,
    launchers: next ? [{ label: `Open ${next.name.split(" ")[0]} — not yet observed`, href: observeHref(next.id) }] : [],
    rows: [
      row("1fr", [{ type: "days", title: `${p.student.position} of ${p.student.of} · ${p.arm.name}`, sub: "Walk the class without going back to the list.", days: p.peers.slice(Math.max(0, p.student.position - 4), p.student.position + 3).map((peer) => ({ label: peer.name.split(" ")[0] ?? peer.name, href: observeHref(peer.id), state: peer.now ? ("now" as const) : ("plain" as const) })) }]),
      row("1.3fr 1fr", [
        /*
         * The observation is written on the page, as the mockup writes it — not in a drawer over it.
         * A teacher watching a child looks at the areas, the box and the child's record at once; a
         * modal would hide the record behind the thing being written about it.
         */
        {
          type: "form", per: 2, title: `Where ${first} is now`, meta: "Kept on this device as you write",
          sub: `One descriptor for each area you saw. Leave the rest as “${NOT_SEEN}”.`,
          fields,
          submit: { endpoint: `${API}/observations/${p.student.id}`, method: "POST", map, nest, encode, done: "Observation saved", refreshAfter: true },
          formNote: "An observation is evidence, not a grade. Nothing is averaged and nothing is ranked.",
          actions: next ? [{ label: `Open ${next.name.split(" ")[0]} next`, href: observeHref(next.id) }] : [],
        },
        { type: "facts", title: "This child’s record", per: 1, facts: childFacts(p) },
      ]),
      row("1.3fr 1fr", [
        { type: "facts", title: `Where ${first} is now`, per: 2, sub: "The latest descriptor in each area, from your observations this term.", facts: p.framework.areas.map((areaName): PanelFact => [areaName, p.bands[areaName] ?? "Not yet seen", ""]) },
        { type: "note", tone: "neutral", icon: EYE, title: "Who reads this", body: "The family reads an observation on the report at the end of term, never as it is written. Nothing here is averaged, summed or ranked." },
      ]),
      p.history.length
        ? row("1fr", [{ type: "quotes", title: "What you have written", sub: "Newest first — this is what the family reads on the report.", quotes: p.history.map((entry) => ({ photos: Array.from({ length: entry.photos }, (_, index) => `${API}/observations/photo/${entry.id}/${index}`), label: `${short(entry.at)} · half-term ${entry.half} · ${Object.entries(entry.areas).map(([areaName, band]) => `${areaName}: ${band}`).join("; ")}`, text: entry.note ?? "", by: entry.by || "You" })) }])
        : row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: `Nothing recorded for ${first} yet`, body: "Record what you saw — in words, against the areas you actually saw. There is no score." }]),
    ] as PanelRow[],
  };
}

/**
 * What else is true of this child while you write about them.
 *
 * The mockup also names who collects them, any medical alert and last term's summary. Those are
 * held elsewhere in the school's record and are not on this payload, so they are not invented here:
 * what is shown is what the observations themselves know.
 */
function childFacts(p: ChildPage): PanelFact[] {
  return [
    ["Observations this term", String(p.history.length), p.history[0] ? `Last on ${short(p.history[0].at)}` : "Nothing yet"],
    ["Half-term", `${p.half}`, p.observedThisHalf ? "Observed" : `Not yet observed · closes ${short(p.closes)}`],
    ["Areas described", `${Object.keys(p.bands).length} of ${p.framework.areas.length}`, "At least once this term"],
    ["Attendance", p.attendance ? `${p.attendance.pct}%` : "—", p.attendance ? `${p.attendance.days} days marked this term` : "No register marked yet"],
  ];
}

void ARROW;
void ({} as PanelTone);
