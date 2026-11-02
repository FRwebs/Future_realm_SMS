import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import { row } from "@/lib/modules/panels";
import type { DrawerSpec, FormField, ListItem, PanelTone } from "@/lib/modules/panels";
import { PW, dDow, dShort, dayOf } from "@/lib/modules/live/parent/shared";
import type { ParentContent } from "@/lib/modules/live/parent/shared";

type Meeting = {
  id: string; title: string; at: string; date: string; time: string; status: string; notes: string | null;
  childId: string | null; child: string | null; with: string | null; past: boolean; answerable: boolean;
};
type Asked = { id: string; type: string; detail: string; state: string; owner: string | null; role: string | null; opened: string; child: string | null; outcome: string | null };
type Meetings = { today: string; children: Array<{ id: string; first: string }>; meetings: Meeting[]; asked: Asked[] };

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WORD: Record<string, [string, PanelTone]> = {
  INVITED: ["Please answer", "attention"], SCHEDULED: ["Set by the school", "progress"], CONFIRMED: ["You are coming", "positive"],
  DECLINED: ["You cannot come", "neutral"], COMPLETED: ["Held", "positive"], HELD: ["Held", "positive"], CANCELLED: ["Cancelled", "neutral"],
};

const answer = (meeting: Meeting, choice: "CONFIRMED" | "DECLINED"): DrawerSpec => ({
  mode: "commit", tone: choice === "CONFIRMED" ? "progress" : "attention", kicker: "Meetings",
  title: choice === "CONFIRMED" ? "Tell the school you can come?" : "Tell the school you cannot come?",
  sub: `${meeting.title} · ${dDow(meeting.date)}, ${meeting.time}.`, commitLabel: choice === "CONFIRMED" ? "I can come" : "I cannot come",
  commitDone: "Your answer is with the school", commitDoneBody: choice === "CONFIRMED" ? "They know to expect you." : "They will be in touch about another time.",
  submit: { endpoint: `${PW}/meetings/${meeting.id}/respond`, method: "POST", body: { answer: choice } },
});

/** Asking for a meeting is a request like any other, so it goes through the same intake: an owner, and a clock. */
function askDrawer(kids: Meetings["children"], chosen?: string): DrawerSpec {
  const fields: FormField[] = [
    ...(kids.length > 1 ? [{ kind: "select", label: "Who is it about?", required: true, value: kids.find((kid) => kid.id === chosen)?.first ?? kids[0]?.first ?? "", options: kids.map((kid) => kid.first) } as FormField] : []),
    { kind: "area", label: "What would you like to talk about?", required: true, value: "", placeholder: "Who you would like to meet, and about what" },
  ];
  return {
    kicker: "Meetings", title: "Ask for a meeting", mode: "form", sub: "It goes to the school as a request you can follow under Requests.", fields,
    confirmTitle: "Send this to the school?", commitLabel: "Send the request", commitDone: "Sent to the school", commitDoneBody: "You can follow it under Requests.",
    submit: {
      endpoint: "/api/v1/parent-portal/submissions", method: "POST",
      map: { "Who is it about?": "child", "What would you like to talk about?": "detail" }, body: { type: "Meeting request" },
      ...(kids.length > 1 ? { encode: { "Who is it about?": Object.fromEntries(kids.map((kid) => [kid.first, kid.id])) } } : kids[0] ? { body: { type: "Meeting request", child: kids[0].id } } : {}),
    },
  };
}

function meetingItem(meeting: Meeting, withChild: boolean): ListItem {
  const date = dayOf(meeting.date);
  const [word, tone] = WORD[meeting.status] ?? [meeting.status, "neutral" as PanelTone];
  return {
    lead: { top: MONTHS[date.getUTCMonth()]!, value: String(date.getUTCDate()), tone: meeting.past ? "neutral" : "progress" },
    label: `${meeting.title}${withChild && meeting.child ? ` · ${meeting.child}` : ""}`,
    sub: [`${dDow(meeting.date)}, ${meeting.time}`, meeting.with ? `With ${meeting.with}` : "", meeting.notes ?? ""].filter(Boolean).join(" · "),
    pill: word, tone,
    ...(meeting.answerable
      ? { viewLabel: meeting.status === "CONFIRMED" ? "Change" : "Answer", drawer: answer(meeting, meeting.status === "CONFIRMED" ? "DECLINED" : "CONFIRMED") }
      : {}),
  };
}

export async function meetingsPage(child: string): Promise<ParentContent> {
  const data = await apiGet(`${PW}/meetings?child=${encodeURIComponent(child)}`, observe<Meetings>(localContracts["src/lib/modules/live/parent/meetings.ts#0c9c78c3"]));
  const one = child === "all" ? null : data.children.find((entry) => entry.id === child) ?? null;
  const upcoming = data.meetings.filter((meeting) => !meeting.past && meeting.status !== "CANCELLED");
  const held = data.meetings.filter((meeting) => meeting.past || meeting.status === "CANCELLED").reverse();
  return {
    eyebrow: one ? one.first : "Whole family", title: "Meetings", desc: "School conferences, and meetings you’ve asked for.",
    primary: { label: "Request a meeting", drawer: askDrawer(data.children, one?.id) },
    rows: [
      row("minmax(0,1.4fr) minmax(0,1fr)", [
        { type: "list", title: "Conferences and school meetings", items: upcoming.map((meeting) => meetingItem(meeting, !one)), empty: "Nothing is scheduled." },
        {
          type: "list", title: "Meetings you asked for", sub: "Each one is a request, with an owner and an answer.", empty: "You have not asked for a meeting.",
          items: data.asked.map((entry): ListItem => ({
            label: `Meeting request${entry.child ? ` · ${entry.child}` : ""}`,
            sub: `${entry.detail.length > 80 ? `${entry.detail.slice(0, 78)}…` : entry.detail} · ${entry.owner ? `With ${entry.owner}${entry.role ? `, ${entry.role}` : ""}` : "Not yet with anyone"} · sent ${dShort(entry.opened)}`,
            pill: entry.state, tone: "progress", href: "/portals/parent/requests",
          })),
        },
      ]),
      row("1fr", [{ type: "list", title: "Earlier", sub: "What was held, so the next conversation starts from it.", items: held.map((meeting) => meetingItem(meeting, !one)), empty: "No meetings earlier." }]),
    ],
  };
}
