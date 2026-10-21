/**
 * Service-level clocks that run in a school's own working hours. A desk is open between `start` and `end` (local time in
 * `timeZone`) on `days` (ISO weekdays, 1 = Monday), and closed on `holidays` (YYYY-MM-DD). Outside those hours a clock
 * stands still — a four-hour target opened at 16:30 on Friday is not due at 20:30 on Friday.
 */
export type WorkingHours = { timeZone: string; start: string; end: string; days: number[]; holidays: string[] };

const MIN = 60_000;
const DAY = 86_400_000;

/** Minutes the zone is ahead of UTC at this instant. */
function offsetMinutes(at: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(at));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return (Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - Math.floor(at / 1000) * 1000) / MIN;
}

/** The instant at which the wall clock in `timeZone` reads this date and time. */
function zoned(year: number, month: number, day: number, minutes: number, timeZone: string): number {
  const naive = Date.UTC(year, month - 1, day, 0, minutes);
  let at = naive - offsetMinutes(naive, timeZone) * MIN;
  at = naive - offsetMinutes(at, timeZone) * MIN; // once more, in case the first guess crossed a daylight-saving change
  return at;
}

const toMinutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

function localDay(at: number, timeZone: string): { year: number; month: number; day: number; weekday: number; key: string } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(new Date(at));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")) + 1;
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), weekday, key: `${get("year")}-${get("month")}-${get("day")}` };
}

/** The open windows (as instants) from `from` onward, one per working day, in order. */
function* windows(from: number, hours: WorkingHours): Generator<[number, number]> {
  const open = toMinutes(hours.start);
  const close = toMinutes(hours.end);
  let cursor = from - DAY; // start a day early so the first window is never skipped by a time-zone edge
  for (let i = 0; i < 800; i += 1) {
    const d = localDay(cursor, hours.timeZone);
    cursor += DAY;
    if (!hours.days.includes(d.weekday) || hours.holidays.includes(d.key)) continue;
    const start = zoned(d.year, d.month, d.day, open, hours.timeZone);
    const end = zoned(d.year, d.month, d.day, close, hours.timeZone);
    if (end > from) yield [Math.max(start, from), end];
  }
}

/** When a target of `hours` working hours, opened at `from`, falls due. */
export function addWorkingHours(from: Date, target: number, working: WorkingHours): Date {
  let remaining = target * 60 * MIN;
  for (const [start, end] of windows(from.getTime(), working)) {
    const room = end - start;
    if (remaining <= room) return new Date(start + remaining);
    remaining -= room;
  }
  return new Date(from.getTime() + target * 60 * MIN);
}

/** Working hours that passed between two instants — what a resolution time is measured in. */
export function workingHoursBetween(from: Date, to: Date, working: WorkingHours): number {
  let total = 0;
  for (const [start, end] of windows(from.getTime(), working)) {
    if (start >= to.getTime()) break;
    total += Math.min(end, to.getTime()) - start;
  }
  return total / (60 * MIN);
}

export function parseWorkingHours(row: { timeZone: string | null; workStart: string | null; workEnd: string | null; workDays: number[]; holidayDates: string[] } | null | undefined): WorkingHours | null {
  if (!row?.workStart || !row.workEnd || !row.timeZone) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: row.timeZone });
  } catch {
    return null;
  }
  return { timeZone: row.timeZone, start: row.workStart, end: row.workEnd, days: row.workDays.length ? row.workDays : [1, 2, 3, 4, 5], holidays: row.holidayDates };
}
