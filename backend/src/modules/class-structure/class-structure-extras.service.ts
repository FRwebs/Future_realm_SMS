import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { armDisplayName, ClassStructureService } from "./class-structure.service";

/**
 * The actions that touch many records at once, and the one page that reads a single
 * child in the context of the arm they sit in.
 *
 * Each bulk action checks the same rules its single counterpart does — a ceiling a
 * teacher cannot pass without a reason, an arm that cannot hold more than its
 * capacity unless the school says so — so doing forty at once is never a way round them.
 */

const TEACHING_ROLES: UserRole[] = [UserRole.TEACHER, UserRole.CLASS_TEACHER, UserRole.SUBJECT_TEACHER, UserRole.HEAD_OF_DEPARTMENT];

const bulkAssignSchema = z.object({
  mappingIds: z.array(z.string()).min(1, "Tick at least one subject-arm."),
  teacherId: z.string().min(1, "Choose the teacher."),
  overCeilingReason: z.string().trim().optional()
});

const bulkArmsSchema = z
  .object({
    armIds: z.array(z.string()).min(1, "Tick at least one arm."),
    formMasterId: z.string().optional(),
    capacity: z.coerce.number().int().min(1).max(200).optional().or(z.literal("")),
    reason: z.string().trim().optional()
  })
  .refine((value) => value.formMasterId || (value.capacity !== undefined && value.capacity !== ""), {
    message: "Choose a form master, a capacity, or both."
  });

const bulkClassesSchema = z.object({
  levelIds: z.array(z.string()).min(1, "Tick at least one class."),
  addArm: z.coerce.boolean().optional(),
  capacity: z.coerce.number().int().min(1).max(200).optional().or(z.literal("")),
  reason: z.string().trim().optional()
});

const bulkUpdateSchema = z
  .object({
    mappingIds: z.array(z.string()).min(1, "Tick at least one subject-arm."),
    periodsPerWeek: z.coerce.number().int().min(1).max(40).optional().or(z.literal("")),
    countsToAverage: z.enum(["keep", "counts", "not"]).optional()
  })
  .refine((value) => (value.periodsPerWeek !== undefined && value.periodsPerWeek !== "") || (value.countsToAverage && value.countsToAverage !== "keep"), {
    message: "Change the periods, whether it counts to the average, or both."
  });

const offerSchema = z.object({
  subjectId: z.string().min(1, "Choose the subject."),
  classIds: z.array(z.string()).min(1, "Tick at least one arm."),
  teacherId: z.string().optional().or(z.literal(""))
});

const allocateBulkSchema = z.object({
  from: z.string().min(1, "Choose who is being moved."),
  destinationIds: z.array(z.string()).min(1, "Choose at least one destination arm."),
  basis: z.enum(["By gender", "Alphabetical", "By prior performance"]).default("By gender"),
  allowOver: z.coerce.boolean().default(false),
  confirm: z.string().trim().optional(),
  reason: z.string().trim().optional()
});

@Injectable()
export class ClassStructureExtrasService {
  constructor(private readonly structure: ClassStructureService) {}

  async ok<T>(dataPromise: Promise<T>, message?: string) {
    return { ok: true, success: true, ...(message ? { message } : {}), data: await dataPromise };
  }

  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    await prisma.auditLog.create({
      data: { schoolId: session.schoolId, actorId: session.userId, action, entityType, entityId, metadata }
    });
  }

  private async assertTeacher(schoolId: string, userId: string) {
    const found = await prisma.user.count({ where: { id: userId, schoolId, deletedAt: null, role: { in: TEACHING_ROLES } } });
    if (!found) throw new BadRequestException("That person is not on this school's teaching staff.");
  }

  /* ───────────────────────── bulk teaching ───────────────────────── */

  /** One teacher onto many subject-arms at once, refused past their ceiling without a reason. */
  async bulkAssign(session: SessionPayload, body: unknown) {
    const parsed = bulkAssignSchema.parse(body);
    const schoolId = session.schoolId;
    await this.assertTeacher(schoolId, parsed.teacherId);
    const rows = await prisma.classSubject.findMany({
      where: { id: { in: parsed.mappingIds }, schoolId },
      include: { subject: { select: { name: true, periodsPerWeek: true } }, classRoom: { select: { name: true } } }
    });
    if (rows.length !== new Set(parsed.mappingIds).size) throw new BadRequestException("One of those subject-arms no longer exists.");

    const teaching = await this.structure.teaching(session);
    const teacher = teaching.teachers.find((item) => item.id === parsed.teacherId);
    const periodsOf = (row: (typeof rows)[number]) => row.periodsPerWeek ?? row.subject.periodsPerWeek;
    const adding = rows.filter((row) => row.teacherId !== parsed.teacherId).reduce((sum, row) => sum + periodsOf(row), 0);
    const after = (teacher?.periods ?? 0) + adding;
    const ceiling = teacher?.ceiling ?? teaching.schoolCeiling;
    if (after > ceiling && !parsed.overCeilingReason) {
      throw new BadRequestException(
        `${teacher?.name ?? "That teacher"} would be at ${after} periods a week, past the ceiling of ${ceiling}. Give a reason, or raise their ceiling first.`
      );
    }
    await prisma.classSubject.updateMany({
      where: { id: { in: rows.map((row) => row.id) } },
      data: { teacherId: parsed.teacherId, assignedById: session.userId, assignedAt: new Date() }
    });
    await this.audit(session, AuditAction.UPDATE, "ClassSubject", rows[0].id, {
      summary: `${teacher?.name ?? "A teacher"} assigned to ${rows.length} subject-arm${rows.length === 1 ? "" : "s"}`,
      loadAfter: after,
      overCeilingReason: parsed.overCeilingReason || undefined
    });
    return { assigned: rows.length, loadAfter: after, ceiling };
  }

  /** Change how a group of subject-arms is offered: the periods a week and whether it counts to the average. */
  async bulkUpdate(session: SessionPayload, body: unknown) {
    const parsed = bulkUpdateSchema.parse(body);
    const rows = await prisma.classSubject.findMany({ where: { id: { in: parsed.mappingIds }, schoolId: session.schoolId }, select: { id: true } });
    if (rows.length !== new Set(parsed.mappingIds).size) throw new BadRequestException("One of those subject-arms no longer exists.");
    const periods = parsed.periodsPerWeek === "" || parsed.periodsPerWeek === undefined ? undefined : parsed.periodsPerWeek;
    await prisma.classSubject.updateMany({
      where: { id: { in: rows.map((row) => row.id) } },
      data: {
        ...(periods ? { periodsPerWeek: periods } : {}),
        ...(parsed.countsToAverage && parsed.countsToAverage !== "keep" ? { countsToAverage: parsed.countsToAverage === "counts" } : {})
      }
    });
    await this.audit(session, AuditAction.UPDATE, "ClassSubject", rows[0].id, {
      summary: `${rows.length} subject-arm${rows.length === 1 ? "" : "s"} changed`,
      periodsPerWeek: periods,
      countsToAverage: parsed.countsToAverage && parsed.countsToAverage !== "keep" ? parsed.countsToAverage === "counts" : undefined
    });
    return { updated: rows.length };
  }

  /** Put a subject on an arm's list with nobody named to teach it yet. */
  async offerSubject(session: SessionPayload, body: unknown) {
    const parsed = offerSchema.parse(body);
    const schoolId = session.schoolId;
    const subject = await prisma.subject.findFirst({ where: { id: parsed.subjectId, schoolId, deletedAt: null } });
    if (!subject) throw new NotFoundException("That subject is not in the catalogue.");
    if (parsed.teacherId) await this.assertTeacher(schoolId, parsed.teacherId);
    const arms = await prisma.classRoom.findMany({ where: { id: { in: parsed.classIds }, schoolId, deletedAt: null } });
    if (arms.length !== new Set(parsed.classIds).size) throw new BadRequestException("One of those arms does not exist.");
    let added = 0;
    for (const arm of arms) {
      const found = await prisma.classSubject.findFirst({ where: { schoolId, classId: arm.id, subjectId: subject.id } });
      if (found) {
        if (!found.isActive) await prisma.classSubject.update({ where: { id: found.id }, data: { isActive: true } });
        continue;
      }
      await prisma.classSubject.create({
        data: { schoolId, classId: arm.id, subjectId: subject.id, teacherId: parsed.teacherId || null, assignedById: session.userId }
      });
      added += 1;
    }
    await this.audit(session, AuditAction.CREATE, "ClassSubject", subject.id, {
      summary: `${subject.name} offered to ${added} arm${added === 1 ? "" : "s"}`,
      arms: arms.map((arm) => armDisplayName(arm.name, arm.arm))
    });
    return { offered: added, already: arms.length - added };
  }

  /* ───────────────────────── bulk structure ───────────────────────── */

  async bulkArms(session: SessionPayload, body: unknown) {
    const parsed = bulkArmsSchema.parse(body);
    const schoolId = session.schoolId;
    if (parsed.formMasterId) await this.assertTeacher(schoolId, parsed.formMasterId);
    const arms = await prisma.classRoom.findMany({ where: { id: { in: parsed.armIds }, schoolId, deletedAt: null } });
    if (arms.length !== new Set(parsed.armIds).size) throw new BadRequestException("One of those arms no longer exists.");
    const capacity = parsed.capacity === "" || parsed.capacity === undefined ? undefined : parsed.capacity;
    await prisma.classRoom.updateMany({
      where: { id: { in: arms.map((arm) => arm.id) } },
      data: { ...(parsed.formMasterId ? { classTeacherId: parsed.formMasterId } : {}), ...(capacity ? { capacity } : {}) }
    });
    await this.audit(session, AuditAction.UPDATE, "ClassRoom", arms[0].id, {
      summary: `${arms.length} arm${arms.length === 1 ? "" : "s"} updated`,
      formMasterId: parsed.formMasterId || undefined,
      capacity,
      reason: parsed.reason || undefined
    });
    return { updated: arms.length };
  }

  /** "Add an arm to each" and "Change capacity" across several classes. */
  async bulkClasses(session: SessionPayload, body: unknown) {
    const parsed = bulkClassesSchema.parse(body);
    const schoolId = session.schoolId;
    const capacity = parsed.capacity === "" || parsed.capacity === undefined ? undefined : parsed.capacity;
    if (!parsed.addArm && !capacity) throw new BadRequestException("Choose to add an arm, change the capacity, or both.");
    const levels = await prisma.classLevel.findMany({
      where: { id: { in: parsed.levelIds }, schoolId },
      include: { classRooms: { where: { deletedAt: null }, orderBy: { name: "asc" } } }
    });
    if (levels.length !== new Set(parsed.levelIds).size) throw new BadRequestException("One of those classes no longer exists.");

    let created = 0;
    await prisma.$transaction(async (tx) => {
      for (const level of levels) {
        if (capacity) {
          await tx.classRoom.updateMany({ where: { classLevelId: level.id, deletedAt: null }, data: { capacity } });
        }
        if (parsed.addArm) {
          const taken = new Set(level.classRooms.map((room) => room.arm.toLowerCase()));
          let letter = "A";
          for (let code = 65; code <= 90; code += 1) {
            letter = String.fromCharCode(code);
            if (!taken.has(letter.toLowerCase())) break;
          }
          const sample = level.classRooms[0];
          await tx.classRoom.create({
            data: {
              schoolId,
              classLevelId: level.id,
              name: `${level.name} ${letter}`,
              arm: letter,
              section: letter,
              category: sample?.category ?? "Secondary",
              capacity: capacity ?? sample?.capacity ?? 35,
              displayOrder: level.order
            }
          });
          created += 1;
        }
      }
    });
    await this.audit(session, AuditAction.UPDATE, "ClassLevel", levels[0].id, {
      summary: `${levels.length} class${levels.length === 1 ? "" : "es"} updated`,
      armsAdded: created,
      capacity,
      reason: parsed.reason || undefined
    });
    return { classes: levels.length, armsAdded: created };
  }

  /* ───────────────────────── bulk allocation ───────────────────────── */

  /**
   * Spread a group of students across the arms chosen, the way a school would by hand:
   * boys and girls dealt out evenly, or alphabetically, or best and weakest alternating.
   */
  async allocateBulk(session: SessionPayload, body: unknown) {
    const parsed = allocateBulkSchema.parse(body);
    const schoolId = session.schoolId;
    const term = await prisma.term.findFirst({ where: { schoolId, isCurrent: true }, select: { id: true } });

    const [kind, id] = parsed.from.includes(":") ? (parsed.from.split(":") as [string, string]) : [parsed.from, ""];
    const students = await prisma.student.findMany({
      where:
        kind === "none"
          ? { schoolId, status: "ACTIVE", currentClassId: null }
          : kind === "arm"
            ? { schoolId, status: "ACTIVE", currentClassId: id }
            : { schoolId, status: "ACTIVE", currentClass: { classLevelId: id } },
      select: { id: true, firstName: true, lastName: true, gender: true, currentClassId: true }
    });
    if (!students.length) throw new BadRequestException("Nobody is in that group, so there is nothing to move.");
    if (students.length > 50 && parsed.confirm !== "ALLOCATE") {
      throw new BadRequestException(`This moves ${students.length} students. Type ALLOCATE in the confirmation box to go ahead.`);
    }

    const destinations = await prisma.classRoom.findMany({
      where: { id: { in: parsed.destinationIds }, schoolId, deletedAt: null, isActive: true },
      include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } },
      orderBy: { name: "asc" }
    });
    if (destinations.length !== new Set(parsed.destinationIds).size) {
      throw new BadRequestException("One of the destination arms is closed or no longer exists.");
    }

    // A student already in a destination stays counted there rather than being moved twice.
    const room = new Map(destinations.map((arm) => [arm.id, arm.capacity - arm._count.students + students.filter((student) => student.currentClassId === arm.id).length]));
    const places = Array.from(room.values()).reduce((sum, value) => sum + Math.max(0, value), 0);
    if (!parsed.allowOver && students.length > places) {
      throw new BadRequestException(
        `The arms chosen have ${places} free place${places === 1 ? "" : "s"} for ${students.length} students. Add an arm, choose more arms, or allow arms to go over capacity.`
      );
    }

    // Order the students by the basis, then deal them out in turn.
    let ordered = [...students];
    if (parsed.basis === "Alphabetical") {
      ordered.sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
    } else if (parsed.basis === "By prior performance" && term) {
      const sheets = await prisma.resultSheet.findMany({
        where: { schoolId, studentId: { in: students.map((student) => student.id) } },
        orderBy: { approvedAt: "desc" },
        select: { studentId: true, averageScore: true }
      });
      const best = new Map<string, number>();
      for (const sheet of sheets) if (!best.has(sheet.studentId)) best.set(sheet.studentId, sheet.averageScore);
      ordered.sort((a, b) => (best.get(b.id) ?? -1) - (best.get(a.id) ?? -1));
    } else {
      const girls = ordered.filter((student) => student.gender === "FEMALE");
      const rest = ordered.filter((student) => student.gender !== "FEMALE");
      ordered = [];
      for (let index = 0; index < Math.max(girls.length, rest.length); index += 1) {
        if (rest[index]) ordered.push(rest[index]);
        if (girls[index]) ordered.push(girls[index]);
      }
    }

    const plan = new Map<string, string[]>(destinations.map((arm) => [arm.id, []]));
    let cursor = 0;
    const order = destinations.map((arm) => arm.id);
    for (const student of ordered) {
      // Skip arms that are full while any arm still has a place.
      let tries = 0;
      while (tries < order.length) {
        const target = order[cursor % order.length];
        cursor += 1;
        tries += 1;
        if (parsed.allowOver || (plan.get(target)?.length ?? 0) < (room.get(target) ?? 0)) {
          plan.get(target)?.push(student.id);
          break;
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const [armId, ids] of plan) {
        if (ids.length) await tx.student.updateMany({ where: { id: { in: ids } }, data: { currentClassId: armId } });
      }
    });

    const result = destinations.map((arm) => {
      const incoming = plan.get(arm.id)?.length ?? 0;
      const already = students.filter((student) => student.currentClassId === arm.id).length;
      const size = arm._count.students - already + incoming;
      return { armId: arm.id, name: armDisplayName(arm.name, arm.arm), moved: incoming, size, capacity: arm.capacity, over: size > arm.capacity };
    });
    await this.audit(session, AuditAction.UPDATE, "ClassAllocation", destinations[0].id, {
      summary: `${students.length} student${students.length === 1 ? "" : "s"} allocated across ${destinations.length} arm${destinations.length === 1 ? "" : "s"}`,
      detail: `${parsed.basis} · ${result.map((item) => `${item.name} ${item.size}`).join(", ")}${parsed.reason ? ` · ${parsed.reason}` : ""}`,
      count: students.length
    });
    return { moved: students.length, basis: parsed.basis, arms: result };
  }

  /* ───────────────────────── one child, in their arm ───────────────────────── */

  async studentInArm(session: SessionPayload, armId: string, studentId: string) {
    const schoolId = session.schoolId;
    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId },
      include: {
        currentClass: { include: { classLevel: true } },
        guardians: { include: { guardian: true } },
        user: { select: { lastLoginAt: true } }
      }
    });
    if (!student) throw new NotFoundException("That student is not on this school's roll.");
    const term = await prisma.term.findFirst({ where: { schoolId, isCurrent: true }, include: { academicSession: { select: { name: true } } } });

    const [attendance, sheet, invoices, combination, peers] = await Promise.all([
      term
        ? prisma.studentAttendance.groupBy({ by: ["status"], where: { schoolId, studentId, termId: term.id }, _count: { _all: true } })
        : Promise.resolve([]),
      term
        ? prisma.resultSheet.findFirst({
            where: { schoolId, studentId, termId: term.id },
            include: {
              scoreEntries: { include: { subject: { select: { name: true, code: true } }, assessmentComponent: { select: { name: true, code: true, order: true } } } }
            }
          })
        : Promise.resolve(null),
      prisma.invoice.findMany({
        where: { schoolId, studentId },
        orderBy: { issuedOn: "desc" },
        take: 6,
        select: { id: true, invoiceNumber: true, total: true, balance: true, status: true, dueOn: true }
      }),
      prisma.subjectCombination.findFirst({ where: { schoolId, studentId }, orderBy: { id: "desc" } }),
      student.currentClassId && term
        ? prisma.resultSheet.count({ where: { schoolId, classId: student.currentClassId, termId: term.id } })
        : Promise.resolve(0)
    ]);

    const count = (status: string) => attendance.find((row) => row.status === status)?._count._all ?? 0;
    const marked = attendance.reduce((sum, row) => sum + row._count._all, 0);

    const bySubject = new Map<string, { subject: string; code: string; total: number; components: Array<{ name: string; score: number; max: number }> }>();
    for (const entry of sheet?.scoreEntries ?? []) {
      const row = bySubject.get(entry.subjectId) ?? { subject: entry.subject.name, code: entry.subject.code, total: 0, components: [] };
      row.total += entry.score;
      row.components.push({ name: entry.assessmentComponent.name, score: entry.score, max: entry.maxScore });
      bySubject.set(entry.subjectId, row);
    }
    const guardianNames = student.guardians.map((link) => ({
      id: link.guardianId,
      name: `${link.guardian.firstName} ${link.guardian.lastName}`,
      relationship: link.guardian.relationship,
      phone: link.guardian.phone,
      email: link.guardian.email,
      primary: link.isPrimary,
      sms: link.guardian.canReceiveSms
    }));
    return {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      admissionNumber: student.admissionNumber,
      gender: student.gender === "MALE" ? "Male" : student.gender === "FEMALE" ? "Female" : "Other",
      dateOfBirth: student.dateOfBirth.toISOString(),
      admissionDate: student.admissionDate.toISOString(),
      status: student.status,
      nationality: student.nationality,
      stateOfOrigin: student.stateOfOrigin,
      arm: student.currentClass ? { id: student.currentClass.id, name: armDisplayName(student.currentClass.name, student.currentClass.arm), level: student.currentClass.classLevel.name } : null,
      backArm: armId,
      portal: student.userId ? (student.user?.lastLoginAt ? "Active" : "Created, never signed in") : "Not activated",
      term: term ? { name: term.name, session: term.academicSession.name } : null,
      guardians: guardianNames,
      attendance: {
        marked,
        present: count("PRESENT"),
        absent: count("ABSENT"),
        late: count("LATE"),
        excused: count("EXCUSED"),
        rate: marked ? Math.round(((marked - count("ABSENT")) / marked) * 1000) / 10 : null
      },
      result: sheet
        ? {
            average: Math.round(sheet.averageScore * 10) / 10,
            total: Math.round(sheet.totalScore * 10) / 10,
            grade: sheet.grade,
            position: sheet.position,
            outOf: peers,
            status: sheet.status,
            subjects: Array.from(bySubject.values())
              .map((row) => ({ ...row, total: Math.round(row.total * 10) / 10 }))
              .sort((a, b) => a.subject.localeCompare(b.subject))
          }
        : null,
      fees: {
        outstanding: invoices.reduce((sum, invoice) => sum + Number(invoice.balance), 0),
        invoices: invoices.map((invoice) => ({
          id: invoice.id,
          number: invoice.invoiceNumber,
          total: Number(invoice.total),
          balance: Number(invoice.balance),
          status: invoice.status,
          dueOn: invoice.dueOn.toISOString()
        }))
      },
      registration: combination ? { track: combination.track, subjects: Array.isArray(combination.subjectIds) ? combination.subjectIds.length : 0 } : null
    };
  }
}
