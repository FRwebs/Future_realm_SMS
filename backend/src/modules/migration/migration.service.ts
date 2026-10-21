import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { MigrationJobStatus, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { sendNotification } from "../../../../src/lib/integrations/notifications";

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
    studentsImported: job.studentsImported,
    resultsImported: job.resultsImported,
    rowsRejected: job.rowsRejected,
    rejectedNote: job.rejectedNote,
    filesCount: job.filesCount,
    sourceFilesDeletedAt: job.sourceFilesDeletedAt?.toISOString() ?? null,
    specialistId: job.specialistId,
    specialistName: userName(job.specialist),
    createdById: job.createdById,
    createdByName: userName(job.createdBy),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  };
}

const DAY = 86_400_000;
const importSchema = z.object({
  studentsImported: z.coerce.number().int().min(0),
  resultsImported: z.coerce.number().int().min(0).default(0),
  rowsRejected: z.coerce.number().int().min(0).default(0),
  rejectedNote: z.string().trim().optional(),
  filesCount: z.coerce.number().int().min(0).optional()
});
const extendSchema = z.object({
  days: z.coerce.number().int().min(1, "Extend by at least a day.").max(365, "A year is the longest extension."),
  reason: z.string().trim().min(10, "Give the reason — the school is told it."),
  approverId: z.string().min(1, "Name the person who approved it.")
});
const deletedSchema = z.object({ evidence: z.string().trim().min(10, "Say how the files were destroyed and where — this is the evidence.") });
const adapterSchema = z.object({
  name: z.string().trim().min(2, "Name the source system."),
  status: z.string().trim().min(2).default("available"),
  formats: z.string().trim().optional(),
  quirks: z.string().trim().optional(),
  notes: z.string().trim().optional()
});
const nudgeSchema = z.object({ schoolId: z.string().min(1), message: z.string().trim().optional() });

/** When a job's source files must be gone: ninety days after sign-off unless someone with a reason moved it. */
export function deletesOn(job: { retentionClockStartsAt: Date | null; retentionDays: number; retentionExtendedTo: Date | null }) {
  if (!job.retentionClockStartsAt) return null;
  const base = new Date(job.retentionClockStartsAt.getTime() + job.retentionDays * DAY);
  return job.retentionExtendedTo && job.retentionExtendedTo > base ? job.retentionExtendedTo : base;
}

@Injectable()
export class MigrationService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger("MigrationRetention");
  private timer: NodeJS.Timeout | null = null;

  onApplicationBootstrap() {
    if (process.env.MIGRATION_RETENTION_SCANNER === "off") return;
    this.timer = setInterval(() => void this.scanRetention().catch((error) => this.log.error(error)), 6 * 3_600_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async actorId(session: SessionPayload) {
    return (await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } }))?.id ?? null;
  }

  private async audit(session: SessionPayload | null, entityType: string, entityId: string, metadata: Prisma.InputJsonValue, schoolId: string) {
    await prisma.auditLog.create({ data: { schoolId, actorId: session ? await this.actorId(session) : null, action: "UPDATE", entityType, entityId, metadata } });
  }

  /** The specialist records what the off-platform run produced — what was imported, what was refused and why. */
  async recordImport(session: SessionPayload, jobId: string, payload: unknown) {
    assertPlatformRole(session);
    const input = importSchema.parse(payload);
    const job = await prisma.migrationJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException("Migration job not found.");
    if (job.status === "INVITED" || job.status === "FILES_AWAITED") throw new BadRequestException("Mark the files received before recording what was imported.");
    if (job.status === "ROLLED_BACK") throw new BadRequestException("A rolled-back job has nothing imported.");
    if (input.rowsRejected > 0 && !input.rejectedNote) throw new BadRequestException("Say why rows were rejected so the school can fix its file.");
    await prisma.migrationJob.update({ where: { id: jobId }, data: { studentsImported: input.studentsImported, resultsImported: input.resultsImported, rowsRejected: input.rowsRejected, rejectedNote: input.rejectedNote || null, ...(input.filesCount !== undefined ? { filesCount: input.filesCount } : {}) } });
    await this.audit(session, "MigrationJob", jobId, { ...input }, job.schoolId);
    return { ok: true, message: "Import result recorded", data: { id: jobId } };
  }

  /** Signed-off jobs that still hold the school's source files, with the day each must be deleted. */
  async retention(session: SessionPayload) {
    assertPlatformRole(session);
    const jobs = await prisma.migrationJob.findMany({
      where: { signedOffAt: { not: null }, sourceFilesDeletedAt: null, status: { not: "ROLLED_BACK" } },
      include: { school: { select: { id: true, name: true } } },
      orderBy: { signedOffAt: "asc" }
    });
    const now = Date.now();
    const rows = jobs.map((job) => {
      const due = deletesOn(job) as Date;
      const left = Math.ceil((due.getTime() - now) / DAY);
      return {
        id: job.id, ref: `MIG-${job.id.slice(-6).toUpperCase()}`, schoolId: job.schoolId, school: job.school.name,
        signedOffAt: job.signedOffAt?.toISOString() ?? null, filesCount: job.filesCount, deletesOn: due.toISOString(), daysLeft: left,
        extended: Boolean(job.retentionExtendedTo && job.retentionExtendedTo > new Date((job.retentionClockStartsAt as Date).getTime() + job.retentionDays * DAY)),
        state: left < 0 ? "OVERDUE" : left <= 14 ? "DUE_SOON" : "HELD"
      };
    });
    return { ok: true, data: { rows, holding: rows.length, overdue: rows.filter((r) => r.state === "OVERDUE").length } };
  }

  async extendRetention(session: SessionPayload, jobId: string, payload: unknown) {
    assertPlatformRole(session);
    const input = extendSchema.parse(payload);
    const job = await prisma.migrationJob.findUnique({ where: { id: jobId }, include: { school: { select: { id: true, name: true, ownerEmail: true } } } });
    if (!job || !job.signedOffAt) throw new NotFoundException("That job has not been signed off.");
    if (job.sourceFilesDeletedAt) throw new BadRequestException("The files were already deleted.");
    const approver = await prisma.user.findFirst({ where: { id: input.approverId, role: { in: ["SUPER_ADMIN", "PLATFORM_OWNER"] }, deletedAt: null }, select: { id: true, firstName: true, lastName: true } });
    if (!approver) throw new BadRequestException("The approver must be a Super Admin or the Platform Owner.");
    const current = deletesOn(job) as Date;
    const next = new Date(Math.max(current.getTime(), Date.now()) + input.days * DAY);
    await prisma.migrationJob.update({ where: { id: jobId }, data: { retentionExtendedTo: next, retentionExtendReason: input.reason, retentionApprovedById: approver.id } });
    await this.audit(session, "MigrationJob", jobId, { retentionExtendedTo: next.toISOString(), days: input.days, reason: input.reason, approvedBy: `${approver.firstName} ${approver.lastName}` }, job.schoolId);
    const body = `We are keeping the source files from your data migration until ${next.toDateString()}. Reason: ${input.reason}. Approved by ${approver.firstName} ${approver.lastName}. We will delete them on that date.`;
    const owners = await prisma.user.findMany({ where: { schoolId: job.schoolId, role: { in: ["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL"] }, isActive: true }, select: { id: true } });
    if (owners.length) await prisma.notificationLog.createMany({ data: owners.map((owner) => ({ schoolId: job.schoolId, userId: owner.id, channel: "IN_APP" as const, title: "Your migration source files are being kept longer", body, status: "SENT" as const, metadata: { kind: "MIGRATION_RETENTION" } })) });
    if (job.school.ownerEmail) await sendNotification({ channel: "EMAIL", recipient: job.school.ownerEmail, title: "Your migration source files are being kept longer", body }).catch(() => undefined);
    return { ok: true, message: "Retention extended and the school told", data: { deletesOn: next.toISOString() } };
  }

  /** The platform does not hold the files itself, so deletion is evidenced by the person who destroyed them. */
  async confirmDeleted(session: SessionPayload, jobId: string, payload: unknown) {
    assertPlatformRole(session);
    const input = deletedSchema.parse(payload);
    const job = await prisma.migrationJob.findUnique({ where: { id: jobId } });
    if (!job || !job.signedOffAt) throw new NotFoundException("That job has not been signed off.");
    await prisma.migrationJob.update({ where: { id: jobId }, data: { sourceFilesDeletedAt: new Date(), sourceFilesDeletedNote: input.evidence } });
    await this.audit(session, "MigrationJob", jobId, { sourceFilesDeleted: true, evidence: input.evidence }, job.schoolId);
    return { ok: true, message: "Deletion recorded", data: { id: jobId } };
  }

  /** Tell the specialist and the Super Admins when a school's source files have passed their delete-by date. One notice per job per delete-by date. */
  async scanRetention() {
    const jobs = await prisma.migrationJob.findMany({ where: { signedOffAt: { not: null }, sourceFilesDeletedAt: null, status: { not: "ROLLED_BACK" } }, include: { school: { select: { name: true } } } });
    const admins = await prisma.user.findMany({ where: { role: { in: ["SUPER_ADMIN", "PLATFORM_OWNER"] }, isActive: true }, select: { id: true, schoolId: true } });
    let notified = 0;
    for (const job of jobs) {
      const due = deletesOn(job) as Date;
      if (due.getTime() > Date.now()) continue;
      const key = due.toISOString().slice(0, 10);
      const done = await prisma.auditLog.findFirst({ where: { entityType: "MigrationRetentionDue", entityId: job.id, metadata: { path: ["deletesOn"], equals: key } }, select: { id: true } });
      if (done) continue;
      const specialist = job.specialistId ? await prisma.user.findUnique({ where: { id: job.specialistId }, select: { id: true, schoolId: true } }) : null;
      for (const person of [...admins, ...(specialist ? [specialist] : [])]) {
        await prisma.notificationLog.create({ data: { schoolId: person.schoolId, userId: person.id, channel: "IN_APP", title: "Source files are past their delete-by date", body: `${job.school.name}'s migration source files were due for deletion on ${due.toDateString()}. Delete them and record the evidence, or extend retention with a reason.`, status: "SENT", metadata: { kind: "MIGRATION_RETENTION_DUE", jobId: job.id } } });
      }
      await this.audit(null, "MigrationRetentionDue", job.id, { deletesOn: key }, job.schoolId);
      notified += 1;
    }
    return { checked: jobs.length, notified };
  }

  async saveAdapter(session: SessionPayload, adapterId: string | null, payload: unknown) {
    assertPlatformRole(session);
    const input = adapterSchema.parse(payload);
    const data = { name: input.name, status: input.status, formats: input.formats || null, quirks: input.quirks || null, notes: input.notes || null };
    if (adapterId) {
      if (!(await prisma.migrationSourceAdapter.findUnique({ where: { id: adapterId } }))) throw new NotFoundException("That adapter does not exist.");
      await prisma.migrationSourceAdapter.update({ where: { id: adapterId }, data });
    } else {
      if (await prisma.migrationSourceAdapter.findUnique({ where: { name: input.name } })) throw new BadRequestException("An adapter with that name already exists.");
      await prisma.migrationSourceAdapter.create({ data });
    }
    return { ok: true, message: adapterId ? "Adapter updated" : "Adapter created", data: { name: input.name } };
  }

  /** A nudge to a school whose setup has stalled — one email to its owner, written down. */
  async nudgeSetup(session: SessionPayload, payload: unknown) {
    assertPlatformRole(session);
    const input = nudgeSchema.parse(payload);
    const school = await prisma.school.findFirst({ where: { id: input.schoolId, deletedAt: null }, select: { id: true, name: true, ownerEmail: true } });
    if (!school) throw new NotFoundException("That school does not exist.");
    const open = await prisma.onboardingChecklistItem.findMany({ where: { schoolId: school.id, completedAt: null }, select: { label: true } });
    const text = input.message || `Your setup is waiting on: ${open.map((item) => item.label).join(", ") || "nothing — you are done"}. Reply to this email and your Account Manager will do it with you.`;
    if (!school.ownerEmail) throw new BadRequestException("This school has no owner email to write to.");
    await sendNotification({ channel: "EMAIL", recipient: school.ownerEmail, title: `Finishing ${school.name}'s setup`, body: text }).catch(() => undefined);
    await this.audit(session, "SetupNudge", school.id, { message: text }, school.id);
    return { ok: true, message: "Message sent to the school's owner", data: { schoolId: school.id } };
  }


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

    const [adapters, jobs] = await Promise.all([
      prisma.migrationSourceAdapter.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.migrationJob.findMany({ select: { sourceSystem: true, status: true } })
    ]);
    return {
      ok: true,
      data: adapters.map((adapter) => {
        const matchingJobs = jobs.filter((job) => job.sourceSystem.toLowerCase() === adapter.name.toLowerCase());
        const completed = matchingJobs.filter((job) => job.status === "SIGNED_OFF" || job.status === "COMPLETED").length;
        return {
          id: adapter.id,
          name: adapter.name,
          status: adapter.status,
          formats: adapter.formats,
          quirks: adapter.quirks,
          notes: adapter.notes,
          jobsRun: matchingJobs.length,
          completionRatePct: matchingJobs.length > 0 ? Math.round((completed / matchingJobs.length) * 1000) / 10 : null,
          createdAt: adapter.createdAt.toISOString()
        };
      })
    };
  }

  // Setup Progress — real completion data from the school's own onboarding checklist
  // (the same six steps every school sees after signup), aggregated across every
  // school that has one. This is the platform-wide "where do schools stall" view.
  async setupProgress(session: SessionPayload) {
    assertPlatformRole(session);
    const items = await prisma.onboardingChecklistItem.findMany({
      select: { key: true, label: true, completedAt: true, schoolId: true, school: { select: { name: true, createdAt: true } } }
    });

    const byKey = new Map<string, { label: string; reached: number; completed: number }>();
    for (const item of items) {
      const entry = byKey.get(item.key) ?? { label: item.label, reached: 0, completed: 0 };
      entry.reached += 1;
      if (item.completedAt) entry.completed += 1;
      byKey.set(item.key, entry);
    }
    // Canonical order matches the checklist as created at signup (onboarding.service.ts) —
    // findMany doesn't guarantee row order, so re-sort explicitly rather than trust it.
    const stepOrder = ["SCHOOL_PROFILE", "ACADEMIC_SESSION", "CLASSES", "STAFF", "STUDENTS", "FEES"];
    const steps = Array.from(byKey.entries())
      .map(([key, v]) => ({
        key,
        label: v.label,
        reached: v.reached,
        completed: v.completed,
        completionRatePct: v.reached > 0 ? Math.round((v.completed / v.reached) * 1000) / 10 : 0
      }))
      .sort((a, b) => stepOrder.indexOf(a.key) - stepOrder.indexOf(b.key));

    // Stalled: a school with at least one incomplete checklist item, older than 5 days.
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const bySchool = new Map<string, { schoolName: string; createdAt: Date; incompleteKeys: string[] }>();
    for (const item of items) {
      if (item.completedAt) continue;
      const entry = bySchool.get(item.schoolId) ?? { schoolName: item.school.name, createdAt: item.school.createdAt, incompleteKeys: [] };
      entry.incompleteKeys.push(item.key);
      bySchool.set(item.schoolId, entry);
    }
    const stepOrder_ = ["SCHOOL_PROFILE", "ACADEMIC_SESSION", "CLASSES", "STAFF", "STUDENTS", "FEES"];
    const managers = await prisma.school.findMany({ where: { id: { in: Array.from(bySchool.keys()) } }, select: { id: true, accountManager: { select: { firstName: true, lastName: true } } } });
    const stalled = Array.from(bySchool.entries())
      .filter(([, s]) => s.createdAt < fiveDaysAgo)
      .map(([schoolId, s]) => {
        const first = s.incompleteKeys.slice().sort((a, b) => stepOrder_.indexOf(a) - stepOrder_.indexOf(b))[0];
        const manager = managers.find((m) => m.id === schoolId)?.accountManager;
        return { schoolId, schoolName: s.schoolName, daysSinceSignup: Math.floor((Date.now() - s.createdAt.getTime()) / (24 * 60 * 60 * 1000)), incompleteCount: s.incompleteKeys.length, stalledStep: stepOrder_.indexOf(first) + 1, stalledLabel: byKey.get(first)?.label ?? first, accountManager: manager ? `${manager.firstName} ${manager.lastName}` : null };
      })
      .sort((a, b) => b.daysSinceSignup - a.daysSinceSignup);

    // How long a school takes: from signup to the last step done, for schools that finished all of them; and per step, signup to that step.
    const median = (values: number[]) => (values.length ? values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)] : null);
    const perSchool = new Map<string, { createdAt: Date; done: Date[]; total: number }>();
    for (const item of items) {
      const entry = perSchool.get(item.schoolId) ?? { createdAt: item.school.createdAt, done: [], total: 0 };
      entry.total += 1;
      if (item.completedAt) entry.done.push(item.completedAt);
      perSchool.set(item.schoolId, entry);
    }
    const hours = (from: Date, to: Date) => Math.max(0, Math.round(((to.getTime() - from.getTime()) / 3_600_000) * 10) / 10);
    const finished = Array.from(perSchool.values()).filter((entry) => entry.total > 0 && entry.done.length === entry.total).map((entry) => hours(entry.createdAt, new Date(Math.max(...entry.done.map((d) => d.getTime())))));
    const stepMedians = Object.fromEntries(Array.from(byKey.keys()).map((key) => [key, median(items.filter((item) => item.key === key && item.completedAt).map((item) => hours(item.school.createdAt, item.completedAt as Date)))]));

    return { ok: true, data: { steps: steps.map((step) => ({ ...step, medianHours: stepMedians[step.key] ?? null })), stalled, medianHoursToComplete: median(finished), schoolsFinished: finished.length } };
  }
}
