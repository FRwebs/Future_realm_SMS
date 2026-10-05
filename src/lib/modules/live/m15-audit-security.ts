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


type LoginAttempt = {
  id: string;
  userId: string | null;
  email: string | null;
  success: boolean;
  reason: string | null;
  ipAddress: string | null;
  device: string | null;
  createdAt: string;
};

/**
 * M15 · Monitoring, read from `GET /v1/configuration/login-history`.
 *
 * This tab exists to answer one question — would this school notice someone
 * trying to get in — and on the evidence it would not. The attempts are
 * recorded, but without an origin or a device there is nothing to tell a
 * legitimate login from a credential-stuffing run against the same account.
 * The page says that rather than printing a reassuring row of zeroes.
 */
function monitoringTab(attempts: LoginAttempt[]): TabContent {
  const failed = attempts.filter((row) => !row.success);
  const succeeded = attempts.filter((row) => row.success);
  const accounts = new Set(attempts.map((row) => row.email).filter(Boolean));
  const origins = new Set(attempts.map((row) => row.ipAddress).filter(Boolean));
  const noOrigin = attempts.filter((row) => !row.ipAddress).length;
  const noDevice = attempts.filter((row) => !row.device).length;

  const byAccount = new Map<string, { ok: number; bad: number }>();
  for (const row of attempts) {
    const key = row.email ?? "unknown";
    const entry = byAccount.get(key) ?? { ok: 0, bad: 0 };
    if (row.success) entry.ok += 1;
    else entry.bad += 1;
    byAccount.set(key, entry);
  }

  const blind = noOrigin === attempts.length && attempts.length > 0;

  return {
    title: "Monitoring",
    desc: "Who has been signing in, and whether the school could tell if somebody should not have been.",
    launchers: [{ label: "Audit log", href: "/audit-security/audit-log" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "Sign-in attempts on record",
            per: 4,
            cards: [
              { label: "Attempts", value: String(attempts.length), sub: `${accounts.size} account${accounts.size === 1 ? "" : "s"}` },
              {
                label: "Failed",
                value: String(failed.length),
                sub: failed.length ? "Wrong password or locked out" : "Nothing has been refused",
                tone: failed.length ? "attention" : "positive",
              },
              {
                label: "Distinct origins",
                value: String(origins.size),
                sub: origins.size ? "Addresses seen" : "No address recorded at all",
                tone: origins.size ? undefined : "negative",
              },
              {
                label: "Succeeded",
                value: String(succeeded.length),
                sub: attempts.length
                  ? `${Math.round((succeeded.length / attempts.length) * 100)}% of attempts`
                  : "—",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          blind
            ? {
                type: "note",
                tone: "negative",
                title: "Sign-ins are recorded without an origin, so an attack would look like normal use",
                body: `All ${attempts.length} attempts on file carry no IP address${noDevice === attempts.length ? " and no device" : ""}. The school can see that somebody signed in and when, but not from where — which means a credential-stuffing run against one account is indistinguishable from that person working late. Capturing the address at the point of the attempt is what would make this tab able to answer the question it is named after.`,
              }
            : noOrigin
              ? {
                  type: "note",
                  tone: "attention",
                  title: `${noOrigin} of ${attempts.length} attempts carry no origin`,
                  body: "Those ones can say who and when, but not from where.",
                }
              : {
                  type: "note",
                  tone: "positive",
                  icon: "M20 6 9 17l-5-5",
                  title: "Every attempt carries an origin",
                  body: "A sign-in from an unexpected address would stand out.",
                },
        ],
      },
      {
        cols: "1.1fr 1fr",
        panels: [
          {
            type: "table",
            title: "By account",
            sub: "Repeated failures against one account are the shape worth noticing.",
            head: ["Account", "Succeeded", "Failed"],
            per: 10,
            rows: Array.from(byAccount.entries())
              .sort((a, b) => b[1].bad - a[1].bad || b[1].ok - a[1].ok)
              .map(([email, counts]) => ({
                cells: [
                  text(email, { strong: true }),
                  text(String(counts.ok), { tone: "positive" }),
                  text(String(counts.bad), {
                    tone: counts.bad ? "negative" : undefined,
                    strong: counts.bad > 0,
                  }),
                ],
                keywords: email,
              })),
          },
          {
            type: "note",
            tone: "neutral",
            title: "What this page cannot tell you",
            body: "Uptime, request failures and rate-limit hits are not collected anywhere on this stack, so nothing on this tab speaks to availability. It covers sign-ins only, which is the one signal that is actually recorded.",
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          attempts.length
            ? {
                type: "table",
                title: "Attempts",
                sub: "Most recent first.",
                meta: `${attempts.length} attempts · ${failed.length} refused`,
                head: ["Account", "Result", "Reason", "From", "Device", "When"],
                per: 15,
                rows: attempts.map((row) => ({
                  cells: [
                    text(row.email ?? "—", { strong: true }),
                    pill(row.success ? "Signed in" : "Refused", row.success ? "positive" : "negative"),
                    text(row.reason ?? "—"),
                    text(row.ipAddress ?? "not recorded", {
                      mono: Boolean(row.ipAddress),
                      tone: row.ipAddress ? undefined : "attention",
                    }),
                    text(row.device ?? "not recorded", {
                      tone: row.device ? undefined : "attention",
                    }),
                    text(whenLabel(row.createdAt)),
                  ],
                  keywords: `${row.email ?? ""} ${row.success ? "success" : "failed"}`,
                })),
              }
            : {
                type: "note",
                tone: "attention",
                title: "No sign-in has been recorded",
                body: "Either nobody has signed in, or attempts are not being written. On a school in use it is the second.",
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

  if (tabSlug === "monitoring") {
    const payload = await apiGet<{ records: LoginAttempt[] }>(
      "/api/v1/configuration/login-history",
    );
    return monitoringTab(payload?.records ?? []);
  }

  // Data protection stays authored: it describes retention policy, which is
  // written down rather than derived from a table.
  return undefined;
}
