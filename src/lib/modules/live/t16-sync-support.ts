import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import type { TeacherWorkspaceView } from "@/lib/api/teacher-workspace";
import { articleDrawer, raiseTicketDrawer, ticketDrawer } from "@/lib/modules/live/m16-forms";
import type { SupportOverview, SyncOverview } from "@/lib/modules/live/m16-types";
import type { Panel, PanelRow, TabContent, TableCellKind, TableRow } from "@/lib/modules/panels";
import { pill, row, text } from "@/lib/modules/panels";

/**
 * M16 for a teaching person: "is my work saved" — answered without a connection — and help written for their job. Everything here is
 * about this person's own device and tickets; the school's queue is somebody else's.
 */

const PLUS = "M12 5.5v13M5.5 12h13";
const TYPE: Record<string, [string, string]> = { ATTENDANCE: ["A register", "Attendance · Mark"], SCORE_ENTRY: ["A score sheet", "Scores · Enter"] };

const phoneOnly = (panel: Panel): PanelRow => ({ ...row("1fr", [panel]), show: "phone" as const });
const desktopOnly = (rows: Array<PanelRow | null>): PanelRow[] => rows.filter((entry): entry is PanelRow => Boolean(entry)).map((entry) => ({ ...entry, show: "desktop" as const }));
const CLOCK = "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z";
const INFO = "M12 11v5M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z";
const HELP = "M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4M12 16.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z";
const CHAT = "M4 5.5h16v10.5H9l-5 4zM8 9.5h8M8 12.8h5";
const DOC = "M6.5 3.5h8L18.5 8v12.5h-12zM14.5 3.5V8h4M9 12.5h6M9 16h4";

const ago = (minutes: number | null) => (minutes === null ? "—" : minutes < 1 ? "Just now" : minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.round(minutes / 60)} h ago` : `${Math.round(minutes / 1440)} d ago`);
const since = (iso: string | null) => (iso ? ago(Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))) : "Never");

export async function teacherSyncSupportTab(tabSlug: string, me: TeacherWorkspaceView): Promise<TabContent | null | undefined> {
  if (tabSlug === "sync") return syncTab(await apiGet("/api/v1/sync/overview", observe<SyncOverview>(localContracts["src/lib/modules/live/t16-sync-support.ts#9dc3cf0a"])), me);
  if (tabSlug === "help-support") return helpTab(await apiGet("/api/v1/support/overview", observe<SupportOverview>(localContracts["src/lib/modules/live/t16-sync-support.ts#d9b1260f"])), me);
  return undefined;
}

function syncTab(o: SyncOverview, me: TeacherWorkspaceView): TabContent {
  const early = me.persona === "early-years";
  const rows: TableRow[] = o.queue.map((entry) => ({
    cells: [text(`${(TYPE[entry.type] ?? [entry.type])[0]}${entry.count > 1 ? ` · ${entry.count}` : ""}`, { strong: true }), text((TYPE[entry.type] ?? ["", "—"])[1]), text(ago(entry.oldestMinutes), { mono: true }), pill(entry.refused ? "Refused" : "Queued", entry.refused ? "negative" : "offline")] as TableCellKind[],
  }));
  const conflicts = o.conflicts.length;
  const panels: Array<PanelRow | null> = [
    row("1fr", [{
      type: "kpi", sub: "Your work, on this device and on the school’s record.", per: 4,
      cards: [
        { label: "Waiting to send", value: String(o.pending), unit: o.pending === 1 ? "item" : "items", sub: o.pending ? `Saved here ${ago(o.oldestMinutes)} · oldest` : "Nothing queued", tone: o.pending ? "offline" : "positive" },
        { label: "Last successful sync", value: since(o.lastSyncedAt), sub: o.lastSyncedAt ? "Your last item to reach the school’s record" : "Nothing of yours has synced yet", tone: o.lastSyncedAt ? "positive" : "neutral" },
        { label: "Your last change on record", value: since(o.lastWriteMineAt), sub: "Anything you save, anywhere in the product", tone: "neutral" },
        { label: "Needs your attention", value: String(conflicts), sub: conflicts ? "Both versions are kept — a leader will choose" : "Nothing has been lost", tone: conflicts ? "attention" : "positive" },
      ],
    }]),
    row("1fr", [{ type: "device", title: "This device", sub: "What this phone or laptop knows that the server cannot." }]),
    row("1.1fr 1fr", [
      { type: "table", title: "What is queued", sub: "Every item, with when you actually did it.", meta: "Client event time, not server receipt", noun: "item", nounPlural: "items", head: ["Item", "Where", "Done", "State"], rows, noRowOpen: true, empty: "Nothing is waiting.", foot: o.pending ? "A queued item survives a closed tab, a closed browser and a dead battery." : "Nothing is waiting — your work is on the school’s record." },
      {
        type: "facts", title: "What works without a connection", per: 1, sub: "Declared, not discovered.",
        facts: [
          ["Marking a register", "Full write", "The class list is cached when the arm is assigned to you"],
          early ? ["Observations", "Entered in Scores", "Saved when you are next online"] : ["Entering marks", "Full write", "Totals are provisional until the server confirms them"],
          ["Submitting or approving", "Online only", "A state change must not fork across two devices"],
          ["A conflict", "Surfaced, never resolved for you", "Both versions kept, compared on when you did it"],
        ],
      },
    ]),
  ];
  // The phone: what is waiting and when it last got through, the queue itself, this phone's own figures folded shut, and the promise about conflicts.
  const phone: PanelRow[] = [
    phoneOnly({ type: "kpi", bare: true, cards: [
      { label: "Waiting to send", value: String(o.pending), unit: o.pending === 1 ? "item" : "items", sub: o.pending ? `Oldest saved ${ago(o.oldestMinutes)}` : "Nothing queued", tone: o.pending ? "offline" : "positive" },
      { label: "Last successful sync", value: since(o.lastSyncedAt), sub: o.lastSyncedAt ? "Your last item to reach the school" : "Nothing of yours has synced yet", tone: o.lastSyncedAt ? "positive" : "neutral" },
    ] }),
    phoneOnly({
      type: "list", title: "Waiting to send", sub: "In the order they will send. Each is written to this phone first.", empty: "Nothing is waiting. What you save goes straight to the school.",
      items: o.queue.map((entry) => ({
        icon: CLOCK, label: `${(TYPE[entry.type] ?? [entry.type])[0]}${entry.count > 1 ? ` · ${entry.count}` : ""}`, sub: `${(TYPE[entry.type] ?? ["", "—"])[1]} · saved ${ago(entry.oldestMinutes)}`,
        pill: entry.refused ? "Refused" : "Queued", tone: entry.refused ? ("negative" as const) : ("offline" as const),
      })),
    }),
    phoneOnly({ type: "embed", component: "phone-device", props: {} }),
    phoneOnly({ type: "note", tone: conflicts ? "attention" : "neutral", icon: INFO, title: "Conflicts are never resolved silently", body: conflicts ? `${conflicts} ${conflicts === 1 ? "change was" : "changes were"} made on two devices. Both versions are kept, and a leader will choose.` : "If two devices change the same mark, you see both and choose. Nothing is overwritten silently." }),
  ];
  return {
    title: "Sync", desc: "Is my work saved — answered without a connection.",
    phoneEyebrow: "Sync & Support · This phone", phoneTitle: o.pending ? `${o.pending} waiting to send` : "Everything is synced",
    phoneDesc: "What is on this phone, what has reached the school, and what is still waiting.",
    rows: [...phone, ...desktopOnly(panels)] };
}

function guides(me: TeacherWorkspaceView): Array<[string, string]> {
  const base: Array<[string, string]> = [["Mark a register", "One thumb, 60 seconds, online or not"], ["Enter and submit scores", "Keyboard only · what the three states mean"]];
  if (me.persona === "early-years") return [["Mark the register", "The class list and who may collect"], ["Record an observation", "Descriptive, never a score"], ["Write remarks for young children", "Warm, specific, and about the next step"]];
  if (me.persona === "teaching-assistant") return [["Mark the register", "The same register the class teacher would mark"], ["What you can and cannot see", "The class list, yes · scores and families, no"], ["Who to ask", "The class teacher first, then the office"]];
  if (me.persona === "cover") return [["Your first day on cover", "What you can reach, and what you cannot"], ["Enter scores for someone else’s class", "Attributed to you, with the owner named alongside"], ["When your access ends", "Nothing to hand back — it simply stops"]];
  return [...base, me.formArms.length ? ["Write remarks that publish cleanly", "What the school’s guidance actually asks for"] : ["Ask for an assignment to change", "How to reach the office from Timetable → Teaching"]];
}

function helpTab(o: SupportOverview, me: TeacherWorkspaceView): TabContent {
  const mine = o.articles.filter((article) => article.forMe);
  const shown = (mine.length ? mine : o.articles).slice(0, 8);
  const tickets = o.tickets;
  const ticketRows: TableRow[] = tickets.tickets.slice(0, 8).map((ticket) => ({
    cells: [{ kind: "name", name: ticket.subject, sub: ticket.ticketNo }, text(ticket.status.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())), text(ticket.ageDays ? `${ticket.ageDays} day${ticket.ageDays === 1 ? "" : "s"}` : "Today"), { kind: "action", label: "Open", drawer: ticketDrawer(ticket) }] as TableCellKind[],
  }));
  const panels: Array<PanelRow | null> = [
    row("1fr", [{ type: "tiles", title: "Your quick-start guides", sub: "Three pages, not a manual.", per: 3, tiles: guides(me).map(([label, sub]) => ({ label, sub })) }]),
    row("1.1fr 1fr", [
      {
        type: "list", title: "Articles for your role", sub: mine.length ? "Written for your job." : "From the school’s help library.", meta: `${shown.length} article${shown.length === 1 ? "" : "s"}`,
        items: shown.length ? shown.map((article) => ({ label: article.title, pill: article.video ? "Video" : article.category, viewLabel: "Read", sub: article.summary, drawer: articleDrawer(article) })) : [{ label: "No article has been written yet", sub: "Raise a ticket and ask — what people ask becomes the next article.", pill: "None" }],
      },
      {
        type: "facts", title: "Your tickets", per: 1,
        facts: [["Open", String(tickets.open), tickets.waitingOnSchool ? `${tickets.waitingOnSchool} waiting on you` : ""], ["Resolved", String(tickets.resolved), ""], ["Typical reply", `Within ${o.responseTarget}`, "School hours, Monday to Friday"], ["Offline", "A ticket queues and sends on reconnection", "You do not lose what you typed"]],
      },
    ]),
    ticketRows.length ? row("1fr", [{ type: "table", title: "What you have raised", head: ["Ticket", "State", "Age", ""], rows: ticketRows, noRowOpen: true, noun: "ticket", nounPlural: "tickets" }]) : null,
  ];
  // The phone reads help as one list after another: the guides for the job, the articles, a way to talk to a person, and what has been raised.
  const phone: PanelRow[] = [
    phoneOnly({ type: "list", title: "Guides for your role", sub: "Short, and they work without a connection.", items: guides(me).map(([label, sub]) => ({ icon: DOC, label, sub })) }),
    phoneOnly({
      type: "list", title: "Common questions", sub: mine.length ? "Written for your job." : "From the school’s help library.",
      items: shown.length ? shown.map((article) => ({ icon: HELP, label: article.title, sub: article.summary, pill: article.video ? "Video" : undefined, drawer: articleDrawer(article) })) : [{ icon: HELP, label: "No article has been written yet", sub: "Raise a ticket and ask — what people ask becomes the next article." }],
    }),
    phoneOnly({
      type: "list", title: "Talk to a person",
      items: [{ icon: CHAT, label: "Raise a ticket", sub: `Answered in-app · usually within ${o.responseTarget}`, drawer: raiseTicketDrawer() }],
    }),
    ...(tickets.tickets.length
      ? [phoneOnly({
          type: "list", title: "Your tickets", tag: `${tickets.open} open`, tagTone: tickets.open ? "attention" : "neutral",
          items: tickets.tickets.slice(0, 8).map((ticket) => ({ icon: CHAT, label: ticket.subject, sub: `${ticket.ticketNo} · ${ticket.ageDays ? `${ticket.ageDays} day${ticket.ageDays === 1 ? "" : "s"}` : "Today"}`, pill: ticket.status.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()), drawer: ticketDrawer(ticket) })),
        })]
      : []),
  ];
  return {
    title: "Help & Support", desc: "Written for your job, not for the whole platform.",
    phoneTitle: "How can we help?", phoneDesc: "Guides work offline. A ticket reaches the school’s administrator first.",
    primary: { label: "Raise a ticket", icon: PLUS, drawer: raiseTicketDrawer() },
    rows: [...phone, ...desktopOnly(panels)],
  };
}
