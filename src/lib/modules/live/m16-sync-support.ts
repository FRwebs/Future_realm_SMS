import { apiGet } from "@/lib/api/server";
import { articleDrawer, categoryName, priorityName, raiseTicketDrawer, readable, resolveDrawer, ticketDrawer } from "@/lib/modules/live/m16-forms";
import type { SupportOverview, SyncOverview, Ticket } from "@/lib/modules/live/m16-types";
import { dayLabel, plural } from "@/lib/modules/live/m7-format";
import { name as nameCell, pill, text, type PanelRow, type PanelTone, type TabContent, type TableCellKind } from "@/lib/modules/panels";

/**
 * M16 Sync & Support.
 *
 * Sync says whether everything is saved, what is waiting, and what this device holds: the device itself reports its
 * connection and storage, the server reports what is waiting to reach the school's record. Help & Support says whether
 * the system is answering, and what the school has asked of support.
 */

const SYNC = "/api/v1/sync/overview";
const SUPPORT_OVERVIEW = "/api/v1/support/overview";
const REFRESH = "M20 11.5a8 8 0 0 0-13.7-5L4 8.8M4 12.5a8 8 0 0 0 13.7 5l2.3-2.3M4 4.5v4.3h4.3";
const PLUS = "M12 5.5v13M5.5 12h13";
const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
const CHECK = "M5 12.5l4.5 4.5 9-10";

const minutesText = (minutes: number | null) => (minutes === null ? "—" : minutes < 1 ? "Under a minute" : minutes < 60 ? `${minutes} min` : minutes < 1440 ? `${Math.round(minutes / 60)} h` : `${Math.round(minutes / 1440)} d`);
const sinceText = (iso: string | null) => {
  if (!iso) return "Never";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return minutes < 1 ? "Just now" : minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.round(minutes / 60)} h ago` : `${Math.round(minutes / 1440)} d ago`;
};
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const mark = (ok: boolean): TableCellKind => ({ kind: "mark", ok });

/** What the product is built to do with no connection, and what always needs one. */
const OFFLINE: Array<[string, string]> = [
  ["Mark attendance", "Publish report cards"],
  ["Enter and edit scores", "Send any message"],
  ["Write remark drafts", "Approve anything"],
  ["Record a payment · provisional receipt", "Generate report cards"],
  ["Read any student record", "Migration and bulk import"],
  ["Read any guardian record", "Full-school export"],
  ["View computed results · marked provisional", "Add or invite a staff member"],
  ["Read cached help articles", "Change permissions"],
  ["View your timetable and class lists", "Publish a timetable or fee structure"],
  ["Draft a support ticket", "Resolve a sync conflict"],
  ["See sync state and pending queue", "Platform status check"],
];

export function syncTab(o: SyncOverview): TabContent {
  const rows: PanelRow[] = [];
  rows.push({ cols: "1fr", panels: [{ type: "device", title: "This device", sub: "Read from the device you are using, not from the server." }] });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "kpi", title: "At the school", sub: "What the school's record holds, wherever the device is.", per: 4,
      cards: [
        { label: "Pending records", value: String(o.pending), sub: o.pending ? `Oldest is ${minutesText(o.oldestMinutes)} old · held on ${plural(o.devices, "device")}` : "Nothing is waiting to reach the record", tone: o.pending ? "attention" : "positive" },
        { label: "Last write to the record", value: sinceText(o.lastWriteAt), sub: when(o.lastWriteAt), tone: "neutral" },
        { label: "Your last save", value: sinceText(o.lastWriteMineAt), sub: o.lastWriteMineAt ? when(o.lastWriteMineAt) : "You have not saved anything yet", tone: "neutral" },
        { label: "Unresolved conflicts", value: String(o.conflicts.length), sub: o.conflicts.length ? "Two versions of one record, waiting for a choice" : "Nothing to resolve", tone: o.conflicts.length ? "negative" : "positive" },
      ],
    }],
  });
  rows.push(
    o.queue.length
      ? {
          cols: "1fr",
          panels: [{
            type: "table", title: "Pending queue", sub: "By type, with the oldest record and its age. A refused item keeps the record\u2019s reason.", meta: `${plural(o.pending, "record")} · nothing has been lost`,
            head: ["Type", "Count", "Oldest", "Who", "State"], noun: "type", nounPlural: "types", noRowOpen: true,
            rows: o.queue.map((entry) => ({ cells: [text(entry.refused && entry.message ? `${readable(entry.type)} · ${entry.message}` : readable(entry.type), { strong: true }), text(String(entry.count), { mono: true }), text(minutesText(entry.oldestMinutes)), nameCell(entry.who, entry.role ? readable(entry.role) : ""), entry.refused ? pill("Refused", "negative") : pill("Queued", entry.oldestMinutes > 1440 ? "negative" : entry.oldestMinutes > 360 ? "attention" : "neutral")] })),
          }],
        }
      : { cols: "1fr", panels: [{ type: "note", tone: "positive", icon: CHECK, title: "Nothing is waiting to reach the school's record", body: "No device is holding a draft that has not been saved. If a teacher marks a register or enters scores with no connection, what they set aside appears here, with its age and whose device holds it." }] },
  );
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: "Conflicts", sub: "Both versions side by side, with author, device and the time each was made on the device.",
      tag: o.conflicts.length ? `${o.conflicts.length} unresolved` : "None waiting", tagTone: o.conflicts.length ? "negative" : "positive",
      head: ["Record", "Version A · on the record", "Version B · from the device", "Authors", "Choose"], noun: "conflict", nounPlural: "conflicts", noRowOpen: true,
      rows: o.conflicts.map((conflict) => ({ cells: [text(conflict.record, { strong: true }), text(conflict.school.summary || "—"), text(conflict.device.summary || "—"), nameCell(`${conflict.school.by} / ${conflict.device.by}`, `${conflict.differing} ${conflict.differing === 1 ? "item differs" : "items differ"}`, { avatar: false }), { kind: "action" as const, label: "Choose", drawer: resolveDrawer(conflict) }] })),
      empty: "No conflict is waiting. When two people change the same record and one of them was offline, both versions are kept here until a school administrator chooses.",
    }],
  });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: "What works offline", tag: "The honest list", tagTone: "neutral", tuck: "What works offline",
      sub: "Eleven things the product is built to do with no connection, and eleven that always need one.",
      head: ["Works offline", "", "Requires a connection", ""], noun: "capability", nounPlural: "capabilities", noRowOpen: true, per: 11,
      rows: OFFLINE.map(([works, needs]) => ({ cells: [text(works), mark(true), text(needs), mark(false)] })),
      foot: "Registers and score sheets are held on the device when there is no connection and sent by themselves when it returns. A page has to be open already: the browser does not yet keep pages for use after a reload with no connection. Other work — payments, messages, edits to a record — needs a connection and says so.",
    }],
  });
  return { title: "Sync", desc: "Is everything saved, what is waiting, and what does this device hold?", primary: { label: "Sync now", icon: REFRESH, href: "/sync-support/sync" }, launchers: [{ label: "Help & support", href: "/sync-support/help-support" }, { label: "Raise a sync ticket", drawer: raiseTicketDrawer({ category: "SYNC_OFFLINE_ISSUE", subject: "My work is not syncing" }) }], rows };
}

const ticketTone = (ticket: Ticket): PanelTone => (ticket.slaBreached ? "negative" : ticket.waitingOnSchool ? "attention" : ticket.open ? "progress" : "positive");

export function supportTab(o: SupportOverview): TabContent {
  const t = o.tickets;
  const rows: PanelRow[] = [];
  const guides = o.articles.filter((article) => article.forMe).slice(0, 6);
  rows.push({
    cols: "1fr",
    panels: [{
      type: "note", tone: o.status.ok ? "positive" : "negative", icon: o.status.ok ? CHECK : WARN,
      title: o.status.ok ? `All systems operational · checked ${sinceText(o.status.checkedAt).toLowerCase()}` : "The school's record is not answering",
      body: o.status.ok ? `The server answered in ${o.status.databaseMs} ms and has been up ${o.status.uptimeMinutes < 120 ? `${o.status.uptimeMinutes} minutes` : `${Math.round(o.status.uptimeMinutes / 60)} hours`}. If something still looks wrong, it is probably your connection — the Sync tab shows what this device holds.` : "This check could not reach the database just now. Raise a ticket and say when it began.",
      acts: [{ label: "Check this device", href: "/sync-support/sync" }, ...(o.status.ok ? [] : [{ label: "Raise a ticket", drawer: raiseTicketDrawer({ category: "TECHNICAL_BUG", subject: "The system is not answering" }) }])],
    }],
  });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "tiles", title: "Quick-start guides", sub: guides.length ? "Written for your role." : "Nothing has been published for your role yet.", per: 3,
      tiles: guides.length ? guides.map((article) => ({ label: article.title, sub: article.summary, drawer: articleDrawer(article), icon: "M6.5 3.5h8L18.5 8v12.5h-12zM14.5 3.5V8h4" })) : [{ label: "Raise a ticket to ask for a guide", sub: "Tell support which job you want a one-page guide for.", drawer: raiseTicketDrawer({ category: "FEATURE_REQUEST", subject: "A quick-start guide for my role" }) }],
    }],
  });
  rows.push({
    cols: "1.1fr 1fr",
    panels: [
      {
        type: "table", title: "Your tickets", meta: `Response target ${o.responseTarget} · ${t.open} open · ${t.resolved} resolved${o.satisfaction.average === null ? "" : ` · rated ${o.satisfaction.average} of 5`}${o.contact && (o.contact.email || o.contact.phone) ? ` · reach ${o.contact.platformName}: ${[o.contact.email, o.contact.phone].filter(Boolean).join(" · ")}` : ""}`,
        search: "Find a ticket",
        acts: [{ label: "Raise a ticket", primary: true, drawer: raiseTicketDrawer() }],
        head: ["Ticket", "Subject", "Priority", "Raised", "State", ""], noun: "ticket", nounPlural: "tickets", per: 6, noRowOpen: true,
        rows: t.tickets.map((ticket) => ({ keywords: `${ticket.ticketNo} ${ticket.subject} ${categoryName(ticket.category)}`, cells: [text(ticket.ticketNo, { strong: true, mono: true }), nameCell(ticket.subject, categoryName(ticket.category), { avatar: false }), pill(priorityName(ticket.priority), ticket.priority === "CRITICAL" || ticket.priority === "HIGH" ? "negative" : ticket.priority === "LOW" ? "neutral" : "progress"), text(ticket.ageDays === 0 ? "Today" : dayLabel(ticket.createdAt)), pill(ticket.waitingOnSchool ? "Waiting on you" : readable(ticket.status), ticketTone(ticket)), { kind: "action" as const, label: "Open", drawer: ticketDrawer(ticket) }] })),
        empty: "This school has not raised a ticket yet.",
        foot: t.waitingOnSchool ? `${plural(t.waitingOnSchool, "ticket")} waiting on an answer from this school — support has stopped until somebody replies.` : undefined,
      },
      {
        type: "list", title: "Articles and walkthroughs", sub: o.articles.length ? "Read by the schools that use the product." : "Nothing has been published yet.",
        items: o.articles.slice(0, 8).map((article) => ({ label: article.title, sub: `${article.category}${article.video ? " · video" : " · article"} · read ${article.views} ${article.views === 1 ? "time" : "times"}`, pill: article.forMe ? "For your role" : "Everyone", tone: article.forMe ? ("positive" as const) : ("neutral" as const), viewLabel: "Read", drawer: articleDrawer(article) })),
        foot: o.articles.length ? undefined : "Raise a ticket if you cannot find how to do something.",
      },
    ],
  });
  return { title: "Help & Support", desc: "Learn the product, or raise a ticket.", primary: { label: "Raise ticket", icon: PLUS, drawer: raiseTicketDrawer() }, launchers: [{ label: "Sync", href: "/sync-support/sync" }], rows };
}

export async function syncSupportLiveTab(tabSlug: string): Promise<TabContent | null | undefined> {
  if (tabSlug === "sync") return syncTab(await apiGet<SyncOverview>(SYNC));
  if (tabSlug === "help-support") return supportTab(await apiGet<SupportOverview>(SUPPORT_OVERVIEW));
  return undefined;
}
