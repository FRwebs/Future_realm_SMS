import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";

import { prisma } from "../../../../src/lib/db/prisma";
import { runGolden } from "./golden";
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
export class InfraExtrasService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("Regression");
  private timer: NodeJS.Timeout | null = null;

  onModuleInit() {
    if (process.env.REGRESSION_SCHEDULER === "off") return;
    setTimeout(() => void this.runRegression("STARTUP", null).catch((error) => this.log.error(error)), 20_000).unref();
    this.timer = setInterval(() => void this.runRegression("DAILY", null).catch((error) => this.log.error(error)), 24 * 3_600_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** The golden-dataset checks, run through the real calculation code and kept so the page can say when they last passed. */
  async runRegression(trigger: "MANUAL" | "STARTUP" | "DAILY", userId: string | null) {
    const result = runGolden();
    const row = await prisma.regressionRun.create({ data: { passed: result.passed, total: result.total, failures: result.failures as never, trigger, ranById: userId } });
    if (result.failures.length) await prisma.securityIncident.create({ data: { type: "Calculation regression", severity: "HIGH", description: `${result.failures.length} golden case${result.failures.length === 1 ? "" : "s"} no longer give the known answer: ${result.failures.map((failure) => failure.name).join("; ")}` } }).catch(() => undefined);
    return { id: row.id, ...result };
  }

  async runRegressionAs(session: SessionPayload) {
    const actor = await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } });
    const result = await this.runRegression("MANUAL", actor?.id ?? null);
    await prisma.auditLog.create({ data: { actorId: actor?.id ?? null, action: AuditAction.UPDATE, entityType: "RegressionRun", entityId: result.id, metadata: { passed: result.passed, total: result.total } } });
    return result;
  }

  /** Who answers for an outside service the platform depends on. */
  async setIntegrationOwner(session: SessionPayload, body: unknown) {
    const input = z.object({ name: z.string().trim().min(2), ownerId: z.string().trim().optional().transform((v) => v || undefined) }).parse(body);
    if (!input.ownerId) {
      await prisma.integrationOwner.deleteMany({ where: { name: input.name } });
      return { name: input.name, ownerId: null };
    }
    const person = await prisma.user.findFirst({ where: { id: input.ownerId, deletedAt: null, isActive: true } });
    if (!person) throw new BadRequestException("That person is not on the team.");
    await prisma.integrationOwner.upsert({ where: { name: input.name }, create: { name: input.name, ownerId: input.ownerId }, update: { ownerId: input.ownerId } });
    await prisma.auditLog.create({ data: { actorId: person.id === session.userId ? person.id : (await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } }))?.id ?? null, action: AuditAction.SETTINGS_UPDATE, entityType: "IntegrationOwner", entityId: input.name, metadata: { ownerId: input.ownerId } } });
    return { name: input.name, ownerId: input.ownerId };
  }

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

    /* what the computation has actually done: runs, how long they took, who keeps re-running them, and frameworks that cannot compute */
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [runs, components] = await Promise.all([
      prisma.computationRun.findMany({ where: { createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } }, select: { schoolId: true, durationMs: true, records: true, recompute: true, reason: true, traceChecked: true, traceMatched: true, createdAt: true } }),
      prisma.sectionAssessmentComponent.findMany({ where: { isActive: true, school: { deletedAt: null } }, select: { schoolId: true, section: true, weight: true, school: { select: { name: true } } } })
    ]);
    const percentile = (values: number[], q: number) => (values.length ? values.slice().sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * q))] : null);
    const today = runs.filter((run) => run.createdAt >= startOfDay);
    const schoolNames = new Map((await prisma.school.findMany({ where: { id: { in: Array.from(new Set(runs.map((run) => run.schoolId))) } }, select: { id: true, name: true } })).map((school) => [school.id, school.name]));
    const bySchool = new Map<string, { records: number; durations: number[]; recomputes: number }>();
    for (const run of runs) {
      const row = bySchool.get(run.schoolId) ?? { records: 0, durations: [], recomputes: 0 };
      row.records += run.records;
      row.durations.push(run.durationMs);
      if (run.recompute) row.recomputes += 1;
      bySchool.set(run.schoolId, row);
    }
    const frameworkTotals = new Map<string, { school: string; section: string; total: number }>();
    for (const component of components) {
      const key = `${component.schoolId}:${component.section}`;
      const row = frameworkTotals.get(key) ?? { school: component.school.name, section: component.section, total: 0 };
      row.total += component.weight;
      frameworkTotals.set(key, row);
    }
    const failingFrameworks = Array.from(frameworkTotals.values()).filter((row) => Math.abs(row.total - 100) > 0.01);
    const traced = runs.filter((run) => run.traceChecked !== null);
    const traceChecked = traced.reduce((sum, run) => sum + (run.traceChecked ?? 0), 0);
    const traceMatched = traced.reduce((sum, run) => sum + (run.traceMatched ?? 0), 0);
    const latestRegression = await prisma.regressionRun.findFirst({ orderBy: { ranAt: "desc" } });
    const computation = {
      trace: { checked: traceChecked, matched: traceMatched, pct: traceChecked ? Math.round((traceMatched / traceChecked) * 1000) / 10 : null },
      regression: latestRegression ? { ranAt: latestRegression.ranAt.toISOString(), passed: latestRegression.passed, total: latestRegression.total, trigger: latestRegression.trigger, failures: latestRegression.failures as Array<{ name: string }> } : null,
      recomputes: runs.filter((run) => run.recompute).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10).map((run) => ({ school: schoolNames.get(run.schoolId) ?? "A school", reason: run.reason ?? "No reason recorded", at: run.createdAt.toISOString() })),
      runsToday: today.length,
      schoolsToday: new Set(today.map((run) => run.schoolId)).size,
      medianMs: percentile(runs.map((run) => run.durationMs), 0.5),
      p95Ms: percentile(runs.map((run) => run.durationMs), 0.95),
      failingFrameworks,
      bySchool: Array.from(bySchool.entries()).map(([schoolId, row]) => ({ school: schoolNames.get(schoolId) ?? "A school", runs: row.durations.length, records: row.records, medianMs: percentile(row.durations, 0.5), recomputes: row.recomputes, state: row.recomputes >= 4 ? "INVESTIGATE" : percentile(row.durations, 0.95)! > 15_000 ? "SLOW" : "HEALTHY" })).sort((a, b) => b.recomputes - a.recomputes || b.records - a.records).slice(0, 12)
    };

    return {
      data: {
        computation,
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
