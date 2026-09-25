import { families } from "@/lib/modules/students-data";
import { people } from "@/lib/modules/staff-data";

/**
 * Who a message can actually reach, and what it costs to reach them.
 *
 * The rule the whole module turns on: anyone who cannot be reached is excluded
 * *before* the count, so the number you approve is the number that gets
 * delivered — never an optimistic one.
 */

/** The four ways a send fails, as the Sent tab names them. */
export type DeliveryState =
  | "Reachable"
  | "Number unreachable"
  | "No number on file"
  | "Never activated"
  | "Invalid number format";

/** A stable pseudo-random from a string, so nothing shuffles between renders. */
function seedOf(key: string): number {
  let seed = 0;
  for (let index = 0; index < key.length; index++) {
    seed = (seed * 31 + key.charCodeAt(index)) % 100000;
  }
  return seed;
}

/**
 * A family's delivery state.
 *
 * A number that has failed is a fact the product holds — the Sent tab lists
 * these four reasons by name. It is derived here from the family's own record
 * so the same household is always in the same state, and so the suppressed
 * count on Compose is the same set the failure list on Sent names.
 */
export function deliveryStateOf(family: { name: string; portal: string; hasSecondContact: boolean }): DeliveryState {
  const seed = seedOf(`${family.name}delivery`);

  if (family.portal !== "Active" && seed % 37 === 0) return "Never activated";
  if (seed % 53 === 0) return "No number on file";
  if (seed % 61 === 0) return "Invalid number format";
  if (seed % 47 === 0) return "Number unreachable";
  return "Reachable";
}

export const households = families();

export const guardianDelivery = households.map((family) => ({
  family,
  state: deliveryStateOf(family),
}));

export const guardiansReachable = guardianDelivery.filter(
  (entry) => entry.state === "Reachable",
).length;

export const guardiansSuppressed = households.length - guardiansReachable;

/** Staff who have never signed in cannot be reached in-app. */
export const staffSuppressed = people.filter((person) => person.portal !== "Active").length;

export type AudienceKey =
  | "One person"
  | "Selected people"
  | "Guardians"
  | "Staff"
  | "Everyone";

export type Audience = {
  key: AudienceKey;
  /** How many match. */
  matched: number;
  /** How many of those cannot be reached, and are excluded before the count. */
  suppressed: number;
  desc: string;
  icon: string;
};

export const audiences: Audience[] = [
  {
    key: "One person",
    matched: 1,
    suppressed: 0,
    desc: "A single guardian or staff member, by name.",
    icon: "M9.5 11.3a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 20v-1.2A4.6 4.6 0 0 1 7.6 14h3.8a4.6 4.6 0 0 1 4.6 4.8V20",
  },
  {
    key: "Selected people",
    matched: 14,
    suppressed: 0,
    desc: "A handful you pick by hand.",
    icon: "M5 12.5l4.5 4.5 9-10",
  },
  {
    key: "Guardians",
    matched: households.length,
    suppressed: guardiansSuppressed,
    desc: "Every family, or a filtered group of them.",
    icon: "M4 5.5h16v13H4zM4 6l8 6 8-6",
  },
  {
    key: "Staff",
    matched: people.length,
    suppressed: staffSuppressed,
    desc: "Teaching and non-teaching staff.",
    icon: "M6.5 20v-1.2A4.6 4.6 0 0 1 11 14h2a4.6 4.6 0 0 1 4.5 4.8V20M12 11.3a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7",
  },
  {
    key: "Everyone",
    matched: households.length + people.length,
    suppressed: guardiansSuppressed + staffSuppressed,
    desc: "Every guardian and every staff member at once.",
    icon: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17M3.5 12h17M12 3.5a13 13 0 0 1 0 17a13 13 0 0 1 0-17",
  },
];

export function reachOf(audience: Audience): number {
  return audience.matched - audience.suppressed;
}

/** The channel a compose defaults to, and what it costs. */
export const smsRate = 3.8;

/** A send's cost, to the kobo — a thousand messages is a figure a bursar reads. */
export function costOf(reach: number): string {
  return `₦${(reach * smsRate).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** The audience Compose opens on. */
export const defaultAudience = audiences.find((entry) => entry.key === "Guardians")!;

/* ------------------------------------------------------------------- Sent */

export type CampaignState =
  | "Awaiting"
  | "Scheduled"
  | "Delivered"
  | "Active"
  | "Cancelled";

export type Campaign = {
  name: string;
  sub: string;
  channel: string;
  recipients: string;
  credits: string;
  state: CampaignState;
  sender: string;
  senderRole: string;
  act: string;
};

export const campaigns: Campaign[] = [
  { name: "Fee reminder · second, 214 families", sub: "Awaiting approval · above 150 threshold", channel: "SMS", recipients: "191", credits: "191", state: "Awaiting", sender: "Mrs Chinelo Obi", senderRole: "Bursar", act: "Decide" },
  { name: "Parents' consultation day", sub: "Scheduled for 20 September, 08:00", channel: "SMS", recipients: "318", credits: "318", state: "Scheduled", sender: "Adaeze Nwosu", senderRole: "Principal · you", act: "Edit" },
  { name: "Examination timetable", sub: "Sent 1 September · 98% delivered", channel: "Rich messaging", recipients: "1,161", credits: "1,161", state: "Delivered", sender: "Mr Samuel Adeyemi", senderRole: "Exam Officer", act: "Open" },
  { name: "Weekly attendance summary", sub: "Recurring · every Friday, 16:00", channel: "In-app", recipients: "1,161", credits: "0", state: "Active", sender: "Automation", senderRole: "No sender", act: "Open" },
  { name: "Consent request · 214 families", sub: "Sent 20 August · 94% delivered", channel: "SMS", recipients: "191", credits: "191", state: "Delivered", sender: "Miss Grace Etim", senderRole: "Registrar", act: "Open" },
  { name: "Emergency · early closure, heavy rain", sub: "Sent 14 August, 11:42 · 100% delivered", channel: "SMS", recipients: "1,182", credits: "1,182", state: "Delivered", sender: "Adaeze Nwosu", senderRole: "Principal · you", act: "Open" },
  { name: "First Term results published", sub: "Sent 19 December · 96% delivered", channel: "SMS", recipients: "1,161", credits: "1,161", state: "Delivered", sender: "Adaeze Nwosu", senderRole: "Principal · you", act: "Open" },
  { name: "Prize-giving invitation", sub: "Cancelled 2 September, 26 minutes before send", channel: "SMS", recipients: "1,182", credits: "0", state: "Cancelled", sender: "Adaeze Nwosu", senderRole: "Principal · you", act: "Open" },
];

export type FailedDelivery = {
  family: string;
  contact: string;
  campaign: string;
  reason: string;
};

export const failedDeliveries: FailedDelivery[] = [
  { family: "Mohammed family", contact: "+234 803 111 0412", campaign: "Consent request", reason: "Number unreachable on 3 attempts across 2 days" },
  { family: "Sule family", contact: "No number on file", campaign: "Fee reminder", reason: "No phone number — also has no consent and no class arm" },
  { family: "Nwankwo family", contact: "+234 803 111 0741", campaign: "Results published", reason: "Never activated the portal · in-app message undelivered" },
  { family: "Anyanwu family", contact: "+234 803 111 0688", campaign: "Results published", reason: "Invalid number format — not a valid +234 number" },
];

/* ------------------------------------------------------------- Automation */

export type NotificationRule = {
  rule: string;
  why: string;
  channel: string;
  timing: string;
  audience: string;
  state: "Mandatory" | "Enabled" | "Disabled";
};

export const notificationRules: NotificationRule[] = [
  { rule: "Result published", why: "Locked · a parent must know their child's result is out", channel: "SMS + in-app", timing: "Immediately", audience: "Guardians of the arm", state: "Mandatory" },
  { rule: "Result revised", why: "Locked · a changed result must never arrive silently", channel: "SMS + in-app", timing: "Immediately", audience: "Guardian of the student", state: "Mandatory" },
  { rule: "Payment reversal", why: "Locked · money leaving a ledger is always announced", channel: "SMS + in-app", timing: "Immediately", audience: "Guardian and Bursar", state: "Mandatory" },
  { rule: "Emergency broadcast", why: "Locked · bypasses scheduling, rate limits and opt-outs", channel: "All channels", timing: "Immediately", audience: "Every family", state: "Mandatory" },
  { rule: "Approval decision", why: "Requester is told the outcome and the reason", channel: "In-app", timing: "Immediately", audience: "The requester", state: "Enabled" },
  { rule: "Absence recorded", why: "Same-day, within the contact window", channel: "SMS", timing: "16:00 daily", audience: "Guardian of the student", state: "Enabled" },
  { rule: "Chronic absence threshold crossed", why: "Below 75% in a term", channel: "SMS + in-app", timing: "Immediately", audience: "Guardian and form master", state: "Enabled" },
  { rule: "Invoice published", why: "With the amount and the due date", channel: "SMS + email", timing: "On publication", audience: "Guardians billed", state: "Enabled" },
  { rule: "Fee reminder · first", why: "Automatic at 14 days overdue", channel: "SMS", timing: "Day 14", audience: "Families overdue", state: "Enabled" },
];

export type MessageTemplate = {
  name: string;
  sub: string;
  owner: "School" | "System" | "Future Realm";
  version: string;
  lastUsed: string;
};

export const messageTemplates: MessageTemplate[] = [
  { name: "Fee reminder · second", sub: "SMS · 4 variables", owner: "School", version: "3", lastUsed: "28 Aug" },
  { name: "Result published", sub: "SMS · 3 variables", owner: "School", version: "2", lastUsed: "19 Dec" },
  { name: "Consent request", sub: "SMS · 2 variables", owner: "School", version: "1", lastUsed: "20 Aug" },
  { name: "Absence recorded", sub: "SMS · 4 variables", owner: "System", version: "5", lastUsed: "Today" },
  { name: "Rich messaging · examination timetable", sub: "Pre-approved library", owner: "Future Realm", version: "2", lastUsed: "1 Sep" },
  { name: "Rich messaging · school announcement", sub: "Pre-approved library", owner: "Future Realm", version: "1", lastUsed: "14 Aug" },
];

/** What each channel reaches and costs. */
export const channelTiles = [
  { label: "In-app · free", sub: "Reaches 1,161 activated families · pinning and acknowledgement tracking", icon: "M12 3.5A5.5 5.5 0 0 0 6.5 9v3.2L5 15.5h14l-1.5-3.3V9A5.5 5.5 0 0 0 12 3.5z" },
  { label: "Email · free on Elite", sub: "Reaches 1,048 families with an email on file · full formatting", icon: "M2.5 6h19v12h-19zM2.5 6l9.5 7 9.5-7" },
  { label: "SMS · ₦3.80 each", sub: "Reaches 1,168 families · 160 characters · the only channel that always arrives", icon: "M4 5.5h16v10.5H9l-5 4z", tone: "attention" as const },
  { label: "Rich messaging · ₦2.10 each", sub: "Reaches 812 families with the app · images and attachments", icon: "M4 5.5h16v13H4zM8 10h8M8 14h5" },
];
