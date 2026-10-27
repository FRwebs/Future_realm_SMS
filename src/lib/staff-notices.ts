import { NOTIFY_ABOUT, NOTIFY_BY, type Preferences } from "@/lib/preferences";

/**
 * What a staff member asked to hear about (Preferences → What reaches me), applied to what the product has to tell them.
 *
 * Staff notices are written in many places as a title and a body, so the kind of a notice is read from its title — and a notice whose
 * kind is not recognised is always delivered: the rule may only ever hold back something it is sure of. Emergencies and safeguarding
 * are never held back, by any choice.
 */

type Kind = (typeof NOTIFY_ABOUT)[number];

const KINDS: Array<[RegExp, Kind]> = [
  [/escalat/i, "An item escalating past me"],
  [/returned|sent back|correction requested|not accepted/i, "A returned submission of mine"],
  [/sync (failed|failure|error)|could not sync|not synced/i, "A sync failure on my device"],
  [/sensitive record|record was opened|opened a sensitive/i, "A sensitive record being opened"],
  [/weekly (oversight )?summary/i, "Weekly oversight summary"],
  [/approval|is waiting|are waiting|asked the office|awaiting your/i, "An approval routed to me"],
];

const NEVER_HELD_BACK = /emergency|safeguarding|urgent/i;

export const kindOfNotice = (title: string): Kind | null => KINDS.find(([pattern]) => pattern.test(title))?.[1] ?? null;

const CHANNEL_NAME: Record<string, (typeof NOTIFY_BY)[number] | undefined> = { IN_APP: "In-app", EMAIL: "Email", SMS: "SMS" };

/** "19:00 – 07:00 WAT" → the window, in minutes past midnight. WAT is UTC+1 all year. */
function quietWindow(label: string | undefined): [number, number] | null {
  const match = /(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/.exec(label ?? "");
  return match ? [Number(match[1]) * 60 + Number(match[2]), Number(match[3]) * 60 + Number(match[4])] : null;
}

export function inPersonalQuietHours(preferences: Preferences | null | undefined, now = new Date()): boolean {
  const window = quietWindow(preferences?.quietHours);
  if (!window) return false;
  const lagos = (now.getUTCHours() * 60 + now.getUTCMinutes() + 60) % (24 * 60);
  const [from, to] = window;
  return from <= to ? lagos >= from && lagos < to : lagos >= from || lagos < to;
}

export type NoticeDecision = "deliver" | "suppress" | "defer";

/**
 * `suppress`: the person chose not to hear this, by this channel. `defer`: they did not choose against it, but it would reach them inside
 * their quiet hours — leave it queued and send it when the hours end. Anything else is delivered.
 */
export function decideNotice(preferences: Preferences | null | undefined, notice: { channel: string; title: string; urgency?: string | null }, now = new Date()): NoticeDecision {
  if (!preferences) return "deliver";
  if (NEVER_HELD_BACK.test(notice.title) || NEVER_HELD_BACK.test(notice.urgency ?? "")) return "deliver";

  const channel = CHANNEL_NAME[notice.channel];
  if (channel && preferences.notifyBy && !preferences.notifyBy.includes(channel)) return "suppress";

  const kind = kindOfNotice(notice.title);
  if (kind && preferences.notifyAbout && !preferences.notifyAbout.includes(kind)) return "suppress";

  // Quiet hours are for the things that interrupt: a message on the phone or in the inbox, not a line waiting in the bell.
  if ((notice.channel === "EMAIL" || notice.channel === "SMS") && inPersonalQuietHours(preferences, now)) return "defer";
  return "deliver";
}
