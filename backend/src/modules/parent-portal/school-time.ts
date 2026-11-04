/**
 * The calendar day and the clock at a school, in the school's own time zone.
 *
 * A school in Accra and one in Abuja are an hour apart, so "today" and "right now" are two answers for a family at both — a lesson that
 * has started at one has not at the other, and the day turns over an hour apart. A zone the runtime does not know falls back to Lagos
 * rather than failing the page, because a wrong hour is better than no page.
 */
const FALLBACK = "Africa/Lagos";

/** `YYYY-MM-DD` at the school. */
export function todayIn(zone: string, at = new Date()): string {
  const format = (timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  try {
    return format(zone);
  } catch {
    return format(FALLBACK);
  }
}

/** `HH:MM`, 24-hour, at the school. */
export function clockIn(zone: string, at = new Date()): string {
  const format = (timeZone: string) => at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
  try {
    return format(zone);
  } catch {
    return format(FALLBACK);
  }
}
