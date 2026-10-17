import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import {
  buildPeriods,
  cellKey,
  clashesIn,
  dayLabel,
  DAY_CODES,
  minutes,
  type Cell,
  type Grid,
  type PeriodInfo
} from "../../../../src/lib/modules/timetable-periods";
import { armDisplayName, stageOf } from "./class-structure.service";

export { buildPeriods, clashesIn };
export type { Cell, Grid, PeriodInfo };

/**
 * Named timetables: the one running, the drafts being worked on, the ones retired.
 *
 * What families and teachers see is `TimetableEntry` — one live week per arm per
 * term. A version is the whole school's week as a document: it can be built, saved
 * half-finished, previewed and discarded without touching that live week, and
 * publishing it is the single act that replaces the live week with it.
 *
 * Cells are stored as { subjectId, teacherId }. The teacher is looked up from the
 * subject-arm mapping at the moment a cell is saved, so a timetable can never name
 * somebody the school has not made responsible for that subject in that arm.
 */

const BREAK_PERIOD = 99;

const settingsSchema = z.object({
  name: z.string().trim().min(3, "Give the timetable a name you will recognise.").max(120),
  termId: z.string().optional().or(z.literal("")),
  periodsPerDay: z.coerce.number().int().min(1).max(16).default(8),
  periodMinutes: z.coerce.number().int().min(20).max(120).default(40),
  firstStarts: z.string().regex(/^\d{2}:\d{2}$/, "Write the first period's start as 08:00.").default("08:00"),
  breakAfter: z.union([z.coerce.number().int().min(1).max(15), z.literal(""), z.literal("No break")]).optional(),
  schoolDays: z.array(z.string()).min(1, "Pick at least one school day.").optional(),
  appliesTo: z.string().default("Every arm"),
  checkClashes: z.coerce.boolean().default(true)
});

const createSchema = settingsSchema.extend({
  startFrom: z.string().default("A copy of the running timetable"),
  copyFromId: z.string().optional().or(z.literal(""))
});

const saveSchema = z.object({
  settings: settingsSchema.partial().optional(),
  edits: z
    .array(
      z.object({
        classIds: z.array(z.string()).min(1),
        cells: z.record(z.string(), z.string().nullable())
      })
    )
    .optional()
});

const publishSchema = z.object({
  /** teachers-changed, teachers-all, form-masters, students, guardians */
  notify: z.array(z.string()).optional(),
  channels: z.array(z.string()).optional(),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  takesEffect: z.string().optional(),
  effectiveDate: z.string().optional().or(z.literal(""))
});
type PublishOptions = z.infer<typeof publishSchema>;

/** Who each notification choice is addressed to, as the portals read audiences. */
const AUDIENCE: Record<string, string> = {
  "teachers-changed": "Teachers and staff",
  "teachers-all": "Teachers and staff",
  "form-masters": "Teachers and staff",
  students: "Students",
  guardians: "Parents and guardians"
};

/** The first moment a chosen start falls on, at the school's own 00:00 (taken as UTC+1). */
function effectiveInstant(takesEffect: string | undefined, date: string | undefined): Date | null {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 3_600_000);
  if (!takesEffect || takesEffect === "Immediately") return null;
  if (takesEffect === "From tomorrow") return startOfDay(new Date(now.getTime() + 86_400_000));
  if (takesEffect === "From next Monday") {
    const ahead = ((8 - now.getUTCDay()) % 7) || 7;
    return startOfDay(new Date(now.getTime() + ahead * 86_400_000));
  }
  if (takesEffect === "On a date I choose") {
    if (!date) throw new BadRequestException("Choose the date it should take effect.");
    const picked = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(picked.getTime())) throw new BadRequestException("That date is not a date.");
    const at = startOfDay(picked);
    return at.getTime() <= now.getTime() ? null : at;
  }
  return null;
}

function parseBreak(value: unknown): number | null {
  if (value === "" || value === undefined || value === null || value === "No break") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function fullName(user: { firstName: string; lastName: string } | null | undefined): string {
  return user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : "";
}

function armsIn(grid: Grid): string[] {
  return Object.entries(grid)
    .filter(([, cells]) => Object.keys(cells).length > 0)
    .map(([classId]) => classId);
}

@Injectable()
export class TimetableVersionsService {
  async ok<T>(dataPromise: Promise<T>, message?: string) {
    return { ok: true, success: true, ...(message ? { message } : {}), data: await dataPromise };
  }

  private async audit(session: SessionPayload, action: AuditAction, entityId: string, metadata?: Prisma.InputJsonValue) {
    await prisma.auditLog.create({
      data: { schoolId: session.schoolId, actorId: session.userId, action, entityType: "TimetableVersion", entityId, metadata }
    });
  }

  private async currentTerm(schoolId: string) {
    return prisma.term.findFirst({ where: { schoolId, isCurrent: true }, include: { academicSession: { select: { name: true } } } });
  }

  /* ─────────────── the live week, read as a grid ─────────────── */

  /** The week as it is actually running: published lessons, arm by arm, with the periods they sit in. */
  private async liveGrid(schoolId: string, termId: string | null) {
    const entries = await prisma.timetableEntry.findMany({
      where: { schoolId, ...(termId ? { termId } : {}), isPublished: true },
      select: {
        classId: true, subjectId: true, teacherId: true, dayOfWeek: true, periodNumber: true,
        startsAt: true, endsAt: true, slotType: true, venue: true, updatedAt: true
      }
    });
    const grid: Grid = {};
    const times = new Map<string, PeriodInfo>();
    let lastEdited: Date | null = null;
    for (const entry of entries) {
      if (!lastEdited || entry.updatedAt > lastEdited) lastEdited = entry.updatedAt;
      if (entry.slotType === "lesson" && entry.subjectId) {
        (grid[entry.classId] ??= {})[cellKey(entry.dayOfWeek, entry.periodNumber)] = {
          subjectId: entry.subjectId,
          teacherId: entry.teacherId
        };
      }
      const isBreak = entry.slotType === "break" || entry.slotType === "lunch";
      if (entry.slotType === "lesson" || entry.slotType === "free" || isBreak) {
        const n: number | "break" = isBreak ? "break" : entry.periodNumber;
        const key = `${n}|${entry.startsAt}`;
        if (!times.has(key)) times.set(key, { n, start: entry.startsAt, end: entry.endsAt });
      }
    }
    // Number the periods the way a person reads a day: by the clock.
    const periods = Array.from(times.values())
      .filter((period, index, all) => all.findIndex((other) => other.n === period.n && other.start === period.start) === index)
      .sort((a, b) => minutes(a.start) - minutes(b.start));
    // A lesson period appears once however many arms have it.
    const seen = new Set<number>();
    const unique = periods.filter((period) => {
      if (period.n === "break") return true;
      if (seen.has(period.n)) return false;
      seen.add(period.n);
      return true;
    });
    return { grid, periods: unique, lastEdited, entries };
  }

  /* ─────────────── list ─────────────── */

  async list(session: SessionPayload) {
    const schoolId = session.schoolId;
    await this.applyDue(schoolId);
    const term = await this.currentTerm(schoolId);
    const [versions, live, arms, logs, builders] = await Promise.all([
      prisma.timetableVersion.findMany({ where: { schoolId }, orderBy: { updatedAt: "desc" }, include: { term: { select: { name: true } } } }),
      this.liveGrid(schoolId, term?.id ?? null),
      prisma.classRoom.count({ where: { schoolId, deletedAt: null, isActive: true } }),
      prisma.timetablePublishLog.findMany({
        where: { schoolId, action: { in: ["publish_version", "discard_version"] } },
        orderBy: { publishedAt: "desc" },
        take: 6,
        include: { publishedBy: { select: { firstName: true, lastName: true } } }
      }),
      prisma.user.findMany({ where: { schoolId, deletedAt: null }, select: { id: true, firstName: true, lastName: true } })
    ]);
    const nameOf = new Map(builders.map((user) => [user.id, fullName(user)]));
    const hasRunningRow = versions.some((version) => version.state === "RUNNING" && (!term || version.termId === term.id));
    const liveArms = armsIn(live.grid).length;
    const clashes = clashesIn(live.grid).length;

    const rows = versions.map((version) => {
      const grid = (version.grid ?? {}) as Grid;
      const isRunning = version.state === "RUNNING";
      return {
        id: version.id,
        name: version.name,
        note: version.note,
        term: version.term?.name ?? null,
        state: version.state,
        arms: isRunning ? Math.max(armsIn(grid).length, liveArms) : armsIn(grid).length,
        periodsPerDay: version.periodsPerDay,
        builtBy: version.builtById ? nameOf.get(version.builtById) ?? "Someone" : "—",
        builtById: version.builtById,
        updatedAt: version.updatedAt.toISOString(),
        publishedAt: version.publishedAt?.toISOString() ?? null,
        scheduledFor: version.scheduledFor?.toISOString() ?? null,
        synthetic: false
      };
    });
    if (!hasRunningRow && liveArms > 0) {
      const lessonPeriods = live.periods.filter((period) => period.n !== "break").length;
      rows.unshift({
        id: "live",
        name: "The running timetable",
        note: "The week as it was set up before versions were kept",
        term: term?.name ?? null,
        state: "RUNNING",
        arms: liveArms,
        periodsPerDay: lessonPeriods,
        builtBy: "—",
        builtById: null,
        updatedAt: (live.lastEdited ?? new Date()).toISOString(),
        publishedAt: null,
        scheduledFor: null,
        synthetic: true
      });
    }

    return {
      term: term ? { id: term.id, name: term.name, session: term.academicSession.name } : null,
      versions: rows,
      totals: { arms, liveArms, clashes },
      publishes: logs.map((log) => {
        let detail: Record<string, unknown> = {};
        try {
          detail = log.notes ? (JSON.parse(log.notes) as Record<string, unknown>) : {};
        } catch {
          detail = { note: log.notes };
        }
        return {
          id: log.id,
          action: log.action,
          at: log.publishedAt.toISOString(),
          by: fullName(log.publishedBy),
          detail
        };
      })
    };
  }

  /* ─────────────── one version ─────────────── */

  private settingsOf(version: {
    periodsPerDay: number; periodMinutes: number; firstStarts: string; breakAfter: number | null; schoolDays: string[];
  }) {
    return {
      periodsPerDay: version.periodsPerDay,
      periodMinutes: version.periodMinutes,
      firstStarts: version.firstStarts,
      breakAfter: version.breakAfter,
      schoolDays: version.schoolDays
    };
  }

  /** The arms a timetable can be built for, with the subjects each is offered and who teaches them. */
  private async armsAndSubjects(schoolId: string) {
    const [arms, mappings] = await Promise.all([
      prisma.classRoom.findMany({
        where: { schoolId, deletedAt: null, isActive: true },
        include: { classLevel: true, classTeacher: { select: { firstName: true, lastName: true } } },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
      }),
      prisma.classSubject.findMany({
        where: { schoolId, isActive: true },
        include: {
          subject: { select: { id: true, name: true, code: true, periodsPerWeek: true } }
        }
      })
    ]);
    const teacherIds = Array.from(new Set(mappings.map((row) => row.teacherId).filter((id): id is string => Boolean(id))));
    const teachers = await prisma.user.findMany({
      where: { id: { in: teacherIds } },
      select: { id: true, firstName: true, lastName: true }
    });
    const teacherName = new Map(teachers.map((teacher) => [teacher.id, fullName(teacher)]));
    const subjects: Record<string, Array<{ subjectId: string; name: string; code: string; teacherId: string | null; teacher: string | null; periods: number }>> = {};
    for (const row of mappings) {
      (subjects[row.classId] ??= []).push({
        subjectId: row.subjectId,
        name: row.subject.name,
        code: row.subject.code,
        teacherId: row.teacherId,
        teacher: row.teacherId ? teacherName.get(row.teacherId) ?? null : null,
        periods: row.periodsPerWeek ?? row.subject.periodsPerWeek
      });
    }
    for (const list of Object.values(subjects)) list.sort((a, b) => a.name.localeCompare(b.name));
    return {
      arms: arms.map((arm) => ({
        id: arm.id,
        name: armDisplayName(arm.name, arm.arm),
        level: arm.classLevel.name,
        levelId: arm.classLevelId,
        stage: stageOf(arm.classLevel),
        room: arm.room,
        formMaster: arm.classTeacher ? fullName(arm.classTeacher) : null
      })),
      subjects,
      teacherName
    };
  }

  async detail(session: SessionPayload, id: string) {
    const schoolId = session.schoolId;
    await this.applyDue(schoolId);
    const term = await this.currentTerm(schoolId);
    const { arms, subjects, teacherName } = await this.armsAndSubjects(schoolId);

    let meta: {
      id: string; name: string; state: string; note: string | null; term: string | null; termId: string | null;
      periodsPerDay: number; periodMinutes: number; firstStarts: string; breakAfter: number | null;
      schoolDays: string[]; appliesTo: string; checkClashes: boolean; builtBy: string | null;
      updatedAt: string; publishedAt: string | null; scheduledFor: string | null; live: boolean;
    };
    let grid: Grid;
    let periods: PeriodInfo[];

    if (id === "live") {
      const live = await this.liveGrid(schoolId, term?.id ?? null);
      grid = live.grid;
      periods = live.periods;
      const lessonPeriods = periods.filter((period) => period.n !== "break");
      const breakAt = periods.findIndex((period) => period.n === "break");
      meta = {
        id: "live", name: "The running timetable", state: "RUNNING",
        note: "The week as it was set up before versions were kept",
        term: term?.name ?? null, termId: term?.id ?? null,
        periodsPerDay: lessonPeriods.length,
        periodMinutes: lessonPeriods[0] ? minutes(lessonPeriods[0].end) - minutes(lessonPeriods[0].start) : 40,
        firstStarts: lessonPeriods[0]?.start ?? "08:00",
        breakAfter: breakAt > 0 ? periods.slice(0, breakAt).filter((period) => period.n !== "break").length : null,
        schoolDays: DAY_CODES.slice(0, 5), appliesTo: "Every arm", checkClashes: true,
        builtBy: null, updatedAt: (live.lastEdited ?? new Date()).toISOString(), publishedAt: null, scheduledFor: null, live: true
      };
    } else {
      const version = await prisma.timetableVersion.findFirst({
        where: { id, schoolId },
        include: { term: { select: { name: true } } }
      });
      if (!version) throw new NotFoundException("That timetable does not exist.");
      const settings = this.settingsOf(version);
      const builder = version.builtById
        ? await prisma.user.findUnique({ where: { id: version.builtById }, select: { firstName: true, lastName: true } })
        : null;
      grid = (version.grid ?? {}) as Grid;
      // The running version is the live week, not the snapshot it was published from.
      if (version.state === "RUNNING") {
        const live = await this.liveGrid(schoolId, version.termId);
        grid = Object.keys(live.grid).length ? live.grid : grid;
        periods = live.periods.length ? live.periods : buildPeriods(settings);
      } else {
        periods = buildPeriods(settings);
      }
      meta = {
        id: version.id, name: version.name, state: version.state, note: version.note,
        term: version.term?.name ?? null, termId: version.termId,
        ...settings, appliesTo: version.appliesTo, checkClashes: version.checkClashes,
        builtBy: builder ? fullName(builder) : null,
        updatedAt: version.updatedAt.toISOString(), publishedAt: version.publishedAt?.toISOString() ?? null, scheduledFor: version.scheduledFor?.toISOString() ?? null, live: version.state === "RUNNING"
      };
    }

    const clashes = clashesIn(grid).map((clash) => ({
      ...clash,
      teacher: teacherName.get(clash.teacherId) ?? "A teacher",
      dayName: dayLabel(clash.day),
      classNames: clash.classIds.map((classId) => arms.find((arm) => arm.id === classId)?.name ?? "An arm")
    }));
    return { version: meta, arms, subjects, grid, periods, clashes };
  }

  /* ─────────────── create / save ─────────────── */

  async create(session: SessionPayload, body: unknown) {
    const parsed = createSchema.parse(body);
    const schoolId = session.schoolId;
    const term = parsed.termId ? await prisma.term.findFirst({ where: { id: parsed.termId, schoolId } }) : await this.currentTerm(schoolId);
    const clash = await prisma.timetableVersion.findFirst({
      where: { schoolId, termId: term?.id ?? null, name: { equals: parsed.name, mode: "insensitive" } }
    });
    if (clash) throw new BadRequestException(`There is already a timetable called ${clash.name} for that term.`);

    const settings = {
      periodsPerDay: parsed.periodsPerDay,
      periodMinutes: parsed.periodMinutes,
      firstStarts: parsed.firstStarts,
      breakAfter: parseBreak(parsed.breakAfter),
      schoolDays: (parsed.schoolDays ?? DAY_CODES.slice(0, 5)).map((day) => day.toUpperCase().slice(0, 3))
    };

    let grid: Grid = {};
    if (parsed.startFrom.startsWith("A copy of the running")) {
      grid = (await this.liveGrid(schoolId, term?.id ?? null)).grid;
    } else if (parsed.startFrom.startsWith("A copy of another") && parsed.copyFromId) {
      if (parsed.copyFromId === "live") grid = (await this.liveGrid(schoolId, term?.id ?? null)).grid;
      else {
        const source = await prisma.timetableVersion.findFirst({ where: { id: parsed.copyFromId, schoolId } });
        if (!source) throw new NotFoundException("The timetable to copy from does not exist.");
        grid = (source.grid ?? {}) as Grid;
      }
    }
    grid = await this.scopeGrid(schoolId, grid, parsed.appliesTo, settings);

    const created = await prisma.timetableVersion.create({
      data: {
        schoolId,
        termId: term?.id ?? null,
        name: parsed.name,
        state: "DRAFT",
        ...settings,
        appliesTo: parsed.appliesTo,
        checkClashes: parsed.checkClashes,
        grid: grid as unknown as Prisma.InputJsonObject,
        builtById: session.userId
      }
    });
    await this.audit(session, AuditAction.CREATE, created.id, { name: created.name, startFrom: parsed.startFrom });
    return { id: created.id };
  }

  /** Keep only the arms a timetable applies to, and the periods and days it has. */
  private async scopeGrid(
    schoolId: string,
    grid: Grid,
    appliesTo: string,
    settings: { periodsPerDay: number; schoolDays: string[] }
  ): Promise<Grid> {
    const arms = await prisma.classRoom.findMany({
      where: { schoolId, deletedAt: null },
      include: { classLevel: true }
    });
    const allowed = new Set(
      arms
        .filter((arm) => {
          const stage = stageOf(arm.classLevel);
          if (appliesTo === "Junior Secondary only") return stage === "Junior Secondary";
          if (appliesTo === "Senior Secondary only") return stage === "Senior Secondary";
          return true;
        })
        .map((arm) => arm.id)
    );
    const days = new Set(settings.schoolDays.map((code) => DAY_CODES.indexOf(code) + 1));
    const out: Grid = {};
    for (const [classId, cells] of Object.entries(grid)) {
      if (!allowed.has(classId)) continue;
      for (const [key, cell] of Object.entries(cells)) {
        const [day, period] = key.split("|").map(Number);
        if (!days.has(day) || period > settings.periodsPerDay) continue;
        (out[classId] ??= {})[key] = cell;
      }
    }
    return out;
  }

  async save(session: SessionPayload, id: string, body: unknown) {
    const parsed = saveSchema.parse(body);
    const schoolId = session.schoolId;
    const version = await prisma.timetableVersion.findFirst({ where: { id, schoolId } });
    if (!version) throw new NotFoundException("That timetable does not exist.");
    if (version.state === "RUNNING") {
      throw new BadRequestException("The running timetable cannot be edited in place. Make a draft from it, change that, and publish it.");
    }

    let grid = (version.grid ?? {}) as Grid;
    // Changing a timetable takes it off its schedule: what was agreed is no longer what is in it.
    const data: Prisma.TimetableVersionUpdateInput = { scheduledFor: null, scheduledById: null, scheduleOptions: Prisma.DbNull };
    if (parsed.settings) {
      const next = parsed.settings;
      if (next.name !== undefined) data.name = next.name;
      if (next.periodsPerDay !== undefined) data.periodsPerDay = next.periodsPerDay;
      if (next.periodMinutes !== undefined) data.periodMinutes = next.periodMinutes;
      if (next.firstStarts !== undefined) data.firstStarts = next.firstStarts;
      if (next.breakAfter !== undefined) data.breakAfter = parseBreak(next.breakAfter);
      if (next.schoolDays !== undefined) data.schoolDays = next.schoolDays.map((day) => day.toUpperCase().slice(0, 3));
      if (next.appliesTo !== undefined) data.appliesTo = next.appliesTo;
      if (next.checkClashes !== undefined) data.checkClashes = next.checkClashes;
      if (next.termId) data.term = { connect: { id: next.termId } };
    }

    let skipped = 0;
    if (parsed.edits?.length) {
      const wanted = Array.from(new Set(parsed.edits.flatMap((edit) => Object.values(edit.cells).filter((value): value is string => Boolean(value)))));
      const mappings = await prisma.classSubject.findMany({
        where: { schoolId, isActive: true, subjectId: { in: wanted }, classId: { in: parsed.edits.flatMap((edit) => edit.classIds) } },
        select: { classId: true, subjectId: true, teacherId: true }
      });
      const mapping = new Map(mappings.map((row) => [`${row.classId}|${row.subjectId}`, row]));
      grid = { ...grid };
      for (const edit of parsed.edits) {
        for (const classId of edit.classIds) {
          const cells = { ...(grid[classId] ?? {}) };
          for (const [key, subjectId] of Object.entries(edit.cells)) {
            if (!subjectId) {
              delete cells[key];
              continue;
            }
            const row = mapping.get(`${classId}|${subjectId}`);
            if (!row) {
              skipped += 1;
              continue;
            }
            cells[key] = { subjectId, teacherId: row.teacherId };
          }
          if (Object.keys(cells).length) grid[classId] = cells;
          else delete grid[classId];
        }
      }
      data.grid = grid as unknown as Prisma.InputJsonObject;
    }
    await prisma.timetableVersion.update({ where: { id }, data });
    const clashes = clashesIn(grid);
    return {
      id,
      skipped,
      clashes: clashes.length,
      placed: Object.values(grid).reduce((sum, cells) => sum + Object.keys(cells).length, 0)
    };
  }

  /* ─────────────── publish / delete ─────────────── */

  /**
   * Publish now, or set it to publish itself on the day chosen. Either way the same
   * checks run first, so a timetable that cannot be published is refused today rather
   * than failing silently on the morning it was due.
   */
  async publish(session: SessionPayload, id: string, body: unknown) {
    const parsed = publishSchema.parse(body ?? {});
    const at = effectiveInstant(parsed.takesEffect, parsed.effectiveDate);
    if (!at) return this.runPublish(session, id, parsed);

    const version = await prisma.timetableVersion.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!version) throw new NotFoundException("That timetable does not exist.");
    if (version.state === "RUNNING") throw new BadRequestException("That timetable is already the one running.");
    const grid = (version.grid ?? {}) as Grid;
    if (!armsIn(grid).length) throw new BadRequestException("This timetable has no periods placed in any arm. Build it before scheduling it.");
    if (clashesIn(grid).length) throw new BadRequestException("This timetable has a teacher booked into two arms at once. Fix that before scheduling it.");
    await prisma.timetableVersion.update({
      where: { id },
      data: { scheduledFor: at, scheduledById: session.userId, scheduleOptions: parsed as unknown as Prisma.InputJsonObject }
    });
    await this.audit(session, AuditAction.UPDATE, id, { name: version.name, scheduledFor: at.toISOString() });
    return { id, scheduled: true, scheduledFor: at.toISOString(), periodsMoved: 0, teachersTold: 0, arms: armsIn(grid).length, announced: false, saturdayNotPublished: false };
  }

  async unschedule(session: SessionPayload, id: string) {
    const version = await prisma.timetableVersion.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!version) throw new NotFoundException("That timetable does not exist.");
    await prisma.timetableVersion.update({ where: { id }, data: { scheduledFor: null, scheduledById: null, scheduleOptions: Prisma.DbNull } });
    await this.audit(session, AuditAction.UPDATE, id, { name: version.name, unscheduled: true });
    return { id };
  }

  /** Publish whatever was scheduled for a day that has now come. Called whenever timetables are read. */
  async applyDue(schoolId: string) {
    const due = await prisma.timetableVersion.findMany({
      where: { schoolId, scheduledFor: { lte: new Date() }, state: { not: "RUNNING" } },
      orderBy: { scheduledFor: "asc" }
    });
    for (const version of due) {
      const actor = { schoolId, userId: version.scheduledById ?? version.builtById ?? "" } as SessionPayload;
      const options = (version.scheduleOptions ?? {}) as PublishOptions;
      try {
        await this.runPublish(actor, version.id, { ...options, takesEffect: "Immediately" });
      } catch {
        // Something changed since it was scheduled (a clash was introduced, say). It stays a
        // draft with its schedule cleared, so it does not retry on every read.
        await prisma.timetableVersion.update({ where: { id: version.id }, data: { scheduledFor: null, note: "It was due to publish but could not: check it for clashes." } });
      }
    }
  }

  private async runPublish(session: SessionPayload, id: string, parsed: PublishOptions) {
    const schoolId = session.schoolId;
    const version = await prisma.timetableVersion.findFirst({ where: { id, schoolId } });
    if (!version) throw new NotFoundException("That timetable does not exist.");
    if (version.state === "RUNNING") throw new BadRequestException("That timetable is already the one running.");
    const term = version.termId
      ? await prisma.term.findFirst({ where: { id: version.termId, schoolId } })
      : await this.currentTerm(schoolId);
    if (!term) throw new BadRequestException("Choose the term this timetable is for before publishing it.");

    const grid = (version.grid ?? {}) as Grid;
    const classIds = armsIn(grid);
    if (!classIds.length) throw new BadRequestException("This timetable has no periods placed in any arm. Build it before publishing.");
    const clashes = clashesIn(grid);
    if (clashes.length) {
      const names = await prisma.user.findMany({
        where: { id: { in: clashes.map((clash) => clash.teacherId) } },
        select: { id: true, firstName: true, lastName: true }
      });
      const who = new Map(names.map((user) => [user.id, fullName(user)]));
      const first = clashes[0];
      throw new BadRequestException(
        `${clashes.length} clash${clashes.length === 1 ? "" : "es"} ${clashes.length === 1 ? "stops" : "stop"} this being published. For example ${who.get(first.teacherId) ?? "a teacher"} is booked into ${first.classIds.length} arms on ${dayLabel(first.day)}, period ${first.period}. Move them first.`
      );
    }

    const before = await this.liveGrid(schoolId, term.id);
    const periods = buildPeriods(this.settingsOf(version));
    const lessonPeriods = periods.filter((period): period is PeriodInfo & { n: number } => period.n !== "break");
    const breakInfo = periods.find((period) => period.n === "break");
    const days = version.schoolDays.map((code) => DAY_CODES.indexOf(code) + 1).filter((day) => day >= 1 && day <= 5);
    const skippedSaturday = version.schoolDays.includes("SAT");

    const arms = await prisma.classRoom.findMany({ where: { id: { in: classIds }, schoolId }, select: { id: true, room: true } });
    const roomOf = new Map(arms.map((arm) => [arm.id, arm.room]));

    // What changes for whom — the number every teacher cares about.
    const changedTeachers = new Set<string>();
    let periodsMoved = 0;
    for (const classId of classIds) {
      const was = before.grid[classId] ?? {};
      const now = grid[classId] ?? {};
      for (const key of new Set([...Object.keys(was), ...Object.keys(now)])) {
        const a = was[key];
        const b = now[key];
        if (a?.subjectId === b?.subjectId && a?.teacherId === b?.teacherId) continue;
        periodsMoved += 1;
        if (a?.teacherId) changedTeachers.add(a.teacherId);
        if (b?.teacherId) changedTeachers.add(b.teacherId);
      }
    }

    // The version being retired is kept: a synthetic running week is snapshotted first,
    // so it can be put back later.
    const running = await prisma.timetableVersion.findFirst({ where: { schoolId, termId: term.id, state: "RUNNING", id: { not: id } } });

    await prisma.$transaction(async (tx) => {
      if (running) {
        await tx.timetableVersion.update({ where: { id: running.id }, data: { state: "ARCHIVED", archivedAt: new Date(), grid: before.grid as unknown as Prisma.InputJsonObject } });
      } else if (Object.keys(before.grid).length) {
        await tx.timetableVersion.create({
          data: {
            schoolId, termId: term.id, name: `Before ${version.name}`, state: "ARCHIVED",
            note: "The week that was running when this was published",
            periodsPerDay: Math.max(1, before.periods.filter((period) => period.n !== "break").length),
            grid: before.grid as unknown as Prisma.InputJsonObject, archivedAt: new Date(), builtById: session.userId
          }
        });
      }

      for (const classId of classIds) {
        const existing = await tx.timetableEntry.findMany({ where: { classId, termId: term.id } });
        const byKey = new Map(existing.map((entry) => [`${entry.dayOfWeek}|${entry.periodNumber}`, entry]));
        const wantedKeys = new Set<string>();
        for (const day of days) {
          for (const period of lessonPeriods) {
            const key = `${day}|${period.n}`;
            wantedKeys.add(key);
            const cell = grid[classId]?.[key];
            const data = {
              subjectId: cell?.subjectId ?? null,
              teacherId: cell?.teacherId ?? null,
              venue: cell ? roomOf.get(classId) ?? null : null,
              slotType: cell ? "lesson" : "free",
              startsAt: period.start,
              endsAt: period.end,
              isPublished: true,
              updatedById: session.userId
            };
            const found = byKey.get(key);
            if (found) await tx.timetableEntry.update({ where: { id: found.id }, data });
            else {
              await tx.timetableEntry.create({
                data: { schoolId, termId: term.id, academicSessionId: term.academicSessionId, classId, dayOfWeek: day, periodNumber: period.n, createdById: session.userId, ...data }
              });
            }
          }
          if (breakInfo) {
            const key = `${day}|${BREAK_PERIOD}`;
            wantedKeys.add(key);
            const data = { subjectId: null, teacherId: null, venue: null, slotType: "break", startsAt: breakInfo.start, endsAt: breakInfo.end, isPublished: true, updatedById: session.userId };
            const found = byKey.get(key);
            if (found) await tx.timetableEntry.update({ where: { id: found.id }, data });
            else {
              await tx.timetableEntry.create({
                data: { schoolId, termId: term.id, academicSessionId: term.academicSessionId, classId, dayOfWeek: day, periodNumber: BREAK_PERIOD, createdById: session.userId, ...data }
              });
            }
          }
        }
        // Anything the new week does not have comes off the live week — or goes free,
        // where an exam seating plan still points at it.
        for (const [key, entry] of byKey) {
          if (wantedKeys.has(key)) continue;
          try {
            await tx.$executeRaw`SAVEPOINT leftover`;
            await tx.timetableEntry.delete({ where: { id: entry.id } });
            await tx.$executeRaw`RELEASE SAVEPOINT leftover`;
          } catch {
            await tx.$executeRaw`ROLLBACK TO SAVEPOINT leftover`;
            await tx.timetableEntry.update({ where: { id: entry.id }, data: { subjectId: null, teacherId: null, slotType: "free" } });
          }
        }
      }

      const summary = {
        periodsMoved,
        teachersTold: changedTeachers.size,
        arms: classIds.length,
        note: parsed.note || undefined,
        notify: parsed.notify ?? [],
        saturdayNotPublished: skippedSaturday || undefined
      };
      await tx.timetableVersion.update({
        where: { id },
        data: { state: "RUNNING", termId: term.id, publishedAt: new Date(), publishedById: session.userId, publishSummary: summary as Prisma.InputJsonObject, archivedAt: null, scheduledFor: null, scheduledById: null, scheduleOptions: Prisma.DbNull }
      });
      await tx.timetablePublishLog.create({
        data: {
          schoolId, termId: term.id, academicSessionId: term.academicSessionId, action: "publish_version",
          publishedById: session.userId,
          notes: JSON.stringify({ version: version.name, ...summary })
        }
      });
    });

    // Tell whoever was chosen, in the app — one announcement per audience.
    let announced = false;
    const chosen = Array.from(new Set(parsed.notify ?? []));
    if (chosen.length) {
      const names = changedTeachers.size
        ? await prisma.user.findMany({ where: { id: { in: Array.from(changedTeachers) } }, select: { firstName: true, lastName: true } })
        : [];
      const masters = chosen.includes("form-masters")
        ? await prisma.classRoom.findMany({ where: { id: { in: classIds }, classTeacherId: { not: null } }, select: { classTeacher: { select: { firstName: true, lastName: true } } } })
        : [];
      const made = new Set<string>();
      for (const choice of chosen) {
        const audience = AUDIENCE[choice];
        if (!audience || made.has(`${audience}|${choice === "form-masters" ? "fm" : ""}`)) continue;
        made.add(`${audience}|${choice === "form-masters" ? "fm" : ""}`);
        const detail =
          choice === "teachers-changed"
            ? `${periodsMoved} period${periodsMoved === 1 ? " has" : "s have"} moved. Teachers whose week changed: ${names.map(fullName).join(", ") || "none"}.`
            : choice === "teachers-all"
              ? "Every teacher should check their week."
              : choice === "form-masters"
                ? `Form masters of the arms on it: ${Array.from(new Set(masters.map((row) => fullName(row.classTeacher)))).join(", ") || "none named"}.`
                : choice === "students"
                  ? "Your timetable has changed. Check your week in the portal."
                  : "Your child's timetable has changed. Check it in the portal.";
        await prisma.announcement.create({
          data: {
            schoolId, createdById: session.userId, channel: "IN_APP", audience,
            title: `A new timetable is running: ${version.name}`,
            body: `${detail}${parsed.note ? `\n\n${parsed.note}` : ""}`
          }
        });
        announced = true;
      }
    }
    await this.audit(session, AuditAction.APPROVE, id, { name: version.name, periodsMoved, teachersTold: changedTeachers.size, announced });
    return {
      id, periodsMoved, teachersTold: changedTeachers.size, arms: classIds.length, announced,
      saturdayNotPublished: skippedSaturday
    };
  }

  async remove(session: SessionPayload, id: string) {
    const version = await prisma.timetableVersion.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!version) throw new NotFoundException("That timetable does not exist.");
    if (version.state === "RUNNING") throw new BadRequestException("The running timetable cannot be deleted. Publish another one first.");
    await prisma.timetableVersion.delete({ where: { id } });
    await prisma.timetablePublishLog.create({
      data: {
        schoolId: session.schoolId, termId: version.termId, action: "discard_version", publishedById: session.userId,
        notes: JSON.stringify({ version: version.name, state: version.state, arms: armsIn((version.grid ?? {}) as Grid).length })
      }
    });
    await this.audit(session, AuditAction.DELETE, id, { name: version.name });
    return { id };
  }
}
