import { prisma } from "../../../src/lib/db/prisma";

/**
 * How the school takes attendance: once a day, once a period, or a mix.
 *
 * It is a School Configuration policy ("Attendance mode"). Everything that asks a teacher for a register asks here first, so a school that
 * chose Daily is never asked for a register for every lesson, and one that chose Per period never has the question go unasked.
 */
export type AttendanceMode = "daily" | "period" | "hybrid";

export const ATTENDANCE_MODE_CODE = "attendance_mode";

export const modeOfValue = (value: unknown): AttendanceMode => {
  const text = String(value ?? "");
  return /^per[\s-]?period/i.test(text) ? "period" : /^hybrid/i.test(text) ? "hybrid" : "daily";
};

export async function attendanceModeOf(schoolId: string): Promise<AttendanceMode> {
  const row = await prisma.configurationItem.findFirst({
    where: { schoolId, resource: "school-policies", code: ATTENDANCE_MODE_CODE, deletedAt: null },
    select: { data: true },
  });
  return modeOfValue((row?.data as { values?: { mode?: unknown } } | null)?.values?.mode);
}

/** The senior classes, where a hybrid school takes a register for each period. */
export const isSeniorClass = (level: { name: string; schoolSection?: string | null }): boolean =>
  level.schoolSection === "SENIOR_SECONDARY" || /^s{2,3}\s*\d/i.test(level.name.trim());

/** Whether a lesson in this class is registered period by period under the school's mode. */
export const takesPeriodRegister = (mode: AttendanceMode, level: { name: string; schoolSection?: string | null }): boolean =>
  mode === "period" || (mode === "hybrid" && isSeniorClass(level));

/** Why there is no period register to take, in words a teacher can act on — or null when there is one. */
export const noPeriodRegisterBecause = (mode: AttendanceMode): string | null =>
  mode === "daily"
    ? "This school takes attendance once a day, so there is no register for each period. The form master takes the daily register."
    : mode === "hybrid"
      ? "This school takes a register for each period only in its senior classes; the daily register covers the rest."
      : null;
