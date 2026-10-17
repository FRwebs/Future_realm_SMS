/**
 * How a timetable's day is cut up, and when two arms want the same teacher.
 *
 * Shared by the API (which refuses to publish a clash) and the builder page (which
 * shows one the moment it is made), so the two can never disagree about what a
 * clash is or where period four falls.
 */

export type Cell = { subjectId: string; teacherId: string | null };
/** classId → "day|period" → what is taught there. Day 1 is Monday. */
export type Grid = Record<string, Record<string, Cell>>;
export type PeriodInfo = { n: number | "break"; start: string; end: string };

export const BREAK_MINUTES = 20;
export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_CODES = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function minutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function clock(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** The periods a day is made of, from the few numbers a school chooses. */
export function buildPeriods(settings: {
  periodsPerDay: number;
  periodMinutes: number;
  firstStarts: string;
  breakAfter: number | null;
}): PeriodInfo[] {
  const out: PeriodInfo[] = [];
  let at = minutes(settings.firstStarts);
  for (let n = 1; n <= settings.periodsPerDay; n += 1) {
    out.push({ n, start: clock(at), end: clock(at + settings.periodMinutes) });
    at += settings.periodMinutes;
    if (settings.breakAfter && n === settings.breakAfter && n < settings.periodsPerDay) {
      out.push({ n: "break", start: clock(at), end: clock(at + BREAK_MINUTES) });
      at += BREAK_MINUTES;
    }
  }
  return out;
}

export function cellKey(day: number, period: number): string {
  return `${day}|${period}`;
}

export function dayLabel(day: number): string {
  return DAY_NAMES[day - 1] ?? `Day ${day}`;
}

/** Every slot where one teacher is booked into more than one arm. */
export function clashesIn(grid: Grid): Array<{ teacherId: string; day: number; period: number; classIds: string[] }> {
  const slots = new Map<string, Set<string>>();
  for (const [classId, cells] of Object.entries(grid)) {
    for (const [key, cell] of Object.entries(cells)) {
      if (!cell.teacherId) continue;
      const id = `${cell.teacherId}#${key}`;
      slots.set(id, (slots.get(id) ?? new Set()).add(classId));
    }
  }
  const out: Array<{ teacherId: string; day: number; period: number; classIds: string[] }> = [];
  for (const [id, classIds] of slots) {
    if (classIds.size < 2) continue;
    const [teacherId, key] = id.split("#");
    const [day, period] = key.split("|").map(Number);
    out.push({ teacherId, day, period, classIds: Array.from(classIds) });
  }
  return out;
}
