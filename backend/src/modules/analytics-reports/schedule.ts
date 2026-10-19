/**
 * When a saved report is next owed.
 *
 * School time is West Africa Time, UTC+1 all year, so "Monday 07:00" is 06:00 UTC. The rule is stated as "the latest
 * moment this schedule fired at or before now": a report is owed when that moment is later than its last run, and
 * later than the day the report was saved (a report saved on Tuesday is not owed Monday's run).
 */

export const SCHEDULES = ["On demand", "Every Monday, 07:00", "Every Friday, 16:00", "First of each month", "End of each term"] as const;

const WAT = 1; // hours ahead of UTC

const atUtc = (date: Date, hourWat: number) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hourWat - WAT, 0, 0));

function lastWeekday(now: Date, weekday: number, hourWat: number): Date {
  const candidate = atUtc(now, hourWat);
  candidate.setUTCDate(candidate.getUTCDate() - ((candidate.getUTCDay() - weekday + 7) % 7));
  if (candidate > now) candidate.setUTCDate(candidate.getUTCDate() - 7);
  return candidate;
}

function lastFirstOfMonth(now: Date): Date {
  const candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 7 - WAT, 0, 0));
  return candidate > now ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 7 - WAT, 0, 0)) : candidate;
}

/** The latest moment the schedule fired at or before `now`, or null when it has never fired (or never fires on its own). */
export function lastDueAt(schedule: string, now: Date, termEnds: Date[] = []): Date | null {
  if (schedule === "Every Monday, 07:00") return lastWeekday(now, 1, 7);
  if (schedule === "Every Friday, 16:00") return lastWeekday(now, 5, 16);
  if (schedule === "First of each month") return lastFirstOfMonth(now);
  if (schedule === "End of each term") {
    const fired = termEnds.map((end) => atUtc(new Date(end.getTime() + 86_400_000), 7)).filter((moment) => moment <= now);
    return fired.length ? new Date(Math.max(...fired.map((moment) => moment.getTime()))) : null;
  }
  return null;
}

export function isOwed(schedule: string, now: Date, o: { createdAt: Date; lastRunAt: Date | null; termEnds?: Date[] }): boolean {
  const due = lastDueAt(schedule, now, o.termEnds);
  if (!due) return false;
  if (due <= o.createdAt) return false;
  return !o.lastRunAt || o.lastRunAt < due;
}
