import { apiGet } from "@/lib/api/server";
import { pill, text, type TabContent } from "@/lib/modules/panels";

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


type Subscription = {
  plan: string;
  planName: string;
  billingStatus: string;
  nextBillingAt: string | null;
  currency: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  supportTier: string | null;
  apiAccess: boolean;
  customBranding: boolean;
  students: { used: number; limit: number | null; percent: number | null; over: boolean };
  staff: { used: number; limit: number | null; percent: number | null; over: boolean };
  smsIncluded: number;
  smsBalance: number;
  since: string;
  transactions: Array<{
    id: string;
    amount: number;
    currency: string;
    method: string;
    status: string;
    reference: string;
    processedAt: string;
  }>;
  plans: Array<{
    name: string;
    plan: string;
    monthlyPrice: number;
    annualPrice: number;
    studentLimit: number | null;
    smsUnitsPerMonth: number;
    current: boolean;
  }>;
};

function money(value: number, currency = "NGN"): string {
  const symbol = currency === "NGN" ? "₦" : `${currency} `;
  return `${symbol}${Math.round(value).toLocaleString("en-NG")}`;
}

function dayLabel(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function readable(value: string): string {
  const words = value.replace(/_/g, " ").toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * M11 · Plan — what the school pays for, against what it is using.
 *
 * A plan page that prints a price answers nothing. The question a proprietor
 * has is whether the school is about to outgrow what it pays for, so every
 * limit is shown against actual usage and an uncapped limit says so rather
 * than showing a reassuring blank.
 */
function planTab(data: Subscription): TabContent {
  const usageCard = (label: string, usage: Subscription["students"]) => ({
    label,
    value: usage.limit === null ? String(usage.used) : `${usage.used} of ${usage.limit}`,
    sub: usage.limit === null ? "No cap on this plan" : `${usage.percent}% of the allowance`,
    tone: usage.over ? ("negative" as const) : (usage.percent ?? 0) >= 85 ? ("attention" as const) : undefined,
  });

  const overages = [
    data.students.over && "students",
    data.staff.over && "staff",
  ].filter(Boolean) as string[];

  return {
    title: "Plan",
    desc: "What this school pays for, and how much of it is being used.",
    launchers: [{ label: "Credits", href: "/subscription-billing/credits" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "The current plan",
            per: 4,
            cards: [
              {
                label: "Plan",
                value: data.planName,
                sub: `${readable(data.billingStatus)} · since ${dayLabel(data.since)}`,
                tone: data.billingStatus.toUpperCase() === "ACTIVE" ? "positive" : "attention",
              },
              {
                label: "Monthly",
                value: data.monthlyPrice === null ? "—" : money(data.monthlyPrice, data.currency),
                sub: data.annualPrice ? `${money(data.annualPrice, data.currency)} a year` : "No annual price",
              },
              usageCard("Students", data.students),
              usageCard("Staff", data.staff),
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          overages.length
            ? {
                type: "note",
                tone: "negative",
                title: `This school is over its ${overages.join(" and ")} allowance`,
                body: "The plan caps what it is sold on. Going past it is not blocked here, but it is the kind of thing that surfaces at renewal as a price change nobody expected.",
              }
            : {
                type: "note",
                tone: "positive",
                icon: CHECK_ICON,
                title: "Usage is within every limit on this plan",
                body: `Next billed ${dayLabel(data.nextBillingAt)}.`,
              },
        ],
      },
      {
        cols: "1.1fr 1fr",
        panels: [
          {
            type: "table",
            title: "Plans available",
            sub: "What the school is on, and what else there is.",
            head: ["Plan", "Monthly", "Students", "SMS a month", ""],
            per: 10,
            rows: data.plans.map((plan) => ({
              cells: [
                text(plan.name, { strong: plan.current }),
                text(money(plan.monthlyPrice, data.currency)),
                text(plan.studentLimit === null ? "uncapped" : String(plan.studentLimit)),
                text(plan.smsUnitsPerMonth ? plan.smsUnitsPerMonth.toLocaleString() : "none"),
                plan.current ? pill("current", "positive") : text(""),
              ],
              keywords: plan.name,
            })),
          },
          {
            type: "facts",
            title: "What this plan includes",
            facts: [
              ["Support", data.supportTier ? readable(data.supportTier) : "—"],
              ["API access", data.apiAccess ? "yes" : "no"],
              ["Custom branding", data.customBranding ? "yes" : "no"],
              ["SMS included a month", data.smsIncluded ? data.smsIncluded.toLocaleString() : "none"],
              ["SMS in the wallet now", data.smsBalance.toLocaleString()],
              ["Next billed", dayLabel(data.nextBillingAt)],
            ],
          },
        ],
      },
    ],
  };
}

/** M11 · Account — what has actually been paid. */
function accountTab(data: Subscription): TabContent {
  const paid = data.transactions.filter((row) => row.status.toUpperCase() === "SUCCESS");
  const total = paid.reduce((sum, row) => sum + row.amount, 0);
  const failed = data.transactions.filter((row) =>
    ["FAILED", "REVERSED"].includes(row.status.toUpperCase()),
  );

  return {
    title: "Account",
    desc: "What this school has paid the platform, and what is due next.",
    launchers: [{ label: "Plan", href: "/subscription-billing/plan" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "Billing",
            per: 4,
            cards: [
              {
                label: "Status",
                value: readable(data.billingStatus),
                sub: `On ${data.planName}`,
                tone: data.billingStatus.toUpperCase() === "ACTIVE" ? "positive" : "attention",
              },
              { label: "Paid to date", value: money(total, data.currency), sub: `${paid.length} payment(s)` },
              {
                label: "Next billed",
                value: dayLabel(data.nextBillingAt),
                sub: data.monthlyPrice === null ? "—" : money(data.monthlyPrice, data.currency),
              },
              {
                label: "Failed payments",
                value: String(failed.length),
                sub: failed.length ? "Worth chasing" : "None",
                tone: failed.length ? "negative" : "positive",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          data.transactions.length
            ? {
                type: "table",
                title: "Payments to the platform",
                sub: "Most recent first.",
                meta: `${data.transactions.length} transaction${data.transactions.length === 1 ? "" : "s"}`,
                head: ["Reference", "Amount", "Method", "Status", "When"],
                per: 12,
                rows: data.transactions.map((row) => ({
                  cells: [
                    text(row.reference, { mono: true }),
                    text(money(row.amount, row.currency), { strong: true }),
                    text(readable(row.method)),
                    pill(
                      row.status.toLowerCase(),
                      row.status.toUpperCase() === "SUCCESS" ? "positive" : "attention",
                    ),
                    text(dayLabel(row.processedAt)),
                  ],
                  keywords: `${row.reference} ${row.status}`,
                })),
              }
            : {
                type: "note",
                tone: "attention",
                title: "No payment has been recorded against this school",
                body: "The subscription shows as billable, but nothing has been taken. On a school that has been running a while, that is a reconciliation question rather than a good sign.",
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

  if (tabSlug === "plan" || tabSlug === "account") {
    const data = await apiGet<Subscription>("/api/v1/communications/subscription");
    if (!data) return undefined;
    return tabSlug === "plan" ? planTab(data) : accountTab(data);
  }

  return undefined;
}
