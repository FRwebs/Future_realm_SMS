import { apiGet } from "@/lib/api/server";
import { dayLabel, plural } from "@/lib/modules/live/m7-format";
import { SB, creditSettingsDrawer, naira, rate2, receiptDrawer, removeCardDrawer, topUpDrawer } from "@/lib/modules/live/m11-forms";
import { invoiceDocDrawer } from "@/lib/modules/live/documents";
import type { Credits } from "@/lib/modules/live/m11-types";
import { pill, text, type KpiCard, type PanelTone, type TabContent, type TableRow } from "@/lib/modules/panels";

/**
 * Credits: four channels, two of them free. A school only ever needs to know two things here: how
 * much is left on the two that cost money, and how to put more on.
 */

export const loadCredits = () => apiGet<Credits>(`${SB}/credits`);

const level = (balance: number, warnAt: number): PanelTone => (balance < warnAt / 2 ? "negative" : balance < warnAt ? "attention" : "positive");

export function creditsTab(c: Credits): TabContent {
  const paid = c.channels.filter((channel) => channel.paid);
  const worth = paid.reduce((sum, channel) => sum + Math.round(channel.balance * channel.rate), 0);
  const low = paid.filter((channel) => channel.balance < c.settings.warnAt);
  const topped = c.topUps.reduce((sum, row) => sum + row.amount, 0);

  const cards: KpiCard[] = c.channels.map((channel) => channel.paid
    ? { label: channel.name, value: channel.balance.toLocaleString("en-NG"), unit: "left", sub: `${channel.base.toLocaleString("en-NG")} base · ${channel.topped.toLocaleString("en-NG")} topped up`, tone: level(channel.balance, c.settings.warnAt), link: "Top up", drawer: topUpDrawer(c, channel.name === "WhatsApp" ? "WhatsApp" : "SMS") }
    : { label: channel.name, value: "Free", sub: `${channel.used.toLocaleString("en-NG")} sent this term`, tone: "positive" });

  const channelRows: TableRow[] = c.channels.map((channel) => ({
    cells: [
      text(channel.name, { strong: true }),
      channel.paid ? text(channel.base.toLocaleString("en-NG"), { mono: true }) : text("Included"),
      channel.paid ? text(channel.topped.toLocaleString("en-NG"), { mono: true }) : text("—"),
      text(channel.used.toLocaleString("en-NG"), { mono: true }),
      channel.paid ? text(channel.balance.toLocaleString("en-NG"), { mono: true, strong: true, tone: level(channel.balance, c.settings.warnAt) }) : pill("Unlimited", "positive"),
      channel.paid ? text(`${rate2(channel.rate)} each`, { mono: true }) : text("Free"),
      channel.paid ? text(naira(Math.round(channel.balance * channel.rate)), { mono: true }) : text("—"),
      channel.paid ? { kind: "action" as const, label: "Top up", drawer: topUpDrawer(c, channel.name === "WhatsApp" ? "WhatsApp" : "SMS") } : text("—"),
    ],
  }));

  const history: TableRow[] = c.topUps.map((row) => ({
    keywords: `${row.channel} ${row.method} ${row.invoice ?? ""}`,
    cells: [text(dayLabel(row.at), { strong: true }), pill(row.channel, row.channel === "SMS" ? "progress" : "submitted"), text(row.credits.toLocaleString("en-NG"), { mono: true }), text(naira(row.amount), { mono: true, strong: true }), text(row.method), text(row.invoice ?? "—", { mono: true }), row.invoiceId ? { kind: "action" as const, label: "Receipt", drawer: invoiceDocDrawer(row.invoiceId, row.invoice ?? "") } : { kind: "action" as const, label: "Receipt", drawer: receiptDrawer(row) }],
  }));

  return {
    title: "Credits",
    desc: "What is left on the channels that cost money, and how to put more on.",
    primary: { label: "Top up", icon: "M12 5.5v13M5.5 12h13", drawer: topUpDrawer(c, "SMS") },
    launchers: [{ label: "Top up WhatsApp", drawer: topUpDrawer(c, "WhatsApp") }, { label: "Set an automatic top-up", drawer: creditSettingsDrawer(c) }, { label: "Open the plan", href: "/subscription-billing/plan" }],
    rows: [
      ...(!c.configured ? [{ cols: "1fr", panels: [{ type: "note" as const, tone: "attention" as PanelTone, title: "This school has no messaging wallet yet", body: "Nothing can be sent by SMS or WhatsApp until credits are bought. The first top-up creates the wallet. Email and in-app are free.", acts: [{ label: "Top up SMS", drawer: topUpDrawer(c, "SMS") }] }] }] : []),
      ...low.map((channel) => ({ cols: "1fr", panels: [{ type: "note" as const, tone: "attention" as PanelTone, title: `${channel.name} is down to ${channel.balance.toLocaleString("en-NG")} credits`, body: `Below the ${c.settings.warnAt.toLocaleString("en-NG")} the school asked to be warned at. Email and in-app are free and cost nothing to fall back on.`, acts: [{ label: `Top up ${channel.name}`, drawer: topUpDrawer(c, channel.name === "WhatsApp" ? "WhatsApp" : "SMS") }, { label: "Change the warning", drawer: creditSettingsDrawer(c) }] }] })),
      ...((c.cards ?? []).length ? [{ cols: "1fr", panels: [{ type: "note" as const, tone: "positive" as PanelTone, title: `Card on file: ${(c.cards ?? [])[0].brand ?? "Card"} ending ${(c.cards ?? [])[0].last4}${(c.cards ?? [])[0].expires ? ` · expires ${(c.cards ?? [])[0].expires}` : ""}`, body: c.settings.auto ? "Charged automatically for the same quantity when the balance passes the threshold. Remove it any time." : "Kept for automatic top-ups. Switch automatic top-up on to use it, or remove it.", acts: [{ label: "Remove the card", drawer: removeCardDrawer((c.cards ?? [])[0]) }] }] }] : []),
      { cols: "1fr", panels: [{ type: "kpi", title: "The wallet", per: 4, cards }] },
      { cols: "1fr", panels: [{ type: "table", title: "Every channel", tag: `${naira(worth)} on the wallet`, tagTone: "neutral", sub: "Base credits come with the plan each term. Anything beyond them is topped up.", meta: `${c.term ?? "This term"} · base credits reset each term · topped-up credits never expire`, head: ["Channel", "Base this term", "Topped up", "Used", "Balance", "Rate", "Worth", ""], noun: "channel", nounPlural: "channels", noRowOpen: true, rows: channelRows, foot: "Email and in-app are free on every tier. SMS and WhatsApp are paid because the networks charge for them. “Used” counts sends this term; the balance is what the wallet holds." }] },
      {
        cols: "1.15fr 1fr",
        panels: [
          { type: "table", title: "Top-up history", sub: "Every purchase, what it cost and what paid for it.", meta: `${plural(c.topUps.length, "top-up")} · ${naira(topped)} before VAT`, filters: [{ label: "Channel", value: "All", options: ["All", "SMS", "WhatsApp"], column: 1 }, { label: "Paid by", value: "All", options: ["All", "Card", "Bank transfer"], column: 4 }], acts: [{ label: "Top up", primary: true, drawer: topUpDrawer(c, "SMS") }], head: ["Date", "Channel", "Credits", "Amount", "Paid by", "Invoice", ""], noun: "top-up", nounPlural: "top-ups", noRowOpen: true, per: 8, rows: history, emptyTitle: "Nothing has been bought yet", emptyBody: "A top-up appears here once its payment clears.", foot: "Topped-up credits never expire and survive a plan change. Base credits are granted per term and do not roll over." },
          { type: "facts", title: "What each channel costs", tag: "Shown transparently", tagTone: "positive", meta: "Pay by card and the credits land when the payment clears", per: 1, acts: [{ label: "Top up WhatsApp", drawer: topUpDrawer(c, "WhatsApp") }, { label: "Top up SMS", primary: true, drawer: topUpDrawer(c, "SMS") }], facts: [["SMS · Nigeria", `${rate2(c.pricing.sms)} each`, "A short sender name saves money on every send"], ["SMS · international", `${rate2(c.pricing.smsInternational)} each`, "Kenya, Ghana, South Africa and the UK"], ["WhatsApp", `${rate2(c.pricing.whatsapp)} each`, "Billed by the conversation, not the message"], ["Email", "Free", "Unlimited on every tier"], ["In-app", "Free", "Reaches activated families only"], ["Base credits", `${c.pricing.baseSms.toLocaleString("en-NG")} SMS and ${c.pricing.baseWhatsapp.toLocaleString("en-NG")} WhatsApp`, "Granted each term with the plan"], ["Volume discount", "3% at 10,000 · 6% at 25,000", "Applied automatically at top-up"], ["Warning", `At ${c.settings.warnAt.toLocaleString("en-NG")} credits · ${c.settings.warnWho}`, c.settings.auto ? `Automatic top-up preference: ${c.settings.autoQuantity.toLocaleString("en-NG")} ${c.settings.autoChannel === "WHATSAPP" ? "WhatsApp" : "SMS"}` : "No automatic top-up"], ["Expiry", "Topped-up credits never expire", "They survive a plan change"]] },
        ],
      },
    ],
  };

}
