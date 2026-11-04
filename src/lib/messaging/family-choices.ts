/**
 * What a family chose to hear, and by which channel.
 *
 * A school writes a message as free text, so the kind of a message is read from its words — and a message whose kind is not recognised is
 * always sent: a choice may only ever hold back something the product is sure of. Safety notices are never held back, by any choice.
 */

export const FAMILY_KINDS = [
  { key: "academic", label: "Academic", sub: "Results, report cards, absences, lesson changes" },
  { key: "financial", label: "Financial", sub: "Invoices, receipts, reminders and plans" },
  { key: "events", label: "Events", sub: "Calendar, trips, meetings and conferences" },
  { key: "general", label: "General", sub: "Newsletters and school notices" },
] as const;
export type FamilyKind = (typeof FAMILY_KINDS)[number]["key"];

/** The channels a family can switch. In-app is the record and cannot be switched off. */
export const FAMILY_CHANNELS = ["SMS", "Email", "WhatsApp"] as const;

export const NEVER_HELD_BACK = /emergency|safeguarding|urgent|closure|closed today|evacuat|lockdown|unwell|sick bay|accident|missing child/i;

const KINDS: Array<[RegExp, FamilyKind]> = [
  [/\b(fees?|invoice|receipt|payment|balance|owing|outstanding|instal?lment|bursar|tuition)\b/i, "financial"],
  [/\b(results?|report cards?|scores?|exams?|tests?|assignments?|homework|absen(t|ce)|attendance|late arrival|timetable|lesson)\b/i, "academic"],
  [/\b(events?|trips?|meetings?|conference|open day|sports|inter-?house|party|ceremony|calendar|pta)\b/i, "events"],
  [/\b(newsletter|notice|announcement|reminder|holiday|resumption|vacation)\b/i, "general"],
];

/** What kind of message this is, or null when the words do not say. */
export const kindOfMessage = (text: string): FamilyKind | null => KINDS.find(([pattern]) => pattern.test(text))?.[1] ?? null;

/** Whether a family switched WhatsApp on for anything at all. */
export const whatsappChosen = (choices: FamilyChoices): boolean => Object.entries(choices?.familyNotify ?? {}).some(([key, value]) => key.endsWith(":WhatsApp") && value === true);

export type FamilyChoices = { familyNotify?: Record<string, boolean>; digest?: "combine" | "separate" } | null | undefined;

/**
 * Whether a message may go to a family on this channel. Only an explicit "off" holds a message back; a family that never chose
 * is sent everything, as it always was.
 */
export function familyAllows(choices: FamilyChoices, channel: "IN_APP" | "SMS" | "EMAIL" | "WHATSAPP", text: string): { ok: true } | { ok: false; reason: string } {
  if (channel === "IN_APP") return { ok: true };
  // WhatsApp is opt-in: a family is written to there only for the kinds it switched on. A safety notice goes to anyone who opted in at all.
  if (channel === "WHATSAPP") {
    if (NEVER_HELD_BACK.test(text)) return { ok: true };
    const kind = kindOfMessage(text);
    const on = kind ? choices?.familyNotify?.[`${kind}:WhatsApp`] === true : whatsappChosen(choices);
    return on ? { ok: true } : { ok: false, reason: `This family has not chosen WhatsApp for ${kind ?? "this kind of"} messages — nothing was sent.` };
  }
  if (NEVER_HELD_BACK.test(text)) return { ok: true };
  const kind = kindOfMessage(text);
  if (!kind) return { ok: true };
  const word = channel === "SMS" ? "SMS" : "Email";
  if (choices?.familyNotify?.[`${kind}:${word}`] === false) {
    return { ok: false, reason: `This family chose not to get ${kind} messages by ${word === "SMS" ? "SMS" : "email"} — nothing was sent.` };
  }
  return { ok: true };
}

/** The word a school message wears in the parent's inbox: its kind, or Safety when it is the kind that is never held back. */
export const categoryOfMessage = (text: string): "Academic" | "Financial" | "Events" | "General" | "Safety" => {
  if (NEVER_HELD_BACK.test(text)) return "Safety";
  const kind = kindOfMessage(text);
  return kind ? (FAMILY_KINDS.find((entry) => entry.key === kind)?.label ?? "General") as "Academic" | "Financial" | "Events" | "General" : "General";
};
