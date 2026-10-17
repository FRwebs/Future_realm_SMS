import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, SchoolCategory, SchoolSection, UserRole } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

/**
 * The structure of a school's teaching, read the way the Class & Timetable module
 * reads it: classes (the ladder students are promoted along), arms (the groups that
 * share a register), and the subject-arm mappings that say who teaches what.
 *
 * Nothing here is a second copy of anything. A class is a `ClassLevel`, an arm is a
 * `ClassRoom`, a mapping is a `ClassSubject`. This service adds the questions the
 * module has to answer across them — who is over capacity, which subject nobody
 * teaches, whose load is past the ceiling — and the writes that move them.
 */

const TEACHING_ROLES: UserRole[] = [
  UserRole.TEACHER,
  UserRole.CLASS_TEACHER,
  UserRole.SUBJECT_TEACHER,
  UserRole.HEAD_OF_DEPARTMENT
];

/** What a school's own ceiling is, until it says otherwise. */
export const DEFAULT_TEACHING_CEILING = 24;
const CEILING_RESOURCE = "teaching-ceilings";
const SCHOOL_CEILING_CODE = "school";
const DAY_MS = 86_400_000;

export const STREAMS = ["Science", "Commercial", "Arts", "Technical"] as const;

const stageSections: Record<string, { category: SchoolCategory; section: SchoolSection | null }> = {
  "Early Years": { category: SchoolCategory.NURSERY, section: SchoolSection.NURSERY },
  Primary: { category: SchoolCategory.PRIMARY, section: SchoolSection.PRIMARY },
  "Junior Secondary": { category: SchoolCategory.SECONDARY, section: SchoolSection.JUNIOR_SECONDARY },
  "Senior Secondary": { category: SchoolCategory.SECONDARY, section: SchoolSection.SENIOR_SECONDARY }
};

export function stageOf(level: { schoolSection: SchoolSection | null; section: SchoolCategory }): string {
  switch (level.schoolSection) {
    case SchoolSection.CRECHE:
    case SchoolSection.NURSERY:
      return "Early Years";
    case SchoolSection.PRIMARY:
      return "Primary";
    case SchoolSection.JUNIOR_SECONDARY:
      return "Junior Secondary";
    case SchoolSection.SENIOR_SECONDARY:
      return "Senior Secondary";
    default:
      break;
  }
  if (level.section === SchoolCategory.NURSERY) return "Early Years";
  if (level.section === SchoolCategory.PRIMARY) return "Primary";
  if (level.section === SchoolCategory.SECONDARY) return "Secondary";
  return "Other";
}

const addClassSchema = z.object({
  name: z.string().trim().min(2, "Name the class."),
  stage: z.enum(["Early Years", "Primary", "Junior Secondary", "Senior Secondary"]),
  position: z.coerce.number().int().min(0).max(200).optional(),
  arms: z.string().trim().optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(1).max(200).optional(),
  copyFromLevelId: z.string().optional().or(z.literal("")),
  visibleToParents: z.coerce.boolean().optional()
});

const addArmSchema = z.object({
  levelId: z.string().min(1, "Choose the class this arm belongs to."),
  arm: z.string().trim().min(1, "Name the arm.").max(40),
  capacity: z.coerce.number().int().min(1).max(200),
  formMasterId: z.string().optional().or(z.literal("")),
  room: z.string().trim().max(80).optional().or(z.literal("")),
  stream: z.string().trim().optional().or(z.literal("")),
  open: z.coerce.boolean().optional()
});

const updateArmSchema = addArmSchema.omit({ levelId: true }).partial().extend({
  reason: z.string().trim().optional()
});

const allocateSchema = z.object({
  studentIds: z.array(z.string()).min(1, "Choose at least one student."),
  classId: z.string().min(1, "Choose the arm they are going to."),
  reason: z.string().trim().optional()
});

const mapSchema = z.object({
  teacherId: z.string().min(1, "Choose the teacher."),
  subjectId: z.string().min(1, "Choose the subject."),
  classIds: z.array(z.string()).min(1, "A mapping always names the arm. Tick at least one."),
  role: z.enum(["PRIMARY", "SECOND", "COVER"]).default("PRIMARY"),
  periodsPerWeek: z.coerce.number().int().min(1).max(40).optional(),
  overCeilingReason: z.string().trim().optional()
});

const updateMappingSchema = z.object({
  teacherId: z.string().optional().nullable(),
  assistantTeacherId: z.string().optional().nullable(),
  periodsPerWeek: z.coerce.number().int().min(0).max(40).optional(),
  countsToAverage: z.coerce.boolean().optional(),
  overCeilingReason: z.string().trim().optional(),
  reason: z.string().trim().optional()
});

const ceilingSchema = z.object({
  teacherId: z.string().min(1),
  ceiling: z.coerce.number().int().min(1).max(120),
  duration: z.string().default("This term only"),
  reason: z.string().trim().min(3, "Say why this teacher carries more than the school ceiling."),
  approvedBy: z.string().optional()
});

const addSubjectSchema = z.object({
  name: z.string().trim().min(2, "Name the subject."),
  code: z.string().trim().min(1, "Give it a code.").max(12),
  category: z.string().trim().min(1),
  levelIds: z.array(z.string()).min(1, "Offer it to at least one class."),
  teacherId: z.string().optional().or(z.literal("")),
  countsToAverage: z.coerce.boolean().optional(),
  periodsPerWeek: z.coerce.number().int().min(1).max(40).optional()
});

/**
 * What an arm is called on screen. Most are "JSS 1 A", but a school that named its arms
 * after colours has a class "JSS 1" with an arm "Silver", and showing only "JSS 1" three
 * times is a list nobody can tell apart.
 */
export function armDisplayName(name: string, arm: string | null | undefined): string {
  const letter = (arm ?? "").trim();
  if (!letter || name.toLowerCase().endsWith(letter.toLowerCase())) return name;
  return `${name} ${letter}`;
}

function fullName(user: { firstName: string; lastName: string } | null | undefined): string {
  return user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : "";
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

@Injectable()
export class ClassStructureService {
  async ok<T>(dataPromise: Promise<T>, message?: string) {
    return { ok: true, success: true, ...(message ? { message } : {}), data: await dataPromise };
  }

  private async audit(
    session: SessionPayload,
    action: AuditAction,
    entityType: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue
  ) {
    await prisma.auditLog.create({
      data: { schoolId: session.schoolId, actorId: session.userId, action, entityType, entityId, metadata }
    });
  }

  /** The active term, with the session it belongs to. */
  private async currentTerm(schoolId: string) {
    return prisma.term.findFirst({
      where: { schoolId, isCurrent: true },
      include: { academicSession: { select: { name: true } } }
    });
  }

  /* ───────────────────────────── ceilings ───────────────────────────── */

  async ceilings(schoolId: string) {
    const rows = await prisma.configurationItem.findMany({
      where: { schoolId, resource: CEILING_RESOURCE, deletedAt: null }
    });
    const school = rows.find((row) => row.code === SCHOOL_CEILING_CODE);
    const schoolCeiling = Number((school?.data as { ceiling?: number } | null)?.ceiling ?? DEFAULT_TEACHING_CEILING);
    const byTeacher = new Map<string, { ceiling: number; duration: string; reason: string; approvedBy: string | null }>();
    for (const row of rows) {
      if (!row.code || row.code === SCHOOL_CEILING_CODE) continue;
      const data = (row.data ?? {}) as { ceiling?: number; duration?: string; reason?: string; approvedBy?: string };
      if (typeof data.ceiling !== "number") continue;
      byTeacher.set(row.code, {
        ceiling: data.ceiling,
        duration: data.duration ?? "This term only",
        reason: data.reason ?? "",
        approvedBy: data.approvedBy ?? null
      });
    }
    return { schoolCeiling, byTeacher };
  }

  async setCeiling(session: SessionPayload, body: unknown) {
    const parsed = ceilingSchema.parse(body);
    const teacher = await prisma.user.findFirst({
      where: { id: parsed.teacherId, schoolId: session.schoolId, deletedAt: null }
    });
    if (!teacher) throw new NotFoundException("That teacher is not on this school's staff.");
    const data = {
      ceiling: parsed.ceiling,
      duration: parsed.duration,
      reason: parsed.reason,
      approvedBy: parsed.approvedBy ?? null,
      setBy: session.userId,
      setAt: new Date().toISOString()
    } as Prisma.InputJsonObject;
    const existing = await prisma.configurationItem.findFirst({
      where: { schoolId: session.schoolId, resource: CEILING_RESOURCE, code: parsed.teacherId }
    });
    if (existing) {
      await prisma.configurationItem.update({ where: { id: existing.id }, data: { data, deletedAt: null, status: "ACTIVE" } });
    } else {
      await prisma.configurationItem.create({
        data: {
          schoolId: session.schoolId,
          resource: CEILING_RESOURCE,
          code: parsed.teacherId,
          name: `Ceiling · ${fullName(teacher)}`,
          description: parsed.reason,
          data
        }
      });
    }
    await this.audit(session, AuditAction.SETTINGS_UPDATE, "TeachingCeiling", parsed.teacherId, {
      teacher: fullName(teacher),
      ceiling: parsed.ceiling,
      reason: parsed.reason
    });
    return { teacherId: parsed.teacherId, ceiling: parsed.ceiling };
  }

  /* ───────────────────────────── overview ───────────────────────────── */

  /**
   * Everything the Classes tab shows, in one read: the ladder, the arms under each
   * rung, who has no arm, and what was done to the allocation lately.
   */
  async overview(session: SessionPayload) {
    const schoolId = session.schoolId;
    const [term, levels, arms, unallocated, subjectArms, recent] = await Promise.all([
      this.currentTerm(schoolId),
      prisma.classLevel.findMany({ where: { schoolId }, orderBy: { order: "asc" } }),
      prisma.classRoom.findMany({
        where: { schoolId, deletedAt: null },
        include: {
          classTeacher: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { students: { where: { status: "ACTIVE" } } } }
        },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
      }),
      prisma.student.findMany({
        where: { schoolId, status: "ACTIVE", currentClassId: null },
        select: { id: true, firstName: true, lastName: true, admissionNumber: true, admissionDate: true },
        orderBy: { admissionDate: "desc" },
        take: 60
      }),
      prisma.classSubject.findMany({
        where: { schoolId, isActive: true },
        select: { classId: true, teacherId: true }
      }),
      prisma.auditLog.findMany({
        where: { schoolId, entityType: "ClassAllocation" },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { actor: { select: { firstName: true, lastName: true } } }
      })
    ]);

    const subjectCount = new Map<string, { total: number; uncovered: number }>();
    for (const row of subjectArms) {
      const entry = subjectCount.get(row.classId) ?? { total: 0, uncovered: 0 };
      entry.total += 1;
      if (!row.teacherId) entry.uncovered += 1;
      subjectCount.set(row.classId, entry);
    }

    const armRows = arms.map((arm) => {
      const counts = subjectCount.get(arm.id) ?? { total: 0, uncovered: 0 };
      const roll = arm._count.students;
      const stream = arm.stream ?? (STREAMS.find((item) => item.toLowerCase() === arm.arm.toLowerCase()) ?? null);
      return {
        id: arm.id,
        name: armDisplayName(arm.name, arm.arm),
        levelId: arm.classLevelId,
        arm: arm.arm,
        stream,
        room: arm.room,
        isActive: arm.isActive,
        roll,
        capacity: arm.capacity,
        formMaster: arm.classTeacher ? { id: arm.classTeacher.id, name: fullName(arm.classTeacher) } : null,
        subjects: counts.total,
        uncoveredSubjects: counts.uncovered,
        state: roll > arm.capacity ? "Over capacity" : roll < arm.capacity * 0.8 ? "Under-filled" : "Open"
      };
    });

    const classRows = levels.map((level) => {
      const own = armRows.filter((arm) => arm.levelId === level.id);
      const roll = own.reduce((sum, arm) => sum + arm.roll, 0);
      const capacity = own.reduce((sum, arm) => sum + arm.capacity, 0);
      const over = own.filter((arm) => arm.roll > arm.capacity);
      const uncovered = own.reduce((sum, arm) => sum + arm.uncoveredSubjects, 0);
      return {
        id: level.id,
        name: level.name,
        stage: stageOf(level),
        position: level.order,
        isActive: level.isActive,
        visibleToParents: level.visibleToParents,
        arms: own.length,
        armNames: own.map((arm) => arm.arm),
        roll,
        capacity,
        formMastersNamed: own.filter((arm) => arm.formMaster).length,
        overArms: over.map((arm) => arm.name),
        uncoveredSubjectArms: uncovered,
        state: !level.isActive ? "Closed" : uncovered ? "Uncovered" : over.length ? "Over capacity" : "Open"
      };
    });

    // The one arm worth proposing a split for: the fullest one over its capacity.
    const worst = armRows
      .filter((arm) => arm.roll > arm.capacity)
      .sort((a, b) => b.roll - b.capacity - (a.roll - a.capacity))[0];

    return {
      term: term ? { id: term.id, name: term.name, session: term.academicSession.name } : null,
      classes: classRows,
      arms: armRows,
      unallocated: unallocated.map((student) => ({
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber,
        enrolledAt: student.admissionDate.toISOString()
      })),
      balancing: worst
        ? {
            armId: worst.id,
            name: worst.name,
            roll: worst.roll,
            capacity: worst.capacity,
            halves: [Math.ceil(worst.roll / 2), Math.floor(worst.roll / 2)]
          }
        : null,
      recent: recent.map((entry) => {
        const meta = (entry.metadata ?? {}) as { summary?: string; detail?: string };
        return {
          id: entry.id,
          label: meta.summary ?? "Allocation recorded",
          detail: meta.detail ?? "",
          by: fullName(entry.actor) || "Someone",
          at: entry.createdAt.toISOString()
        };
      })
    };
  }

  /* ───────────────────────────── classes & arms ───────────────────────────── */

  async createClass(session: SessionPayload, body: unknown) {
    const parsed = addClassSchema.parse(body);
    const schoolId = session.schoolId;
    const clash = await prisma.classLevel.findFirst({ where: { schoolId, name: { equals: parsed.name, mode: "insensitive" } } });
    if (clash) throw new BadRequestException(`There is already a class called ${clash.name}.`);

    const stage = stageSections[parsed.stage];
    const siblingCount = await prisma.classLevel.count({ where: { schoolId } });
    const armNames = Array.from(
      new Set(
        (parsed.arms ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
    const capacity = parsed.capacity ?? (stage.category === SchoolCategory.SECONDARY ? 40 : 35);

    // A class's offering is read off whichever of its arms carries the most subjects.
    const source = parsed.copyFromLevelId
      ? (
          await prisma.classRoom.findMany({
            where: { schoolId, classLevelId: parsed.copyFromLevelId, deletedAt: null },
            include: { classSubjects: { where: { isActive: true } } }
          })
        ).sort((a, b) => b.classSubjects.length - a.classSubjects.length)[0] ?? null
      : null;

    const created = await prisma.$transaction(async (tx) => {
      const level = await tx.classLevel.create({
        data: {
          schoolId,
          name: parsed.name,
          section: stage.category,
          schoolSection: stage.section,
          order: parsed.position ?? siblingCount + 1,
          visibleToParents: parsed.visibleToParents ?? true
        }
      });
      const rooms = [];
      for (const arm of armNames) {
        const room = await tx.classRoom.create({
          data: {
            schoolId,
            classLevelId: level.id,
            name: `${parsed.name} ${arm}`,
            arm,
            section: arm,
            category: parsed.stage,
            capacity,
            displayOrder: level.order
          }
        });
        if (source?.classSubjects.length) {
          await tx.classSubject.createMany({
            data: source.classSubjects.map((row) => ({
              schoolId,
              classId: room.id,
              subjectId: row.subjectId,
              assignedById: session.userId,
              passMark: row.passMark,
              periodsPerWeek: row.periodsPerWeek,
              countsToAverage: row.countsToAverage
            })),
            skipDuplicates: true
          });
        }
        rooms.push(room);
      }
      return { level, rooms };
    });

    await this.audit(session, AuditAction.CREATE, "ClassLevel", created.level.id, {
      name: parsed.name,
      arms: armNames,
      copiedFrom: parsed.copyFromLevelId || null
    });
    return { id: created.level.id, arms: created.rooms.length };
  }

  async updateClass(session: SessionPayload, levelId: string, body: unknown) {
    const parsed = addClassSchema.partial().extend({ reason: z.string().optional(), isActive: z.coerce.boolean().optional() }).parse(body);
    const level = await prisma.classLevel.findFirst({ where: { id: levelId, schoolId: session.schoolId } });
    if (!level) throw new NotFoundException("Class not found.");
    if (parsed.name && parsed.name.toLowerCase() !== level.name.toLowerCase()) {
      const clash = await prisma.classLevel.findFirst({
        where: { schoolId: session.schoolId, name: { equals: parsed.name, mode: "insensitive" }, id: { not: levelId } }
      });
      if (clash) throw new BadRequestException(`There is already a class called ${clash.name}.`);
    }
    const stage = parsed.stage ? stageSections[parsed.stage] : null;
    await prisma.$transaction(async (tx) => {
      await tx.classLevel.update({
        where: { id: levelId },
        data: {
          name: parsed.name,
          order: parsed.position,
          isActive: parsed.isActive,
          visibleToParents: parsed.visibleToParents,
          ...(stage ? { section: stage.category, schoolSection: stage.section } : {})
        }
      });
      // An arm's name is its class's name and its own letter, so renaming the class
      // renames every arm under it.
      if (parsed.name && parsed.name !== level.name) {
        const arms = await tx.classRoom.findMany({ where: { classLevelId: levelId, deletedAt: null } });
        for (const arm of arms) {
          await tx.classRoom.update({ where: { id: arm.id }, data: { name: `${parsed.name} ${arm.arm}` } });
        }
      }
    });
    await this.audit(session, AuditAction.UPDATE, "ClassLevel", levelId, { ...(parsed as Prisma.InputJsonObject) });
    return { id: levelId };
  }

  async createArm(session: SessionPayload, body: unknown) {
    const parsed = addArmSchema.parse(body);
    const level = await prisma.classLevel.findFirst({ where: { id: parsed.levelId, schoolId: session.schoolId } });
    if (!level) throw new NotFoundException("That class does not exist.");
    const existing = await prisma.classRoom.findFirst({
      where: { schoolId: session.schoolId, classLevelId: level.id, arm: { equals: parsed.arm, mode: "insensitive" }, deletedAt: null }
    });
    if (existing) throw new BadRequestException(`${level.name} already has an arm called ${existing.arm}.`);
    if (parsed.formMasterId) await this.assertTeacher(session.schoolId, parsed.formMasterId);
    const created = await prisma.classRoom.create({
      data: {
        schoolId: session.schoolId,
        classLevelId: level.id,
        name: `${level.name} ${parsed.arm}`,
        arm: parsed.arm,
        section: parsed.arm,
        category: stageOf(level),
        capacity: parsed.capacity,
        room: parsed.room || null,
        stream: parsed.stream && parsed.stream !== "Not applicable" ? parsed.stream : null,
        classTeacherId: parsed.formMasterId || null,
        isActive: parsed.open ?? true,
        displayOrder: level.order
      }
    });
    await this.audit(session, AuditAction.CREATE, "ClassRoom", created.id, { name: created.name });
    return { id: created.id };
  }

  private async assertTeacher(schoolId: string, userId: string) {
    const found = await prisma.user.count({
      where: { id: userId, schoolId, deletedAt: null, role: { in: TEACHING_ROLES } }
    });
    if (!found) throw new BadRequestException("That person is not on this school's teaching staff.");
  }

  async updateArm(session: SessionPayload, armId: string, body: unknown) {
    const parsed = updateArmSchema.parse(body);
    const arm = await prisma.classRoom.findFirst({
      where: { id: armId, schoolId: session.schoolId, deletedAt: null },
      include: { classLevel: true }
    });
    if (!arm) throw new NotFoundException("Arm not found.");
    if (parsed.formMasterId) await this.assertTeacher(session.schoolId, parsed.formMasterId);
    if (parsed.arm && parsed.arm.toLowerCase() !== arm.arm.toLowerCase()) {
      const clash = await prisma.classRoom.findFirst({
        where: {
          schoolId: session.schoolId,
          classLevelId: arm.classLevelId,
          arm: { equals: parsed.arm, mode: "insensitive" },
          deletedAt: null,
          id: { not: armId }
        }
      });
      if (clash) throw new BadRequestException(`${arm.classLevel.name} already has an arm called ${clash.arm}.`);
    }
    await prisma.classRoom.update({
      where: { id: armId },
      data: {
        ...(parsed.arm ? { arm: parsed.arm, section: parsed.arm, name: `${arm.classLevel.name} ${parsed.arm}` } : {}),
        capacity: parsed.capacity,
        room: parsed.room === undefined ? undefined : parsed.room || null,
        stream: parsed.stream === undefined ? undefined : parsed.stream && parsed.stream !== "Not applicable" ? parsed.stream : null,
        classTeacherId: parsed.formMasterId === undefined ? undefined : parsed.formMasterId || null,
        isActive: parsed.open
      }
    });
    await this.audit(session, AuditAction.UPDATE, "ClassRoom", armId, { ...(parsed as Prisma.InputJsonObject) });
    return { id: armId };
  }

  async deleteArm(session: SessionPayload, armId: string) {
    const arm = await prisma.classRoom.findFirst({
      where: { id: armId, schoolId: session.schoolId, deletedAt: null },
      include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } }
    });
    if (!arm) throw new NotFoundException("Arm not found.");
    if (arm._count.students > 0) {
      throw new BadRequestException(
        `${arm.name} has ${arm._count.students} student${arm._count.students === 1 ? "" : "s"} on its roll. Move them to another arm first.`
      );
    }
    await prisma.classRoom.update({ where: { id: armId }, data: { deletedAt: new Date(), isActive: false } });
    await this.audit(session, AuditAction.DELETE, "ClassRoom", armId, { name: arm.name });
    return { id: armId };
  }

  /**
   * A class goes only once nobody is in it. Its empty arms go with it; if the class has
   * history that other records still point at, it is closed rather than erased, and the
   * answer says which happened.
   */
  async deleteClass(session: SessionPayload, levelId: string) {
    const level = await prisma.classLevel.findFirst({ where: { id: levelId, schoolId: session.schoolId } });
    if (!level) throw new NotFoundException("Class not found.");
    const arms = await prisma.classRoom.findMany({
      where: { classLevelId: levelId, deletedAt: null },
      include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } }
    });
    const students = arms.reduce((sum, arm) => sum + arm._count.students, 0);
    if (students > 0) {
      throw new BadRequestException(
        `${level.name} has ${students} student${students === 1 ? "" : "s"} in its arms. Move them first, then delete the class.`
      );
    }
    // Try to take the class out entirely: its empty arms, the subjects offered to them,
    // then the class. If any record still points at it (a score, a timetable entry) the
    // whole attempt is undone and the class is closed instead.
    let erased = true;
    try {
      await prisma.$transaction(async (tx) => {
        const armIds = arms.map((arm) => arm.id);
        await tx.classSubject.deleteMany({ where: { classId: { in: armIds } } });
        await tx.classRoom.deleteMany({ where: { classLevelId: levelId } });
        await tx.classLevel.delete({ where: { id: levelId } });
      });
    } catch {
      erased = false;
      await prisma.classRoom.updateMany({ where: { classLevelId: levelId, deletedAt: null }, data: { deletedAt: new Date(), isActive: false } });
      await prisma.classLevel.update({ where: { id: levelId }, data: { isActive: false } });
    }
    await this.audit(session, AuditAction.DELETE, "ClassLevel", levelId, { name: level.name, arms: arms.length, erased });
    return { id: levelId, erased };
  }

  /** Place students in an arm, or move them between arms, and keep a record of it. */
  async allocate(session: SessionPayload, body: unknown) {
    const parsed = allocateSchema.parse(body);
    const target = await prisma.classRoom.findFirst({
      where: { id: parsed.classId, schoolId: session.schoolId, deletedAt: null },
      include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } }
    });
    if (!target) throw new NotFoundException("That arm does not exist.");
    const targetName = armDisplayName(target.name, target.arm);
    if (!target.isActive) {
      throw new BadRequestException(`${targetName} is closed for allocation. Open it first, or choose another arm.`);
    }
    const students = await prisma.student.findMany({
      where: { id: { in: parsed.studentIds }, schoolId: session.schoolId, status: "ACTIVE" },
      select: { id: true, currentClassId: true, currentClass: { select: { name: true, arm: true } } }
    });
    if (students.length !== new Set(parsed.studentIds).size) {
      throw new BadRequestException("One or more of those students is not an active student of this school.");
    }
    // Two arms can share a name (a class "JSS 1" with an arm "Silver" and another "A"),
    // so "already there" is a question about the arm's id, never its name.
    const moving = students.filter((student) => student.currentClassId !== target.id);
    await prisma.student.updateMany({ where: { id: { in: moving.map((student) => student.id) } }, data: { currentClassId: target.id } });

    const sources = Array.from(
      new Set(moving.map((student) => (student.currentClass ? armDisplayName(student.currentClass.name, student.currentClass.arm) : "no arm")))
    );
    const after = target._count.students + moving.length;
    await this.audit(session, AuditAction.UPDATE, "ClassAllocation", target.id, {
      summary: `${moving.length} student${moving.length === 1 ? "" : "s"} moved ${sources.length === 1 ? `${sources[0]} ` : ""}→ ${targetName}`,
      detail: `${parsed.reason ? `${parsed.reason} · ` : ""}${after > target.capacity ? `${after - target.capacity} over capacity` : "within capacity"}`,
      count: moving.length,
      from: sources,
      to: targetName
    });
    return {
      moved: moving.length,
      target: targetName,
      roll: after,
      capacity: target.capacity,
      overCapacity: after > target.capacity
    };
  }

  /* ───────────────────────────── teaching ───────────────────────────── */

  /**
   * Where each subject's scores stand in the active term, per arm: how many children
   * have marks, what the arm averaged, and whether the sheet is still being worked on,
   * has been sent back, is waiting for review or has been approved.
   */
  private async scoreSummary(schoolId: string, termId: string | null) {
    const out = new Map<string, { state: string; average: number | null; students: number }>();
    if (!termId) return out;
    const rows = await prisma.$queryRaw<
      Array<{ classId: string; subjectId: string; students: number; avg: number | null; draft: boolean; ret: number; appr: number; cnt: number }>
    >(Prisma.sql`
      with per as (
        select rs."classId" as "classId", se."subjectId" as "subjectId", se."studentId" as "studentId",
               sum(se.score) as total, bool_or(se."isDraft") as draft,
               count(*) filter (where rs.status in ('RETURNED','REJECTED')) as ret,
               count(*) filter (where rs.status in ('APPROVED','PUBLISHED')) as appr,
               count(*) as cnt
        from "ScoreEntry" se
        join "ResultSheet" rs on rs.id = se."resultSheetId"
        where rs."schoolId" = ${schoolId} and rs."termId" = ${termId}
        group by 1, 2, 3
      )
      select "classId", "subjectId", count(*)::int as students, avg(total)::float as avg,
             bool_or(draft) as draft, sum(ret)::int as ret, sum(appr)::int as appr, sum(cnt)::int as cnt
      from per group by 1, 2
    `);
    for (const row of rows) {
      const state = row.draft
        ? "In progress"
        : row.ret > 0
          ? "Returned"
          : row.appr >= row.cnt
            ? "Approved"
            : "Submitted";
      out.set(`${row.classId}|${row.subjectId}`, {
        state,
        average: row.avg === null ? null : Math.round(row.avg * 10) / 10,
        students: row.students
      });
    }
    return out;
  }

  /**
   * Every subject-arm in the school, who teaches it, and every teacher's load — the
   * same mappings read from the subject's side and from the person's side.
   */
  async teaching(session: SessionPayload) {
    const schoolId = session.schoolId;
    const [term, ceilings, mappings, teachers, combos, catalogue] = await Promise.all([
      this.currentTerm(schoolId),
      this.ceilings(schoolId),
      prisma.classSubject.findMany({
        where: { schoolId, isActive: true },
        include: {
          subject: {
            select: {
              id: true, name: true, code: true, isCore: true, section: true, periodsPerWeek: true,
              trackSpecific: true, tradeSubject: true, department: { select: { name: true } }
            }
          },
          classRoom: {
            select: {
              id: true, name: true, arm: true, stream: true,
              classLevel: { select: { id: true, name: true, order: true } },
              _count: { select: { students: { where: { status: "ACTIVE" } } } }
            }
          }
        }
      }),
      prisma.user.findMany({
        where: { schoolId, deletedAt: null, role: { in: TEACHING_ROLES } },
        select: {
          id: true, firstName: true, lastName: true, email: true, phone: true, role: true,
          staffProfile: { select: { employeeNo: true, designation: true, department: { select: { name: true } } } }
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }]
      }),
      prisma.subjectCombination.findMany({
        where: { schoolId },
        select: { studentId: true, classId: true, track: true, subjectIds: true, student: { select: { firstName: true, lastName: true } } }
      }),
      prisma.subject.findMany({
        where: { schoolId, deletedAt: null },
        select: { id: true, name: true, code: true, isCore: true, department: { select: { name: true } } },
        orderBy: { name: "asc" }
      })
    ]);

    const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));
    const termStart = term?.startDate ?? null;
    const now = new Date();

    const comboByClassSubject = new Map<string, number>();
    for (const combo of combos) {
      const ids = Array.isArray(combo.subjectIds) ? (combo.subjectIds as unknown[]).map(String) : [];
      for (const subjectId of ids) {
        const key = `${combo.classId}|${subjectId}`;
        comboByClassSubject.set(key, (comboByClassSubject.get(key) ?? 0) + 1);
      }
    }
    const armsWithCombos = new Set(combos.map((combo) => combo.classId).filter(Boolean));
    const scores = await this.scoreSummary(schoolId, term?.id ?? null);

    const subjectArms = mappings.map((row) => {
      const teacher = row.teacherId ? teacherById.get(row.teacherId) : undefined;
      const assistant = row.assistantTeacherId ? teacherById.get(row.assistantTeacherId) : undefined;
      const periods = row.periodsPerWeek ?? row.subject.periodsPerWeek;
      const roll = row.classRoom._count.students;
      // Where a student registers for subjects individually, a taker is a student who
      // registered for it. Everywhere else the whole arm takes what the arm is offered.
      const takers = armsWithCombos.has(row.classId)
        ? comboByClassSubject.get(`${row.classId}|${row.subjectId}`) ?? 0
        : roll;
      return {
        id: row.id,
        classId: row.classId,
        arm: armDisplayName(row.classRoom.name, row.classRoom.arm),
        armLabel: row.classRoom.arm,
        levelId: row.classRoom.classLevel.id,
        level: row.classRoom.classLevel.name,
        levelOrder: row.classRoom.classLevel.order,
        subjectId: row.subjectId,
        subject: row.subject.name,
        code: row.subject.code,
        category: row.subject.isCore ? "Core" : row.subject.trackSpecific ? titleCase(row.subject.trackSpecific) : row.subject.tradeSubject ? "Trade" : "Elective",
        department: row.subject.department?.name ?? null,
        teacher: teacher ? { id: teacher.id, name: fullName(teacher), department: teacher.staffProfile?.department?.name ?? null } : null,
        assistant: assistant ? { id: assistant.id, name: fullName(assistant) } : null,
        periods,
        takers,
        countsToAverage: row.countsToAverage,
        daysUnassigned: row.teacherId ? 0 : daysBetween(termStart ?? row.assignedAt, now),
        compulsory: row.subject.isCore,
        scores: scores.get(`${row.classId}|${row.subjectId}`) ?? { state: row.teacherId ? "Not started" : "Unassigned", average: null, students: 0 }
      };
    });

    const loads = new Map<string, number>();
    for (const row of subjectArms) {
      if (!row.teacher) continue;
      loads.set(row.teacher.id, (loads.get(row.teacher.id) ?? 0) + row.periods);
    }

    const teacherRows = teachers.map((teacher) => {
      const own = subjectArms.filter((row) => row.teacher?.id === teacher.id);
      const periods = loads.get(teacher.id) ?? 0;
      const override = ceilings.byTeacher.get(teacher.id);
      const ceiling = override?.ceiling ?? ceilings.schoolCeiling;
      return {
        id: teacher.id,
        name: fullName(teacher),
        email: teacher.email,
        phone: teacher.phone,
        staffNo: teacher.staffProfile?.employeeNo ?? null,
        designation: teacher.staffProfile?.designation ?? null,
        department: teacher.staffProfile?.department?.name ?? null,
        subjects: Array.from(new Set(own.map((row) => row.subject))),
        arms: Array.from(new Set(own.map((row) => row.arm))),
        subjectArms: own.length,
        sheetsOwed: own.filter((row) => row.scores.state === "In progress" || row.scores.state === "Returned").length,
        periods,
        ceiling,
        raised: Boolean(override),
        load: periods > ceiling ? "Over the ceiling" : periods === ceiling ? "At the ceiling" : periods === 0 ? "No assignment" : periods < Math.max(6, Math.round(ceiling * 0.5)) ? "Under-loaded" : "Within range"
      };
    });

    // The one rule the data can actually prove: a student registered for a subject
    // that is restricted to a stream they are not in.
    const invalid: Array<{ student: string; arm: string; detail: string }> = [];
    const subjectsById = new Map(mappings.map((row) => [row.subjectId, row.subject]));
    const armById = new Map(mappings.map((row) => [row.classId, row.classRoom]));
    for (const combo of combos) {
      const ids = Array.isArray(combo.subjectIds) ? (combo.subjectIds as unknown[]).map(String) : [];
      for (const id of ids) {
        const subject = subjectsById.get(id);
        if (subject?.trackSpecific && combo.track && subject.trackSpecific.toLowerCase() !== combo.track.toLowerCase()) {
          invalid.push({
            student: fullName(combo.student),
            arm: (combo.classId ? armById.get(combo.classId)?.name : undefined) ?? "No arm",
            detail: `Registered for ${subject.name}, which is restricted to the ${titleCase(subject.trackSpecific)} stream. They are in the ${titleCase(combo.track)} stream.`
          });
        }
      }
    }

    return {
      term: term ? { id: term.id, name: term.name, session: term.academicSession.name } : null,
      schoolCeiling: ceilings.schoolCeiling,
      subjectArms,
      teachers: teacherRows,
      invalidCombinations: invalid,
      subjectCount: catalogue.length,
      catalogue: catalogue.map((subject) => ({
        id: subject.id,
        name: subject.name,
        code: subject.code,
        category: subject.isCore ? "Core" : "Elective",
        department: subject.department?.name ?? null
      }))
    };
  }

  /** Map one subject to one teacher in every arm named, refusing a load past the ceiling without a reason. */
  async mapSubject(session: SessionPayload, body: unknown) {
    const parsed = mapSchema.parse(body);
    const schoolId = session.schoolId;
    await this.assertTeacher(schoolId, parsed.teacherId);
    const subject = await prisma.subject.findFirst({ where: { id: parsed.subjectId, schoolId, deletedAt: null } });
    if (!subject) throw new NotFoundException("That subject is not in the catalogue.");
    const arms = await prisma.classRoom.findMany({ where: { id: { in: parsed.classIds }, schoolId, deletedAt: null } });
    if (arms.length !== new Set(parsed.classIds).size) throw new BadRequestException("One of those arms does not exist.");

    const periods = parsed.periodsPerWeek ?? subject.periodsPerWeek;
    const teaching = await this.teaching(session);
    const teacher = teaching.teachers.find((item) => item.id === parsed.teacherId);
    const existing = await prisma.classSubject.findMany({
      where: { schoolId, subjectId: parsed.subjectId, classId: { in: parsed.classIds } }
    });
    // Mapping the teacher onto a subject-arm they already hold must not count it twice.
    const alreadyHeld = existing
      .filter((row) => row.teacherId === parsed.teacherId)
      .reduce((sum, row) => sum + (row.periodsPerWeek ?? subject.periodsPerWeek), 0);
    const after = (teacher?.periods ?? 0) - (parsed.role === "PRIMARY" ? alreadyHeld : 0) + (parsed.role === "PRIMARY" ? periods * arms.length : 0);
    const ceiling = teacher?.ceiling ?? teaching.schoolCeiling;
    if (parsed.role === "PRIMARY" && after > ceiling && !parsed.overCeilingReason) {
      throw new BadRequestException(
        `${teacher?.name ?? "That teacher"} would be at ${after} periods a week, past the ceiling of ${ceiling}. Say why in the reason box, or raise their ceiling first.`
      );
    }

    for (const arm of arms) {
      const found = existing.find((row) => row.classId === arm.id);
      const teacherField = parsed.role === "PRIMARY" ? { teacherId: parsed.teacherId } : { assistantTeacherId: parsed.teacherId };
      if (found) {
        await prisma.classSubject.update({
          where: { id: found.id },
          data: { ...teacherField, periodsPerWeek: periods, assignedById: session.userId, assignedAt: new Date(), isActive: true }
        });
      } else {
        await prisma.classSubject.create({
          data: { schoolId, classId: arm.id, subjectId: parsed.subjectId, ...teacherField, periodsPerWeek: periods, assignedById: session.userId }
        });
      }
    }
    await this.audit(session, AuditAction.UPDATE, "ClassSubject", parsed.subjectId, {
      teacher: teacher?.name,
      subject: subject.name,
      arms: arms.map((arm) => arm.name),
      role: parsed.role,
      periods,
      loadAfter: after,
      overCeilingReason: parsed.overCeilingReason || undefined
    });
    return { mapped: arms.length, loadAfter: after, ceiling };
  }

  async updateMapping(session: SessionPayload, id: string, body: unknown) {
    const parsed = updateMappingSchema.parse(body);
    const existing = await prisma.classSubject.findFirst({
      where: { id, schoolId: session.schoolId },
      include: { subject: true, classRoom: { select: { name: true } } }
    });
    if (!existing) throw new NotFoundException("That subject-arm mapping does not exist.");
    if (parsed.teacherId) await this.assertTeacher(session.schoolId, parsed.teacherId);
    if (parsed.assistantTeacherId) await this.assertTeacher(session.schoolId, parsed.assistantTeacherId);
    if (parsed.teacherId && parsed.teacherId === parsed.assistantTeacherId) {
      throw new BadRequestException("The primary and the second teacher must be different people.");
    }
    if (parsed.teacherId && parsed.teacherId !== existing.teacherId) {
      const teaching = await this.teaching(session);
      const teacher = teaching.teachers.find((item) => item.id === parsed.teacherId);
      const periods = parsed.periodsPerWeek ?? existing.periodsPerWeek ?? existing.subject.periodsPerWeek;
      const after = (teacher?.periods ?? 0) + periods;
      const ceiling = teacher?.ceiling ?? teaching.schoolCeiling;
      if (after > ceiling && !parsed.overCeilingReason) {
        throw new BadRequestException(
          `${teacher?.name ?? "That teacher"} would be at ${after} periods a week, past the ceiling of ${ceiling}. Say why in the reason box, or raise their ceiling first.`
        );
      }
    }
    await prisma.classSubject.update({
      where: { id },
      data: {
        teacherId: parsed.teacherId === undefined ? undefined : parsed.teacherId || null,
        assistantTeacherId: parsed.assistantTeacherId === undefined ? undefined : parsed.assistantTeacherId || null,
        periodsPerWeek: parsed.periodsPerWeek,
        countsToAverage: parsed.countsToAverage,
        ...(parsed.teacherId !== undefined ? { assignedById: session.userId, assignedAt: new Date() } : {})
      }
    });
    await this.audit(session, AuditAction.UPDATE, "ClassSubject", id, {
      subject: existing.subject.name,
      arm: existing.classRoom.name,
      reason: parsed.reason || parsed.overCeilingReason || undefined
    });
    return { id };
  }

  async removeMapping(session: SessionPayload, id: string) {
    const existing = await prisma.classSubject.findFirst({
      where: { id, schoolId: session.schoolId },
      include: { subject: true, classRoom: { select: { name: true } } }
    });
    if (!existing) throw new NotFoundException("That subject-arm mapping does not exist.");
    const scores = await prisma.scoreEntry.count({
      where: { schoolId: session.schoolId, subjectId: existing.subjectId, student: { currentClassId: existing.classId } }
    });
    if (scores > 0) {
      throw new BadRequestException(
        `${scores} score${scores === 1 ? " has" : "s have"} been entered for ${existing.subject.name} in ${existing.classRoom.name}. Take the teacher off it instead of removing the subject.`
      );
    }
    await prisma.classSubject.delete({ where: { id } });
    await this.audit(session, AuditAction.DELETE, "ClassSubject", id, { subject: existing.subject.name, arm: existing.classRoom.name });
    return { id };
  }

  /** Add a subject to the catalogue and offer it to every arm of the classes chosen. */
  async addSubject(session: SessionPayload, body: unknown) {
    const parsed = addSubjectSchema.parse(body);
    const schoolId = session.schoolId;
    const clash = await prisma.subject.findFirst({
      where: { schoolId, deletedAt: null, OR: [{ code: { equals: parsed.code, mode: "insensitive" } }, { name: { equals: parsed.name, mode: "insensitive" } }] }
    });
    if (clash) throw new BadRequestException(`${clash.name} (${clash.code}) is already in the catalogue.`);
    if (parsed.teacherId) await this.assertTeacher(schoolId, parsed.teacherId);
    const arms = await prisma.classRoom.findMany({
      where: { schoolId, deletedAt: null, classLevelId: { in: parsed.levelIds } },
      select: { id: true }
    });
    const category = parsed.category;
    const stream = ["Science", "Commercial", "Arts"].includes(category) ? category.toUpperCase() : null;
    const created = await prisma.$transaction(async (tx) => {
      const subject = await tx.subject.create({
        data: {
          schoolId,
          name: parsed.name,
          code: parsed.code.toUpperCase(),
          isCore: category === "Core",
          isOptional: category !== "Core",
          trackSpecific: stream,
          tradeSubject: category === "Trade",
          periodsPerWeek: parsed.periodsPerWeek ?? 3
        }
      });
      if (arms.length) {
        await tx.classSubject.createMany({
          data: arms.map((arm) => ({
            schoolId,
            classId: arm.id,
            subjectId: subject.id,
            teacherId: parsed.teacherId || null,
            assignedById: session.userId,
            countsToAverage: parsed.countsToAverage ?? true
          })),
          skipDuplicates: true
        });
      }
      return subject;
    });
    await this.audit(session, AuditAction.CREATE, "Subject", created.id, { name: created.name, arms: arms.length });
    return { id: created.id, arms: arms.length };
  }

  /* ───────────────────────────── arm page ───────────────────────────── */

  /** One arm's responsible people and the load its form master carries elsewhere. */
  async armDetail(session: SessionPayload, armId: string) {
    const arm = await prisma.classRoom.findFirst({
      where: { id: armId, schoolId: session.schoolId, deletedAt: null },
      include: {
        classLevel: true,
        classTeacher: {
          select: {
            id: true, firstName: true, lastName: true, email: true, phone: true, lastLoginAt: true,
            staffProfile: { select: { employeeNo: true, employmentDate: true, designation: true, department: { select: { name: true } } } }
          }
        },
        _count: { select: { students: { where: { status: "ACTIVE" } } } }
      }
    });
    if (!arm) throw new NotFoundException("Arm not found.");
    const term = await this.currentTerm(session.schoolId);
    const [teaching, siblings, activity, students, attendance, owing, sheets, siblingSheets] = await Promise.all([
      this.teaching(session),
      prisma.classRoom.findMany({
        where: { schoolId: session.schoolId, classLevelId: arm.classLevelId, deletedAt: null },
        select: { id: true, name: true, arm: true, _count: { select: { students: { where: { status: "ACTIVE" } } } }, capacity: true },
        orderBy: { name: "asc" }
      }),
      prisma.auditLog.findMany({
        where: { schoolId: session.schoolId, entityId: armId },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { actor: { select: { firstName: true, lastName: true } } }
      }),
      prisma.student.findMany({
        where: { schoolId: session.schoolId, currentClassId: armId, status: "ACTIVE" },
        select: {
          id: true, firstName: true, lastName: true, admissionNumber: true, gender: true, userId: true,
          guardians: { select: { isPrimary: true, guardian: { select: { firstName: true, lastName: true, phone: true, relationship: true } } } }
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
      }),
      term
        ? prisma.studentAttendance.groupBy({
            by: ["studentId", "status"],
            where: { schoolId: session.schoolId, classId: armId, termId: term.id },
            _count: { _all: true }
          })
        : Promise.resolve([] as Array<{ studentId: string; status: string; _count: { _all: number } }>),
      prisma.invoice.groupBy({
        by: ["studentId"],
        where: {
          schoolId: session.schoolId,
          student: { currentClassId: armId },
          status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
          balance: { gt: 0 }
        },
        _sum: { balance: true }
      }),
      term
        ? prisma.resultSheet.findMany({
            where: { schoolId: session.schoolId, classId: armId, termId: term.id },
            select: { studentId: true, averageScore: true, grade: true, position: true, status: true }
          })
        : Promise.resolve([]),
      term
        ? prisma.resultSheet.groupBy({
            by: ["classId"],
            where: { schoolId: session.schoolId, termId: term.id, classRoom: { classLevelId: arm.classLevelId } },
            _avg: { averageScore: true },
            _count: { _all: true }
          })
        : Promise.resolve([])
    ]);
    const sheetOf = new Map(sheets.map((sheet) => [sheet.studentId, sheet]));
    const resultState = (status: string | undefined) =>
      !status
        ? "No result yet"
        : status === "DRAFT"
          ? "In progress"
          : status === "SUBMITTED" || status === "UNDER_REVIEW"
            ? "Submitted"
            : status === "APPROVED"
              ? "Approved"
              : status === "PUBLISHED"
                ? "Published"
                : "Returned";
    const ranked = [...sheets].sort((a, b) => b.averageScore - a.averageScore);
    const armAverage = sheets.length ? Math.round((sheets.reduce((sum, sheet) => sum + sheet.averageScore, 0) / sheets.length) * 10) / 10 : null;
    const averageOf = new Map(siblingSheets.map((row) => [row.classId, row._avg.averageScore === null ? null : Math.round(Number(row._avg.averageScore) * 10) / 10]));
    const marked = new Map<string, { present: number; total: number }>();
    for (const row of attendance) {
      const entry = marked.get(row.studentId) ?? { present: 0, total: 0 };
      entry.total += row._count._all;
      if (row.status !== "ABSENT") entry.present += row._count._all;
      marked.set(row.studentId, entry);
    }
    const owes = new Map(owing.map((row) => [row.studentId, Number(row._sum.balance ?? 0)]));
    const master = arm.classTeacher ? teaching.teachers.find((teacher) => teacher.id === arm.classTeacher?.id) : undefined;
    const otherArms = master
      ? (await prisma.classRoom.findMany({
          where: { schoolId: session.schoolId, classTeacherId: master.id, deletedAt: null, id: { not: armId } },
          select: { name: true }
        })).map((row) => row.name)
      : [];
    return {
      id: arm.id,
      name: armDisplayName(arm.name, arm.arm),
      level: arm.classLevel.name,
      levelId: arm.classLevelId,
      stage: stageOf(arm.classLevel),
      stream: arm.stream ?? (STREAMS.find((item) => item.toLowerCase() === arm.arm.toLowerCase()) ?? null),
      room: arm.room,
      roll: arm._count.students,
      capacity: arm.capacity,
      isActive: arm.isActive,
      formMaster: arm.classTeacher
        ? {
            id: arm.classTeacher.id,
            name: fullName(arm.classTeacher),
            email: arm.classTeacher.email,
            phone: arm.classTeacher.phone,
            staffNo: arm.classTeacher.staffProfile?.employeeNo ?? null,
            designation: arm.classTeacher.staffProfile?.designation ?? null,
            department: arm.classTeacher.staffProfile?.department?.name ?? null,
            since: arm.classTeacher.staffProfile?.employmentDate.toISOString() ?? null,
            lastSeen: arm.classTeacher.lastLoginAt ? arm.classTeacher.lastLoginAt.toISOString() : null,
            periods: master?.periods ?? 0,
            load: master?.load ?? "No assignment",
            subjects: master?.subjects ?? [],
            otherArms
          }
        : null,
      subjects: teaching.subjectArms.filter((row) => row.classId === armId),
      siblings: siblings.map((sibling) => ({ id: sibling.id, name: armDisplayName(sibling.name, sibling.arm), roll: sibling._count.students, capacity: sibling.capacity, average: averageOf.get(sibling.id) ?? null })),
      schoolCeiling: teaching.schoolCeiling,
      results: {
        average: armAverage,
        sheets: sheets.length,
        passRate: sheets.length ? Math.round((sheets.filter((sheet) => sheet.averageScore >= 40).length / sheets.length) * 100) : null,
        topGrade: ranked[0]?.grade ?? null
      },
      term: term ? { id: term.id, name: term.name, session: term.academicSession.name } : null,
      roster: students.map((student) => {
        const guardian = student.guardians.find((link) => link.isPrimary) ?? student.guardians[0];
        const days = marked.get(student.id);
        return {
          id: student.id,
          name: `${student.firstName} ${student.lastName}`,
          admissionNumber: student.admissionNumber,
          gender: student.gender === "MALE" ? "Male" : student.gender === "FEMALE" ? "Female" : "Other",
          guardian: guardian ? `${guardian.guardian.firstName} ${guardian.guardian.lastName}` : null,
          guardianPhone: guardian?.guardian.phone ?? null,
          relationship: guardian?.guardian.relationship ?? null,
          average: sheetOf.get(student.id) ? Math.round(sheetOf.get(student.id)!.averageScore * 10) / 10 : null,
          position: sheetOf.get(student.id)?.position ?? null,
          grade: sheetOf.get(student.id)?.grade ?? null,
          resultState: resultState(sheetOf.get(student.id)?.status),
          attendance: days && days.total ? Math.round((days.present / days.total) * 1000) / 10 : null,
          daysMarked: days?.total ?? 0,
          owes: owes.get(student.id) ?? 0,
          portal: student.userId ? "Active" : "Not activated"
        };
      }),
      activity: activity.map((entry) => {
        const meta = (entry.metadata ?? {}) as { summary?: string; detail?: string; name?: string };
        return {
          id: entry.id,
          label: meta.summary ?? `${entry.action.toLowerCase()} · ${entry.entityType}`,
          detail: `${fullName(entry.actor) || "Someone"} · ${entry.createdAt.toISOString().slice(0, 10)}${meta.detail ? ` · ${meta.detail}` : ""}`
        };
      })
    };
  }

  /* ───────────────────────────── coverage ───────────────────────────── */

  /**
   * The eight questions that decide whether a school is ready to teach, each with the
   * count behind it and the person who owns the answer.
   */
  async coverage(session: SessionPayload) {
    const schoolId = session.schoolId;
    const [term, teaching, overview, entries, officers] = await Promise.all([
      this.currentTerm(schoolId),
      this.teaching(session),
      this.overview(session),
      prisma.timetableEntry.findMany({
        where: { schoolId, slotType: "lesson" },
        select: { classId: true, teacherId: true, dayOfWeek: true, periodNumber: true, isPublished: true, updatedAt: true, termId: true }
      }),
      prisma.user.findMany({
        where: { schoolId, deletedAt: null, role: { in: [UserRole.EXAM_OFFICER, UserRole.ADMIN_OFFICER, UserRole.PRINCIPAL, UserRole.HEAD_OF_DEPARTMENT] } },
        select: { id: true, firstName: true, lastName: true, role: true }
      })
    ]);
    const termDay = term ? daysBetween(term.startDate, new Date()) : 0;
    const ownerOf = (role: UserRole, label: string) => {
      const person = officers.find((officer) => officer.role === role);
      return { owner: person ? fullName(person) : label, role: label };
    };
    const principal = ownerOf(UserRole.PRINCIPAL, "Principal");
    const exam = ownerOf(UserRole.EXAM_OFFICER, "Exam Officer");
    const admin = ownerOf(UserRole.ADMIN_OFFICER, "Admin Officer");

    const uncovered = teaching.subjectArms.filter((row) => !row.teacher);
    const overTeachers = teaching.teachers.filter((teacher) => teacher.periods > teacher.ceiling);
    const idleTeachers = teaching.teachers.filter((teacher) => teacher.subjectArms === 0);
    const overArms = overview.arms.filter((arm) => arm.roll > arm.capacity);

    const inTerm = entries.filter((entry) => !term || entry.termId === term.id);
    const armsWithLessons = new Set(inTerm.map((entry) => entry.classId));
    const armsPublished = new Set(inTerm.filter((entry) => entry.isPublished).map((entry) => entry.classId));
    const unpublished = Array.from(armsWithLessons).filter((id) => !armsPublished.has(id));
    // A clash is a teacher in two rooms in one period of the week families actually
    // see. A draft that double-books somebody is work in progress, not a fault.
    const teacherSlots = new Map<string, Set<string>>();
    for (const entry of inTerm) {
      if (!entry.teacherId || !entry.isPublished) continue;
      const key = `${entry.teacherId}|${entry.dayOfWeek}|${entry.periodNumber}`;
      teacherSlots.set(key, (teacherSlots.get(key) ?? new Set<string>()).add(entry.classId));
    }
    const clashedSlots = Array.from(teacherSlots.values()).filter((set) => set.size > 1).length;
    const clashes = clashedSlots;

    const oldestUnallocated = overview.unallocated.length
      ? Math.max(...overview.unallocated.map((student) => daysBetween(new Date(student.enrolledAt), new Date())))
      : 0;

    const list = (items: string[], max = 3) =>
      items.slice(0, max).join(", ") + (items.length > max ? ` and ${items.length - max} more` : "");

    const checks = [
      {
        key: "unassigned",
        unit: "Unassigned subject-classes",
        sub: uncovered.length ? list(Array.from(new Set(uncovered.map((row) => `${row.subject} · ${row.arm}`)))) : "Every subject-arm has a named teacher",
        ...principal,
        state: uncovered.length ? "Unassigned" : "Complete",
        age: uncovered.length ? `${Math.max(...uncovered.map((row) => row.daysUnassigned))} days` : "—",
        overdue: uncovered.length > 0,
        count: uncovered.length,
        href: "/class-timetable/teaching"
      },
      {
        key: "no-arm",
        unit: "Students with no arm",
        sub: overview.unallocated.length ? `${overview.unallocated.length} student${overview.unallocated.length === 1 ? "" : "s"} enrolled and never allocated` : "Every student is in an arm",
        ...admin,
        state: overview.unallocated.length ? "Not started" : "Complete",
        age: overview.unallocated.length ? `${oldestUnallocated} days` : "—",
        overdue: overview.unallocated.length > 0,
        count: overview.unallocated.length,
        href: "/class-timetable/classes"
      },
      {
        key: "combinations",
        unit: "Invalid subject combinations",
        sub: teaching.invalidCombinations.length ? `${teaching.invalidCombinations.length} student${teaching.invalidCombinations.length === 1 ? "" : "s"} named by rule broken` : "No registration breaks a stream rule",
        ...exam,
        state: teaching.invalidCombinations.length ? "In progress" : "Complete",
        age: "—",
        overdue: false,
        count: teaching.invalidCombinations.length,
        href: "/class-timetable/subjects"
      },
      {
        key: "ceiling",
        unit: "Load outside the ceiling",
        sub: overTeachers.length ? list(overTeachers.map((teacher) => `${teacher.name} at ${teacher.periods} of ${teacher.ceiling} periods`)) : `Nobody is past ${teaching.schoolCeiling} periods a week`,
        ...principal,
        state: overTeachers.length ? "In progress" : "Complete",
        age: "—",
        overdue: false,
        count: overTeachers.length,
        href: "/class-timetable/teaching"
      },
      {
        key: "capacity",
        unit: "Arms over capacity",
        sub: overArms.length ? list(overArms.map((arm) => `${arm.name} at ${arm.roll} of ${arm.capacity}`)) : "Every arm is within its capacity",
        ...principal,
        state: overArms.length ? "In progress" : "Complete",
        age: "—",
        overdue: false,
        count: overArms.length,
        href: "/class-timetable/classes"
      },
      {
        key: "unpublished",
        unit: "Unpublished timetables",
        sub: unpublished.length ? `${unpublished.length} arm${unpublished.length === 1 ? "" : "s"} in draft` : "Every timetabled arm is published",
        ...exam,
        state: unpublished.length ? "Draft" : "Complete",
        age: "—",
        overdue: false,
        count: unpublished.length,
        href: "/class-timetable/timetable"
      },
      {
        key: "idle",
        unit: "Teachers with no assignment",
        sub: idleTeachers.length ? list(idleTeachers.map((teacher) => teacher.name)) : "Every teacher has work",
        ...principal,
        state: idleTeachers.length ? "In progress" : "Complete",
        age: "—",
        overdue: false,
        count: idleTeachers.length,
        href: "/class-timetable/teaching"
      },
      {
        key: "clashes",
        unit: "Unresolved clashes",
        sub: clashedSlots ? `${clashedSlots} period${clashedSlots === 1 ? "" : "s"} where a teacher is booked into two arms` : `None across ${armsWithLessons.size} arm${armsWithLessons.size === 1 ? "" : "s"}`,
        ...exam,
        state: clashedSlots ? "In progress" : "Complete",
        age: "—",
        overdue: clashedSlots > 0,
        count: clashedSlots,
        href: "/class-timetable/timetable"
      }
    ];

    // The same findings read from three other sides: by person, by class, by subject.
    type Row = (typeof checks)[number];
    const asRow = (unit: string, sub: string, who: { owner: string; role: string }, href: string, count: number, overdue = false): Row => ({
      key: unit,
      unit,
      sub,
      ...who,
      state: "In progress",
      age: "—",
      overdue,
      count,
      href
    });
    const byTeacher: Row[] = teaching.teachers
      .map((teacher) => {
        const issues: string[] = [];
        if (teacher.periods > teacher.ceiling) issues.push(`${teacher.periods} of ${teacher.ceiling} periods — over the ceiling`);
        if (teacher.subjectArms === 0) issues.push("No subject-arm assigned");
        if (teacher.sheetsOwed) issues.push(`${teacher.sheetsOwed} score sheet${teacher.sheetsOwed === 1 ? "" : "s"} unfinished or returned`);
        return { teacher, issues };
      })
      .filter((item) => item.issues.length)
      .map((item) => asRow(item.teacher.name, item.issues.join(" · "), { owner: item.teacher.name, role: item.teacher.designation ?? "Teacher" }, `/class-timetable/subjects/teacher/${item.teacher.id}`, item.issues.length, item.teacher.periods > item.teacher.ceiling));
    const byClass: Row[] = overview.classes
      .map((level) => {
        const arms = overview.arms.filter((arm) => arm.levelId === level.id);
        const issues: string[] = [];
        const noMaster = arms.filter((arm) => !arm.formMaster).length;
        if (level.uncoveredSubjectArms) issues.push(`${level.uncoveredSubjectArms} subject-arm${level.uncoveredSubjectArms === 1 ? "" : "s"} with no teacher`);
        if (level.overArms.length) issues.push(`${level.overArms.join(", ")} over capacity`);
        if (noMaster) issues.push(`${noMaster} arm${noMaster === 1 ? "" : "s"} with no form master`);
        if (arms.length === 0) issues.push("No arm yet");
        return { level, issues };
      })
      .filter((item) => item.issues.length)
      .map((item) => asRow(item.level.name, item.issues.join(" · "), principal, "/class-timetable/classes", item.issues.length, item.level.uncoveredSubjectArms > 0));
    const bySubjectMap = new Map<string, string[]>();
    for (const row of uncovered) bySubjectMap.set(row.subject, [...(bySubjectMap.get(row.subject) ?? []), row.arm]);
    const bySubject: Row[] = Array.from(bySubjectMap.entries()).map(([subject, armNames]) =>
      asRow(subject, `Nobody teaches it in ${list(armNames, 4)}`, principal, "/class-timetable/teaching", armNames.length, true)
    );

    return {
      term: term ? { name: term.name, day: termDay } : null,
      checks,
      groups: { "By teacher": byTeacher, "By class": byClass, "By subject": bySubject },
      cards: {
        uncovered: uncovered.length,
        uncoveredSub: uncovered.length ? list(Array.from(new Set(uncovered.map((row) => `${row.subject} ${row.arm}`)))) : "Every subject-arm is covered",
        noArm: overview.unallocated.length,
        overCeiling: overTeachers.length,
        underLoaded: teaching.teachers.filter((teacher) => teacher.load === "Under-loaded").length,
        unpublishedArms: unpublished.length,
        timetabledArms: armsWithLessons.size,
        clashes: clashes
      }
    };
  }
}

function titleCase(value: string): string {
  const words = value.replace(/_/g, " ").toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
