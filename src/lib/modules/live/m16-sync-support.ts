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

export async function syncSupportLiveTab(
  tabSlug: string,
): Promise<TabContent | null | undefined> {
  if (tabSlug === "sync") {
    const feed = await apiGet<SyncFeed>("/api/v1/sync/drafts");
    if (!feed) return undefined;
    return syncTab(feed);
  }

  // Help & support stays authored: it is contact routes and documentation
  // links, which are written down rather than read from a table.
  return undefined;
}
