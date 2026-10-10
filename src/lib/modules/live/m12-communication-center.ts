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

type WalletSnapshot = {
  configured: boolean;
  smsBalance: number;
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


/**
 * M12 · Compose, posting to `POST /v1/communications/announcements`.
 *
 * This is the one send this stack actually performs. SMS and email have no
 * dispatch endpoint, so the form offers the channels the API accepts and says
 * which of them leaves the building — a Compose box whose button cannot send is
 * worse than no Compose box.
 */
function composeTab(wallet: WalletSnapshot, guardians: GuardianRow[]): TabContent {
  const reachable = guardians.filter((row) => row.canReceiveSms && row.phone?.trim()).length;

  return {
    title: "Compose",
    desc: "Write something and publish it to the people it concerns.",
    launchers: [{ label: "What has been sent", href: "/communication-center/sent" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "note",
            tone: "attention",
            title: "Only in-app announcements are actually delivered from here",
            body: `An announcement published on this form is written to the school's record and appears to everyone in the product. SMS and email have no dispatch endpoint on this stack — choosing them records the intent and the channel, and nothing leaves the building. ${
              wallet.configured
                ? `The wallet holds ${wallet.smsBalance.toLocaleString()} SMS credits against ${reachable} reachable guardians, so the credits are not the blocker; the sender is.`
                : "There is no messaging wallet on this school either."
            }`,
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "form",
            title: "New announcement",
            sub: "Published immediately, and kept on the record of what families were told.",
            fields: [
              {
                label: "Title",
                kind: "text",
                required: true,
                span: 2,
                hint: "At least 5 characters — it is what people see first.",
              },
              {
                label: "Audience",
                kind: "select",
                required: true,
                value: "School-wide",
                options: [
                  "School-wide",
                  "All parents",
                  "All staff",
                  "All students",
                  "Senior school",
                  "Junior school",
                ],
              },
              {
                label: "Channel",
                kind: "select",
                required: true,
                value: "IN_APP",
                options: ["IN_APP", "EMAIL", "SMS", "PUSH"],
                hint: "Only IN_APP is delivered.",
              },
              {
                label: "Message",
                kind: "area",
                required: true,
                span: 2,
                hint: "At least 10 characters.",
              },
            ],
            submit: {
              endpoint: "/api/v1/communications/announcements",
              method: "POST",
              map: {
                Title: "title",
                Audience: "audience",
                Channel: "channel",
                Message: "body",
              },
              done: "Published.",
              clearOnSuccess: ["Title", "Message"],
            },
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

  if (tabSlug === "compose") {
    const [wallet, guardians] = await Promise.all([
      apiGet<WalletSnapshot>("/api/v1/communications/wallet").catch(() => ({
        configured: false,
        smsBalance: 0,
      })),
      apiGet<GuardianRow[]>("/api/v1/parents").catch(() => [] as GuardianRow[]),
    ]);
    return composeTab(wallet, guardians ?? []);
  }

  // Automation stays authored: it describes scheduled rules, and nothing
  // persists one.
  return undefined;
}
