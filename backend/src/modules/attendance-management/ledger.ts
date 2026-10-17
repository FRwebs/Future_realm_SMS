import { prisma } from "../../../../src/lib/db/prisma";
import { type ArmRow, type Policy, type TermLike, dayOf, fullName, iso, lagosClock } from "./attendance.shared";

/**
 * The register ledger: for every arm and every school day, was a register taken, and was it taken
 * in time. It is the one place "unmarked", "late" and "unknown" are decided, so the Register,
 * Compliance and Log tabs cannot describe the same day differently.
 */

export type DayState = "ON_TIME" | "LATE" | "BACKDATED" | "UNTIMED" | "DRAFT" | "MISSING";

export type LedgerEntry = {
  state: DayState;
  markedAt: string | null;
  byId: string | null;
  roll: number;
  startedAt: Date | null;
  submittedAt: Date | null;
};

export type Ledger = Map<string, Map<string, LedgerEntry>>;

/** A register taken after the cutoff, or on a later day than it is for, is a breach. */
export function stateOfRegister(
  register: { status: string; date: Date; submittedAt: Date | null; backdated: boolean },
  policy: Policy
): DayState {
  if (register.status !== "SUBMITTED") return "DRAFT";
  if (register.backdated) return "BACKDATED";
  if (!register.submittedAt) return "UNTIMED";
  const local = new Date(register.submittedAt.getTime() + 3_600_000);
  const sameDay = iso(dayOf(local)) === iso(register.date);
  if (!sameDay) return "BACKDATED";
  return (lagosClock(register.submittedAt) ?? "00:00") > policy.markCutoff ? "LATE" : "ON_TIME";
}

export const isBreach = (state: DayState) => state === "LATE" || state === "BACKDATED" || state === "MISSING";
export const isTaken = (state: DayState) => state !== "MISSING" && state !== "DRAFT";

export async function buildLedger(schoolId: string, term: TermLike, policy: Policy): Promise<Ledger> {
  const registers = await prisma.attendanceRegister.findMany({
    where: { schoolId, termId: term.id },
    select: { classId: true, date: true, status: true, submittedAt: true, startedAt: true, backdated: true, markedById: true, roll: true }
  });
  const ledger: Ledger = new Map();
  for (const register of registers) {
    const arm = ledger.get(register.classId) ?? new Map<string, LedgerEntry>();
    arm.set(iso(dayOf(register.date)), {
      state: stateOfRegister({ ...register, date: dayOf(register.date) }, policy),
      markedAt: lagosClock(register.submittedAt),
      byId: register.markedById,
      roll: register.roll,
      startedAt: register.startedAt,
      submittedAt: register.submittedAt
    });
    ledger.set(register.classId, arm);
  }
  return ledger;
}

export function entryFor(ledger: Ledger, classId: string, day: Date): LedgerEntry {
  return ledger.get(classId)?.get(iso(day)) ?? { state: "MISSING", markedAt: null, byId: null, roll: 0, startedAt: null, submittedAt: null };
}

/**
 * How a form master is doing across their arms: arm-days owed, breached, and the share taken in
 * time. A register with no recorded clock time counts as taken but is left out of punctuality,
 * because nobody can say whether it was on time.
 */
export function teacherRecord(arms: ArmRow[], ledger: Ledger, days: Date[]) {
  let owed = 0;
  let breached = 0;
  let timed = 0;
  let onTime = 0;
  let missing = 0;
  for (const arm of arms) {
    for (const day of days) {
      owed += 1;
      const state = entryFor(ledger, arm.id, day).state;
      if (state === "UNTIMED") continue;
      if (state === "MISSING" || state === "DRAFT") {
        breached += 1;
        missing += 1;
        timed += 1;
        continue;
      }
      timed += 1;
      if (state === "ON_TIME") onTime += 1;
      else breached += 1;
    }
  }
  return { owed, breached, missing, timed, punctuality: timed ? Math.round((onTime / timed) * 100) : null };
}

export const namesOf = async (schoolId: string, ids: string[]) => {
  const users = ids.length ? await prisma.user.findMany({ where: { schoolId, id: { in: ids } }, select: { id: true, firstName: true, lastName: true } }) : [];
  return new Map(users.map((user) => [user.id, fullName(user)]));
};
