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
 * M12 Communication Center · Sent, read from `GET /v1/communications/announcements`.
 *
 * Announcements are the only sent traffic this stack persists. SMS and email
 * are dispatched without a delivery record, so what this tab can honestly show
 * is what was published, to whom, and down which channel — not whether it
 * arrived. The page says so rather than implying a delivery rate it cannot
 * compute.
 */

type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string | null;
  channel: string | null;
  publishedAt: string | null;
};

type GuardianRow = {
  email: string | null;
  phone: string | null;
  canReceiveSms: boolean;
  canReceiveEmail: boolean;
};

const CHECK_ICON = "M20 6 9 17l-5-5";

function channelTone(channel: string | null): PanelTone {
  switch ((channel ?? "").toUpperCase()) {
    case "SMS":
      return "attention";
    case "EMAIL":
      return "neutral";
    case "IN_APP":
      return "positive";
    default:
      return "neutral";
  }
}

function readable(value: string): string {
  const words = value.replace(/_/g, " ").toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function whenLabel(iso: string | null): string {
  if (!iso) return "not published";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function sentTab(items: Announcement[], guardians: GuardianRow[]): TabContent {
  const channels = new Map<string, number>();
  for (const item of items) channels.set(readable(item.channel ?? "unknown"), (channels.get(readable(item.channel ?? "unknown")) ?? 0) + 1);

  const unpublished = items.filter((item) => !item.publishedAt).length;
  const smsReach = guardians.filter((row) => row.canReceiveSms && row.phone?.trim()).length;
  const emailReach = guardians.filter((row) => row.canReceiveEmail && row.email?.trim()).length;

  return {
    title: "Sent",
    desc: "What has gone out, to whom, and down which channel.",
    launchers: [{ label: "Guardians", href: "/parents-guardians/guardians" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "What has been published",
            per: 4,
            cards: [
              {
                label: "Announcements",
                value: String(items.length),
                sub: unpublished ? `${unpublished} not yet published` : "All published",
                tone: unpublished ? "attention" : undefined,
              },
              {
                label: "Channels used",
                value: String(channels.size),
                sub: Array.from(channels.keys()).join(" · ") || "none",
              },
              {
                label: "Reachable by SMS",
                value: String(smsReach),
                sub: `of ${guardians.length} guardians`,
                tone: smsReach < guardians.length ? "attention" : "positive",
              },
              {
                label: "Reachable by email",
                value: String(emailReach),
                sub: `of ${guardians.length} guardians`,
                tone: emailReach < guardians.length ? "attention" : "positive",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "note",
            tone: "attention",
            title: "Nothing here proves delivery",
            body: `This school has no messaging wallet and no delivery records: SMS and email are dispatched without anything persisting whether they arrived. What the table below can answer is what was published and to whom. Whether ${guardians.length - emailReach} guardians with no email address ever saw it is not something this system currently knows.`,
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          items.length
            ? {
                type: "table",
                title: "Published",
                sub: "Most recent first.",
                meta: `${items.length} announcement${items.length === 1 ? "" : "s"}`,
                head: ["Announcement", "Audience", "Channel", "Published", ""],
                per: 12,
                rows: items
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime(),
                  )
                  .map((item) => ({
                    cells: [
                      nameCell(item.title, item.body.slice(0, 70)),
                      text(item.audience ?? "—"),
                      pill(readable(item.channel ?? "unknown"), channelTone(item.channel)),
                      text(whenLabel(item.publishedAt), {
                        tone: item.publishedAt ? undefined : "attention",
                      }),
                      {
                        kind: "action" as const,
                        label: "Read",
                        drawer: {
                          kicker: readable(item.channel ?? "announcement"),
                          title: item.title,
                          sub: item.audience ?? undefined,
                          readOnly: true,
                          readOnlyNote:
                            "A published announcement is a record of what families were told. Editing it would change the account of what was said.",
                          facts: [
                            ["Audience", item.audience ?? "—"],
                            ["Channel", readable(item.channel ?? "unknown")],
                            ["Published", whenLabel(item.publishedAt)],
                            ["Body", item.body],
                          ] as PanelFact[],
                        },
                      },
                    ],
                    keywords: `${item.title} ${item.audience ?? ""} ${item.channel ?? ""}`,
                  })),
              }
            : {
                type: "note",
                tone: "attention",
                title: "Nothing has been published",
                body: "No announcement has gone out on this school.",
              },
        ],
      },
    ],
  };
}

export async function communicationCenterLiveTab(
  tabSlug: string,
): Promise<TabContent | null | undefined> {
  if (tabSlug === "sent") {
    const [items, guardians] = await Promise.all([
      apiGet<Announcement[]>("/api/v1/communications/announcements"),
      apiGet<GuardianRow[]>("/api/v1/parents").catch(() => [] as GuardianRow[]),
    ]);
    return sentTab(items ?? [], guardians ?? []);
  }

  // Compose stays authored: there is no send endpoint behind it, so a wired
  // Compose would be a form whose button could not do anything — the exact
  // failure the drawer work was done to stop. Automation describes scheduled
  // rules, and nothing persists one.
  return undefined;
}
