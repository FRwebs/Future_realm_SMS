import { randomBytes } from "crypto";

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

import { verifyTotp } from "../../../../src/lib/auth/mfa";
import { verifyPassword } from "../../../../src/lib/auth/password";
import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { fullName } from "../student-records/records.shared";
import { OWNERS, json, schoolOf, tierOf } from "./billing.shared";

/**
 * The account: the rare, consequential settings. The agreement the school holds with Future
 * Realm, who is written to, who owns the school — and the two things that cannot be done lightly:
 * taking everything out, and closing.
 */

export const DATASETS = ["Students", "Staff", "Guardians", "Scores", "Attendance", "Payments", "Messages", "Consents", "Audit log"] as const;
type Dataset = (typeof DATASETS)[number];

const preferencesSchema = z.object({
  billingContact: z.string().trim().min(3, "Name the billing contact."),
  billingEmail: z.string().email("Give the billing contact's email."),
  schoolContact: z.string().trim().optional(),
  dpoName: z.string().trim().optional(),
  dpoEmail: z.string().optional(),
  comms: z.string().default("Product and billing only")
});

const transferSchema = z.object({
  basis: z.string().min(1),
  document: z.string().trim().min(3, "Name the document that evidences the transfer."),
  summary: z.string().trim().min(10, "Summarise the transfer for the record."),
  name: z.string().trim().min(3, "Give the incoming owner's full name."),
  email: z.string().email("Give the incoming owner's email."),
  phone: z.string().trim().min(10, "Give the incoming owner's phone number.")
});

const exportSchema = z.object({ datasets: z.array(z.string()).min(1, "Choose what to take."), password: z.string().min(1, "Enter your password to continue."), code: z.string().optional() });
const closureSchema = z.object({ reason: z.string().trim().min(10, "Say why the school is closing its account."), confirm: z.coerce.boolean().refine((value) => value, "Confirm that you understand closure.") });
const agreementSchema = z.object({ version: z.string().default("4.0"), understood: z.coerce.boolean().refine((value) => value, "Confirm that you have read the agreement.") });

const csvRow = (cells: unknown[]) => cells.map((cell) => (cell === null || cell === undefined ? "" : /[",\n\r]/.test(String(cell)) ? `"${String(cell).replace(/"/g, '""')}"` : String(cell))).join(",");
const iso = (date: Date | null | undefined) => (date ? date.toISOString().slice(0, 19).replace("T", " ") : "");

@Injectable()
export class AccountService {
  private owner(session: SessionPayload) {
    if (!OWNERS.has(session.role)) throw new ForbiddenException("Only the Proprietor can do this.");
  }

  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata: Record<string, unknown>) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType, entityId, metadata: json(metadata) } });
  }

  async overview(session: SessionPayload) {
    const schoolId = session.schoolId;
    const school = await schoolOf(schoolId);
    const sub = school.schoolSubscription;
    const [manager, accepter, principal, transfers, exports, closures, counts] = await Promise.all([
      school.accountManagerId ? prisma.user.findUnique({ where: { id: school.accountManagerId }, select: { firstName: true, lastName: true, email: true } }) : Promise.resolve(null),
      school.dpaAcceptedById ? prisma.user.findUnique({ where: { id: school.dpaAcceptedById }, select: { firstName: true, lastName: true, role: true } }) : Promise.resolve(null),
      prisma.user.findFirst({ where: { schoolId, role: "PRINCIPAL", isActive: true }, select: { firstName: true, lastName: true } }),
      prisma.ownershipTransfer.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.fullExport.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.accountClosureRequest.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 3 }),
      this.counts(schoolId)
    ]);
    const inForce = await prisma.dpaVersion.findFirst({ where: { isCurrent: true }, select: { version: true } });
    const open = transfers.find((row) => !["EXECUTED", "FROZEN"].includes(row.status)) ?? null;
    const delivered = exports.find((row) => row.downloadedAt) ?? null;
    return {
      school: { name: school.name, ownerName: school.ownerName, ownerEmail: school.ownerEmail, country: school.country },
      agreement: { status: school.dpaStatus, version: school.dpaVersion, current: inForce?.version ?? null, acceptedAt: school.dpaAcceptedAt?.toISOString() ?? null, by: accepter ? `${fullName(accepter)} · ${String(accepter.role).replace(/_/g, " ").toLowerCase()}` : null, hosting: sub?.hosting ?? null, retentionDays: sub?.retentionDays ?? 90, retentionDefault: sub?.retentionDays === null || sub?.retentionDays === undefined, dpo: sub?.dpoName ? { name: sub.dpoName, email: sub.dpoEmail } : null },
      contacts: { billing: sub?.billingContact ?? school.ownerName, billingEmail: sub?.billingEmail ?? school.ownerEmail, school: sub?.schoolContact ?? (principal ? `${fullName(principal)} · Principal` : null), manager: manager ? fullName(manager) : null, managerEmail: manager?.email ?? null, productOnly: sub?.productOnly ?? true },
      address: { subdomain: school.subdomain, issued: school.createdAt.toISOString() },
      tier: tierOf(school),
      transfer: open ? { id: open.id, status: open.status, createdAt: open.createdAt.toISOString(), holdExpiresAt: open.holdExpiresAt?.toISOString() ?? null } : null,
      transfers: transfers.map((row) => ({ id: row.id, status: row.status, createdAt: row.createdAt.toISOString() })),
      exports: exports.map((row) => ({ id: row.id, token: row.token, datasets: row.datasets as string[], rows: row.rows, expiresAt: row.expiresAt.toISOString(), downloadedAt: row.downloadedAt?.toISOString() ?? null, expired: row.expiresAt < new Date(), createdAt: row.createdAt.toISOString() })),
      exportDelivered: Boolean(delivered),
      closure: closures[0] ? { status: closures[0].status, createdAt: closures[0].createdAt.toISOString(), retentionDays: closures[0].retentionDays } : null,
      counts,
      datasets: DATASETS,
      canOwn: OWNERS.has(session.role),
      userMfa: Boolean((await prisma.user.findUnique({ where: { id: session.userId }, select: { mfaEnabled: true } }))?.mfaEnabled)
    };
  }

  private async counts(schoolId: string): Promise<Record<Dataset, number>> {
    const [students, staff, guardians, scores, attendance, payments, messages, consents, audit] = await Promise.all([
      prisma.student.count({ where: { schoolId } }),
      prisma.user.count({ where: { schoolId, role: { notIn: ["PARENT", "STUDENT"] } } }),
      prisma.guardian.count({ where: { schoolId } }),
      prisma.scoreEntry.count({ where: { schoolId } }),
      prisma.studentAttendance.count({ where: { schoolId } }),
      prisma.payment.count({ where: { schoolId } }),
      prisma.notificationLog.count({ where: { schoolId } }),
      prisma.familyConsent.count({ where: { schoolId } }),
      prisma.auditLog.count({ where: { schoolId } })
    ]);
    return { Students: students, Staff: staff, Guardians: guardians, Scores: scores, Attendance: attendance, Payments: payments, Messages: messages, Consents: consents, "Audit log": audit };
  }

  /* ───────────────────────── the agreement and the contacts ───────────────────────── */

  async acceptAgreement(session: SessionPayload, body: unknown) {
    this.owner(session);
    const input = agreementSchema.parse(body);
    // The version a school accepts is the one in force, not whatever the browser says it read.
    const inForce = await prisma.dpaVersion.findFirst({ where: { isCurrent: true } });
    if (inForce) input.version = inForce.version;
    await prisma.school.update({ where: { id: session.schoolId }, data: { dpaStatus: "SIGNED", dpaVersion: input.version, dpaAcceptedAt: new Date(), dpaAcceptedById: session.userId } });
    await this.audit(session, AuditAction.SETTINGS_UPDATE, "School", session.schoolId, { summary: `Data processing agreement accepted · version ${input.version}` });
    return { version: input.version };
  }

  async savePreferences(session: SessionPayload, body: unknown) {
    const input = preferencesSchema.parse(body);
    const school = await schoolOf(session.schoolId);
    const data = { billingContact: input.billingContact, billingEmail: input.billingEmail, schoolContact: input.schoolContact || null, dpoName: input.dpoName || null, dpoEmail: input.dpoEmail || null, productOnly: input.comms.startsWith("Product") };
    await prisma.schoolSubscription.upsert({ where: { schoolId: session.schoolId }, update: data, create: { schoolId: session.schoolId, tier: tierOf(school), ...data } });
    await this.audit(session, AuditAction.SETTINGS_UPDATE, "SchoolSubscription", session.schoolId, { summary: "Billing contacts and preferences saved" });
    return { saved: true };
  }

  /* ───────────────────────── ownership ───────────────────────── */

  /** A request, never a field edit: the incoming owner gets a new account, and Future Realm approves. */
  async requestTransfer(session: SessionPayload, body: unknown) {
    this.owner(session);
    const input = transferSchema.parse(body);
    const open = await prisma.ownershipTransfer.findFirst({ where: { schoolId: session.schoolId, status: { notIn: ["EXECUTED", "FROZEN"] } } });
    if (open) throw new BadRequestException("A transfer is already in progress for this school.");
    const created = await prisma.ownershipTransfer.create({
      data: { schoolId: session.schoolId, outgoingOwnerId: session.userId, triggerType: "VOLUNTARY_SALE", evidenceNotes: `${input.basis}. ${input.summary}\nDocument: ${input.document}\nIncoming owner: ${input.name} · ${input.email} · ${input.phone}` }
    });
    await this.audit(session, AuditAction.SETTINGS_UPDATE, "OwnershipTransfer", created.id, { summary: `Ownership transfer requested · ${input.basis}`, incoming: input.email });
    return { id: created.id };
  }

  /* ───────────────────────── the full export ───────────────────────── */

  async createExport(session: SessionPayload, body: unknown) {
    const input = exportSchema.parse(body);
    const schoolId = session.schoolId;
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || !verifyPassword(input.password, user.passwordHash)) throw new ForbiddenException("That password is not right. One compromised account must not extract every child's record.");
    if (user.mfaEnabled) {
      if (!input.code) throw new BadRequestException("Enter the six-digit code from your authenticator app.");
      const backup = user.mfaBackupCodeHashes.some((hash) => verifyPassword(input.code as string, hash));
      if (!(user.mfaSecret && verifyTotp(input.code, user.mfaSecret)) && !backup) throw new ForbiddenException("That code is not right.");
    }
    const datasets = input.datasets.filter((name): name is Dataset => (DATASETS as readonly string[]).includes(name));
    if (!datasets.length) throw new BadRequestException("Choose what to take.");
    const counts = await this.counts(schoolId);
    const rows = datasets.reduce((sum, name) => sum + counts[name], 0);
    const grant = await prisma.fullExport.create({ data: { schoolId, requestedById: session.userId, token: randomBytes(18).toString("hex"), datasets: json(datasets), rows, expiresAt: new Date(Date.now() + 24 * 3_600_000) } });
    await this.audit(session, AuditAction.EXPORT, "FullExport", grant.id, { summary: `Full-school export requested · ${datasets.length} datasets · ${rows} rows`, mfa: user.mfaEnabled });
    // The leadership is told straight away — a full export is the one action that must never be quiet.
    const leaders = await prisma.user.findMany({ where: { schoolId, isActive: true, role: { in: ["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL"] } }, select: { id: true } });
    if (leaders.length) await prisma.notificationLog.createMany({ data: leaders.map((leader) => ({ schoolId, userId: leader.id, channel: "IN_APP" as const, title: "A full-school export was generated", body: `${fullName(user)} generated an export of ${datasets.length} datasets (${rows.toLocaleString("en-NG")} rows). It is logged, and expires in 24 hours.`, status: "QUEUED", sentAt: new Date() })) });
    return { token: grant.token, datasets, rows, notified: leaders.length, expiresAt: grant.expiresAt.toISOString() };
  }

  async exportGrant(session: SessionPayload, token: string) {
    const grant = await prisma.fullExport.findFirst({ where: { token, schoolId: session.schoolId } });
    if (!grant) throw new NotFoundException("That export does not exist.");
    if (grant.expiresAt < new Date()) throw new BadRequestException("That export has expired. Generate a new one.");
    const counts = await this.counts(session.schoolId);
    return { token, datasets: (grant.datasets as string[]).map((name) => ({ name, rows: counts[name as Dataset] ?? 0 })), expiresAt: grant.expiresAt.toISOString(), downloadedAt: grant.downloadedAt?.toISOString() ?? null };
  }

  /** One dataset as a CSV a spreadsheet opens. Taking it marks the export delivered, which is what unblocks closure. */
  async dataset(session: SessionPayload, token: string, name: string) {
    const schoolId = session.schoolId;
    const grant = await prisma.fullExport.findFirst({ where: { token, schoolId } });
    if (!grant) throw new NotFoundException("That export does not exist.");
    if (grant.expiresAt < new Date()) throw new BadRequestException("That export has expired. Generate a new one.");
    if (!(grant.datasets as string[]).includes(name)) throw new BadRequestException("That dataset is not part of this export.");
    const data = await this.rows(schoolId, name as Dataset);
    await prisma.fullExport.update({ where: { id: grant.id }, data: { downloadedAt: grant.downloadedAt ?? new Date() } });
    await this.audit(session, AuditAction.EXPORT, "FullExport", grant.id, { summary: `Export downloaded · ${name}` });
    return [csvRow(data.head), ...data.rows.map(csvRow)].join("\r\n") + "\r\n";
  }

  private async rows(schoolId: string, name: Dataset): Promise<{ head: string[]; rows: unknown[][] }> {
    switch (name) {
      case "Students": {
        const rows = await prisma.student.findMany({ where: { schoolId }, include: { currentClass: true }, orderBy: { admissionNumber: "asc" } });
        return { head: ["Admission number", "First name", "Middle name", "Last name", "Gender", "Date of birth", "Admitted", "Status", "Class", "Nationality", "State of origin", "Address", "Previous school"], rows: rows.map((r) => [r.admissionNumber, r.firstName, r.middleName, r.lastName, r.gender, iso(r.dateOfBirth), iso(r.admissionDate), r.status, r.currentClass ? `${r.currentClass.name} ${r.currentClass.arm}` : "", r.nationality, r.stateOfOrigin, r.address, r.previousSchool]) };
      }
      case "Staff": {
        const rows = await prisma.user.findMany({ where: { schoolId, role: { notIn: ["PARENT", "STUDENT"] } }, orderBy: { lastName: "asc" } });
        return { head: ["First name", "Last name", "Email", "Phone", "Role", "Active", "Last sign-in"], rows: rows.map((r) => [r.firstName, r.lastName, r.email, r.phone, r.role, r.isActive, iso(r.lastLoginAt)]) };
      }
      case "Guardians": {
        const rows = await prisma.guardian.findMany({ where: { schoolId }, include: { students: { include: { student: { select: { admissionNumber: true } } } } }, orderBy: { lastName: "asc" } });
        return { head: ["First name", "Last name", "Relationship", "Phone", "Email", "Occupation", "Address", "Children"], rows: rows.map((r) => [r.firstName, r.lastName, r.relationship, r.phone, r.email, r.occupation, r.address, r.students.map((s) => s.student.admissionNumber).join("; ")]) };
      }
      case "Scores": {
        const rows = await prisma.scoreEntry.findMany({ where: { schoolId }, include: { student: { select: { admissionNumber: true } }, subject: { select: { name: true } }, assessmentComponent: { select: { name: true } }, resultSheet: { select: { term: { select: { name: true } } } } } });
        return { head: ["Admission number", "Term", "Subject", "Component", "Score", "Maximum", "Recorded"], rows: rows.map((r) => [r.student.admissionNumber, r.resultSheet.term.name, r.subject.name, r.assessmentComponent.name, r.score, r.maxScore, iso(r.recordedAt)]) };
      }
      case "Attendance": {
        const rows = await prisma.studentAttendance.findMany({ where: { schoolId }, include: { student: { select: { admissionNumber: true } } }, orderBy: { date: "asc" } });
        return { head: ["Admission number", "Date", "Mark", "Reason"], rows: rows.map((r) => [r.student.admissionNumber, iso(r.date).slice(0, 10), r.status, r.reason]) };
      }
      case "Payments": {
        const rows = await prisma.payment.findMany({ where: { schoolId }, include: { student: { select: { admissionNumber: true } } }, orderBy: { paidAt: "asc" } });
        return { head: ["Admission number", "Reference", "Amount", "Method", "Status", "Paid", "Receipt"], rows: rows.map((r) => [r.student.admissionNumber, r.reference, r.amount.toString(), r.method, r.status, iso(r.paidAt), r.receiptNumber]) };
      }
      case "Messages": {
        const rows = await prisma.notificationLog.findMany({ where: { schoolId }, orderBy: { sentAt: "asc" } });
        return { head: ["Sent", "Channel", "Title", "Status"], rows: rows.map((r) => [iso(r.sentAt), r.channel, r.title, r.status]) };
      }
      case "Consents": {
        const rows = await prisma.familyConsent.findMany({ where: { schoolId }, include: { guardian: { select: { firstName: true, lastName: true, phone: true } } } });
        return { head: ["Guardian", "Phone", "Consent", "Status", "Means", "Recorded"], rows: rows.map((r) => [`${r.guardian.firstName} ${r.guardian.lastName}`, r.guardian.phone, r.typeCode, r.status, r.means, iso(r.recordedAt)]) };
      }
      default: {
        const rows = await prisma.auditLog.findMany({ where: { schoolId }, orderBy: { createdAt: "asc" } });
        return { head: ["When", "Action", "Entity", "Entity id", "Actor"], rows: rows.map((r) => [iso(r.createdAt), r.action, r.entityType, r.entityId, r.actorId]) };
      }
    }
  }

  /* ───────────────────────── closure ───────────────────────── */

  async requestClosure(session: SessionPayload, body: unknown) {
    this.owner(session);
    const input = closureSchema.parse(body);
    const schoolId = session.schoolId;
    const delivered = await prisma.fullExport.findFirst({ where: { schoolId, downloadedAt: { not: null } }, orderBy: { downloadedAt: "desc" } });
    if (!delivered) throw new BadRequestException("Closure is blocked until a full-school export has been generated and downloaded.");
    if (await prisma.accountClosureRequest.findFirst({ where: { schoolId, status: "REQUESTED" } })) throw new BadRequestException("A closure request is already waiting.");
    const created = await prisma.accountClosureRequest.create({ data: { schoolId, requestedById: session.userId, exportId: delivered.id, reason: input.reason } });
    await this.audit(session, AuditAction.SETTINGS_UPDATE, "AccountClosureRequest", created.id, { summary: "Account closure requested", reason: input.reason });
    return { id: created.id, retentionDays: created.retentionDays };
  }
}
