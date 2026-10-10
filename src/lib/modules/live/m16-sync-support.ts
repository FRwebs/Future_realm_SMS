import { apiGet } from "@/lib/api/server";
import {
  name as nameCell,
  pill,
  text,
  type PanelFact,
  type PanelTone,
  type TabContent,
} from "@/lib/modules/panels";

/**
 * M16 Sync & Support · Sync, read from `GET /v1/sync/drafts`.
 *
 * SyncDraft is written by the offline-first clients and had no read at all, so
 * this tab described a queue nobody could see. What it reports is not how many
 * drafts exist but how long the oldest has been held: an unsynced register is a
 * day of attendance the school cannot see, and it ages.
 */

type Draft = {
  id: string;
  userId: string;
  userName: string | null;
  userRole: string | null;
  type: string;
  payload: unknown;
  syncedAt: string | null;
  createdAt: string;
  ageHours: number;
};

type SyncFeed = {
  entries: Draft[];
  pending: number;
  synced: number;
  oldestPendingHours: number;
  lastSyncedAt: string | null;
  devices: number;
};

const CHECK_ICON = "M20 6 9 17l-5-5";

function readable(value: string): string {
  const words = value.replace(/_/g, " ").toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function ageTone(hours: number): PanelTone {
  if (hours >= 24) return "negative";
  if (hours >= 6) return "attention";
  return "positive";
}

function ageLabel(hours: number): string {
  if (hours < 1) return "under an hour";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

function stamp(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function describe(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "—";
  const entries = Object.entries(payload as Record<string, unknown>)
    .filter(([, value]) => typeof value !== "object")
    .slice(0, 3)
    .map(([key, value]) => `${readable(key)}: ${String(value)}`);
  return entries.join(" · ") || "—";
}

function syncTab(feed: SyncFeed): TabContent {
  const pending = feed.entries.filter((entry) => !entry.syncedAt);
  const stale = pending.filter((entry) => entry.ageHours >= 24);
  const byType = new Map<string, number>();
  for (const entry of pending) byType.set(readable(entry.type), (byType.get(readable(entry.type)) ?? 0) + 1);

  return {
    title: "Sync",
    desc: "What is still sitting on a device, and how long it has been there.",
    launchers: [{ label: "Attendance register", href: "/attendance/register" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "Offline work waiting to arrive",
            per: 4,
            cards: [
              {
                label: "Pending",
                value: String(feed.pending),
                sub: feed.pending ? Array.from(byType.keys()).join(" · ") : "Nothing held back",
                tone: feed.pending ? "attention" : "positive",
              },
              {
                label: "Oldest held",
                value: feed.pending ? ageLabel(feed.oldestPendingHours) : "—",
                sub: feed.pending ? "On somebody's device" : "Nothing waiting",
                tone: feed.pending ? ageTone(feed.oldestPendingHours) : "positive",
              },
              {
                label: "Synced",
                value: String(feed.synced),
                sub: `Last ${stamp(feed.lastSyncedAt)}`,
              },
              {
                label: "Devices",
                value: String(feed.devices),
                sub: "Holding drafts",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          stale.length
            ? {
                type: "note",
                tone: "negative",
                title: `${stale.length} draft${stale.length === 1 ? " has" : "s have"} been held for more than a day`,
                body: "A register that has not synced is a day of attendance the school cannot see — the figures on Attendance and the Command Center are both computed without it. The device has to come back online for this to clear; nothing on the server can pull it.",
              }
            : feed.pending
              ? {
                  type: "note",
                  tone: "attention",
                  title: `${feed.pending} draft${feed.pending === 1 ? "" : "s"} still waiting`,
                  body: "Recent enough not to be a problem yet. Anything past a day means a device that has not been back on the network.",
                }
              : {
                  type: "note",
                  tone: "positive",
                  icon: CHECK_ICON,
                  title: "Everything has reached the server",
                  body: "No work is being held on a device.",
                },
        ],
      },
      {
        cols: "1fr",
        panels: [
          feed.entries.length
            ? {
                type: "table",
                title: "Drafts",
                sub: "Oldest unsynced first.",
                meta: `${feed.pending} pending · ${feed.synced} synced`,
                head: ["Held by", "Kind", "What", "Age", "State", ""],
                per: 12,
                rows: feed.entries
                  .slice()
                  .sort((a, b) => {
                    if (!a.syncedAt && b.syncedAt) return -1;
                    if (a.syncedAt && !b.syncedAt) return 1;
                    return b.ageHours - a.ageHours;
                  })
                  .map((entry) => ({
                    cells: [
                      nameCell(entry.userName ?? "—", entry.userRole ? readable(entry.userRole) : ""),
                      pill(readable(entry.type), "neutral"),
                      text(describe(entry.payload)),
                      text(ageLabel(entry.ageHours), {
                        tone: entry.syncedAt ? undefined : ageTone(entry.ageHours),
                        strong: !entry.syncedAt && entry.ageHours >= 24,
                      }),
                      pill(entry.syncedAt ? "Synced" : "Pending", entry.syncedAt ? "positive" : "attention"),
                      {
                        kind: "action" as const,
                        label: "View",
                        drawer: {
                          kicker: readable(entry.type),
                          title: entry.userName ?? "Draft",
                          sub: entry.syncedAt ? `Synced ${stamp(entry.syncedAt)}` : `Held ${ageLabel(entry.ageHours)}`,
                          tone: entry.syncedAt ? "positive" : ageTone(entry.ageHours),
                          readOnly: true,
                          readOnlyNote:
                            "A draft clears when the device it is on comes back online. Nothing on the server can pull it in.",
                          facts: [
                            ["Held by", entry.userName ?? "—"],
                            ["Role", entry.userRole ? readable(entry.userRole) : "—"],
                            ["Kind", readable(entry.type)],
                            ["Contents", describe(entry.payload)],
                            ["Captured", stamp(entry.createdAt)],
                            ["Age", ageLabel(entry.ageHours)],
                            ["Synced", entry.syncedAt ? stamp(entry.syncedAt) : "not yet"],
                          ] as PanelFact[],
                        },
                      },
                    ],
                    keywords: `${entry.userName ?? ""} ${entry.type}`,
                  })),
              }
            : {
                type: "note",
                tone: "positive",
                icon: CHECK_ICON,
                title: "No draft has ever been held",
                body: "Nothing has been captured offline on this school.",
              },
        ],
      },
    ],
  };
}


type TicketMessage = {
  id: string;
  body: string;
  author: string;
  authorRole: string | null;
  createdAt: string;
};

type Ticket = {
  id: string;
  ticketNo: string;
  category: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  open: boolean;
  waitingOnSchool: boolean;
  slaDueAt: string | null;
  slaBreached: boolean;
  assignedTo: string | null;
  raisedBy: string | null;
  messageCount: number;
  lastMessageAt: string | null;
  ageDays: number;
  resolvedAt: string | null;
  createdAt: string;
  messages: TicketMessage[];
};

type SupportFeed = {
  tickets: Ticket[];
  open: number;
  waitingOnSchool: number;
  breached: number;
  resolved: number;
};

function priorityTone(priority: string): PanelTone {
  switch (priority.toUpperCase()) {
    case "CRITICAL":
      return "negative";
    case "HIGH":
      return "attention";
    default:
      return "neutral";
  }
}

function ticketTone(ticket: Ticket): PanelTone {
  if (!ticket.open) return "positive";
  if (ticket.slaBreached) return "negative";
  if (ticket.waitingOnSchool) return "attention";
  return "neutral";
}

/**
 * M16 · Help & support, read from `GET /v1/support/tickets`.
 *
 * The figure that matters is not how many tickets are open but which of them
 * are waiting on the school: a ticket in AWAITING_SCHOOL_RESPONSE is not
 * support being slow, it is the school being the blocker, and nobody here
 * would otherwise know.
 */
function helpTab(feed: SupportFeed): TabContent {
  const open = feed.tickets.filter((ticket) => ticket.open);
  const waiting = open.filter((ticket) => ticket.waitingOnSchool);
  const categories = new Map<string, number>();
  for (const ticket of feed.tickets) {
    categories.set(readable(ticket.category), (categories.get(readable(ticket.category)) ?? 0) + 1);
  }

  return {
    title: "Help & support",
    desc: "What this school has raised with support, and what is waiting on whom.",
    launchers: [{ label: "Sync", href: "/sync-support/sync" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "Tickets on this school",
            per: 4,
            cards: [
              {
                label: "Open",
                value: String(feed.open),
                sub: feed.open ? `of ${feed.tickets.length} raised` : "Nothing outstanding",
                tone: feed.open ? "attention" : "positive",
              },
              {
                label: "Waiting on you",
                value: String(feed.waitingOnSchool),
                sub: feed.waitingOnSchool ? "Support cannot proceed" : "Nothing is blocked here",
                tone: feed.waitingOnSchool ? "negative" : "positive",
              },
              {
                label: "Past their answer time",
                value: String(feed.breached),
                sub: feed.breached ? "Support is overdue" : "All within SLA",
                tone: feed.breached ? "negative" : "positive",
              },
              { label: "Resolved", value: String(feed.resolved), sub: "Closed out" },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          waiting.length
            ? {
                type: "note",
                tone: "negative",
                title: `${waiting.length} ticket${waiting.length === 1 ? " is" : "s are"} waiting on an answer from this school`,
                body: "Support has asked a question and stopped. These are not slow replies from them — they are blocked on somebody here, and will sit untouched until a reply goes back.",
              }
            : feed.open
              ? {
                  type: "note",
                  tone: "neutral",
                  title: `${feed.open} ticket${feed.open === 1 ? "" : "s"} open with support`,
                  body: "Nothing is blocked on this school. The replies below are the whole conversation support can see on your side — their internal notes are not shown here, and never were.",
                }
              : {
                  type: "note",
                  tone: "positive",
                  icon: CHECK_ICON,
                  title: "No ticket is open",
                  body: "Nothing has been raised that is still outstanding.",
                },
        ],
      },
      {
        cols: "1fr",
        panels: [
          feed.tickets.length
            ? {
                type: "table",
                title: "Tickets",
                sub: "Most recent first.",
                meta: `${feed.tickets.length} raised · ${feed.open} open`,
                head: ["Ticket", "Category", "Priority", "Status", "Age", "Replies", ""],
                per: 12,
                rows: feed.tickets.map((ticket) => ({
                  cells: [
                    nameCell(ticket.subject, ticket.ticketNo),
                    text(readable(ticket.category)),
                    pill(ticket.priority.toLowerCase(), priorityTone(ticket.priority)),
                    pill(readable(ticket.status), ticketTone(ticket)),
                    text(ageLabel(ticket.ageDays * 24), {
                      tone: ticket.slaBreached ? "negative" : undefined,
                      strong: ticket.slaBreached,
                    }),
                    text(String(ticket.messageCount)),
                    {
                      kind: "action" as const,
                      label: "Open",
                      drawer: {
                        kicker: ticket.ticketNo,
                        title: ticket.subject,
                        sub: `${readable(ticket.status)} · ${ticket.priority.toLowerCase()} priority`,
                        tone: ticketTone(ticket),
                        readOnly: true,
                        readOnlyNote:
                          "Support's internal notes are not part of this thread and are never shown here.",
                        facts: [
                          ["Ticket", ticket.ticketNo],
                          ["Category", readable(ticket.category)],
                          ["Priority", ticket.priority.toLowerCase()],
                          ["Status", readable(ticket.status)],
                          ["Raised by", ticket.raisedBy ?? "—"],
                          ["Raised", stamp(ticket.createdAt)],
                          ["Assigned to", ticket.assignedTo ?? "not yet assigned"],
                          ["Answer due", ticket.slaDueAt ? stamp(ticket.slaDueAt) : "no SLA set"],
                          ["Resolved", ticket.resolvedAt ? stamp(ticket.resolvedAt) : "not yet"],
                          ["What was reported", ticket.description],
                          ...ticket.messages.map(
                            (message) =>
                              [
                                `${message.author} · ${stamp(message.createdAt)}`,
                                message.body,
                              ] as PanelFact,
                          ),
                        ] as PanelFact[],
                      },
                    },
                  ],
                  keywords: `${ticket.subject} ${ticket.ticketNo} ${ticket.category}`,
                })),
              }
            : {
                type: "note",
                tone: "neutral",
                title: "No ticket has been raised",
                body: "Nothing has been reported to support from this school.",
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "form",
            title: "Raise a ticket",
            sub: "Goes to platform support with this school attached.",
            fields: [
              {
                label: "Subject",
                kind: "text",
                required: true,
                span: 2,
                hint: "At least five characters — it is what support scans first.",
              },
              {
                label: "Category",
                kind: "select",
                required: true,
                value: "TECHNICAL_BUG",
                options: [
                  "TECHNICAL_BUG",
                  "BILLING",
                  "ACCOUNT_ACCESS",
                  "DATA_ISSUE",
                  "RESULT_COMPUTATION",
                  "NOTIFICATION_DELIVERY",
                  "SYNC_OFFLINE_ISSUE",
                  "DATA_CORRECTION_REQUEST",
                  "FEATURE_REQUEST",
                  "OTHER",
                ],
              },
              {
                label: "Priority",
                kind: "select",
                required: true,
                value: "MEDIUM",
                options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
              },
              {
                label: "What happened",
                kind: "area",
                required: true,
                span: 2,
                hint: "At least twenty characters. What you did, what you expected, what happened instead.",
              },
            ],
            submit: {
              endpoint: "/api/v1/support/tickets",
              method: "POST",
              map: {
                Subject: "subject",
                Category: "category",
                Priority: "priority",
                "What happened": "description",
              },
              done: "Ticket raised.",
              clearOnSuccess: ["Subject", "What happened"],
            },
          },
        ],
      },
    ],
  };
}

export async function syncSupportLiveTab(
  tabSlug: string,
): Promise<TabContent | null | undefined> {
  if (tabSlug === "sync") {
    const feed = await apiGet<SyncFeed>("/api/v1/sync/drafts");
    if (!feed) return undefined;
    return syncTab(feed);
  }

  if (tabSlug === "help-support") {
    const feed = await apiGet<SupportFeed>("/api/v1/support/tickets");
    if (!feed) return undefined;
    return helpTab(feed);
  }

  return undefined;
}
