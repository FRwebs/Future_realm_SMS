import { Injectable } from "@nestjs/common";

import { prisma } from "../../../../src/lib/db/prisma";
import type { SuperAdminComputationMonitoring } from "../../../../src/lib/domain/types";

/**
 * Thresholds for flagging a stuck computation-pipeline stage. There is no formal
 * job-queue table backing broadsheet compilation / report card generation (they are
 * synchronous, human-triggered workflow steps — see AcademicAssessment, Broadsheet,
 * and ReportCard in prisma/schema.prisma), so "pending computation" is derived from
 * records currently sitting in a not-yet-finalized status. Because these are termly
 * academic workflows (not real-time jobs), the healthy/warning/critical windows are
 * measured in days rather than the minutes/hours used for the sync-draft queue.
 */
const WARNING_AGE_HOURS = 14 * 24; // 14 days
const CRITICAL_AGE_HOURS = 30 * 24; // 30 days

function ageStatus(oldestAgeHours: number | null): string {
  if (oldestAgeHours === null) return "HEALTHY";
  if (oldestAgeHours > CRITICAL_AGE_HOURS) return "CRITICAL";
  if (oldestAgeHours > WARNING_AGE_HOURS) return "WARNING";
  return "HEALTHY";
}

function hoursBetween(from: Date, to: Date): number {
  return Math.round(((to.getTime() - from.getTime()) / (60 * 60 * 1000)) * 10) / 10;
}

@Injectable()
export class InfraExtrasService {
  async computationMonitoring(): Promise<{ data: SuperAdminComputationMonitoring }> {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [
      pendingApprovalCount,
      oldestPendingAssessment,
      pendingBroadsheetCount,
      oldestPendingBroadsheet,
      recentApprovedBroadsheets,
      pendingReportCardCount,
      oldestPendingReportCard
    ] = await Promise.all([
      prisma.academicAssessment.count({ where: { status: "MARKED", school: { deletedAt: null } } }),
      prisma.academicAssessment.findFirst({
        where: { status: "MARKED", school: { deletedAt: null } },
        orderBy: { updatedAt: "asc" },
        include: { school: { select: { name: true } }, classRoom: { select: { name: true } }, subject: { select: { name: true } } }
      }),
      prisma.broadsheet.count({ where: { status: { in: ["DRAFT", "IN_REVIEW", "CORRECTION_REQUESTED"] }, school: { deletedAt: null } } }),
      prisma.broadsheet.findFirst({
        where: { status: { in: ["DRAFT", "IN_REVIEW", "CORRECTION_REQUESTED"] }, school: { deletedAt: null } },
        orderBy: { createdAt: "asc" },
        include: { school: { select: { name: true } }, classRoom: { select: { name: true } } }
      }),
      prisma.broadsheet.findMany({
        where: { approvedAt: { not: null, gte: ninetyDaysAgo }, school: { deletedAt: null } },
        select: { createdAt: true, approvedAt: true }
      }),
      prisma.reportCard.count({ where: { status: "DRAFT", school: { deletedAt: null } } }),
      prisma.reportCard.findFirst({
        where: { status: "DRAFT", school: { deletedAt: null } },
        orderBy: { createdAt: "asc" },
        include: { school: { select: { name: true } }, student: { select: { firstName: true, lastName: true } } }
      })
    ]);

    const assessmentOldestAgeHours = oldestPendingAssessment ? hoursBetween(oldestPendingAssessment.updatedAt, now) : null;
    const broadsheetOldestAgeHours = oldestPendingBroadsheet ? hoursBetween(oldestPendingBroadsheet.createdAt, now) : null;
    const reportCardOldestAgeHours = oldestPendingReportCard ? hoursBetween(oldestPendingReportCard.createdAt, now) : null;

    const compileDurations = recentApprovedBroadsheets
      .filter((b): b is { createdAt: Date; approvedAt: Date } => b.approvedAt !== null)
      .map((b) => hoursBetween(b.createdAt, b.approvedAt));
    const avgCompileHours = compileDurations.length
      ? Math.round((compileDurations.reduce((sum, h) => sum + h, 0) / compileDurations.length) * 10) / 10
      : null;

    return {
      data: {
        assessments: {
          pendingApproval: pendingApprovalCount,
          oldestAgeHours: assessmentOldestAgeHours,
          oldestLabel: oldestPendingAssessment
            ? `${oldestPendingAssessment.school.name} · ${oldestPendingAssessment.classRoom.name} · ${oldestPendingAssessment.subject.name}`
            : null,
          status: ageStatus(assessmentOldestAgeHours)
        },
        broadsheets: {
          pending: pendingBroadsheetCount,
          oldestAgeHours: broadsheetOldestAgeHours,
          oldestLabel: oldestPendingBroadsheet ? `${oldestPendingBroadsheet.school.name} · ${oldestPendingBroadsheet.classRoom.name}` : null,
          status: ageStatus(broadsheetOldestAgeHours),
          avgCompileHours
        },
        reportCards: {
          pending: pendingReportCardCount,
          oldestAgeHours: reportCardOldestAgeHours,
          oldestLabel: oldestPendingReportCard
            ? `${oldestPendingReportCard.school.name} · ${oldestPendingReportCard.student.firstName} ${oldestPendingReportCard.student.lastName}`
            : null,
          status: ageStatus(reportCardOldestAgeHours)
        },
        generatedAt: now.toISOString()
      }
    };
  }
}
