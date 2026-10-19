import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AuditAction,
  ComplianceReturnStatus,
  DataSubjectRequestKind,
  DataSubjectRequestStatus,
  IntegrityFlagStatus,
  IntegritySeverity,
} from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

/**
 * The record-shaped half of M14 Compliance and M15 Audit & Security.
 *
 * Everything the existing audit service answers is derived — how many students
 * have a date of birth, how many guardians have consent. That is the right way
 * to answer "can this return be produced". It cannot answer "what does this
 * school owe, to whom, by when", because a return is a thing somebody tracks,
 * not a thing you can count your way to. Same for a subject access request,
 * a retention rule, and a flag somebody has to clear.
 */

const DAY = 86_400_000;

const returnSchema = z.object({
  name: z.string().trim().min(3),
  body: z.string().trim().min(2),
  period: z.string().trim().min(2),
  dueOn: z.string().datetime(),
  format: z.string().trim().min(2),
  covers: z.string().trim().min(3),
  ownerRole: z.string().trim().optional(),
});

const fileSchema = z.object({
  action: z.enum(["FILE", "START", "BLOCK", "REOPEN"]),
  note: z.string().trim().optional(),
});

const dsrSchema = z.object({
  kind: z.nativeEnum(DataSubjectRequestKind),
  requesterName: z.string().trim().min(2, "Name who is asking."),
  subjectName: z.string().trim().optional(),
  dueDays: z.number().int().min(1).max(90).optional(),
});

const dsrDecisionSchema = z.object({
  action: z.enum(["RESPOND", "CLOSE", "REFUSE"]),
  outcome: z.string().trim().min(4, "Say what was done, in a sentence."),
});

const flagSchema = z.object({
  action: z.enum(["RESOLVE", "DISMISS"]),
  resolution: z.string().trim().min(4, "Say what was found, or it cannot be audited later."),
});

/**
 * The returns a Nigerian school owes as a matter of course.
 *
 * Seeded per school the first time the tab is opened, the same way the
 * notification rules are: a school that has never touched this page still owes
 * these, and a deadline nobody has written down is the one that gets missed.
 * Dates are set relative to the current session so a demo school is never
 * looking at a calendar from two years ago.
 */
const STANDARD_RETURNS: Array<{
  name: string;
  body: string;
  monthsOut: number;
  format: string;
  covers: string;
  ownerRole: string;
}> = [
  {
    name: "Annual school census",
    body: "Ministry of Education",
    monthsOut: 2,
    format: "Ministry template · Excel",
    covers: "Enrolment by class, gender and age; staff numbers by qualification; facilities",
    ownerRole: "Registrar",
  },
  {
    name: "Termly enrolment return",
    body: "State Universal Basic Education Board",
    monthsOut: 1,
    format: "Board portal · CSV",
    covers: "Enrolment, admissions, withdrawals and transfers this term",
    ownerRole: "Registrar",
  },
  {
    name: "Examination entry file",
    body: "WAEC · West African Examinations Council",
    monthsOut: 3,
    format: "WAEC schema · fixed width",
    covers: "Candidate names, dates of birth, subjects and photographs",
    ownerRole: "Exam Officer",
  },
  {
    name: "Attendance compliance return",
    body: "Ministry of Education",
    monthsOut: 2,
    format: "Ministry template · PDF",
    covers: "Attendance by class, chronic absence cases and actions taken",
    ownerRole: "Principal",
  },
  {
    name: "Safeguarding and child protection audit",
    body: "Independent Schools Inspectorate",
    monthsOut: 5,
    format: "Inspectorate checklist · PDF",
    covers: "Safeguarding checks on staff, incident log, policy version and training records",
    ownerRole: "Principal",
  },
  {
    name: "Data protection register",
    body: "Nigeria Data Protection Commission",
    monthsOut: 7,
    format: "NDPC form · PDF",
    covers: "What personal data is held, on what basis, for how long, and who can reach it",
    ownerRole: "Data Protection Officer",
  },
  {
    name: "Staff qualification return",
    body: "Teachers Registration Council",
    monthsOut: 1,
    format: "TRC portal · CSV",
    covers: "Every teacher, their qualifications and their registration number",
    ownerRole: "Registrar",
  },
  {
    name: "Financial statement for the board",
    body: "School Board of Governors",
    monthsOut: 4,
    format: "Board format · PDF",
    covers: "Fees billed, collected and outstanding; waivers and write-offs; subscription costs",
    ownerRole: "Bursar",
  },
];

/** What the mockup's retention schedule holds, and the basis for each. */
const STANDARD_RETENTION: Array<{
  dataClass: string;
  years: number | null;
  untilAge: number | null;
  basis: string;
}> = [
  { dataClass: "Student academic record", years: null, untilAge: null, basis: "Legitimate interest · a transcript may be requested decades later" },
  { dataClass: "Attendance records", years: 7, untilAge: null, basis: "Education authority requirement" },
  { dataClass: "Financial records", years: 7, untilAge: null, basis: "Tax and audit requirement" },
  { dataClass: "Health and welfare notes", years: null, untilAge: 25, basis: "Explicit consent · sensitive category" },
  { dataClass: "Safeguarding records", years: null, untilAge: 25, basis: "Legal obligation · sensitive category" },
  { dataClass: "Message and delivery logs", years: 2, untilAge: null, basis: "Legitimate interest · dispute resolution" },
  { dataClass: "Audit log", years: 10, untilAge: null, basis: "Legal obligation · immutable" },
];

@Injectable()
export class GovernanceService {
  ok<T>(data: Promise<T> | T, message = "Request completed") {
    return Promise.resolve(data).then((resolved) => ({ ok: true, success: true, message, data: resolved }));
  }

  private daysUntil(date: Date): number {
    return Math.ceil((date.getTime() - Date.now()) / DAY);
  }

  /**
   * What blocks a return, counted from the records themselves.
   *
   * A missing transfer certificate is not a filing problem — it is a record
   * problem that only becomes urgent the week a return is due, which is why
   * this is counted here rather than discovered then.
   */
  private async gaps(schoolId: string) {
    const [noPhoto, noArm, noConsent, staffNoNumber] = await Promise.all([
      prisma.student.count({ where: { schoolId, OR: [{ photoUrl: null }, { photoUrl: "" }] } }),
      prisma.student.count({ where: { schoolId, currentClassId: null } }),
      prisma.guardian.count({ where: { schoolId, consents: { none: {} } } }),
      prisma.staffProfile.count({ where: { schoolId, employeeNo: "" } }),
    ]);

    return [
      { what: "Student photographs", count: noPhoto, blocks: "Examination entry file", fix: "Student Records · Registry" },
      { what: "Students with no class arm", count: noArm, blocks: "Annual school census · enrolment by class", fix: "Student Records · Registry" },
      { what: "Guardians with no consent on file", count: noConsent, blocks: "Data protection register", fix: "Parents & Guardians" },
      { what: "Staff with no employee number", count: staffNoNumber, blocks: "Staff qualification return", fix: "Staff & Access · Directory" },
    ].filter((gap) => gap.count > 0);
  }

  async complianceReturns(session: SessionPayload) {
    const schoolId = session.schoolId;
    const existing = await prisma.complianceReturn.count({ where: { schoolId } });

    if (existing === 0) {
      const term = await prisma.term.findFirst({
        where: { isCurrent: true, academicSession: { schoolId } },
        select: { name: true, academicSession: { select: { name: true } } },
      });
      const period = term ? `${term.name} ${term.academicSession?.name ?? ""}`.trim() : "Current session";
      const now = new Date();
      await prisma.complianceReturn.createMany({
        data: STANDARD_RETURNS.map((item) => ({
          schoolId,
          name: item.name,
          body: item.body,
          period,
          dueOn: new Date(now.getFullYear(), now.getMonth() + item.monthsOut, 28),
          format: item.format,
          covers: item.covers,
          ownerRole: item.ownerRole,
        })),
        skipDuplicates: true,
      });
    }

    const [rows, gaps] = await Promise.all([
      prisma.complianceReturn.findMany({ where: { schoolId }, orderBy: { dueOn: "asc" } }),
      this.gaps(schoolId),
    ]);

    const blockedNames = new Set(gaps.map((gap) => gap.blocks.split(" · ")[0]));

    const returns = rows.map((row) => {
      const days = this.daysUntil(row.dueOn);
      // A return is blocked by data, not by somebody's opinion of it, so the
      // state is recomputed against the gaps on every read.
      const blockedBy = gaps.filter((gap) => row.name.startsWith(gap.blocks.split(" · ")[0]));
      const blocked = row.status !== ComplianceReturnStatus.FILED && blockedNames.has(row.name);
      return {
        id: row.id,
        name: row.name,
        body: row.body,
        period: row.period,
        dueOn: row.dueOn.toISOString(),
        days,
        format: row.format,
        covers: row.covers,
        status: blocked ? ComplianceReturnStatus.BLOCKED : row.status,
        filedOn: row.filedOn?.toISOString() ?? null,
        ownerRole: row.ownerRole,
        ready: !blocked,
        blocker: blockedBy.length
          ? blockedBy.map((gap) => `${gap.count} ${gap.what.toLowerCase()}`).join(", ")
          : null,
      };
    });

    const open = returns.filter((item) => item.status !== ComplianceReturnStatus.FILED);
    return {
      stats: {
        tracked: returns.length,
        bodies: new Set(returns.map((item) => item.body)).size,
        dueSoon: open.filter((item) => item.days <= 35).length,
        blocked: returns.filter((item) => !item.ready).length,
        ready: open.filter((item) => item.ready).length,
        filed: returns.filter((item) => item.status === ComplianceReturnStatus.FILED).length,
        nextDays: open.length ? Math.min(...open.map((item) => item.days)) : null,
      },
      returns,
      gaps,
    };
  }

  async updateReturn(session: SessionPayload, id: string, payload: unknown) {
    const parsed = fileSchema.parse(payload);
    const row = await prisma.complianceReturn.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!row) throw new NotFoundException("That return is not tracked for this school.");

    if (parsed.action === "FILE") {
      const { returns } = await this.complianceReturns(session);
      const current = returns.find((item) => item.id === id);
      // Filing short is worse than filing late: refuse rather than produce a
      // return the body will bounce.
      if (current && !current.ready) {
        throw new BadRequestException(
          `This return cannot be filed yet — ${current.blocker}. Fix the records first.`,
        );
      }
    }

    const status =
      parsed.action === "FILE"
        ? ComplianceReturnStatus.FILED
        : parsed.action === "START"
          ? ComplianceReturnStatus.IN_PROGRESS
          : parsed.action === "BLOCK"
            ? ComplianceReturnStatus.BLOCKED
            : ComplianceReturnStatus.NOT_STARTED;

    const updated = await prisma.complianceReturn.update({
      where: { id },
      data: {
        status,
        filedOn: parsed.action === "FILE" ? new Date() : null,
        ownerId: session.userId,
      },
    });
    return { id: updated.id, status: updated.status };
  }

  async createReturn(session: SessionPayload, payload: unknown) {
    const parsed = returnSchema.parse(payload);
    const created = await prisma.complianceReturn.create({
      data: {
        schoolId: session.schoolId,
        name: parsed.name,
        body: parsed.body,
        period: parsed.period,
        dueOn: new Date(parsed.dueOn),
        format: parsed.format,
        covers: parsed.covers,
        ownerRole: parsed.ownerRole,
        ownerId: session.userId,
      },
    });
    return { id: created.id };
  }

  /* ─────────────── Data protection ─────────────── */

  async dataSubjectRequests(session: SessionPayload) {
    const schoolId = session.schoolId;
    const [rows, retention, consentHeld, consentTotal, incidents] = await Promise.all([
      prisma.dataSubjectRequest.findMany({
        where: { schoolId },
        orderBy: [{ status: "asc" }, { receivedOn: "asc" }],
        include: { owner: { select: { firstName: true, lastName: true, role: true } } },
      }),
      this.retention(session),
      prisma.guardian.count({ where: { schoolId, consents: { some: {} } } }),
      prisma.guardian.count({ where: { schoolId } }),
      prisma.integrityFlag.count({ where: { schoolId, monitor: "Data breach", status: IntegrityFlagStatus.OPEN } }),
    ]);

    const requests = rows.map((row) => {
      const due = new Date(row.receivedOn.getTime() + row.dueDays * DAY);
      return {
        id: row.id,
        reference: row.reference,
        kind: row.kind,
        requesterName: row.requesterName,
        subjectName: row.subjectName,
        status: row.status,
        receivedOn: row.receivedOn.toISOString(),
        daysLeft: row.closedOn ? null : this.daysUntil(due),
        closedOn: row.closedOn?.toISOString() ?? null,
        outcome: row.outcome,
        ownerName: row.owner ? `${row.owner.firstName} ${row.owner.lastName}`.trim() : null,
        ownerRole: row.owner?.role ?? null,
      };
    });

    const open = requests.filter((item) => item.status === DataSubjectRequestStatus.OPEN);
    return {
      stats: {
        open: open.length,
        closestDays: open.length ? Math.min(...open.map((item) => item.daysLeft ?? 999)) : null,
        consentHeld,
        consentTotal,
        incidents,
      },
      requests,
      retention,
    };
  }

  async createRequest(session: SessionPayload, payload: unknown) {
    const parsed = dsrSchema.parse(payload);
    const year = new Date().getFullYear().toString().slice(-2);
    const count = await prisma.dataSubjectRequest.count({ where: { schoolId: session.schoolId } });
    const reference = `DSR/${year}/${String(count + 1).padStart(4, "0")}`;

    const created = await prisma.dataSubjectRequest.create({
      data: {
        schoolId: session.schoolId,
        reference,
        kind: parsed.kind,
        requesterName: parsed.requesterName,
        subjectName: parsed.subjectName,
        dueDays: parsed.dueDays ?? 30,
        ownerId: session.userId,
      },
    });
    return { id: created.id, reference: created.reference };
  }

  async decideRequest(session: SessionPayload, id: string, payload: unknown) {
    const parsed = dsrDecisionSchema.parse(payload);
    const row = await prisma.dataSubjectRequest.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!row) throw new NotFoundException("That request is not on this school's register.");
    if (row.status !== DataSubjectRequestStatus.OPEN) {
      throw new BadRequestException(`This request is already ${row.status.toLowerCase()}.`);
    }

    const updated = await prisma.dataSubjectRequest.update({
      where: { id },
      data: {
        status:
          parsed.action === "RESPOND"
            ? DataSubjectRequestStatus.RESPONDED
            : parsed.action === "REFUSE"
              ? DataSubjectRequestStatus.REFUSED
              : DataSubjectRequestStatus.CLOSED,
        outcome: parsed.outcome,
        closedOn: parsed.action === "RESPOND" ? null : new Date(),
        ownerId: session.userId,
      },
    });
    return { id: updated.id, status: updated.status };
  }

  /** The retention schedule, seeded on first read. */
  async retention(session: SessionPayload) {
    const schoolId = session.schoolId;
    const count = await prisma.retentionPolicy.count({ where: { schoolId } });
    if (count === 0) {
      await prisma.retentionPolicy.createMany({
        data: STANDARD_RETENTION.map((item) => ({ schoolId, ...item })),
        skipDuplicates: true,
      });
    }
    const rows = await prisma.retentionPolicy.findMany({ where: { schoolId }, orderBy: { dataClass: "asc" } });
    return rows.map((row) => ({
      id: row.id,
      dataClass: row.dataClass,
      retention: row.years ? `${row.years} years` : row.untilAge ? `Until ${row.untilAge}th birthday` : "Permanent",
      basis: row.basis,
      hostedIn: row.hostedIn,
    }));
  }

  /* ─────────────── Monitoring ─────────────── */

  /**
   * Run the monitors against the records, then reconcile the flag table to what
   * they found: raise what is new, close what has gone away. A flag nobody can
   * clear by fixing the data is a flag people learn to ignore.
   */
  async integrity(session: SessionPayload) {
    const schoolId = session.schoolId;
    const weekAgo = new Date(Date.now() - 7 * DAY);

    const [noArm, orphanPayments, duplicateRefs, failedLogins, noMfa, dormant, exports30, permChanges] =
      await Promise.all([
        prisma.student.count({ where: { schoolId, currentClassId: null, status: "ACTIVE" } }),
        prisma.payment.count({ where: { schoolId, invoiceId: null } }),
        prisma.payment
          .groupBy({ by: ["reference"], where: { schoolId, reference: { not: "" } }, _count: { _all: true }, having: { reference: { _count: { gt: 1 } } } })
          .then((rows) => rows.length)
          .catch(() => 0),
        prisma.loginAttempt.count({ where: { schoolId, success: false, createdAt: { gte: weekAgo } } }),
        prisma.user.count({ where: { schoolId, mfaEnabled: false, accountStatus: "ACTIVE" } }),
        prisma.user.count({
          where: { schoolId, accountStatus: "ACTIVE", OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: new Date(Date.now() - 90 * DAY) } }] },
        }),
        prisma.auditLog.count({ where: { schoolId, action: AuditAction.EXPORT, createdAt: { gte: new Date(Date.now() - 30 * DAY) } } }),
        prisma.auditLog.count({
          where: { schoolId, entityType: { contains: "Permission" }, createdAt: { gte: new Date(Date.now() - 30 * DAY) } },
        }),
      ]);

    const found: Array<{ monitor: string; count: number; detail: string; severity: IntegritySeverity }> = [
      {
        monitor: "Student with no class arm",
        count: noArm,
        detail: `${noArm} active students sit in no arm, so they cannot be marked, graded or counted in a return.`,
        severity: IntegritySeverity.ATTENTION,
      },
      {
        monitor: "Payment with no invoice",
        count: orphanPayments,
        detail: `${orphanPayments} payments are recorded against no invoice.`,
        severity: IntegritySeverity.ATTENTION,
      },
      {
        monitor: "Duplicate bank reference",
        count: duplicateRefs,
        detail: `${duplicateRefs} bank references appear on more than one payment.`,
        severity: IntegritySeverity.CRITICAL,
      },
      {
        monitor: "Users without two-factor",
        count: noMfa,
        detail: `${noMfa} active accounts can sign in with a password alone.`,
        severity: IntegritySeverity.CRITICAL,
      },
      {
        monitor: "Dormant accounts",
        count: dormant,
        detail: `${dormant} active accounts have not signed in for 90 days or have never signed in.`,
        severity: IntegritySeverity.ATTENTION,
      },
      {
        monitor: "Failed sign-ins, 7 days",
        count: failedLogins,
        detail: `${failedLogins} failed sign-in attempts in the last seven days.`,
        severity: IntegritySeverity.ATTENTION,
      },
    ];

    const open = await prisma.integrityFlag.findMany({
      where: { schoolId, status: IntegrityFlagStatus.OPEN },
    });
    const openByMonitor = new Map(open.map((row) => [row.monitor, row]));

    for (const item of found) {
      const existing = openByMonitor.get(item.monitor);
      if (item.count > 0 && !existing) {
        await prisma.integrityFlag.create({
          data: { schoolId, monitor: item.monitor, detail: item.detail, severity: item.severity },
        });
      } else if (item.count > 0 && existing && existing.detail !== item.detail) {
        await prisma.integrityFlag.update({ where: { id: existing.id }, data: { detail: item.detail } });
      } else if (item.count === 0 && existing) {
        // The data that raised it has been fixed, so the flag closes itself
        // rather than waiting for somebody to tidy up after the fix.
        await prisma.integrityFlag.update({
          where: { id: existing.id },
          data: { status: IntegrityFlagStatus.RESOLVED, resolution: "The records that raised this no longer match.", resolvedAt: new Date() },
        });
      }
    }

    const flags = await prisma.integrityFlag.findMany({
      where: { schoolId },
      orderBy: [{ status: "asc" }, { severity: "desc" }, { createdAt: "desc" }],
      take: 40,
      include: { resolvedBy: { select: { firstName: true, lastName: true } } },
    });

    return {
      stats: {
        open: flags.filter((row) => row.status === IntegrityFlagStatus.OPEN).length,
        monitors: found.length,
        noMfa,
        activeUsers: await prisma.user.count({ where: { schoolId, accountStatus: "ACTIVE" } }),
        failedLogins,
        dormant,
        exports30,
        permChanges,
      },
      monitors: found.map((item) => ({ ...item, clean: item.count === 0 })),
      flags: flags.map((row) => ({
        id: row.id,
        monitor: row.monitor,
        detail: row.detail,
        severity: row.severity,
        status: row.status,
        ageDays: Math.floor((Date.now() - row.createdAt.getTime()) / DAY),
        resolution: row.resolution,
        resolvedBy: row.resolvedBy ? `${row.resolvedBy.firstName} ${row.resolvedBy.lastName}`.trim() : null,
      })),
    };
  }

  async resolveFlag(session: SessionPayload, id: string, payload: unknown) {
    const parsed = flagSchema.parse(payload);
    const row = await prisma.integrityFlag.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!row) throw new NotFoundException("That flag is not on this school's board.");
    if (row.status !== IntegrityFlagStatus.OPEN) {
      throw new BadRequestException("That flag has already been closed.");
    }

    const updated = await prisma.integrityFlag.update({
      where: { id },
      data: {
        status: parsed.action === "RESOLVE" ? IntegrityFlagStatus.RESOLVED : IntegrityFlagStatus.DISMISSED,
        resolution: parsed.resolution,
        resolvedById: session.userId,
        resolvedAt: new Date(),
      },
    });
    return { id: updated.id, status: updated.status };
  }
}
