import { Prisma } from "@prisma/client";

import { prisma } from "../../../../src/lib/db/prisma";

/**
 * Small things every part of Fee Management reads the same way, and the one ledger the
 * Collections, History and Review tabs all derive from — so a balance on the debtor list and
 * the same balance on a family's page can never tell different stories.
 */

export const DAY_MS = 86_400_000;

export const num = (value: unknown): number => (value === null || value === undefined ? 0 : Number(value));

export function fullName(user: { firstName: string; lastName: string } | null | undefined): string {
  return user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : "";
}

export function armName(room: { name: string; arm?: string | null } | null | undefined): string {
  if (!room) return "No arm";
  return room.arm && !room.name.endsWith(room.arm) ? `${room.name} ${room.arm}` : room.name;
}

export const daysSince = (date: Date | null | undefined, now = new Date()): number => (date ? Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS)) : 0);

export type Bucket = "Current" | "30 days" | "60 days" | "90+ days";

export function bucketOf(days: number): Bucket {
  return days > 90 ? "90+ days" : days > 60 ? "60 days" : days > 30 ? "30 days" : "Current";
}

/** What the school has actually done about a balance, read from what was sent — never assumed from its age. */
export type Stage = "Not started" | "First reminder" | "Second reminder" | "Meeting requested" | "On a payment plan";

export function stageOf(contacts: Array<{ kind: string; createdAt: Date }>, planActive: boolean): Stage {
  if (planActive) return "On a payment plan";
  if (contacts.some((contact) => contact.kind === "MEETING")) return "Meeting requested";
  const reminders = contacts.filter((contact) => contact.kind === "REMINDER").length;
  return reminders >= 2 ? "Second reminder" : reminders === 1 ? "First reminder" : "Not started";
}

export const PAYMENT_MODE: Record<string, string> = {
  CASH: "Cash at the bursary",
  TRANSFER: "Bank transfer",
  BANK_TRANSFER: "Bank transfer",
  POS: "POS card",
  ONLINE: "Online card",
  USSD: "USSD transfer",
  CHEQUE: "Cheque",
  SCHOLARSHIP: "Scholarship",
  WAIVER: "Waiver"
};

export type LedgerChild = {
  studentId: string;
  name: string;
  adm: string;
  arm: string;
  level: string;
  levelId: string | null;
  section: string;
  boarding: boolean;
  invoices: Array<{
    id: string;
    number: string;
    structureId: string | null;
    structure: string;
    kind: string;
    total: number;
    received: number;
    balance: number;
    issuedOn: Date;
    dueOn: Date;
    status: string;
    termId: string | null;
    items: Array<{ description: string; amount: number }>;
  }>;
  billed: number;
  paid: number;
  owing: number;
};

export type LedgerFamily = {
  id: string;
  guardianId: string | null;
  name: string;
  relation: string;
  phone: string;
  email: string | null;
  portal: "Active" | "Not activated";
  canSms: boolean;
  children: LedgerChild[];
  billed: number;
  paid: number;
  owing: number;
  days: number;
  bucket: Bucket;
  contacts: Array<{ id: string; kind: string; channel: string | null; summary: string; at: Date; meetingAt: Date | null }>;
  stage: Stage;
};

/**
 * Every family with something on the books, built from invoices up. A family is the primary
 * guardian and every child they answer for; a child with nobody on record stands alone.
 */
export async function loadFamilies(schoolId: string, o: { termId?: string | null; includeSettled?: boolean } = {}): Promise<LedgerFamily[]> {
  const invoices = await prisma.invoice.findMany({
    where: { schoolId, status: { not: "VOID" }, ...(o.termId ? { termId: o.termId } : {}) },
    include: {
      student: {
        include: {
          currentClass: { include: { classLevel: true } },
          guardians: { include: { guardian: { include: { user: { select: { lastLoginAt: true } } } } } },
          hostelAllocation: { where: { endDate: null }, select: { id: true } }
        }
      },
      items: true,
      payments: { where: { status: "SUCCESS", isReversed: false }, select: { amount: true } },
      feeStructure: { select: { id: true, name: true, kind: true } }
    }
  });

  const byStudent = new Map<string, LedgerChild & { guardian: (typeof invoices)[number]["student"]["guardians"][number] | null }>();
  for (const invoice of invoices) {
    const student = invoice.student;
    const received = invoice.payments.reduce((sum, payment) => sum + num(payment.amount), 0);
    const row = {
      id: invoice.id,
      number: invoice.invoiceNumber,
      structureId: invoice.feeStructureId,
      structure: invoice.feeStructure?.name ?? "Fees",
      kind: invoice.feeStructure?.kind ?? "Day",
      total: num(invoice.total),
      received,
      balance: num(invoice.balance),
      issuedOn: invoice.issuedOn,
      dueOn: invoice.dueOn,
      status: String(invoice.status),
      termId: invoice.termId,
      items: invoice.items.map((item) => ({ description: item.description, amount: num(item.amount) * item.quantity }))
    };
    const existing = byStudent.get(student.id);
    if (existing) {
      existing.invoices.push(row);
      continue;
    }
    const guardian = student.guardians.find((link) => link.isPrimary) ?? student.guardians[0] ?? null;
    byStudent.set(student.id, {
      studentId: student.id,
      name: fullName(student),
      adm: student.admissionNumber,
      arm: armName(student.currentClass),
      level: student.currentClass?.classLevel?.name ?? student.currentClass?.name ?? "No class",
      levelId: student.currentClass?.classLevelId ?? null,
      section: String(student.currentClass?.classLevel?.schoolSection ?? student.currentClass?.classLevel?.section ?? "Other"),
      boarding: student.hostelAllocation.length > 0,
      invoices: [row],
      billed: 0,
      paid: 0,
      owing: 0,
      guardian
    });
  }

  const families = new Map<string, LedgerFamily>();
  for (const child of byStudent.values()) {
    child.billed = child.invoices.reduce((sum, invoice) => sum + invoice.total, 0);
    child.paid = child.invoices.reduce((sum, invoice) => sum + invoice.received, 0);
    child.owing = child.invoices.reduce((sum, invoice) => sum + invoice.balance, 0);
    const link = child.guardian;
    const key = link ? link.guardianId : `s_${child.studentId}`;
    const guardian = link?.guardian;
    let family = families.get(key);
    if (!family) {
      family = {
        id: key,
        guardianId: guardian?.id ?? null,
        name: guardian ? `${guardian.lastName} family` : `${child.name.split(" ").slice(-1)[0]} family`,
        relation: guardian?.relationship ?? "Guardian",
        phone: guardian?.phone ?? "No phone",
        email: guardian?.email ?? null,
        portal: guardian?.user?.lastLoginAt ? "Active" : "Not activated",
        canSms: guardian?.canReceiveSms ?? false,
        children: [],
        billed: 0,
        paid: 0,
        owing: 0,
        days: 0,
        bucket: "Current",
        contacts: [],
        stage: "Not started"
      };
      families.set(key, family);
    }
    const { guardian: _unused, ...rest } = child;
    void _unused;
    family.children.push(rest);
  }

  const guardianIds = Array.from(families.values()).map((family) => family.guardianId).filter((id): id is string => Boolean(id));
  const [contacts, plans] = await Promise.all([
    guardianIds.length ? prisma.feeContact.findMany({ where: { schoolId, guardianId: { in: guardianIds } }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
    prisma.installmentPlan.findMany({ where: { schoolId, status: { in: ["PENDING", "PARTIALLY_PAID"] } }, select: { studentId: true } })
  ]);
  const planned = new Set(plans.map((plan) => plan.studentId));
  const now = new Date();
  for (const family of families.values()) {
    family.billed = family.children.reduce((sum, child) => sum + child.billed, 0);
    family.paid = family.children.reduce((sum, child) => sum + child.paid, 0);
    family.owing = family.children.reduce((sum, child) => sum + child.owing, 0);
    const owed = family.children.flatMap((child) => child.invoices).filter((invoice) => invoice.balance > 0);
    family.days = owed.length ? Math.max(...owed.map((invoice) => daysSince(invoice.issuedOn, now))) : 0;
    family.bucket = bucketOf(family.days);
    family.contacts = contacts.filter((contact) => contact.guardianId === family.guardianId).map((contact) => ({ id: contact.id, kind: contact.kind, channel: contact.channel, summary: contact.summary, at: contact.createdAt, meetingAt: contact.meetingAt }));
    family.stage = stageOf(family.contacts.map((contact) => ({ kind: contact.kind, createdAt: contact.at })), family.children.some((child) => planned.has(child.studentId)));
  }
  const list = Array.from(families.values());
  return o.includeSettled ? list : list.filter((family) => family.owing > 0);
}

export async function currentTerm(schoolId: string) {
  return prisma.term.findFirst({ where: { schoolId, isCurrent: true }, include: { academicSession: true } });
}

export const jsonValue = (value: unknown) => value as Prisma.InputJsonValue;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export const isoDay = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** A calendar day as the database's date column holds it: UTC midnight, so the day never slips with the server's timezone. */
export const utcDay = (date: Date): string => date.toISOString().slice(0, 10);
export const dayStart = (day: string): Date => new Date(`${day}T00:00:00.000Z`);
