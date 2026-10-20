import type { Prisma } from "@prisma/client";

/**
 * A new school arrives with a sample class (admission numbers SMP-001…). It is demonstration, not a customer's pupils,
 * so nothing the platform reports about schools — students served, revenue per student, usage — counts it.
 */
export const SAMPLE_ADMISSION_PREFIX = "SMP-";

export const REAL_STUDENTS: Prisma.StudentWhereInput = { NOT: { admissionNumber: { startsWith: SAMPLE_ADMISSION_PREFIX } } };
