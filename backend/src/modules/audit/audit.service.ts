import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

/**
 * The school's own audit trail.
 *
 * The log has always been written and indexed — `@@index([schoolId, action,
 * createdAt])` is exactly this query — but the only way to read it was through
 * super-admin, which is platform-wide. A principal has to be able to see their
 * own school's log without platform access, which is what this is for.
 *
 * Every query is scoped to the session's school. Nothing here takes a schoolId
 * from the caller.
 */

export type AuditEntryView = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: string | null;
  actorRole: string | null;
  actorEmail: string | null;
  ipAddress: string | null;
  metadata: unknown;
  createdAt: string;
};

export type AuditFeed = {
  entries: AuditEntryView[];
  total: number;
  byAction: Array<{ action: string; count: number }>;
  byActor: Array<{ actor: string; count: number }>;
  /** Distinct days the log covers, oldest first — the span it can speak for. */
  firstAt: string | null;
  lastAt: string | null;
};

@Injectable()
export class AuditService {
  ok<T>(data: Promise<T> | T, message = "Request completed") {
    return Promise.resolve(data).then((resolved) => ({
      ok: true,
      success: true,
      message,
      data: resolved,
    }));
  }

  async recent(
    session: SessionPayload,
    query: { take?: string; action?: string; entityType?: string },
  ): Promise<AuditFeed> {
    const take = Math.min(Number(query.take) || 100, 500);
    const where: Prisma.AuditLogWhereInput = {
      schoolId: session.schoolId,
      ...(query.action && query.action !== "ALL" ? { action: query.action as never } : {}),
      ...(query.entityType && query.entityType !== "ALL" ? { entityType: query.entityType } : {}),
    };

    const [rows, total, byAction, bounds] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          ipAddress: true,
          metadata: true,
          createdAt: true,
          actor: {
            select: { firstName: true, lastName: true, preferredName: true, role: true, email: true },
          },
        },
      }),
      prisma.auditLog.count({ where: { schoolId: session.schoolId } }),
      prisma.auditLog.groupBy({
        by: ["action"],
        where: { schoolId: session.schoolId },
        _count: { _all: true },
      }),
      prisma.auditLog.aggregate({
        where: { schoolId: session.schoolId },
        _min: { createdAt: true },
        _max: { createdAt: true },
      }),
    ]);

    const entries = rows.map((row) => ({
      id: row.id,
      action: String(row.action),
      entityType: row.entityType,
      entityId: row.entityId ?? null,
      actor: row.actor
        ? row.actor.preferredName?.trim() ||
          [row.actor.firstName, row.actor.lastName].filter(Boolean).join(" ")
        : null,
      actorRole: row.actor?.role ?? null,
      actorEmail: row.actor?.email ?? null,
      ipAddress: row.ipAddress ?? null,
      metadata: row.metadata ?? null,
      createdAt: row.createdAt.toISOString(),
    }));

    // Who is most active, counted off the page that was read rather than the
    // whole table: grouping by actor across every row would need a join the
    // index does not cover, and the tab only ever shows the leaders.
    const actorCounts = new Map<string, number>();
    for (const entry of entries) {
      if (!entry.actor) continue;
      actorCounts.set(entry.actor, (actorCounts.get(entry.actor) ?? 0) + 1);
    }

    return {
      entries,
      total,
      byAction: byAction
        .map((group) => ({ action: String(group.action), count: group._count._all }))
        .sort((a, b) => b.count - a.count),
      byActor: Array.from(actorCounts.entries())
        .map(([actor, count]) => ({ actor, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      firstAt: bounds._min.createdAt?.toISOString() ?? null,
      lastAt: bounds._max.createdAt?.toISOString() ?? null,
    };
  }

  /**
   * What personal data this school holds, counted rather than described.
   *
   * A data-protection page is usually a policy document, which says what the
   * school intends. This says what it actually has: how many children's dates
   * of birth are on file, how many medical records, how many guardians have
   * never been asked for consent, and how far back the trail of who-touched-
   * what reaches. Those are the questions a regulator asks and a policy
   * document cannot answer.
   */
  async dataProtection(session: SessionPayload) {
    const schoolId = session.schoolId;

    const [
      students,
      withDob,
      withReligion,
      withOrigin,
      medical,
      guardians,
      guardiansWithPhone,
      guardiansWithEmail,
      users,
      consents,
      auditBounds,
      auditTotal,
      loginAttempts
    ] = await Promise.all([
      prisma.student.count({ where: { schoolId } }),
      prisma.student.count({ where: { schoolId, dateOfBirth: { not: undefined } } }),
      prisma.student.count({ where: { schoolId, religion: { not: null } } }),
      prisma.student.count({ where: { schoolId, stateOfOrigin: { not: null } } }),
      prisma.medicalRecord.count({ where: { student: { schoolId } } }),
      prisma.guardian.count({ where: { schoolId } }),
      // phone is non-nullable on Guardian, so every guardian carries one by
      // schema — counted, not filtered, so the figure is not quietly wrong.
      prisma.guardian.count({ where: { schoolId } }),
      prisma.guardian.count({ where: { schoolId, email: { not: null } } }),
      prisma.user.count({ where: { schoolId, deletedAt: null } }),
      prisma.guardian.findMany({ where: { schoolId }, select: { userId: true } }),
      prisma.auditLog.aggregate({
        where: { schoolId },
        _min: { createdAt: true },
        _max: { createdAt: true }
      }),
      prisma.auditLog.count({ where: { schoolId } }),
      prisma.loginAttempt.count({ where: { schoolId } })
    ]);

    const guardianUserIds = consents.map((row) => row.userId).filter((id): id is string => Boolean(id));
    const consented = guardianUserIds.length
      ? await prisma.consentRecord.findMany({
          where: { userId: { in: guardianUserIds } },
          select: { userId: true }
        })
      : [];
    const consentedUsers = new Set(consented.map((row) => row.userId));

    const first = auditBounds._min.createdAt;
    const last = auditBounds._max.createdAt;

    return {
      // Categories the school holds, each with how many records carry it.
      holdings: [
        { category: "Children on the roll", count: students, special: false },
        { category: "Dates of birth", count: withDob, special: false },
        { category: "State of origin", count: withOrigin, special: false },
        { category: "Religion", count: withReligion, special: true },
        { category: "Medical records", count: medical, special: true },
        { category: "Guardians", count: guardians, special: false },
        { category: "Guardian phone numbers", count: guardiansWithPhone, special: false },
        { category: "Guardian email addresses", count: guardiansWithEmail, special: false },
        { category: "User accounts", count: users, special: false }
      ],
      /** Special-category data needs a lawful basis beyond "we run a school". */
      specialCategoryRecords: withReligion + medical,
      guardians,
      guardiansWithoutConsent: guardians - consentedUsers.size,
      audit: {
        entries: auditTotal,
        firstAt: first?.toISOString() ?? null,
        lastAt: last?.toISOString() ?? null,
        spanDays:
          first && last ? Math.max(1, Math.round((last.getTime() - first.getTime()) / 86_400_000)) : 0
      },
      loginAttempts,
      /**
       * Nothing in the schema expresses a retention period, so the honest
       * answer is that data is kept indefinitely until somebody deletes it.
       */
      retentionConfigured: false
    };
  }


  /** Reports somebody actually generated, which nothing used to record. */
  async reports(session: SessionPayload) {
    const rows = await prisma.generatedReport.findMany({
      where: { schoolId: session.schoolId },
      orderBy: { generatedAt: "desc" },
      take: 100,
      include: { generatedBy: { select: { firstName: true, lastName: true, role: true } } }
    });
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      format: row.format,
      scope: row.scope,
      rowCount: row.rowCount,
      sizeBytes: row.sizeBytes,
      generatedBy: row.generatedBy
        ? [row.generatedBy.firstName, row.generatedBy.lastName].filter(Boolean).join(" ")
        : null,
      generatedByRole: row.generatedBy?.role ? String(row.generatedBy.role) : null,
      generatedAt: row.generatedAt.toISOString()
    }));
  }

  /**
   * Whether this school could file a return today.
   *
   * Derived rather than modelled: a compliance table would record what somebody
   * claimed, and the useful question is what the records can actually support.
   * Each check is a field a Nigerian school is routinely asked for.
   */
  async compliance(session: SessionPayload) {
    const schoolId = session.schoolId;
    const [
      students,
      withDob,
      withGender,
      withAdmissionNo,
      guardians,
      guardiansWithPhone,
      staff,
      staffWithQualification,
      classesTotal,
      classesWithTeacher,
      school
    ] = await Promise.all([
      prisma.student.count({ where: { schoolId, status: "ACTIVE" } }),
      prisma.student.count({ where: { schoolId, status: "ACTIVE", dateOfBirth: { not: undefined } } }),
      prisma.student.count({ where: { schoolId, status: "ACTIVE" } }),
      prisma.student.count({ where: { schoolId, status: "ACTIVE", admissionNumber: { not: "" } } }),
      prisma.guardian.count({ where: { schoolId } }),
      prisma.guardian.count({ where: { schoolId } }),
      prisma.staffProfile.count({ where: { schoolId } }),
      prisma.staffProfile.count({ where: { schoolId, qualification: { not: null } } }),
      prisma.classRoom.count({ where: { schoolId } }),
      prisma.classRoom.count({ where: { schoolId, classTeacherId: { not: null } } }),
      prisma.school.findUnique({
        where: { id: schoolId },
        select: { cacNumber: true, ministryApprovalNumber: true, verifiedAt: true, address: true }
      })
    ]);

    const check = (label: string, have: number, need: number, note: string) => ({
      label,
      have,
      need,
      complete: need > 0 && have >= need,
      percent: need > 0 ? Math.round((have / need) * 100) : 100,
      note
    });

    return {
      registration: {
        cacNumber: school?.cacNumber ?? null,
        ministryApprovalNumber: school?.ministryApprovalNumber ?? null,
        verified: Boolean(school?.verifiedAt),
        addressOnFile: Boolean(school?.address)
      },
      checks: [
        check("Children with a date of birth", withDob, students, "Required on every enrolment return."),
        check("Children with a gender recorded", withGender, students, "Returns are broken down by gender."),
        check("Children with an admission number", withAdmissionNo, students, "The identifier a return is keyed on."),
        check("Guardians with a phone number", guardiansWithPhone, guardians, "Contactability is routinely inspected."),
        check("Staff with a qualification on file", staffWithQualification, staff, "Asked for on every staffing return."),
        check("Classes with a class teacher", classesWithTeacher, classesTotal, "An unassigned class cannot be returned.")
      ]
    };
  }

}
