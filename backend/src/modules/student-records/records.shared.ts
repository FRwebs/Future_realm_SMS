import { prisma } from "../../../../src/lib/db/prisma";
import { DAY_MS, armName, currentTerm, daysSince, fullName, num } from "../fee-management/fees.shared";

export { DAY_MS, armName, currentTerm, daysSince, fullName, num };

/**
 * What every part of Student Records and Parents & Guardians reads the same way. A figure that
 * appears on the registry, on the child's own page and on their guardian's page is computed
 * once, here, so the three can never disagree.
 */

export const OWNERS = new Set(["SCHOOL_OWNER", "PROPRIETOR", "SUPER_ADMIN"]);
export const LEADERS = new Set(["SCHOOL_OWNER", "PROPRIETOR", "SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL_ACADEMICS", "VICE_PRINCIPAL_ADMINISTRATION", "VICE_PRINCIPAL_SPECIAL_DUTIES"]);
/** Who may open the full health and welfare record — in addition to the leadership. */
export const WELFARE = new Set(["SCHOOL_NURSE", "GUIDANCE_COUNSELOR", "GUIDANCE_COUNSELLOR"]);

export type StudentState = "Enrolled" | "Blocked" | "Withdrawn" | "Alumni";

export function stateOf(status: string): StudentState {
  switch (status) {
    case "WITHDRAWN":
      return "Withdrawn";
    case "GRADUATED":
    case "ALUMNI":
      return "Alumni";
    case "SUSPENDED":
      return "Blocked";
    default:
      return "Enrolled";
  }
}

export const STATE_TO_STATUS: Record<string, string> = { Enrolled: "ACTIVE", Blocked: "SUSPENDED", Withdrawn: "WITHDRAWN", Alumni: "ALUMNI" };

export type Portal = "Active" | "Not activated";

/** A login that has been used is active. Everything else — never created, never opened — is not. */
export function portalOf(user: { lastLoginAt: Date | null } | null | undefined): Portal {
  return user?.lastLoginAt ? "Active" : "Not activated";
}

export function ageOf(date: Date | null | undefined, now = new Date()): number {
  if (!date) return 0;
  let years = now.getFullYear() - date.getFullYear();
  const beforeBirthday = now.getMonth() < date.getMonth() || (now.getMonth() === date.getMonth() && now.getDate() < date.getDate());
  if (beforeBirthday) years -= 1;
  return Math.max(0, years);
}

export const genderLabel = (gender: string) => (gender === "MALE" ? "Male" : gender === "FEMALE" ? "Female" : "Other");

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/**
 * The invoices that speak for "this term": the term's own, any raised with no term at all, and
 * anything from an earlier term still unpaid — so a balance reads the same here as it does on the
 * debtor list.
 */
export function relevantInvoice(invoice: { termId: string | null; balance: unknown }, termId: string | null | undefined): boolean {
  return !termId || invoice.termId === termId || invoice.termId === null || num(invoice.balance) > 0;
}

export type FeeState = "Paid" | "Part paid" | "Outstanding" | "Not billed";

export function feeStateOf(invoices: Array<{ total: unknown; balance: unknown; status?: string }>): FeeState {
  const live = invoices.filter((invoice) => invoice.status !== "VOID" && invoice.status !== "CANCELLED");
  if (!live.length) return "Not billed";
  const total = live.reduce((sum, invoice) => sum + num(invoice.total), 0);
  const balance = live.reduce((sum, invoice) => sum + num(invoice.balance), 0);
  if (balance <= 0) return "Paid";
  return balance < total ? "Part paid" : "Outstanding";
}

/** The school's active grading bands, highest first, so a score can be named the way the school names it. */
export async function gradeBands(schoolId: string): Promise<Array<{ label: string; min: number; max: number; remark: string }>> {
  const scheme =
    (await prisma.gradingScheme.findFirst({ where: { schoolId, isActive: true }, include: { bands: true } })) ??
    (await prisma.gradingScheme.findFirst({ where: { schoolId }, include: { bands: true }, orderBy: { createdAt: "asc" } }));
  return (scheme?.bands ?? []).map((band) => ({ label: band.label, min: band.minScore, max: band.maxScore, remark: band.remark })).sort((a, b) => b.min - a.min);
}

export function gradeOf(bands: Array<{ label: string; min: number; max: number }>, score: number | null): string {
  if (score === null || Number.isNaN(score)) return "—";
  const hit = bands.find((band) => score >= band.min && score <= band.max) ?? bands.find((band) => score >= band.min);
  return hit?.label ?? "—";
}

export const STANDING = (score: number, classAverage: number): string =>
  score >= classAverage + 8 ? "Well above the class" : score >= classAverage ? "Above the class" : score >= classAverage - 8 ? "Around the class" : "Below the class";

/** A Nigerian mobile number, in any of the ways people write one. */
export function normalPhone(value: string | null | undefined): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("234")) return `0${digits.slice(3)}`;
  return digits;
}

export const validMobile = (value: string | null | undefined): boolean => /^0[789][01]\d{8}$/.test(normalPhone(value));

export function dayText(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** The next admission number in the school's own pattern, never one that is already taken. */
export async function nextAdmissionNumber(schoolId: string): Promise<string> {
  const year = String(new Date().getFullYear()).slice(-2);
  const existing = await prisma.student.findMany({ where: { schoolId, admissionNumber: { startsWith: "GFC/" } }, select: { admissionNumber: true } });
  const taken = new Set(existing.map((row) => row.admissionNumber));
  let prefix = `${year}`;
  const sample = existing.map((row) => row.admissionNumber).find((value) => /^[A-Z]+\/\d{2}\/\d+$/.test(value));
  const head = sample ? sample.split("/")[0] : "GFC";
  prefix = `${head}/${year}`;
  let highest = 0;
  for (const value of taken) {
    const match = value.match(new RegExp(`^${head}/${year}/(\\d+)$`));
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  let next = highest + 1;
  while (taken.has(`${prefix}/${String(next).padStart(4, "0")}`)) next += 1;
  return `${prefix}/${String(next).padStart(4, "0")}`;
}

export const ok = async <T>(dataPromise: Promise<T>, message?: string) => ({ ok: true, success: true, ...(message ? { message } : {}), data: await dataPromise });
