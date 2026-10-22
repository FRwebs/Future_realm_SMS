import { apiGet } from "@/lib/api/server";
import type { TeacherWorkspaceView } from "@/lib/api/teacher-workspace";
import { area, fixed, toggle } from "@/lib/modules/live/m7-forms";
import type { DrawerSpec, FormField, PanelFact, PanelRow, PanelTone, TabContent, TableCellKind, TableRow } from "@/lib/modules/panels";
import { pill, row, text } from "@/lib/modules/panels";

/**
 * M12 for a teaching person: Messages — the families of their own class and nobody else's, with the cost shown before it goes. A family
 * sees the school, not the teacher; replies reach the office; and a send above the school's threshold waits for the Principal.
 */

type ComposeInfo = {
  arms: Array<{ id: string; name: string; roll: number }>;
  families: Array<{ id: string; name: string; phone: string; children: string[]; reachable: boolean }>;
  wallet: { sms: number };
  threshold: number | null;
  sender: string;
  smsNaira: number;
};
type SentView = {
  rows: Array<{ id: string; name: string; audience: string; channel: string; status: string; recipients: number; credits: number; delivered: number; failed: number; body: string; at: string; note: string | null }>;
  totals: { sent: number; credits: number; deliveredRate: number | null; failures: number; held: number };
};

const API = "/api/v1/teacher-workspace";
const SEND = "M4.5 12.5 19.5 5l-4 15-4.2-5.3z";
const PLUS = "M12 5.5v13M5.5 12h13";
const EYE = "M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0-5.2";
const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
const CHANNELS: Array<{ label: string; code: "IN_APP" | "SMS" | "EMAIL"; sub: string }> = [
  { label: "In-app", code: "IN_APP", sub: "Free" },
  { label: "SMS", code: "SMS", sub: "1 credit each" },
  { label: "Email", code: "EMAIL", sub: "Free" },
];
const AUDIENCES = ["all", "selected", "one"] as const;
type Audience = (typeof AUDIENCES)[number];
const stamp = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(iso));
const statusTone = (status: string): PanelTone => (status === "SENT" ? "positive" : status === "AWAITING_APPROVAL" ? "attention" : status === "CANCELLED" || status === "RETURNED" ? "negative" : "neutral");
const statusLabel = (status: string) => (status === "SENT" ? "Delivered" : status === "AWAITING_APPROVAL" ? "Held for approval" : status === "RETURNED" ? "Returned" : status === "CANCELLED" ? "Cancelled" : status);

export async function teacherMessagesTab(tabSlug: string, me: TeacherWorkspaceView, query: Record<string, string | undefined>): Promise<TabContent | null | undefined> {
  if (tabSlug === "compose") return composeTab(await apiGet<ComposeInfo>(`${API}/messages/compose`), me, query);
  if (tabSlug === "sent") return sentTab(await apiGet<SentView>(`${API}/messages/sent`), me);
  return undefined;
}

function noClass(title: string, desc: string): TabContent {
  return { title, desc, rows: [row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: "You hold no form class this term", body: "A teacher messages the families of their own class. When the school gives you a class, its families appear here." }])] };
}

function composeTab(info: ComposeInfo, me: TeacherWorkspaceView, query: Record<string, string | undefined>): TabContent {
  const arm = info.arms[0];
  if (!arm) return noClass("Compose", "Your class’s families, and nobody else’s.");
  const to: Audience = (AUDIENCES as readonly string[]).includes(query.to ?? "") ? (query.to as Audience) : "all";
  const channel = CHANNELS.find((entry) => entry.code === query.ch) ?? CHANNELS[0]!;
  const sms = channel.code === "SMS";
  const total = info.families.length;
  const reachable = info.families.filter((family) => family.reachable).length;
  const reach = to === "all" ? (sms ? reachable : total) : to === "one" ? 1 : Math.min(6, total);
  const cost = sms ? reach : 0;
  const href = (nextTo: string, nextCh: string) => `/communication-center/compose?to=${nextTo}&ch=${nextCh}`;
  const label = (key: Audience) => (key === "all" ? `Every ${info.arms.map((entry) => entry.name).join(" and ")} family` : key === "selected" ? "Selected families" : "One family");
  const options = info.families.map((family) => ({ value: family.id, label: family.name, sub: family.children.join(", ") }));
  const fields: FormField[] = [
    fixed("To", label(to), { hint: to === "all" ? `${reach} famil${reach === 1 ? "y" : "ies"}${sms && total !== reachable ? ` · ${total - reachable} without a phone number are left out` : ""}` : "Pick the families below" }),
    ...(to === "all" ? [] : [{ label: to === "one" ? "Family" : "Families", kind: "picker", options, checked: [], span: 2, required: true, placeholder: "Search by guardian or child", noun: "family", nounPlural: "families" } as FormField]),
    fixed("Channel", channel.label, { hint: sms ? "1 credit each" : "Free" }),
    area("Message", { span: 2, required: true, placeholder: "Dear parent, …", hint: "Families see this from the school, and replies reach the office." }),
    toggle("Ask families to acknowledge", false, "A reply is asked for", "No reply needed", { span: 2 }),
  ];
  const sendDrawer: DrawerSpec = {
    mode: "form", kicker: "Messages", title: `Send to ${to === "all" ? reach : to === "one" ? 1 : "the selected"} famil${reach === 1 && to !== "selected" ? "y" : "ies"}`, sub: "The cost is shown before it leaves, and it is charged to the school.",
    commitLabel: "Send it", commitDone: "Message sent", commitDoneBody: `It is on its way as ${info.sender}. It also appears in the school’s Outbound Review.`,
    reviewNote: `${channel.label} · ${sms ? `${reach} credit${reach === 1 ? "" : "s"} (₦${(reach * info.smsNaira).toFixed(2)})` : "free"}. ${info.threshold !== null ? `A send to more than ${info.threshold} families routes to the Principal first.` : ""}`,
    fields,
    submit: { endpoint: `${API}/messages`, method: "POST", body: { audience: to, channel: channel.code }, map: { Families: "families", Family: "families", Message: "body", "Ask families to acknowledge": "acknowledge" } },
  };
  const before: PanelFact[] = [
    ["Recipients", String(reach), label(to)],
    ["Channel", channel.label, sms ? "1 credit each" : "Free"],
    ["Cost", `${cost} credit${cost === 1 ? "" : "s"}`, sms ? `School balance ${info.wallet.sms.toLocaleString("en-NG")} → ${(info.wallet.sms - cost).toLocaleString("en-NG")}` : "Nothing is charged"],
    ["Your audience limit", `${info.arms.map((entry) => entry.name).join(" and ")} families only`, "Set on your account, not by this screen"],
    ["Above the threshold", info.threshold === null ? "Never routes for approval" : `${info.threshold} recipients`, info.threshold === null ? "" : reach > info.threshold ? "This send will wait for the Principal" : "Below it — this sends now"],
    ["Needs a connection", "Yes", "A cost cannot be shown truthfully against a stale balance"],
  ];
  return {
    title: "Compose", desc: `${info.arms.map((entry) => entry.name).join(" and ")}’s families, and nobody else’s.`,
    primary: { label: "Preview and send", icon: SEND, drawer: sendDrawer },
    rows: ([
      row("1fr", [{
        type: "tiles", title: "Who it goes to", tag: `${reach} recipient${reach === 1 ? "" : "s"}`, tagTone: "progress", per: 3,
        tiles: AUDIENCES.map((key) => ({ label: label(key), sub: key === to ? "Selected" : key === "all" ? `${total} ${total === 1 ? "family" : "families"}` : key === "selected" ? "Pick the ones you mean" : "A single family", tone: (key === to ? "positive" : "neutral") as PanelTone, href: href(key, channel.code) })),
      }]),
      row("1fr", [{ type: "tiles", title: "How it reaches them", sub: "The cost is shown before every send, whatever the channel.", per: 3, tiles: CHANNELS.map((entry) => ({ label: entry.label, sub: entry.code === channel.code ? `Selected · ${entry.sub}` : entry.sub, tone: (entry.code === channel.code ? "positive" : "neutral") as PanelTone, href: href(to, entry.code) })) }]),
      row("1fr", [{ type: "facts", title: "Before it leaves", tag: `${cost} credits`, tagTone: cost ? "attention" : "positive", per: 2, sub: "The cost is shown before every send, whatever the audience.", facts: before }]),
      row("1fr", [{ type: "note", tone: "neutral", icon: WARN, title: "Families see the school, not you", body: `Every message is sent as ${info.sender}. Replies reach the office, not your phone.` }]),
    ] as PanelRow[]),
  };
}

function sentTab(v: SentView, me: TeacherWorkspaceView): TabContent {
  const rows: TableRow[] = v.rows.map((message) => ({
    keywords: `${message.name} ${message.channel} ${message.status}`,
    cells: [
      text(message.name.split(" · ").slice(1).join(" · ") || message.name, { strong: true }), text(stamp(message.at)), text(String(message.recipients), { mono: true }), text(message.channel === "IN_APP" ? "In-app" : message.channel === "SMS" ? "SMS" : "Email"),
      text(message.credits ? `${message.credits} credits` : "Free"), pill(statusLabel(message.status), statusTone(message.status)),
      {
        kind: "action", label: "Open",
        drawer: {
          mode: "view", readOnly: true, kicker: `Sent · ${stamp(message.at)}`, title: message.name.split(" · ").slice(1).join(" · ") || message.name,
          facts: [["Audience", message.audience, `${message.recipients} recipients`], ["Channel", message.channel === "IN_APP" ? "In-app" : message.channel, message.credits ? `${message.credits} credits` : "Free"], ["What was said", message.body, ""], ["State", statusLabel(message.status), message.note ?? ""], ["Also visible to", "The school’s Outbound Review", "Reaching a family on the school’s credit is an accountable act"]],
        } as DrawerSpec,
      },
    ] as TableCellKind[],
  }));
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
        search: "Find a message", head: ["Message", "Sent", "To", "Channel", "Cost", "State", ""], rows, per: 10, noRowOpen: true, empty: "You have not sent a message yet.", foot: "A send above the school’s threshold is held for approval before it leaves.",
      }]),
    ],
  };
}
