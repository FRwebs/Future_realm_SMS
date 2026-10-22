import { apiGet } from "@/lib/api/server";
import { area, select } from "@/lib/modules/live/m7-forms";
import type { DrawerSpec, FormField, PanelFact, PanelRow, PanelTone, TabContent, TableCellKind, TableRow } from "@/lib/modules/panels";
import { pill, row, text } from "@/lib/modules/panels";

/**
 * M05 for an early-years teacher: Observations. What they saw, in words, against the school's own learning areas — never a score.
 * Nothing is averaged, summed or ranked; the class summary counts children at each descriptor.
 */

const API = "/api/v1/teacher-workspace";
const EYE = "M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0-5.2";
const ARROW = "M5 12h13M13 6.5l5.5 5.5L13 17.5";

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

const short = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(iso)) : "—");
export const observeHref = (studentId: string) => `/score-entry-results/enter/observe/${studentId}`;
export const loadChild = (studentId: string) => apiGet<ChildPage>(`${API}/observations/${studentId}`);

export async function teacherObservationsTab(tabSlug: string): Promise<TabContent | null | undefined> {
  if (tabSlug === "enter") return enterTab(await apiGet<List>(`${API}/observations`));
  if (tabSlug === "results") return resultsTab(await apiGet<Summary>(`${API}/observations/summary`));
  return undefined;
}

function enterTab(v: List): TabContent {
  const unseen = v.arms.flatMap((arm) => arm.children.filter((child) => !child.observed));
  const total = v.arms.reduce((sum, arm) => sum + arm.roll, 0);
  const first = unseen[0] ?? v.arms[0]?.children[0] ?? null;
  const rows: TableRow[] = v.arms.flatMap((arm) =>
    arm.children.map((child) => ({
      keywords: `${child.name} ${child.adm}`, href: observeHref(child.id),
      cells: [
        { kind: "name", name: child.name, sub: `${arm.name} · roll ${String(child.roll).padStart(2, "0")}`, avatar: false }, text(child.adm, { mono: true }), pill(child.observed ? "Observed" : "Not yet", child.observed ? "positive" : "attention"),
        text(child.areasSeen ? `${child.areasSeen} of ${v.framework.areas.length} areas` : "—"), text(child.last ? short(child.last) : "—"), { kind: "action", label: child.observed ? "Add" : "Observe", href: observeHref(child.id) },
      ] as TableCellKind[],
    })),
  );
  return {
    title: "Enter observations", desc: `${v.arms.map((arm) => arm.name).join(" and ")} · descriptive, in ${v.framework.areas.length} learning areas. No CA, no examination.`,
    primary: first ? { label: unseen.length ? "Observe the next child not yet seen" : "Add an observation", icon: EYE, href: observeHref(first.id) } : undefined,
    rows: [
      row("1fr", [{
        type: "kpi", sub: `Half-term ${v.half} · the observation window closes ${short(v.closes)}, counted from the term’s dates.`, per: 3,
        cards: [
          { label: "Not yet observed", value: String(unseen.length), unit: `of ${total}`, sub: `${v.daysLeft} day${v.daysLeft === 1 ? "" : "s"} left`, tone: unseen.length ? "negative" : "positive" },
          { label: "Observations this half-term", value: String(v.arms.reduce((sum, arm) => sum + arm.total, 0)), sub: `Across ${v.framework.areas.length} areas` },
          { label: "Photographs", value: String(v.arms.reduce((sum, arm) => sum + arm.photos, 0)), sub: "Attached to observations this half-term", tone: "neutral" },
        ],
      }]),
      row("1fr", [{
        type: "table", title: `${v.arms.map((arm) => arm.name).join(" and ")} · every child`, tag: `${total - unseen.length} of ${total} observed`, tagTone: unseen.length ? "attention" : "positive", sub: "Open a child to record what you saw.", meta: `${total} children`, noun: "child", nounPlural: "children", search: "Find a child",
        head: ["Child", "Admission no", "State", "Areas seen", "Last seen", ""], rows, per: 12, noRowOpen: false, empty: "No children are on the roll.", foot: "An observation is evidence, not a grade. Nothing is averaged and nothing is ranked.",
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
  const strongest = arm.counts.map((line) => ({ area: line.area, secure: line.counts.slice(secure).reduce((sum, count) => sum + count, 0) })).sort((a, b) => b.secure - a.secure)[0];
  return {
    title: "Results", desc: `Where ${v.arms.map((entry) => entry.name).join(" and ")} stands in each learning area. Counts of children, never an average.`,
    rows: [
      row("1fr", [{
        type: "kpi", sub: `Half-term ${v.half} · ${arm.roll} children · nothing here is a score.`, per: 3,
        cards: [
          { label: "Children observed", value: String(arm.observed), unit: `of ${arm.roll}`, sub: "At least once this half-term", tone: arm.observed < arm.roll ? "attention" : "positive" },
          { label: "Strongest area", value: strongest && strongest.secure ? strongest.area : "—", sub: strongest && strongest.secure ? `${strongest.secure} children ${v.framework.bands[secure]?.toLowerCase()} or beyond` : "Nothing observed yet", tone: "positive" },
          { label: "Areas not yet seen", value: String(arm.counts.filter((line) => line.unseen === arm.roll).length), sub: "Areas where no child has been described yet", tone: arm.counts.some((line) => line.unseen === arm.roll) ? "attention" : "neutral" },
        ],
      }]),
      ...tables,
    ],
  };
}

export function childPage(p: ChildPage): TabContent & { crumb: { label: string; href: string } } {
  const first = p.student.name.split(" ")[0] ?? p.student.name;
  const fields: FormField[] = [
    ...p.framework.areas.map((areaName) => select(areaName, ["Not seen this time", ...p.framework.bands], { value: "Not seen this time" })),
    area("What you saw", { required: true, span: 2, placeholder: "Counted six shells aloud and stopped to recount without being asked…", hint: "Specific and short. This is what the family reads at the end of term." }),
    { label: "Photograph", kind: "asset", options: ["No photograph", "Attach a photograph", "Remove it"], hint: "Shrunk on your device before it is sent." } as FormField,
    { label: "A second photograph", kind: "asset", options: ["No photograph", "Attach a photograph", "Remove it"] } as FormField,
  ] as FormField[];
  const nest = Object.fromEntries(p.framework.areas.map((areaName): [string, [string, string]] => [areaName, ["areas", areaName]]));
  const record: DrawerSpec = {
    mode: "form", kicker: `${p.arm.name} · ${p.student.adm}`, title: `Where ${first} is now`, sub: "One descriptor for each area you saw. Leave the rest as “Not seen this time”.",
    commitLabel: "Save the observation", commitDone: "Observation saved", commitDoneBody: "It is kept on the record, and the families read it only on the report.", reviewNote: "An observation is evidence, not a grade. Nothing is averaged and nothing is ranked.",
    fields, submit: { endpoint: `${API}/observations/${p.student.id}`, method: "POST", nest: { ...nest, }, map: { "What you saw": "note", Photograph: "photoA", "A second photograph": "photoB" }, encode: Object.fromEntries(p.framework.areas.map((areaName) => [areaName, { "Not seen this time": "" }])) },
  };
  const bandRows: PanelFact[] = p.framework.areas.map((areaName): PanelFact => [areaName, p.bands[areaName] ?? "Not yet seen", ""]);
  return {
    crumb: { label: "Back to the observations", href: "/score-entry-results/enter" },
    title: p.student.name, desc: `${p.arm.name} · ${p.student.adm} · what you saw, in words. There is no score.`,
    primary: { label: "Record an observation", icon: EYE, drawer: record },
    launchers: p.nextUnseen ? [{ label: `Open ${p.nextUnseen.name.split(" ")[0]} — not yet observed`, href: observeHref(p.nextUnseen.id) }] : [],
    rows: [
      row("1fr", [{ type: "days", title: `${p.student.position} of ${p.student.of} · ${p.arm.name}`, sub: "Walk the class without going back to the list.", days: p.peers.slice(Math.max(0, p.student.position - 4), p.student.position + 3).map((peer) => ({ label: peer.name.split(" ")[0] ?? peer.name, href: observeHref(peer.id), state: peer.now ? ("now" as const) : peer.observed ? ("plain" as const) : ("plain" as const) })) }]),
      row("1.3fr 1fr", [
        { type: "facts", title: `Where ${first} is now`, per: 2, sub: "The latest descriptor in each area, from your observations this term.", facts: bandRows },
        { type: "facts", title: "This child’s record", per: 1, facts: [["Observations this term", String(p.history.length), p.history[0] ? `Last on ${short(p.history[0].at)}` : "Nothing yet"], ["Half-term", `${p.half}`, p.observedThisHalf ? "Observed" : `Not yet observed · closes ${short(p.closes)}`], ["Attendance", p.attendance ? `${p.attendance.pct}%` : "—", p.attendance ? `${p.attendance.days} days marked this term` : "No register marked yet"]] as PanelFact[] },
      ]),
      p.history.length
        ? row("1fr", [{ type: "quotes", title: "What you have written", sub: "Newest first — this is what the family reads on the report.", quotes: p.history.map((entry) => ({ photos: Array.from({ length: entry.photos }, (_, index) => `${API}/observations/photo/${entry.id}/${index}`), label: `${short(entry.at)} · half-term ${entry.half} · ${Object.entries(entry.areas).map(([areaName, band]) => `${areaName}: ${band}`).join("; ")}`, text: entry.note ?? "", by: entry.by || "You" })) }])
        : row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: `Nothing recorded for ${first} yet`, body: "Record what you saw — in words, against the areas you actually saw. There is no score." }]),
    ] as PanelRow[],
  };
}
void ARROW;
void ({} as PanelTone);
