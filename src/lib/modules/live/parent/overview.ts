import { row } from "@/lib/modules/panels";
import type { ListItem, Panel, PanelRow } from "@/lib/modules/panels";
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
  const needs = await loadNeeds(child);
  const one = child === "all" ? null : me.children.find((entry) => entry.id === child) ?? null;
  return one ? childOverview(me, one, needs.items) : familyOverview(me, needs.items);
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

function familyOverview(me: ParentMe, needs: NeedItem[]): ParentContent {
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

function childOverview(me: ParentMe, child: ParentMe["children"][number], needs: NeedItem[]): ParentContent {
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
