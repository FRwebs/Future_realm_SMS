import { apiGet } from "@/lib/api/server";
import type { TeacherWorkspaceView } from "@/lib/api/teacher-workspace";
import type { DrawerSpec, PanelFact, PanelTone, TabContent, TableCellKind, TableRow } from "@/lib/modules/panels";
import { row } from "@/lib/modules/panels";

/**
 * M12 for a teaching person: Messages — the families of their own class and nobody else's, with the cost shown before it goes. A family
 * sees the school, not the teacher; replies reach the office; and a send above the school's threshold waits for the Principal.
 */

type ComposeInfo = {
  arms: Array<{ id: string; name: string; roll: number }>;
  families: Array<{ id: string; name: string; phone: string; email: string; children: string[]; arms: string[]; canSms: boolean; canEmail: boolean; portal: string; language: string }>;
  wallet: { sms: number };
  threshold: number | null;
  sender: string;
  smsNaira: number;
  drafts: Array<{ id: string; body: string; channel: string; audience: string; families: string[]; acknowledge: boolean; savedAt: string }>;
};
type SentRow = { id: string; name: string; audience: string; channel: string; status: string; recipients: number; credits: number; delivered: number; failed: number; pending: number; read: number; asked: number; acknowledged: number; body: string; at: string; note: string | null };
type SentView = {
  rows: SentRow[];
  totals: { sent: number; credits: number; deliveredRate: number | null; failures: number; held: number };
};
type SentDetail = { recipients: Array<{ id: string; name: string; children: string[]; status: string; reason: string | null; text: string | null; readAt: string | null; acknowledgeAsked: boolean; acknowledgedAt: string | null; replies: Array<{ text: string; at: string }> }> };

const API = "/api/v1/teacher-workspace";
const PLUS = "M12 5.5v13M5.5 12h13";
const EYE = "M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0-5.2";
const stamp = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(iso));
const clock = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso));
const channelName = (code: string) => (code === "IN_APP" ? "In-app" : code === "SMS" ? "SMS" : "Email");

/** What became of a send, in one word and a tone: it is only "delivered" once every family that could be reached has been. */
function outcome(message: SentRow): { label: string; tone: PanelTone } {
  if (message.status === "AWAITING_APPROVAL") return { label: "Held for approval", tone: "attention" };
  if (message.status === "RETURNED") return { label: "Returned", tone: "negative" };
  if (message.status === "CANCELLED") return { label: "Cancelled", tone: "negative" };
  if (message.failed) return { label: `${message.failed} failed`, tone: "attention" };
  if (message.pending) return { label: "Sending", tone: "progress" };
  return { label: "Delivered", tone: "positive" };
}

export async function teacherMessagesTab(tabSlug: string, me: TeacherWorkspaceView, query: Record<string, string | undefined>): Promise<TabContent | null | undefined> {
  if (tabSlug === "compose") return composeTab(await apiGet<ComposeInfo>(`${API}/messages/compose`), query);
  if (tabSlug === "sent") {
    const view = await apiGet<SentView>(`${API}/messages/sent`);
    // The most recent sends open with every recipient (the rest show their summary: eight is what a person looks at): what happened to each, who read it, who answered.
    const details = new Map<string, SentDetail>();
    await Promise.all(view.rows.slice(0, 8).filter((entry) => entry.status === "SENT").map(async (entry) => {
      try { details.set(entry.id, await apiGet<SentDetail>(`${API}/messages/sent/${entry.id}`)); } catch { /* the drawer falls back to the summary */ }
    }));
    return sentTab(view, me, details);
  }
  return undefined;
}

function noClass(title: string, desc: string): TabContent {
  return { title, desc, rows: [row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: "You hold no form class this term", body: "A teacher messages the families of their own class. When the school gives you a class, its families appear here — and only they do." }])] };
}

function composeTab(info: ComposeInfo, query: Record<string, string | undefined>): TabContent {
  const arm = info.arms[0];
  if (!arm) return noClass("Compose", "Your class’s families, and nobody else’s.");
  const armNames = info.arms.map((entry) => entry.name);
  // A draft the teacher came back to, or families ticked in Guardians and carried over here.
  const draft = query.draft ? info.drafts.find((entry) => entry.id === query.draft) : undefined;
  const ids = (query.ids ?? "").split(",").map((entry) => entry.trim()).filter((entry) => info.families.some((family) => family.id === entry));
  const prefill = draft
    ? { audience: draft.audience, families: draft.families, channel: draft.channel, body: draft.body, draftId: draft.id, acknowledge: draft.acknowledge }
    : ids.length ? { audience: ids.length === 1 ? "one" : "selected", families: ids, channel: query.ch } : query.ch || query.to ? { audience: query.to, channel: query.ch } : undefined;
  return {
    title: "Compose", desc: armNames.length > 3 ? "The families of the classes you teach, and nobody else’s." : `${armNames.join(" and ")}’s families, and nobody else’s.`,
    rows: [row("1fr", [{
      type: "embed", component: "message-composer",
      props: { arms: armNames, families: info.families, wallet: info.wallet.sms, threshold: info.threshold, sender: info.sender, smsNaira: info.smsNaira, drafts: info.drafts, prefill, base: API, sentHref: "/communication-center/sent" },
    }])],
  };
}

function sentTab(v: SentView, me: TeacherWorkspaceView, details: Map<string, SentDetail>): TabContent {
  const rows: TableRow[] = v.rows.map((message) => {
    const title = message.name.split(" · ").slice(1).join(" · ") || message.name;
    const state = outcome(message);
    const detail = details.get(message.id);
    const facts: PanelFact[] = [
      ["Audience", message.audience, `${message.recipients} recipients`],
      ["Channel", channelName(message.channel), message.credits ? `${message.credits} credit${message.credits === 1 ? "" : "s"}` : "Free"],
      ["Sender shown as", "The school", "Never your own name, never the platform’s"],
      ["What was said", message.body.length > 240 ? `${message.body.slice(0, 237)}…` : message.body, "Each family read it with their own name and child"],
      ["Delivered", `${message.delivered} of ${message.recipients}`, message.failed ? `${message.failed} failed` : message.pending ? `${message.pending} still with the carrier` : "No failures"],
      ["Read", `${message.read} of ${message.recipients}`, message.channel === "IN_APP" ? "Counted when a family opens it in their portal" : "Counted when a family opens it in their portal, if they do"],
      ...(message.asked ? ([["Acknowledged", `${message.acknowledged} of ${message.asked}`, message.acknowledged === message.asked ? "Everyone who was asked has" : `${message.asked - message.acknowledged} still to`]] as PanelFact[]) : []),
      ...(message.note ? ([["The Principal wrote", message.note, ""]] as PanelFact[]) : []),
      ["Also visible to", "The school’s Outbound Review", "Reaching a family on the school’s credit is an accountable act"],
    ];
    if (detail) {
      const answered = detail.recipients.filter((entry) => entry.replies.length);
      for (const entry of answered.slice(0, 6)) facts.push([`${entry.name} replied`, entry.replies[entry.replies.length - 1]!.text, `${clock(entry.replies[entry.replies.length - 1]!.at)} · it went to the office`]);
      for (const entry of detail.recipients.filter((person) => person.status === "FAILED" || person.status === "EXCLUDED").slice(0, 8)) facts.push([entry.name, entry.status === "FAILED" ? "Failed" : "Left out", entry.reason ?? ""]);
    }
    return {
      keywords: `${message.name} ${channelName(message.channel)} ${state.label}`,
      at: message.at,
      cells: [
        { kind: "text", text: title, strong: true }, { kind: "text", text: stamp(message.at) }, { kind: "text", text: String(message.recipients), mono: true }, { kind: "text", text: channelName(message.channel) },
        { kind: "text", text: message.credits ? `${message.credits} credit${message.credits === 1 ? "" : "s"}` : "Free" }, { kind: "pill", label: state.label, tone: state.tone },
        { kind: "action", label: "Open", drawer: { mode: "view", readOnly: true, kicker: `Sent · ${stamp(message.at)}`, title, facts } as DrawerSpec },
      ] as TableCellKind[],
    };
  });
  const t = v.totals;
  return {
    title: "Sent", desc: "Your own messages. Nobody else’s.",
    primary: { label: "Write a message", icon: PLUS, href: "/communication-center/compose" },
    rows: [
      row("1fr", [{
        type: "kpi", sub: "This term · every send of yours also appears in the school’s Outbound Review.", per: 4,
        cards: [
          { label: "Messages sent", value: String(t.sent), sub: me.formArms.length ? `To ${me.formArms.map((arm) => arm.name).join(" and ")} families` : "" },
          { label: "Credits used", value: String(t.credits), sub: "Of the school’s balance, not your own" },
          { label: "Delivered", value: t.deliveredRate === null ? "—" : `${t.deliveredRate}%`, sub: t.failures ? `${t.failures} failure${t.failures === 1 ? "" : "s"}` : "No failures", tone: t.failures ? "attention" : "positive" },
          { label: "Held for approval", value: String(t.held), sub: t.held ? "Waiting for the Principal" : "Nothing above the school’s threshold", tone: t.held ? "attention" : "positive" },
        ],
      }]),
      row("1fr", [{
        type: "table", title: "What you have sent", sub: "With its cost and what happened to it.", meta: `${v.rows.length} message${v.rows.length === 1 ? "" : "s"} · this term`, noun: "message", nounPlural: "messages",
        search: "Find a message",
        filters: [
          { label: "Channel", value: "All", options: ["All", "In-app", "SMS", "Email"], column: 3 },
          { label: "State", value: "All", options: ["All", "Delivered", "Sending", "Held for approval", "Returned"], column: 5 },
          { label: "Sent", value: "Any date", options: ["Any date", "Last 24 hours", "Last 7 days", "Last 30 days"], since: { "Last 24 hours": 24, "Last 7 days": 168, "Last 30 days": 720 } },
        ],
        head: ["Message", "Sent", "To", "Channel", "Cost", "State", ""], rows, per: 10, noRowOpen: true, empty: "You have not sent a message yet.", foot: "A send above the school’s threshold is held for approval before it leaves.",
      }]),
    ],
  };
}
