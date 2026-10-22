import { apiGet } from "@/lib/api/server";
import type { TeacherWorkspaceView } from "@/lib/api/teacher-workspace";
import { area, checks, choice, toggle } from "@/lib/modules/live/m7-forms";
import type { DrawerSpec, PanelFact, PanelRow, PanelTone, TabContent, TableCellKind, TableRow } from "@/lib/modules/panels";
import { pill, row, text } from "@/lib/modules/panels";

/**
 * M09 for a teaching person: the families of their class — a number to call, and what those families have sent in. Contact details
 * only; a guardian writes to the school, and the form master is the person who acts on it.
 */

type GuardiansView = {
  arms: Array<{ id: string; name: string; roll: number }>;
  rows: Array<{ id: string; name: string; relation: string; phone: string | null; email: string | null; children: Array<{ id: string; name: string; arm: string }>; portal: string; delivery: string; language: string; channel: string; phoneOnly: boolean; calls: Array<{ at: string; outcome: string; note: string; child: string; by: string }> }>;
  kpis: { households: number; reachable: number; noPhone: number; otherLanguage: number };
};
type SubmissionsView = {
  arms: Array<{ id: string; name: string; roll: number }>;
  items: Array<{ id: string; type: string; child: string; childId: string | null; arm: string; guardian: string; relation: string; detail: string; state: string; open: boolean; canDecide: boolean; days: number; outcome: string | null; at: string; decidedAt: string | null; absences: Array<{ date: string; label: string; reason: string | null }>; evidence: string | null; claimedDates: string[]; claimed: string[]; kind: "absence" | "collection" | "other"; collector: { name: string; relation: string; phone: string; date: string | null } | null; ifAccept: string; ifDecline: string }>;
  kpis: { waiting: number; decided: number; accepted?: number; declined?: number; median: number | null; withoutEvidence: number; collections?: number };
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

const clock = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso));
const OUTCOMES = ["Spoke to them", "No answer", "Left a message", "Number not working"];

/** What a person opens from a guardian's row: the number to ring, what is known of how they like to be reached, and a place to say how the call went. */
function callDrawer(guardian: GuardiansView["rows"][number]): DrawerSpec {
  const child = guardian.children[0];
  const last = guardian.calls[0];
  const kids = guardian.children.map((entry) => entry.name);
  return {
    mode: "form", kicker: `Guardian · ${kids.join(", ")}`, title: guardian.name, sub: "Contact details only. Everything else about this family belongs to somebody else.",
    commitLabel: "Log the call", commitDone: "Call logged", commitDoneBody: `It is on ${kids.length === 1 ? `${kids[0]}’s` : "the"} record, under your name.`,
    reviewNote: "A call that was not answered is as worth keeping as one that was: it is how the next person knows this number has been tried.",
    facts: [
      ["Child", kids.join(", "), child?.arm ?? ""], ["Relation", guardian.relation, guardian.portal === "Active" ? "Portal active" : "Has never activated the portal"],
      ["Phone", guardian.phone || "No number on file", guardian.delivery === "Failing" ? "Messages to this number are failing" : guardian.phone ? "Primary contact" : "The office is chasing it"],
      ["Prefers", `${guardian.language} · ${guardian.channel}`, guardian.email ? guardian.email : ""],
      ["Fees", "Not visible to you", "Paid or unpaid is all your role may see"],
      ...(last ? ([["Last call", last.outcome, `${clock(last.at)} · ${last.by}${last.note ? ` · ${last.note}` : ""}`]] as PanelFact[]) : ([["A call you log", "Appears on the child’s record", "Under your name"]] as PanelFact[])),
    ],
    fields: [
      ...(kids.length > 1 ? [choice("About which child", kids, { span: 2 })] : []),
      choice("How did it go", OUTCOMES, { span: 2, value: OUTCOMES[0] }),
      area("A note — optional", { span: 2, placeholder: "What was said, or what to do next." }),
    ],
    submit: { endpoint: `${API}/guardians/${guardian.id}/calls`, method: "POST", map: { "About which child": "child", "How did it go": "outcome", "A note — optional": "note" }, encode: { "About which child": Object.fromEntries(guardian.children.map((entry) => [entry.name, entry.id])) } },
  };
}

function guardiansTab(v: GuardiansView, me: TeacherWorkspaceView, held: Set<string>): TabContent {
  const arm = v.arms[0];
  if (!arm) return noClass("Guardians", "A number to call. Contact details only.");
  const armLabel = v.arms.length > 3 ? `Your ${v.arms.length} classes` : v.arms.map((entry) => entry.name).join(" and ");
  const roll = v.arms.reduce((sum, entry) => sum + entry.roll, 0);
  const canMessage = held.has("communication-center.compose.view");
  const rows: TableRow[] = v.rows.map((guardian) => ({
    id: guardian.id,
    keywords: `${guardian.name} ${guardian.phone ?? ""} ${guardian.children.map((child) => child.name).join(" ")} ${guardian.portal} ${guardian.language}`,
    cells: [
      { kind: "name", name: guardian.name, sub: guardian.relation }, text(guardian.children.map((child) => child.name).join(", ")), text(guardian.phone || "No number", { mono: true, tone: guardian.phone ? undefined : "negative" }),
      pill(guardian.portal === "Active" ? "Active" : "Never activated", guardian.portal === "Active" ? "positive" : "attention"), text(`${guardian.language} · ${guardian.channel}`),
      { kind: "action", label: "Call", drawer: callDrawer(guardian) },
    ] as TableCellKind[],
  }));
  const k = v.kpis;
  const languages = [...new Set(v.rows.map((row) => row.language))].sort();
  const panels: Array<PanelRow | null> = [
    row("1fr", [{
      type: "kpi", sub: `${armLabel} · ${roll} children, ${k.households} households.`, per: 4,
      cards: [
        { label: "Households", value: String(k.households), sub: "Siblings share a household" },
        { label: "Reachable in-app", value: String(k.reachable), unit: `of ${k.households}`, sub: `${k.households - k.reachable} have never activated the portal`, tone: k.reachable === k.households ? "positive" : "attention" },
        { label: "No phone number on file", value: String(k.noPhone), sub: k.noPhone ? "The office is chasing it" : "Everyone has a number", tone: k.noPhone ? "negative" : "positive" },
        { label: "Prefer another language", value: String(k.otherLanguage), sub: k.otherLanguage ? `Messages go in their language where the school can${languages.filter((entry) => entry !== "English").length ? ` · ${languages.filter((entry) => entry !== "English").join(", ")}` : ""}` : "Everyone prefers English" },
      ],
    }]),
    row("1fr", [{
      type: "table", title: `${armLabel} guardians`, sub: "Contacts and preferences. No financial or safeguarding context.", meta: `${k.households} households · contact details only`, noun: "guardian", nounPlural: "guardians",
      search: "Find a guardian, a child or a number",
      filters: [
        { label: "Portal", value: "All", options: ["All", "Active", "Never activated"], column: 3 },
        ...(languages.length > 1 ? [{ label: "Prefers", value: "All", options: ["All", ...languages], column: 4 }] : []),
      ],
      selectable: true,
      bulkActs: [
        ...(canMessage ? [{ label: "Message the selected families", icon: MSG, href: "/communication-center/compose", selection: { key: "ids", noun: "family" } }] : []),
        { label: "Export contacts", primary: true, export: true },
      ],
      head: ["Guardian", "Child", "Phone", "Portal", "Prefers", ""], rows, per: 10, noRowOpen: true,
      empty: "No guardian is on record for this class yet.", foot: "Where the Safeguarding Lead has restricted a contact, it is simply not here — and you are not told why.",
    }]),
  ];
  return {
    title: "Guardians", desc: "A number to call. Contact details only.",
    primary: canMessage ? { label: "Message these families", icon: MSG, href: "/communication-center/compose" } : undefined,
    rows: panels.filter((entry): entry is PanelRow => Boolean(entry)),
  };
}

const tone = (state: string): PanelTone => (state === "New" ? "attention" : state === "Resolved" ? "positive" : "neutral");

function decideDrawer(item: SubmissionsView["items"][number]): DrawerSpec {
  const options = item.absences.map((absence) => ({ value: absence.date, label: absence.label }));
  const asked = options.filter((option) => item.claimed.includes(option.value));
  const collection = item.kind === "collection";
  return {
    mode: "form", kicker: "Guardian submission", title: `${item.child} · ${item.type.toLowerCase()}`, sub: "Your decision is logged under your name, and the guardian reads your note.",
    commitLabel: "Record the decision", commitDone: "Decision recorded", commitDoneBody: `${item.guardian} has been told.`,
    reviewNote: collection ? "Accepting adds the named adult as a collector for the day the family gave, and no longer. Declining needs a reason, and the guardian reads it." : "Accepting turns the days you choose from absent to excused. Declining needs a reason, and the guardian reads it.",
    facts: [
      ["Child", item.child, item.arm], ["Submitted by", item.guardian, item.relation], ["What they say", item.detail, ""],
      ["Evidence", item.evidence || (collection ? "A named adult" : "None offered"), collection && item.collector ? `${item.collector.name} · ${item.collector.relation} · ${item.collector.phone}` : ""],
      ["If you accept", item.ifAccept, ""], ["If you decline", item.ifDecline, "The guardian is told, with your note"],
    ],
    fields: [
      choice("Decision", ["Accept", "Decline"], { span: 2, value: "Accept" }),
      ...(!collection && options.length ? [checks("Days it covers", options.map((option) => option.label), (asked.length ? asked : options.slice(0, 1)).map((option) => option.label), { span: 2, hint: asked.length ? "The days the family named are ticked. Only days marked absent can be excused." : "Only days marked absent can be excused", when: { field: "Decision", equals: "Accept" } })] : []),
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
    facts: [["Submitted by", item.guardian, item.relation], ["What", item.detail, ""], ["Evidence", item.evidence || (item.kind === "collection" ? "A named adult" : "None offered"), item.collector ? `${item.collector.name} · ${item.collector.phone}` : ""], ["Sent", stamp(item.at), `${item.days} day${item.days === 1 ? "" : "s"} ago`], ["State", item.state, item.outcome ?? (item.open && !item.canDecide ? "A decision for the office, not for a class" : "")]] as Array<[string, string, string]>,
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
          me.persona === "early-years"
            ? { label: "Collection changes", value: String(k.collections ?? 0), sub: "Checked against the photo on file", tone: "neutral" as PanelTone }
            : { label: "Without evidence", value: String(k.withoutEvidence), sub: "Allowed where the school’s policy allows it", tone: "neutral" as PanelTone },
        ],
      }]),
      row("1fr", [{ type: "list", title: "From families", tag: `${open.length} waiting`, tagTone: open.length ? "attention" : "positive", sub: "A guardian submits; you decide; the decision is logged.", meta: `${arm.name} · this term`, items: items.length ? items : [{ label: "Nothing has been sent in", sub: "When a family writes to the school about a child in your class, it appears here.", pill: "Clear", tone: "positive" as PanelTone }] }]),
      row("1fr", [{ type: "note", tone: "progress", icon: WARN, title: "Why this reaches you, not the office", body: `Without it, an explanation stops with an administrator — and the ${me.persona === "early-years" ? "class teacher" : "form master"} rings a parent who already wrote in.` }]),
    ],
  };
}
