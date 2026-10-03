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
 * M15 Audit & Security · Audit log, read from `GET /v1/audit/recent`.
 *
 * The log has always been written; what was missing was a school-facing way to
 * read it. Everything under super-admin is platform-wide, and a principal has
 * to be able to read their own school's trail without platform access.
 */

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: string | null;
  actorRole: string | null;
  actorEmail: string | null;
  ipAddress: string | null;
  metadata: unknown;
  createdAt: string;
};

type AuditFeed = {
  entries: AuditEntry[];
  total: number;
  byAction: Array<{ action: string; count: number }>;
  byActor: Array<{ actor: string; count: number }>;
  firstAt: string | null;
  lastAt: string | null;
};

/** Actions that change who can do what, or that touch money. */
const SENSITIVE = new Set([
  "RESET_PASSWORD",
  "SETTINGS_UPDATE",
  "PERMISSION_CHANGE",
  "ROLE_CHANGE",
  "DELETE",
  "IMPERSONATE",
]);

function readable(value: string): string {
  const words = value.replace(/_/g, " ").toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function actionTone(action: string): PanelTone {
  if (SENSITIVE.has(action.toUpperCase())) return "attention";
  if (action.toUpperCase() === "DELETE") return "negative";
  if (action.toUpperCase() === "APPROVE") return "positive";
  return "neutral";
}

function whenLabel(iso: string | null): string {
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

function dayCount(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
  return Math.max(days, 1);
}

function entryFacts(entry: AuditEntry): PanelFact[] {
  const meta =
    entry.metadata && typeof entry.metadata === "object"
      ? Object.entries(entry.metadata as Record<string, unknown>)
          .slice(0, 6)
          .map(([key, value]) => [readable(key), String(value)] as [string, string])
      : [];

  return [
    ["Action", readable(entry.action)],
    ["Record type", entry.entityType],
    ["Record", entry.entityId ?? "—"],
    ["Who", entry.actor ?? "system"],
    ["Role", entry.actorRole ? readable(entry.actorRole) : "—"],
    ["Email", entry.actorEmail ?? "—"],
    ["From", entry.ipAddress ?? "not recorded"],
    ["When", whenLabel(entry.createdAt)],
    ...meta,
  ];
}

function auditTab(feed: AuditFeed): TabContent {
  const span = dayCount(feed.firstAt, feed.lastAt);
  const sensitive = feed.byAction.filter((row) => SENSITIVE.has(row.action.toUpperCase()));
  const sensitiveCount = sensitive.reduce((sum, row) => sum + row.count, 0);
  const noIp = feed.entries.filter((entry) => !entry.ipAddress).length;
  const systemRows = feed.entries.filter((entry) => !entry.actor).length;

  return {
    title: "Audit log",
    desc: "Everything that has happened to this school's records, and who did it.",
    launchers: [{ label: "Command Center", href: "/command-center/today" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "What the trail covers",
            per: 4,
            cards: [
              {
                label: "Entries",
                value: feed.total.toLocaleString(),
                sub: span ? `Across ${span} day${span === 1 ? "" : "s"}` : "No entries yet",
              },
              {
                label: "Sensitive actions",
                value: String(sensitiveCount),
                sub: sensitiveCount
                  ? sensitive.map((row) => readable(row.action)).join(" · ")
                  : "No password or settings changes",
                tone: sensitiveCount ? "attention" : "positive",
              },
              {
                label: "Acting people",
                value: String(feed.byActor.length),
                sub: feed.byActor.length ? `Busiest: ${feed.byActor[0]?.actor}` : "Nobody named",
              },
              {
                label: "Oldest entry",
                value: feed.firstAt
                  ? new Date(feed.firstAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })
                  : "—",
                sub: "Nothing before this can be answered for",
              },
            ],
          },
        ],
      },
      {
        cols: "1.1fr 1fr",
        panels: [
          {
            type: "bars",
            title: "By action",
            sub: "What this school's records are mostly subjected to.",
            rows: feed.byAction.slice(0, 8).map((row) => ({
              label: readable(row.action),
              value: row.count,
              display: String(row.count),
              tone: actionTone(row.action),
            })),
          },
          {
            type: "bars",
            title: "By person",
            sub: "Counted off the entries on this page, not the whole table.",
            rows: feed.byActor.map((row) => ({
              label: row.actor,
              value: row.count,
              display: String(row.count),
            })),
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          noIp
            ? {
                type: "note",
                tone: "attention",
                title: `${noIp} of the ${feed.entries.length} entries shown carry no IP address`,
                body: "An entry with no origin can say what was done and by whom, but not from where. That is the difference between an audit trail and an investigation.",
              }
            : {
                type: "note",
                tone: "positive",
                icon: "M20 6 9 17l-5-5",
                title: "Every entry shown carries an origin",
                body: "Each one can be traced to the address it came from.",
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          feed.entries.length
            ? {
                type: "table",
                title: "The trail",
                sub: "Most recent first. Entries are written once and never edited.",
                meta: `${feed.entries.length} of ${feed.total.toLocaleString()} · ${systemRows} by the system`,
                head: ["Who", "Action", "Record", "From", "When", ""],
                per: 15,
                rows: feed.entries.map((entry) => ({
                  cells: [
                    nameCell(
                      entry.actor ?? "System",
                      entry.actorRole ? readable(entry.actorRole) : "automated",
                    ),
                    pill(readable(entry.action), actionTone(entry.action)),
                    text(entry.entityType),
                    text(entry.ipAddress ?? "—", {
                      mono: Boolean(entry.ipAddress),
                      tone: entry.ipAddress ? undefined : "attention",
                    }),
                    text(whenLabel(entry.createdAt)),
                    {
                      kind: "action" as const,
                      label: "View",
                      drawer: {
                        kicker: readable(entry.action),
                        title: entry.actor ?? "System",
                        sub: `${entry.entityType}${entry.entityId ? ` · ${entry.entityId}` : ""}`,
                        tone: actionTone(entry.action),
                        facts: entryFacts(entry),
                        readOnly: true,
                        readOnlyNote:
                          "An audit entry is a record of what happened. It cannot be edited or deleted, by anyone, including you.",
                      },
                    },
                  ],
                  keywords: `${entry.actor ?? "system"} ${entry.action} ${entry.entityType}`,
                })),
              }
            : {
                type: "note",
                tone: "attention",
                title: "Nothing has been recorded against this school",
                body: "An empty trail means either a school that has done nothing, or auditing that is not writing. On a school with records, it is the second.",
              },
        ],
      },
    ],
  };
}

export async function auditSecurityLiveTab(
  tabSlug: string,
): Promise<TabContent | null | undefined> {
  if (tabSlug === "audit-log") {
    const feed = await apiGet<AuditFeed>("/api/v1/audit/recent?take=120");
    if (!feed) return undefined;
    return auditTab(feed);
  }

  // Monitoring and Data protection stay authored. Monitoring wants uptime and
  // failed-login rates that nothing on this stack collects yet, and Data
  // protection describes retention policy, which is written down rather than
  // derived from a table.
  return undefined;
}
