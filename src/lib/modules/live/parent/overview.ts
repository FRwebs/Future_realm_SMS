import { row } from "@/lib/modules/panels";
import type { ListItem, Panel, PanelRow } from "@/lib/modules/panels";
import { loadCalendar, item as eventItem } from "@/lib/modules/live/parent/calendar";
import { liveLesson, loadLearning } from "@/lib/modules/live/parent/learning";
import { loadRequests, requestItem } from "@/lib/modules/live/parent/requests";
import { dDow, greeting, loadMe, loadNeeds } from "@/lib/modules/live/parent/shared";
import type { NeedItem, ParentContent, ParentMe } from "@/lib/modules/live/parent/shared";

/**
 * What a parent sees first.
 *
 * It answers one question — "is there anything I have to do?" — before it shows
 * anything else, because that is the question a parent opens this portal with.
 * Everything outstanding is listed in one place, worst first, each with the one
 * action that clears it. When nothing is outstanding it says so plainly rather
 * than filling the space.
 */
export async function overviewPage(child: string): Promise<ParentContent> {
  const me = await loadMe();
  // What the phone's Home adds below the needs: where each child is in class right now, what is coming up, and what is still open with the
  // school. Each is read where the page for it reads it, and a read that fails leaves its block out rather than the page.
  const [needs, learning, calendar, requests] = await Promise.all([
    loadNeeds(child),
    me.sees.includes("Timetable") ? loadLearning(child).catch(() => null) : Promise.resolve(null),
    loadCalendar(child).catch(() => null),
    loadRequests(child).catch(() => null),
  ]);
  const one = child === "all" ? null : me.children.find((entry) => entry.id === child) ?? null;
  const more = homeBlocks(me, child, learning, calendar, requests);
  return one ? childOverview(me, one, needs.items, more) : familyOverview(me, needs.items, more);
}

type Learning = Awaited<ReturnType<typeof loadLearning>>;
type Calendar = Awaited<ReturnType<typeof loadCalendar>>;
type Requests = Awaited<ReturnType<typeof loadRequests>>;

/** The blocks under the needs on a phone: in class now, coming up, still open with the school, and the three things a parent does most. */
function homeBlocks(me: ParentMe, child: string, learning: Learning | null, calendar: Calendar | null, requests: Requests | null): PanelRow[] {
  const blocks: PanelRow[] = [];
  const inClass = (learning?.children ?? []).map((kid) => ({ kid, live: liveLesson(kid, me) })).filter((entry) => entry.live.now);
  if (inClass.length) {
    blocks.push(phoneOnly({
      type: "list", noFind: true, title: "Right now in class", sub: me.now,
      items: inClass.map(({ kid, live }): ListItem => ({
        avatar: me.children.find((entry) => entry.id === kid.id)?.initials ?? kid.first.slice(0, 2).toUpperCase(),
        label: `${kid.first} · ${live.now!.subject}`, pill: "Now", tone: "progress", href: `/portals/parent/learning?child=${kid.id}`,
        sub: `${live.now!.from}–${live.now!.to}${live.now!.teacher ? ` · ${live.now!.teacher}` : ""}${live.next ? ` · then ${live.next.subject}` : ""}`,
      })),
    }));
  }
  const ahead = (calendar?.events ?? []).filter((event) => event.end >= calendar!.today).slice(0, 4);
  if (ahead.length) blocks.push(phoneOnly({ type: "list", noFind: true, title: "Coming up", sub: "From the school calendar.", items: ahead.map((event) => eventItem(event, child === "all")), foot: "The whole term is under Calendar." }));
  const open = (requests?.items ?? []).filter((entry) => entry.open).slice(0, 3);
  if (requests && open.length) {
    blocks.push(phoneOnly({ type: "list", noFind: true, title: "Your requests", tag: `${requests.items.filter((entry) => entry.open).length} open`, tagTone: "attention", items: open.map((entry) => requestItem(entry, child === "all", requests)) }));
  }
  const quick: ListItem[] = [
    ...(me.sees.includes("Fees") ? [{ icon: "M3.5 6.5h17v11h-17zM3.5 10.5h17", label: "Pay fees", sub: "What is owed, and the ways to pay it", href: "/portals/parent/fees" }] : []),
    ...(me.sees.includes("Attendance") ? [{ icon: "M4 5.5h16V20H4zM8 3v4M16 3v4M8.5 14l2 2 4-4.5", label: "Explain an absence", sub: "Tell the school why, in a minute", href: "/portals/parent/attendance" }] : []),
    { icon: "M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4M12 16.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z", label: "Ask the school", sub: "Goes to a named person", href: "/portals/parent/requests?new=1" },
  ];
  blocks.push(phoneOnly({ type: "list", noFind: true, title: "Quick actions", items: quick }));
  return blocks;
}


const phoneOnly = (panel: Panel): PanelRow => ({ ...row("1fr", [panel]), show: "phone" as const });
const desktopOnly = (rows: PanelRow[]): PanelRow[] => rows.map((entry) => ({ ...entry, show: "desktop" as const }));

/** A need as the phone lists it: the child in a round tile, what is asked, and the one button that does it. */
const needRow = (need: NeedItem, kids: ParentMe["children"]): ListItem => {
  const kid = kids.find((entry) => entry.id === need.childId);
  return {
    ...(kid || need.child ? { avatar: kid?.initials ?? need.child.slice(0, 2).toUpperCase() } : { icon: "M12 3.2 19 6v6c0 4-3 7.4-7 8.3-4-.9-7-4.3-7-8.3V6zM9.3 12l2 2 3.4-3.7" }), label: need.label, sub: `${need.child ? `${need.child} · ` : ""}${need.sub}`,
    tone: need.tone, act: { label: need.action, href: need.href },
  };
};

const needItem = (need: NeedItem, withChild: boolean): ListItem => ({
  label: withChild && need.child ? `${need.child} · ${need.label}` : need.label,
  sub: need.sub,
  pill: need.pill,
  tone: need.tone,
  viewLabel: need.action,
  href: need.href,
});

function familyOverview(me: ParentMe, needs: NeedItem[], more: PanelRow[]): ParentContent {
  const urgent = needs.filter((need) => need.tone === "negative").length;
  const count = needs.length;
  const sub = count
    ? `${count} ${count === 1 ? "thing needs" : "things need"} you${urgent ? `, starting with ${urgent} overdue payment${urgent === 1 ? "" : "s"}.` : "."}`
    : "Nothing needs you today.";
  return {
    eyebrow: `${dDow(me.today)} · ${me.now}${me.term ? ` · ${me.term.name}, week ${me.term.week}` : ""}`,
    title: `${greeting(me.now)}, ${me.first}`,
    desc: `${me.children.length === 1 ? "Your child is" : `Your ${me.children.length} children are`} at ${me.school}. ${sub}`,
    primary: { label: "Start a request", href: "/portals/parent/requests?new=1" },
    // The phone opens on the greeting and the date, then who is in the family and what is asked of the parent, the way its mockup does.
    phoneEyebrow: "", phoneTitle: `${greeting(me.now)}, ${me.first}`, phoneDesc: `${dDow(me.today)} · ${me.now}${me.term ? ` · ${me.term.name}, week ${me.term.week}` : ""}`,
    rows: [
      phoneOnly({
        type: "list", title: "Your children", empty: "No child is linked to your account yet. The school office links them.",
        items: me.children.map((entry): ListItem => {
          const mine = needs.filter((need) => need.childId === entry.id);
          return {
            avatar: entry.initials, label: entry.name, sub: `${entry.arm} · ${entry.level}`,
            side: mine.length ? `${mine.length} ${mine.length === 1 ? "thing" : "things"} to do` : "Nothing to do",
            tone: mine.some((need) => need.tone === "negative") ? "negative" : mine.length ? "attention" : "positive", href: `/portals/parent/overview?child=${entry.id}`,
          };
        }),
      }),
      phoneOnly({
        type: "list", noFind: true, title: "Needs you", tag: needs.length ? String(needs.length) : undefined, tagTone: urgent ? "negative" : "attention",
        empty: "Nothing is waiting on you. The school will tell you here when something is.",
        items: needs.map((need) => needRow(need, me.children)),
      }),
      ...more,
      ...desktopOnly([
      row("1fr", [{
        type: "kpi", bare: true, per: Math.min(4, Math.max(1, me.children.length + 1)),
        cards: [
          { label: "Needs you", value: String(count), sub: count ? `${urgent} overdue · ${count - urgent} waiting` : "Nothing outstanding", tone: urgent ? "negative" : count ? "attention" : "positive", icon: "listCheck" },
          ...me.children.map((entry) => ({
            label: entry.first,
            value: entry.arm,
            sub: `${entry.level} · ${entry.admissionNumber}`,
            tone: "neutral" as const,
            href: `/portals/parent/profile?child=${entry.id}`,
            icon: "person",
          })),
        ],
      }]),
      row("minmax(0,1.25fr) minmax(0,1fr)", [
        {
          type: "list", title: "Needs you", sub: "Worst first. Each one has the single thing that clears it.",
          empty: "Nothing is waiting on you. The school will tell you here when something is.",
          items: needs.map((need) => needItem(need, true)),
        },
        {
          type: "list", title: "Your children", sub: "Open a child to see only their record.",
          items: me.children.map((entry): ListItem => {
            const mine = needs.filter((need) => need.childId === entry.id);
            return {
              label: entry.name,
              sub: `${entry.arm} · ${entry.admissionNumber}`,
              pill: mine.length ? `${mine.length} to do` : "Nothing to do",
              tone: mine.some((need) => need.tone === "negative") ? "negative" : mine.length ? "attention" : "positive",
              href: `/portals/parent/overview?child=${entry.id}`,
            };
          }),
          empty: "No child is linked to your account yet. The school office links them.",
        },
      ]),
      ]),
    ],
  };
}

function childOverview(me: ParentMe, child: ParentMe["children"][number], needs: NeedItem[], more: PanelRow[]): ParentContent {
  const mine = needs.filter((need) => need.childId === child.id || need.childId === null);
  return {
    eyebrow: `${child.level} · ${child.admissionNumber}`,
    title: child.name,
    desc: `${child.arm} · ${me.school}`,
    primary: { label: "Ask the school something", href: `/portals/parent/requests?new=1&child=${child.id}` },
    phoneEyebrow: `${child.level} · ${child.admissionNumber}`, phoneTitle: child.name, phoneDesc: `${child.arm} · ${me.school}`,
    rows: [
      phoneOnly({
        type: "list", noFind: true, title: `What needs you about ${child.first}`, tag: mine.length ? String(mine.length) : undefined, tagTone: "attention",
        empty: `Nothing is waiting on you about ${child.first}.`,
        items: mine.map((need) => needRow(need, [child])),
      }),
      phoneOnly({
        type: "list", title: "Where to look",
        items: [
          { label: "Attendance", sub: "Every mark, the day it is made", href: `/portals/parent/attendance?child=${child.id}` },
          { label: "Results and reports", sub: "What the school has released", href: `/portals/parent/results?child=${child.id}` },
          { label: "Timetable and lessons", sub: "The week, and what is being taught", href: `/portals/parent/learning?child=${child.id}` },
          { label: "Fees and payments", sub: "What is owed, and every receipt", href: "/portals/parent/fees" },
        ],
      }),
      ...more,
      ...desktopOnly([
      row("1fr", [{
        type: "list", title: `What needs you about ${child.first}`, sub: "Worst first. Each one has the single thing that clears it.",
        empty: `Nothing is waiting on you about ${child.first}.`,
        items: mine.map((need) => needItem(need, false)),
      }]),
      row("minmax(0,1fr) minmax(0,1fr)", [
        {
          type: "facts", title: "On record", sub: "Held by the school registry.", per: 2,
          facts: [["Class", child.arm], ["Level", child.level], ["Admission number", child.admissionNumber], ["School", me.school]],
        },
        {
          type: "list", title: "Where to look",
          items: [
            { label: "Attendance", sub: "Every mark, the day it is made", href: `/portals/parent/attendance?child=${child.id}` },
            { label: "Results and reports", sub: "What the school has released", href: `/portals/parent/results?child=${child.id}` },
            { label: "Timetable and lessons", sub: "The week, and what is being taught", href: `/portals/parent/learning?child=${child.id}` },
            { label: "Fees and payments", sub: "What is owed, and every receipt", href: "/portals/parent/fees" },
          ],
        },
      ]),
      ]),
    ],
  };
}
