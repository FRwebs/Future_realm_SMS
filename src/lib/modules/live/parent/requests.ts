import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import { row } from "@/lib/modules/panels";
import type { DrawerSpec, FormField, ListItem, PanelFact, PanelTone } from "@/lib/modules/panels";
import { PW, dLong, dShort } from "@/lib/modules/live/parent/shared";
import type { ParentContent } from "@/lib/modules/live/parent/shared";
import { correctionDrawer } from "@/lib/modules/live/parent/profile";

type Item = {
  id: string; type: string; detail: string; evidence: string | null; dates: string[]; childId: string | null; child: string | null;
  state: string; open: boolean; owner: string | null; role: string | null; outcome: string | null;
  opened: string; closed: string | null; due: string | null; late: boolean; channel: string | null;
};
type Requests = {
  today: string; items: Item[]; typical: number | null;
  types: Array<{ name: string; days: number; reviewer: string; accepted: boolean }>;
  children: Array<{ id: string; first: string; name: string }>;
};

const TABS = ["Open", "Closed", "All"];
const toneOf = (item: Item): PanelTone => (item.state === "Resolved" ? "positive" : item.state === "Declined" || item.state === "Withdrawn" ? "neutral" : item.late ? "negative" : "progress");
const age = (from: string, to: string) => {
  const days = Math.max(0, Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000));
  return days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
};

export const loadRequests = (child: string) => apiGet(`${PW}/requests?child=${encodeURIComponent(child)}`, observe<Requests>(localContracts["src/lib/modules/live/parent/requests.ts#ed1af676"]));

export async function requestsPage(child: string, query: Record<string, string | undefined>): Promise<ParentContent> {
  const data = await loadRequests(child);
  const one = child === "all" ? null : data.children.find((entry) => entry.id === child) ?? null;
  const tab = TABS.includes(query.tab ?? "") ? query.tab! : TABS[0]!;
  const open = data.items.filter((item) => item.open);
  const closed = data.items.filter((item) => !item.open);
  const list = tab === "Open" ? open : tab === "Closed" ? closed : data.items;
  const oldest = open[open.length - 1];
  const late = open.filter((item) => item.late).length;

  return {
    eyebrow: one ? one.name : "Whole family", title: "Requests to the school",
    tabs: [{ label: "Open", count: open.length || undefined }, { label: "Closed", count: closed.length || undefined }, { label: "All" }], tab,
    desc: "Each request goes to a named person and closes only with a written answer.",
    primary: { label: "Start a request", drawer: askDrawer("Result query", data, one?.id) },
    rows: [
      row("1fr", [{
        type: "kpi", bare: true, per: 4,
        cards: [
          { label: "Open", value: String(open.length), sub: oldest ? `Oldest: ${age(oldest.opened, data.today)}` : "Nothing waiting", tone: (open.length ? "progress" : "positive") as PanelTone, icon: "listCheck" },
          { label: "Answered", value: String(closed.filter((item) => item.state === "Resolved").length), sub: "Each with a written outcome", tone: "positive" as PanelTone, icon: "person" },
          { label: "Typical answer time", value: data.typical === null ? "—" : `${data.typical} ${data.typical === 1 ? "day" : "days"}`, sub: data.typical === null ? "Nothing answered yet" : "From sent to answered", tone: "neutral" as PanelTone, icon: "clock" },
          { label: "Past its promised date", value: String(late), sub: late ? "Past the school’s reply time" : "None", tone: (late ? "negative" : "positive") as PanelTone, icon: "calendar" },
        ],
      }]),
      row("minmax(0,1.55fr) minmax(0,1fr)", [
        {
          type: "list", title: tab === "Closed" ? "Answered" : tab === "All" ? "Every request" : "In progress", sub: "Tap a request to see who has it and every step so far.",
          empty: tab === "Open" ? "No open requests." : "Nothing here yet.",
          items: list.map((item) => requestItem(item, !one, data)),
        },
        {
          type: "list", title: "Start a request", sub: "Choose what you need. Each type goes to one named role.",
          items: startItems(data, one?.id),
        },
      ]),
    ],
  };
}

export function requestItem(item: Item, withChild: boolean, data: Requests): ListItem {
  const where = item.owner ? `With ${item.owner}${item.role ? `, ${item.role}` : ""}` : "Not yet with anyone";
  return {
    label: `${item.type}${withChild && item.child ? ` · ${item.child}` : ""}`,
    sub: `${where} · sent ${dShort(item.opened)}${item.open && item.due ? ` · answer by ${dShort(item.due)}` : item.closed ? ` · closed ${dShort(item.closed)}` : ""}`,
    pill: item.open && item.late ? "Past its date" : item.state, tone: toneOf(item),
    drawer: detailDrawer(item, data),
  };
}

/** Every step the school's records hold: sent, who has it, and — once closed — the written answer. */
function detailDrawer(item: Item, data: Requests): DrawerSpec {
  const facts: PanelFact[] = [
    ["With", item.owner ?? "Not yet with anyone", item.role ?? ""],
    ["Sent", dLong(item.opened), `${age(item.opened, item.closed ?? data.today)} ${item.closed ? "from sent to closed" : "ago"}`],
    item.closed
      ? ["Closed", dLong(item.closed), item.state]
      : ["Answer promised by", item.due ? dLong(item.due) : "No date promised", item.late ? "That date has passed" : "The school’s own reply time", item.late ? "negative" : ""],
    ["Your words", item.detail, item.dates.length ? `Days: ${item.dates.map((day) => dShort(day)).join(", ")}` : item.evidence ? `Backed up by: ${item.evidence}` : ""],
    ...(item.outcome ? [["Outcome", item.outcome, "", item.state === "Resolved" ? "positive" : ""] as PanelFact] : []),
    ["Every step", `Sent ${dShort(item.opened)} through the portal`, [item.owner ? `Given to ${item.owner}` : "Waiting for someone at the school to take it", item.closed ? `Closed ${dShort(item.closed)}` : ""].filter(Boolean).join(" · ")],
  ];
  return item.open
    ? {
        mode: "commit", tone: "attention", kicker: item.type, title: `${item.type}${item.child ? ` · ${item.child}` : ""}`, sub: "This is with the school. You can withdraw it if you no longer need an answer.",
        facts, commitLabel: "Withdraw this request", commitNote: "It closes now, with “Withdrawn by the family” as the outcome. You can send a new one any time.",
        commitDone: "Request withdrawn", commitDoneBody: `${item.owner ?? "The school"} has been told.`,
        submit: { endpoint: `${PW}/requests/${item.id}/withdraw`, method: "POST" },
      }
    : { mode: "view", readOnly: true, kicker: item.type, title: `${item.type}${item.child ? ` · ${item.child}` : ""}`, sub: item.state, facts };
}

/** What a family may ask the school, and the one thing each type promises: an owner, and a clock. */
const KINDS: Array<{ type: string; label: string; sub: string; need: "child" | "any" }> = [
  { type: "Absence explanation", label: "Explain an absence", sub: "Tell the school why your child was away, or will be.", need: "child" },
  { type: "Record correction", label: "Update your child’s record", sub: "Fix a wrong detail, or add a collection person.", need: "child" },
  { type: "Result query", label: "Ask about a result", sub: "A score or grade that looks wrong to you.", need: "child" },
  { type: "Fee query", label: "Fees: a question or a payment", sub: "Tell the bursar about a payment, question a line, or ask for a plan.", need: "any" },
  { type: "Meeting request", label: "Request a meeting", sub: "With the form master, a teacher or the Principal.", need: "any" },
];

function startItems(data: Requests, chosen?: string): ListItem[] {
  const kids = data.children;
  const items: ListItem[] = KINDS.map((kind): ListItem => {
    const type = data.types.find((entry) => entry.name === kind.type);
    if (!type?.accepted) return { label: kind.label, sub: "Not offered here — the school handles this in person.", pill: "In person", tone: "neutral" };
    const reply = type.days ? ` Answer within ${type.days} school ${type.days === 1 ? "day" : "days"}.` : "";
    const drawer = kind.type === "Record correction" ? correctionDrawer(kids, kids.find((entry) => entry.id === chosen)) : askDrawer(kind.type, data, chosen);
    return { label: kind.label, sub: `${kind.sub}${reply}`, viewLabel: "Start", drawer };
  });
  items.push(
    { label: "Update your contact details", sub: "A new phone number, email or home address.", viewLabel: "Start", href: "/portals/parent/account" },
    { label: "Give or withdraw a consent", sub: "Photography, health data, sharing results. Recorded at once.", viewLabel: "Start", href: "/portals/parent/consents" },
    { label: "Withdrawal or transfer notice", sub: "Your child is leaving the school. The school handles this in person.", pill: "In person", tone: "neutral" },
  );
  return items;
}

/** One form for the asks that are only words: a child, and what you would like to say. */
function askDrawer(type: string, data: Requests, chosen?: string): DrawerSpec {
  const kids = data.children;
  const kind = KINDS.find((entry) => entry.type === type);
  const target = data.types.find((entry) => entry.name === type);
  const needsChild = kind?.need === "child";
  const fields: FormField[] = [
    ...(kids.length > 1 || needsChild
      ? [{ kind: "select", label: "Who is it about?", required: needsChild, value: kids.find((entry) => entry.id === chosen)?.name ?? kids[0]?.name ?? "", options: kids.map((entry) => entry.name) } as FormField]
      : []),
    ...(type === "Absence explanation" ? [{ kind: "text", type: "date", label: "Which day?", required: true, value: "" } as FormField] : []),
    { kind: "area", label: "What would you like to say?", required: true, value: "", placeholder: "Your own words — the person who reads it has only these" },
  ];
  const encode = kids.length ? { "Who is it about?": Object.fromEntries(kids.map((entry) => [entry.name, entry.id])) } : undefined;
  return {
    kicker: "Requests", title: kind?.label ?? "Ask the school something", mode: "form",
    sub: `${kind?.sub ?? "It goes to the school as a request you can follow."}${target?.reviewer ? ` It goes to the ${target.reviewer.toLowerCase()}.` : ""}`,
    fields, confirmTitle: "Send this to the school?", commitLabel: "Send the request", commitDone: "Sent to the school",
    commitDoneBody: "You can follow it on this page. A request closes only with a written answer.",
    submit: {
      endpoint: "/api/v1/parent-portal/submissions", method: "POST",
      map: { "Who is it about?": "child", "Which day?": "dates", "What would you like to say?": "detail" },
      body: { type }, ...(encode ? { encode } : {}),
    },
  };
}

