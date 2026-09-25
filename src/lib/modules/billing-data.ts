import { armRows } from "@/lib/modules/school-data";
import { registryStudents } from "@/lib/modules/students-data";

/**
 * What Nooria costs this school, and what is left on the channels that cost
 * money.
 *
 * The plan is billed per student per term, counted at term start, so the
 * billed figure is read from the same registry every other module counts —
 * never a literal that drifts away from the roll beneath it.
 */

export type PlanTier = "Standard" | "Premium" | "Elite";

/** Per student, per term. */
export const planRates: Record<PlanTier, number> = {
  Standard: 600,
  Premium: 900,
  Elite: 1200,
};

export const currentPlan: PlanTier = "Elite";

/** Students are counted at term start — every child on a roll, and the three in no arm. */
export const studentsBilled = registryStudents.length;

export const termCost = studentsBilled * planRates[currentPlan];

export const planRenewal = {
  date: "2 Jan 2027",
  days: 119,
  term: "Third Term",
  settled: "12 March 2026",
  outstanding: 0,
};

/* ------------------------------------------------------------------ Credits */

export type Channel = {
  name: "SMS" | "WhatsApp" | "Email" | "In-app";
  /** Naira per message. Zero for the free channels. */
  rate: number;
  /** Granted with the plan each term. Does not roll over. */
  base: number;
  /** Bought on top. Never expires, and survives a plan change. */
  topped: number;
  used: number;
  paid: boolean;
  note: string;
};

const channelSeed: Channel[] = [
  { name: "SMS", rate: 3.8, base: 4000, topped: 6000, used: 1580, paid: true, note: "160 characters a message" },
  { name: "WhatsApp", rate: 4.4, base: 1500, topped: 1000, used: 1360, paid: true, note: "Billed by conversation, not message" },
  { name: "Email", rate: 0, base: 0, topped: 0, used: 3420, paid: false, note: "Unlimited on every tier" },
  { name: "In-app", rate: 0, base: 0, topped: 0, used: 9140, paid: false, note: "Unlimited · reaches activated families only" },
];

export type ChannelBalance = Channel & { left: number; worth: number };

export const channels: ChannelBalance[] = channelSeed.map((channel) => {
  const left = channel.base + channel.topped - channel.used;
  return { ...channel, left, worth: Math.round(left * channel.rate) };
});

export const smsChannel = channels[0]!;
export const whatsappChannel = channels[1]!;

/** What the unspent paid credits are worth. */
export const walletValue = channels
  .filter((channel) => channel.paid)
  .reduce((total, channel) => total + channel.worth, 0);

export type TopUp = {
  date: string;
  channel: "SMS" | "WhatsApp";
  credits: number;
  amount: number;
  paidBy: string;
  invoice: string;
};

export const topUps: TopUp[] = [
  { date: "14 Aug 2026", channel: "SMS", credits: 6000, amount: 22800, paidBy: "Mastercard ·4417", invoice: "FR/INV/26/0602" },
  { date: "2 Aug 2026", channel: "WhatsApp", credits: 1000, amount: 4400, paidBy: "Mastercard ·4417", invoice: "FR/INV/26/0588" },
  { date: "6 Jan 2026", channel: "SMS", credits: 10000, amount: 38000, paidBy: "Bank transfer", invoice: "FR/INV/26/0412" },
  { date: "4 Jan 2026", channel: "WhatsApp", credits: 2500, amount: 11000, paidBy: "Verve ·2210", invoice: "FR/INV/26/0409" },
  { date: "12 Sep 2025", channel: "SMS", credits: 5000, amount: 19000, paidBy: "Mastercard ·4417", invoice: "FR/INV/25/0377" },
];

/* ----------------------------------------------------------------- Invoices */

export type Invoice = {
  number: string;
  period: string;
  amount: number;
  issued: string;
  state: "Paid" | "Outstanding";
};

export const invoices: Invoice[] = [
  { number: "FR/INV/26/0418", period: `Second Term 2026/27 · ${studentsBilled.toLocaleString("en-NG")} students`, amount: termCost, issued: "1 Mar 2026", state: "Paid" },
  { number: "FR/INV/26/0602", period: "Credit top-up · 10,000 SMS", amount: 38000, issued: "14 Aug 2026", state: "Paid" },
  { number: "FR/INV/26/0301", period: "First Term 2026/27 · 1,546 students", amount: 1_855_200, issued: "2 Sep 2025", state: "Paid" },
  { number: "FR/INV/25/0391", period: "Third Term 2025/26 · 1,502 students", amount: 1_802_400, issued: "1 Mar 2025", state: "Paid" },
  { number: "FR/INV/25/0512", period: "Migration assistance · one-off", amount: 180_000, issued: "11 Mar 2024", state: "Paid" },
];

/* --------------------------------------------------------- Plan comparison */

export type PlanCapability = {
  label: string;
  /** A money row states a figure per tier; a capability row states a tick. */
  money?: Record<PlanTier, number>;
  included?: Record<PlanTier, boolean>;
};

export const planComparison: PlanCapability[] = [
  { label: "Per student, per term", money: planRates },
  {
    label: `At ${studentsBilled.toLocaleString("en-NG")} students, a term`,
    money: {
      Standard: studentsBilled * planRates.Standard,
      Premium: studentsBilled * planRates.Premium,
      Elite: studentsBilled * planRates.Elite,
    },
  },
  {
    label: "Across three terms",
    money: {
      Standard: studentsBilled * planRates.Standard * 3,
      Premium: studentsBilled * planRates.Premium * 3,
      Elite: studentsBilled * planRates.Elite * 3,
    },
  },
  { label: "Attendance, scores, report cards", included: { Standard: true, Premium: true, Elite: true } },
  { label: "Offline entry and sync", included: { Standard: true, Premium: true, Elite: true } },
  { label: "Full data export, every tier", included: { Standard: true, Premium: true, Elite: true } },
  { label: "Guardian portal", included: { Standard: false, Premium: true, Elite: true } },
  { label: "Custom report builder", included: { Standard: false, Premium: true, Elite: true } },
  { label: "Rich messaging channel", included: { Standard: false, Premium: false, Elite: true } },
  { label: "Named Account Manager", included: { Standard: false, Premium: false, Elite: true } },
];

/** What is billed to this account today, beyond the plan itself. */
/**
 * `thisTerm` is a figure when the line is billed, the literal word when it is
 * carried by the plan, and null when it draws on the wallet instead.
 */
export const runningItems: Array<{
  name: string;
  basis: string;
  units: string;
  rate: number | null;
  /**
   * What the rate is charged against. A plan is priced per student per term in
   * whole naira; a message is priced in fractions of one, so the two cannot
   * share a formatter without one of them reading wrong.
   */
  rateUnit?: "student" | "message";
  thisTerm: number | string | null;
  renews: string;
  state: "Active" | "Low" | "Completed";
}> = [
  { name: "Elite plan", basis: "Per student, per term", units: studentsBilled.toLocaleString("en-NG"), rate: planRates.Elite, rateUnit: "student", thisTerm: termCost, renews: planRenewal.date, state: "Active" as const },
  { name: "Guardian portal", basis: "Included in Elite", units: "—", rate: null, thisTerm: "Included", renews: "With the plan", state: "Active" as const },
  { name: "SMS credits", basis: "4,000 base, then pay as you go", units: smsChannel.left.toLocaleString("en-NG"), rate: smsChannel.rate, rateUnit: "message", thisTerm: null, renews: "On top-up", state: "Active" as const },
  { name: "WhatsApp credits", basis: "1,500 base, then pay as you go", units: whatsappChannel.left.toLocaleString("en-NG"), rate: whatsappChannel.rate, rateUnit: "message", thisTerm: null, renews: "On top-up", state: "Low" as const },
  { name: "Migration assistance", basis: "One-off", units: "—", rate: null, thisTerm: 0, renews: "Does not renew", state: "Completed" as const },
];

/**
 * A per-message rate is a fraction of a naira, so it keeps its decimal.
 * `naira` rounds, which would print every channel's rate as ₦4 and make SMS
 * and WhatsApp look identically priced.
 */
export function ratePerMessage(value: number): string {
  return `₦${value.toFixed(1)}`;
}

/** Arms the plan covers — read from the same table the rest of the product counts. */
export const armsCovered = armRows.length;
