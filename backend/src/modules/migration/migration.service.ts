import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { MigrationJobStatus, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

const platformRoles = new Set<UserRole>([
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "SUPPORT_AGENT",
  "SALES_MANAGER",
  "FINANCE_MANAGER",
  "DEVELOPER",
  "SUPER_ADMIN"
]);

function assertPlatformRole(session: SessionPayload) {
  if (!platformRoles.has(session.role as UserRole)) {
    throw new ForbiddenException("Platform admin access required.");
  }
}

const zBool = (defaultValue: boolean) =>
  z.preprocess((value) => value === true || value === "true", z.boolean()).default(defaultValue);

const zOptionalId = () =>
  z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === "" ? undefined : value));

const createJobSchema = z.object({
  schoolId: z.string().trim().min(1, "School is required"),
  sourceSystem: z.string().trim().min(1, "Source system is required"),
  specialistId: zOptionalId(),
  studentsExpected: z.coerce.number().int().nonnegative().optional().nullable(),
  resultsExpected: z.coerce.number().int().nonnegative().optional().nullable(),
  includeStudentsGuardians: zBool(true),
  includeStaffAccounts: zBool(true),
  includeHistoricalResults: zBool(true),
  includeFeesBalances: zBool(true),
  includeAttendanceHistory: zBool(false),
  includeBehaviouralRecords: zBool(false),
  notes: z.string().trim().optional()
});

const statusOrder: MigrationJobStatus[] = [
  "INVITED",
  "FILES_AWAITED",
  "IN_PROGRESS",
  "PREVIEW_READY",
  "SIGNED_OFF",
  "COMPLETED"
];

const updateJobSchema = z.object({
  status: z.nativeEnum(MigrationJobStatus).optional(),
  markFilesReceived: zBool(false).optional(),
  rollbackReason: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  specialistId: zOptionalId(),
  studentsExpected: z.coerce.number().int().nonnegative().optional().nullable(),
  resultsExpected: z.coerce.number().int().nonnegative().optional().nullable(),
  includeStudentsGuardians: zBool(true).optional(),
  includeStaffAccounts: zBool(true).optional(),
  includeHistoricalResults: zBool(true).optional(),
  includeFeesBalances: zBool(true).optional(),
  includeAttendanceHistory: zBool(false).optional(),
  includeBehaviouralRecords: zBool(false).optional()
});

const jobInclude = {
  school: { select: { id: true, name: true } },
  specialist: { select: { id: true, firstName: true, lastName: true } },
  signedOffBy: { select: { id: true, firstName: true, lastName: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } }
} satisfies Prisma.MigrationJobInclude;

type JobWithRelations = Prisma.MigrationJobGetPayload<{ include: typeof jobInclude }>;

function userName(user: { firstName: string; lastName: string } | null | undefined) {
  if (!user) return null;
  return `${user.firstName} ${user.lastName}`.trim();
}

function mapJob(job: JobWithRelations) {
  return {
    id: job.id,
    schoolId: job.schoolId,
    schoolName: job.school.name,
    sourceSystem: job.sourceSystem,
    status: job.status,
    studentsExpected: job.studentsExpected,
    resultsExpected: job.resultsExpected,
    includeStudentsGuardians: job.includeStudentsGuardians,
    includeStaffAccounts: job.includeStaffAccounts,
    includeHistoricalResults: job.includeHistoricalResults,
    includeFeesBalances: job.includeFeesBalances,
    includeAttendanceHistory: job.includeAttendanceHistory,
    includeBehaviouralRecords: job.includeBehaviouralRecords,
    filesReceivedAt: job.filesReceivedAt?.toISOString() ?? null,
    retentionClockStartsAt: job.retentionClockStartsAt?.toISOString() ?? null,
    previewSharedAt: job.previewSharedAt?.toISOString() ?? null,
    signedOffAt: job.signedOffAt?.toISOString() ?? null,
    signedOffById: job.signedOffById,
    signedOffByName: userName(job.signedOffBy),
    rolledBackAt: job.rolledBackAt?.toISOString() ?? null,
    rollbackReason: job.rollbackReason,
    notes: job.notes,
    specialistId: job.specialistId,
    specialistName: userName(job.specialist),
    createdById: job.createdById,
    createdByName: userName(job.createdBy),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  };
}

@Injectable()
export class MigrationService {
  async listJobs(session: SessionPayload) {
    assertPlatformRole(session);
    const jobs = await prisma.migrationJob.findMany({
      include: jobInclude,
      orderBy: { createdAt: "desc" }
    });
    return { ok: true, data: jobs.map(mapJob) };
  }

  async createJob(session: SessionPayload, payload: unknown) {
    assertPlatformRole(session);
    const parsed = createJobSchema.parse(payload);

    const school = await prisma.school.findUnique({ where: { id: parsed.schoolId }, select: { id: true } });
    if (!school) throw new NotFoundException("School not found.");

    if (parsed.specialistId) {
      const specialist = await prisma.user.findFirst({
        where: { id: parsed.specialistId, role: { in: Array.from(platformRoles) }, deletedAt: null }
      });
      if (!specialist) throw new BadRequestException("Selected specialist is not a valid internal team member.");
    }

    const job = await prisma.migrationJob.create({
      data: {
        schoolId: parsed.schoolId,
        sourceSystem: parsed.sourceSystem,
        specialistId: parsed.specialistId ?? null,
        studentsExpected: parsed.studentsExpected ?? null,
        resultsExpected: parsed.resultsExpected ?? null,
        includeStudentsGuardians: parsed.includeStudentsGuardians,
        includeStaffAccounts: parsed.includeStaffAccounts,
        includeHistoricalResults: parsed.includeHistoricalResults,
        includeFeesBalances: parsed.includeFeesBalances,
        includeAttendanceHistory: parsed.includeAttendanceHistory,
        includeBehaviouralRecords: parsed.includeBehaviouralRecords,
        notes: parsed.notes || null,
        createdById: session.userId
      },
      include: jobInclude
    });

    return { ok: true, message: "Migration job created", data: mapJob(job) };
  }

  async updateJob(session: SessionPayload, jobId: string, payload: unknown) {
    assertPlatformRole(session);
    const parsed = updateJobSchema.parse(payload);

    const existing = await prisma.migrationJob.findUnique({ where: { id: jobId } });
    if (!existing) throw new NotFoundException("Migration job not found.");

    if (parsed.specialistId) {
      const specialist = await prisma.user.findFirst({
        where: { id: parsed.specialistId, role: { in: Array.from(platformRoles) }, deletedAt: null }
      });
      if (!specialist) throw new BadRequestException("Selected specialist is not a valid internal team member.");
    }

    const data: Prisma.MigrationJobUpdateInput = {};

    if (parsed.notes !== undefined) data.notes = parsed.notes || null;
    if (parsed.specialistId !== undefined) data.specialist = parsed.specialistId ? { connect: { id: parsed.specialistId } } : { disconnect: true };
    if (parsed.studentsExpected !== undefined) data.studentsExpected = parsed.studentsExpected;
    if (parsed.resultsExpected !== undefined) data.resultsExpected = parsed.resultsExpected;
    if (parsed.includeStudentsGuardians !== undefined) data.includeStudentsGuardians = parsed.includeStudentsGuardians;
    if (parsed.includeStaffAccounts !== undefined) data.includeStaffAccounts = parsed.includeStaffAccounts;
    if (parsed.includeHistoricalResults !== undefined) data.includeHistoricalResults = parsed.includeHistoricalResults;
    if (parsed.includeFeesBalances !== undefined) data.includeFeesBalances = parsed.includeFeesBalances;
    if (parsed.includeAttendanceHistory !== undefined) data.includeAttendanceHistory = parsed.includeAttendanceHistory;
    if (parsed.includeBehaviouralRecords !== undefined) data.includeBehaviouralRecords = parsed.includeBehaviouralRecords;

    // Marking files received is a standalone convenience action: it records the receipt
    // timestamp and, if the job hasn't started yet, advances it into active work.
    if (parsed.markFilesReceived) {
      data.filesReceivedAt = new Date();
      if (existing.status === "INVITED" || existing.status === "FILES_AWAITED") {
        data.status = "IN_PROGRESS";
      }
    }

    if (parsed.status) {
      const nextStatus = parsed.status;

      if (nextStatus === "ROLLED_BACK") {
        if (!parsed.rollbackReason) throw new BadRequestException("A rollback reason is required.");
        data.status = "ROLLED_BACK";
        data.rolledBackAt = new Date();
        data.rollbackReason = parsed.rollbackReason;
      } else {
        const currentIndex = statusOrder.indexOf(existing.status);
        const nextIndex = statusOrder.indexOf(nextStatus);
        if (currentIndex === -1 || nextIndex === -1 || nextIndex < currentIndex) {
          throw new BadRequestException(`Cannot move a job from ${existing.status} to ${nextStatus}.`);
        }

        data.status = nextStatus;

        if (nextStatus === "IN_PROGRESS" && !existing.filesReceivedAt) {
          data.filesReceivedAt = new Date();
        }

        if (nextStatus === "PREVIEW_READY" && !existing.previewSharedAt) {
          data.previewSharedAt = new Date();
        }

        // Retention clock starts at sign-off, not at file upload — the school's copy of
        // records is only counted from the point the migration is formally accepted.
        if (nextStatus === "SIGNED_OFF") {
          data.signedOffAt = new Date();
          data.signedOffBy = { connect: { id: session.userId } };
          data.retentionClockStartsAt = new Date();
        }
      }
    }

    const job = await prisma.migrationJob.update({
      where: { id: jobId },
      data,
      include: jobInclude
    });

    return { ok: true, message: "Migration job updated", data: mapJob(job) };
  }

  async markFilesReceived(session: SessionPayload, jobId: string) {
    assertPlatformRole(session);

    const existing = await prisma.migrationJob.findUnique({ where: { id: jobId } });
    if (!existing) throw new NotFoundException("Migration job not found.");
    if (existing.status !== "INVITED" && existing.status !== "FILES_AWAITED") {
      throw new BadRequestException("Files can only be marked received while a job is awaiting them.");
    }

    const job = await prisma.migrationJob.update({
      where: { id: jobId },
      data: { filesReceivedAt: new Date(), status: "IN_PROGRESS" },
      include: jobInclude
    });

    return { ok: true, message: "Files marked as received", data: mapJob(job) };
  }

  async listSourceAdapters(session: SessionPayload) {
    assertPlatformRole(session);

    const count = await prisma.migrationSourceAdapter.count();
    if (count === 0) {
      // Honest, always-true baseline capability: every source system's data can be
      // exported to CSV/Excel and imported manually. No third-party adapters exist yet.
      await prisma.migrationSourceAdapter.upsert({
        where: { name: "CSV / Excel import" },
        update: {},
        create: {
          name: "CSV / Excel import",
          status: "available",
          notes: "Universal fallback — works from any source system's data export."
        }
      });
    }

    const adapters = await prisma.migrationSourceAdapter.findMany({ orderBy: { createdAt: "asc" } });
    return {
      ok: true,
      data: adapters.map((adapter) => ({
        id: adapter.id,
        name: adapter.name,
        status: adapter.status,
        notes: adapter.notes,
        createdAt: adapter.createdAt.toISOString()
      }))
    };
  }
}
