import { apiGet } from "@/lib/api/server";
import type { TeacherWorkspaceView } from "@/lib/api/teacher-workspace";
import { area, checks, choice, toggle } from "@/lib/modules/live/m7-forms";
import type { DrawerSpec, PanelRow, PanelTone, TabContent, TableCellKind, TableRow } from "@/lib/modules/panels";
import { pill, row, text } from "@/lib/modules/panels";

/**
 * M09 for a teaching person: the families of their class — a number to call, and what those families have sent in. Contact details
 * only; a guardian writes to the school, and the form master is the person who acts on it.
 */

type GuardiansView = {
  arms: Array<{ id: string; name: string; roll: number }>;
  rows: Array<{ id: string; name: string; relation: string; phone: string | null; children: Array<{ id: string; name: string; arm: string }>; portal: string; delivery: string; language: string; channel: string; phoneOnly: boolean }>;
  kpis: { households: number; reachable: number; noPhone: number; otherLanguage: number };
};
type SubmissionsView = {
  arms: Array<{ id: string; name: string; roll: number }>;
  items: Array<{ id: string; type: string; child: string; childId: string | null; arm: string; guardian: string; relation: string; detail: string; state: string; open: boolean; canDecide: boolean; days: number; outcome: string | null; at: string; decidedAt: string | null; absences: Array<{ date: string; label: string; reason: string | null }> }>;
  kpis: { waiting: number; decided: number; accepted?: number; declined?: number; median: number | null; withoutEvidence: number };
  oldest: number;
};

const API = "/api/v1/teacher-workspace";
const MSG = "M4 5.5h16v10.5H9l-5 4zM8 9.5h8M8 12.8h5";
const CHECK = "M5 12.5l4.5 4.5 9-10";
const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
const EYE = "M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0-5.2";
const pair = (items: Array<{ value: string; label: string }>) => Object.fromEntries(items.map((item) => [item.label, item.value]));
const stamp = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(iso));

export async function teacherGuardiansTab(tabSlug: string, me: TeacherWorkspaceView, permissions: string[]): Promise<TabContent | null | undefined> {
  const held = new Set(permissions);
  if (tabSlug === "guardians") return guardiansTab(await apiGet<GuardiansView>(`${API}/guardians`), me, held);
  if (tabSlug === "submissions") return submissionsTab(await apiGet<SubmissionsView>(`${API}/submissions`), me);
  return undefined;
}

function noClass(title: string, desc: string): TabContent {
  return { title, desc, rows: [row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: "You hold no form class this term", body: "The families of a class are the form master’s to reach. When the school gives you a class, its guardians appear here." }])] };
}

function guardiansTab(v: GuardiansView, me: TeacherWorkspaceView, held: Set<string>): TabContent {
  const arm = v.arms[0];
  if (!arm) return noClass("Guardians", "A number to call. Contact details only.");
  const rows: TableRow[] = v.rows.map((guardian) => ({
    keywords: `${guardian.name} ${guardian.phone ?? ""} ${guardian.children.map((child) => child.name).join(" ")} ${guardian.portal}`,
    cells: [
      { kind: "name", name: guardian.name, sub: guardian.relation }, text(guardian.children.map((child) => child.name).join(", ")), text(guardian.phone || "No number", { mono: true, tone: guardian.phone ? undefined : "negative" }),
      pill(guardian.portal === "Active" ? "Active" : "Never activated", guardian.portal === "Active" ? "positive" : "attention"), text(`${guardian.language} · ${guardian.channel}`),
      {
        kind: "action", label: "Call",
        drawer: {
          mode: "view", readOnly: true, kicker: `Guardian · ${guardian.children[0]?.name ?? ""}`, title: guardian.name, sub: "Contact details only. Everything else about this family belongs to somebody else.",
          facts: [
            ["Child", guardian.children.map((child) => child.name).join(", "), guardian.children[0]?.arm ?? ""], ["Relation", guardian.relation, guardian.portal === "Active" ? "Portal active" : "Has never activated the portal"],
            ["Phone", guardian.phone || "No number on file", guardian.delivery === "Failing" ? "Messages to this number are failing" : guardian.phone ? "Primary contact" : "The office is chasing it"], ["Prefers", `${guardian.language} · ${guardian.channel}`, guardian.phoneOnly ? "Reached by phone only" : ""],
            ["Fees", "Not visible to you", "Paid or unpaid is all your role may see"],
          ],
        } as DrawerSpec,
      },
    ] as TableCellKind[],
  }));
  const k = v.kpis;
  const panels: Array<PanelRow | null> = [
    row("1fr", [{
      type: "kpi", sub: `${arm.name} · ${arm.roll} children, ${k.households} households.`, per: 4,
      cards: [
        { label: "Households", value: String(k.households), sub: "Siblings share a household" },
        { label: "Reachable in-app", value: String(k.reachable), unit: `of ${k.households}`, sub: `${k.households - k.reachable} have never activated the portal`, tone: k.reachable === k.households ? "positive" : "attention" },
        { label: "No phone number on file", value: String(k.noPhone), sub: k.noPhone ? "The office is chasing it" : "Everyone has a number", tone: k.noPhone ? "negative" : "positive" },
        { label: "Prefer another language", value: String(k.otherLanguage), sub: k.otherLanguage ? "Messages go in their language where the school can" : "Everyone prefers English" },
      ],
    }]),
    row("1fr", [{
      type: "table", title: `${arm.name} guardians`, sub: "Contacts and preferences. No financial or safeguarding context.", meta: `${k.households} households · contact details only`, noun: "guardian", nounPlural: "guardians",
      search: "Find a guardian, a child or a number", filters: [{ label: "Portal", value: "All", options: ["All", "Active", "Never activated"], column: 3 }], head: ["Guardian", "Child", "Phone", "Portal", "Prefers", ""], rows, per: 10, noRowOpen: true,
      empty: "No guardian is on record for this class yet.", foot: "Where the Safeguarding Lead has restricted a contact, it is simply not here — and you are not told why.",
    }]),
  ];
  return {
    title: "Guardians", desc: "A number to call. Contact details only.",
    primary: held.has("communication-center.compose.view") ? { label: "Message these families", icon: MSG, href: "/communication-center/compose" } : undefined,
    rows: panels.filter((entry): entry is PanelRow => Boolean(entry)),
  };
}

const tone = (state: string): PanelTone => (state === "New" ? "attention" : state === "Resolved" ? "positive" : "neutral");

function decideDrawer(item: SubmissionsView["items"][number]): DrawerSpec {
  const options = item.absences.map((absence) => ({ value: absence.date, label: absence.label }));
  return {
    mode: "form", kicker: "Guardian submission", title: `${item.child} · ${item.type.toLowerCase()}`, sub: "Your decision is logged under your name, and the guardian reads your note.",
    commitLabel: "Record the decision", commitDone: "Decision recorded", commitDoneBody: `${item.guardian} has been told.`,
    reviewNote: "Accepting turns the days you choose from absent to excused. Declining needs a reason, and the guardian reads it.",
    fields: [
      choice("Decision", ["Accept", "Decline"], { span: 2, value: "Accept" }),
      ...(options.length ? [checks("Days it covers", options.map((option) => option.label), options.slice(0, 1).map((option) => option.label), { span: 2, hint: "Only days marked absent can be excused", when: { field: "Decision", equals: "Accept" } })] : []),
      area("Your note — the guardian will read it", { span: 2, placeholder: "Required if you decline." }),
      toggle("Tell the guardian", true, "In-app and SMS, with your note", "Do not tell them", { span: 2 }),
    ],
    submit: { endpoint: `${API}/submissions/${item.id}/decide`, method: "POST", map: { Decision: "decision", "Days it covers": "dates", "Your note — the guardian will read it": "note", "Tell the guardian": "tell" }, encode: { "Days it covers": pair(options) } },
  };
}

function submissionsTab(v: SubmissionsView, me: TeacherWorkspaceView): TabContent {
  const arm = v.arms[0];
  if (!arm) return noClass("Submissions", "What the families of your class have sent in.");
  const open = v.items.filter((item) => item.open);
  const decidable = open.find((item) => item.canDecide);
  const items = v.items.map((item) => ({
    label: `${item.child} · ${item.type}`, pill: item.state, tone: tone(item.state), viewLabel: item.canDecide ? "Decide" : "View", sub: `${item.guardian}: ${item.detail}`,
    facts: [["Submitted by", item.guardian, item.relation], ["What", item.detail, ""], ["Sent", stamp(item.at), `${item.days} day${item.days === 1 ? "" : "s"} ago`], ["State", item.state, item.outcome ?? (item.open && !item.canDecide ? "A decision for the office, not for a class" : "")]] as Array<[string, string, string]>,
    ...(item.canDecide ? { drawer: decideDrawer(item) } : {}),
  }));
  const k = v.kpis;
  return {
    title: "Submissions", desc: `What the families of ${arm.name} have sent in, and what you do about it.`,
    primary: decidable ? { label: "Decide the oldest", icon: CHECK, drawer: decideDrawer(decidable) } : undefined,
    rows: [
      row("1fr", [{
        type: "kpi", sub: "Your class only. A guardian writes to the school; you are the person who acts on it.", per: 4,
        cards: [
          { label: "Waiting on you", value: String(open.length), sub: open.length ? `The oldest is ${v.oldest} day${v.oldest === 1 ? "" : "s"} old` : "Nothing is waiting", tone: open.length ? "attention" : "positive" },
          { label: "Decided this term", value: String(k.decided), sub: `${k.accepted ?? 0} accepted, ${k.declined ?? 0} declined` },
          { label: "Median time to decide", value: k.median === null ? "—" : String(k.median), unit: k.median === null ? undefined : "days", sub: "From a family sending it to a decision", tone: k.median !== null && k.median <= 2 ? "positive" : "neutral" },
          { label: "Absence explanations", value: String(k.withoutEvidence), sub: "Yours to decide", tone: "neutral" },
        ],
      }]),
      row("1fr", [{ type: "list", title: "From families", tag: `${open.length} waiting`, tagTone: open.length ? "attention" : "positive", sub: "A guardian submits; you decide; the decision is logged.", meta: `${arm.name} · this term`, items: items.length ? items : [{ label: "Nothing has been sent in", sub: "When a family writes to the school about a child in your class, it appears here.", pill: "Clear", tone: "positive" as PanelTone }] }]),
      row("1fr", [{ type: "note", tone: "progress", icon: WARN, title: "Why this reaches you, not the office", body: `Without it, an explanation stops with an administrator — and the ${me.persona === "early-years" ? "class teacher" : "form master"} rings a parent who already wrote in.` }]),
    ],
  };
}
