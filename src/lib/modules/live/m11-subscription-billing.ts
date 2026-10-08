import { apiGet } from "@/lib/api/server";
import { text, type TabContent } from "@/lib/modules/panels";

/**
 * M11 Subscription & Billing · Credits, read from `GET /v1/communications/wallet`.
 *
 * The credit balance on its own is not a number anybody can decide on. What a
 * bursar needs to know is how many school-wide sends it covers, which is the
 * balance divided by the roll — so that is what the tab leads with.
 */

type Wallet = {
  configured: boolean;
  smsBalance: number;
  whatsappBalance: number;
  lowBalanceThreshold: number;
  low: boolean;
  lastToppedUpAt: string | null;
  guardians: number;
  announcements: number;
  sendsCovered: number;
};

const CHECK_ICON = "M20 6 9 17l-5-5";

function whenLabel(iso: string | null): string {
  if (!iso) return "never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function creditsTab(wallet: Wallet): TabContent {
  if (!wallet.configured) {
    return {
      title: "Credits",
      desc: "Messaging credits, and what they buy.",
      rows: [
        {
          cols: "1fr",
          panels: [
            {
              type: "note",
              tone: "attention",
              title: "This school has no messaging wallet",
              body: "No wallet record exists, which is a different thing from a wallet that has run dry. Until one is created, every SMS the product tries to send has nothing to draw on — and nothing on this page can tell you how close to that you are.",
            },
          ],
        },
      ],
    };
  }

  const shortfall = Math.max(0, wallet.lowBalanceThreshold - wallet.smsBalance);

  return {
    title: "Credits",
    desc: "Messaging credits, and how many sends they actually buy.",
    launchers: [{ label: "Communication Center", href: "/communication-center/sent" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "What the wallet holds",
            per: 4,
            cards: [
              {
                label: "SMS credits",
                value: wallet.smsBalance.toLocaleString(),
                sub: wallet.low
                  ? `${shortfall.toLocaleString()} below your ${wallet.lowBalanceThreshold.toLocaleString()} threshold`
                  : `above your ${wallet.lowBalanceThreshold.toLocaleString()} threshold`,
                tone: wallet.low ? "negative" : "positive",
              },
              {
                label: "School-wide sends covered",
                value: String(wallet.sendsCovered),
                sub: `At ${wallet.guardians} guardians a send`,
                tone: wallet.sendsCovered < 5 ? "negative" : wallet.sendsCovered < 20 ? "attention" : "positive",
              },
              {
                label: "WhatsApp credits",
                value: wallet.whatsappBalance.toLocaleString(),
                sub: wallet.whatsappBalance ? "Separate balance" : "None held",
                tone: wallet.whatsappBalance ? undefined : "attention",
              },
              {
                label: "Last topped up",
                value: whenLabel(wallet.lastToppedUpAt),
                sub: "Credits do not expire",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          wallet.low
            ? {
                type: "note",
                tone: "negative",
                title: `The balance is below the threshold this school set for itself`,
                body: `${wallet.smsBalance.toLocaleString()} credits covers ${wallet.sendsCovered} more messages to the whole roll of ${wallet.guardians} guardians. The threshold exists so somebody is told before a send fails rather than after, and it has been crossed — topping up is the action, and nothing else on this page substitutes for it.`,
              }
            : {
                type: "note",
                tone: "positive",
                icon: CHECK_ICON,
                title: "The balance is above this school's own threshold",
                body: `${wallet.sendsCovered} school-wide sends remain before it is reached.`,
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "What a send costs",
            sub: "One credit per guardian per message, on the roll as it stands today.",
            head: ["Audience", "Guardians", "Credits a send", "Sends covered"],
            per: 10,
            rows: [
              {
                cells: [
                  text("Whole school", { strong: true }),
                  text(String(wallet.guardians)),
                  text(String(wallet.guardians)),
                  text(String(wallet.sendsCovered), {
                    tone: wallet.sendsCovered < 5 ? "negative" : undefined,
                    strong: true,
                  }),
                ],
                keywords: "whole school",
              },
              {
                cells: [
                  text("Half the roll"),
                  text(String(Math.ceil(wallet.guardians / 2))),
                  text(String(Math.ceil(wallet.guardians / 2))),
                  text(
                    String(
                      Math.ceil(wallet.guardians / 2)
                        ? Math.floor(wallet.smsBalance / Math.ceil(wallet.guardians / 2))
                        : 0,
                    ),
                  ),
                ],
                keywords: "half",
              },
            ],
          },
        ],
      },
    ],
  };
}

export async function subscriptionBillingLiveTab(
  tabSlug: string,
): Promise<TabContent | null | undefined> {
  if (tabSlug === "credits") {
    const wallet = await apiGet<Wallet>("/api/v1/communications/wallet");
    if (!wallet) return undefined;
    return creditsTab(wallet);
  }

  // Plan and Account stay authored: this school has no platform subscription
  // record, so there is no plan, price or renewal date to read.
  return undefined;
}
