import { BadRequestException, Injectable } from "@nestjs/common";
import { refuseTeaching } from "../../common/teaching-scope";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import {
  armName,
  currentTerm,
  feeStateOf,
  fullName,
  genderLabel,
  nextAdmissionNumber,
  portalOf,
  relevantInvoice,
  stateOf,
  type FeeState,
  type Portal,
  type StudentState
} from "./records.shared";

/**
 * The registry: the authoritative list of every child, folded with what the rest of the school
 * knows about them — how often they are here, how they are scoring, what the family owes. The
 * same list the class rosters are cut from, so a child opened here and a child opened from their
 * arm land on one record with one set of figures.
 */

export type RegistryRow = {
  id: string;
  name: string;
  boarding: "Day" | "Boarding";
  arm: string;
  level: string;
  adm: string;
  gender: string;
  guardian: { id: string; name: string; relation: string; phone: string } | null;
  att: number | null;
  avg: number | null;
  grade: string;
  fee: FeeState;
  portal: Portal;
  state: StudentState;
};

const enrolSchema = z.object({
  name: z.string().trim().min(3, "Give the child's full name."),
  dob: z.string().min(1, "Give the date of birth."),
  gender: z.string().default("Female"),
  adm: z.string().trim().optional(),
  nationality: z.string().default("Nigerian"),
  level: z.string().min(1, "Choose a level."),
  arm: z.string().default("Any arm with space"),
  term: z.string().optional(),
  boarding: z.string().default("Day"),
  previousSchool: z.string().optional(),
  guardianMode: z.string().default("Add a new guardian"),
  guardianId: z.union([z.string(), z.array(z.string())]).optional(),
  guardianName: z.string().optional(),
  relation: z.string().default("Mother"),
  phone: z.string().optional(),
  email: z.string().optional(),
  consent: z.array(z.string()).default([])
});

@Injectable()
export class RegistryService {
  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType, entityId, metadata } });
  }

  /** Everything the registry needs, in one read. */
  async overview(session: SessionPayload) {
    // The whole school's roll, with what each family owes, is not a teacher's. Theirs is My Students.
    await refuseTeaching(session, "My Students");
    const schoolId = session.schoolId;
    const term = await currentTerm(schoolId);
    const [students, attendance, sheets, invoices, hostel, pendingChanges, school] = await Promise.all([
      prisma.student.findMany({
        where: { schoolId },
        include: {
          currentClass: { include: { classLevel: true } },
          user: { select: { lastLoginAt: true } },
          guardians: { include: { guardian: { select: { id: true, firstName: true, lastName: true, phone: true, relationship: true, userId: true, user: { select: { lastLoginAt: true } } } } } }
        },
        orderBy: { admissionNumber: "asc" }
      }),
      term ? prisma.studentAttendance.groupBy({ by: ["studentId", "status"], where: { schoolId, termId: term.id }, _count: { _all: true } }) : Promise.resolve([]),
      term ? prisma.resultSheet.findMany({ where: { schoolId, termId: term.id }, select: { studentId: true, averageScore: true, grade: true } }) : Promise.resolve([]),
      prisma.invoice.findMany({ where: { schoolId, status: { not: "VOID" } }, select: { studentId: true, total: true, balance: true, status: true, termId: true } }),
      prisma.hostelAllocation.findMany({ where: { schoolId, OR: [{ endDate: null }, { endDate: { gt: new Date() } }] }, select: { studentId: true } }),
      prisma.studentChangeRequest.count({ where: { schoolId, status: "PENDING" } }),
      prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } })
    ]);

    const marked = new Map<string, { total: number; here: number }>();
    for (const row of attendance) {
      const entry = marked.get(row.studentId) ?? { total: 0, here: 0 };
      entry.total += row._count._all;
      if (row.status !== "ABSENT") entry.here += row._count._all;
      marked.set(row.studentId, entry);
    }
    const sheetOf = new Map(sheets.map((sheet) => [sheet.studentId, sheet]));
    const invoicesOf = new Map<string, typeof invoices>();
    for (const invoice of invoices.filter((entry) => relevantInvoice(entry, term?.id))) invoicesOf.set(invoice.studentId, [...(invoicesOf.get(invoice.studentId) ?? []), invoice]);
    const boarders = new Set(hostel.map((row) => row.studentId));

    const rows: RegistryRow[] = students.map((student) => {
      const link = student.guardians.find((entry) => entry.isPrimary) ?? student.guardians[0];
      const sheet = sheetOf.get(student.id);
      const stats = marked.get(student.id);
      return {
        id: student.id,
        name: fullName(student),
        boarding: boarders.has(student.id) ? "Boarding" : "Day",
        arm: student.currentClass ? armName(student.currentClass) : "No arm",
        level: student.currentClass?.classLevel?.name ?? "",
        adm: student.admissionNumber,
        gender: genderLabel(student.gender),
        guardian: link ? { id: link.guardian.id, name: fullName(link.guardian), relation: link.relation ?? link.guardian.relationship, phone: link.guardian.phone } : null,
        att: stats && stats.total ? Math.round((stats.here / stats.total) * 1000) / 10 : null,
        avg: sheet ? Math.round(sheet.averageScore * 10) / 10 : null,
        grade: sheet?.grade ?? "—",
        fee: feeStateOf(invoicesOf.get(student.id) ?? []),
        portal: portalOf(student.user),
        state: stateOf(student.status)
      };
    });

    const guardianPortal = new Map<string, Portal>();
    for (const student of students) for (const link of student.guardians) guardianPortal.set(link.guardian.id, portalOf(link.guardian.user));

    const enrolled = rows.filter((row) => row.state === "Enrolled" && row.arm !== "No arm");
    const owingFamilies = new Set(rows.filter((row) => row.fee === "Part paid" || row.fee === "Outstanding").map((row) => row.guardian?.id ?? `s_${row.id}`));
    const inTerm = term ? students.filter((student) => student.admissionDate >= term.startDate && student.admissionDate <= term.endDate).length : 0;
    const out = term
      ? await prisma.studentChangeRequest.count({ where: { schoolId, status: "APPROVED", field: "Status", decidedAt: { gte: term.startDate, lte: term.endDate }, after: { in: ["Withdrawn", "Alumni"] } } })
      : 0;
    const levels = await prisma.classLevel.findMany({ where: { schoolId, isActive: true }, orderBy: { order: "asc" }, select: { name: true } });
    const arms = await prisma.classRoom.findMany({ where: { schoolId }, select: { name: true, arm: true }, orderBy: [{ name: "asc" }, { arm: "asc" }] });

    return {
      term: term ? { id: term.id, name: term.name, session: term.academicSession?.name ?? "", label: `${term.name} ${term.academicSession?.name ?? ""}`.trim() } : null,
      school: school?.name ?? "",
      totals: {
        records: rows.length,
        enrolled: enrolled.length,
        withoutArm: rows.filter((row) => row.state === "Enrolled" && row.arm === "No arm").length,
        alumni: rows.filter((row) => row.state === "Alumni").length,
        withdrawn: rows.filter((row) => row.state === "Withdrawn").length,
        blocked: rows.filter((row) => row.state === "Blocked").length,
        in: inTerm,
        out,
        owingFamilies: owingFamilies.size,
        noGuardianPortal: Array.from(guardianPortal.values()).filter((portal) => portal !== "Active").length,
        noGuardian: rows.filter((row) => !row.guardian).length,
        pendingChanges,
        arms: arms.length
      },
      rows,
      options: { arms: arms.map(armName), levels: levels.map((level) => level.name) }
    };
  }

  /* ───────────────────────── enrolling a child ───────────────────────── */

  async enrolOptions(session: SessionPayload) {
    const schoolId = session.schoolId;
    const [levels, arms, terms, guardians, adm] = await Promise.all([
      prisma.classLevel.findMany({ where: { schoolId, isActive: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
      prisma.classRoom.findMany({ where: { schoolId }, include: { classLevel: true, _count: { select: { students: true } } }, orderBy: [{ name: "asc" }, { arm: "asc" }] }),
      prisma.term.findMany({ where: { schoolId }, include: { academicSession: true }, orderBy: { startDate: "desc" }, take: 6 }),
      prisma.guardian.findMany({ where: { schoolId, mergedIntoId: null }, include: { students: { select: { studentId: true } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
      nextAdmissionNumber(schoolId)
    ]);
    const seen = new Set<string>();
    const uniqueGuardians = guardians.filter((guardian) => {
      const key = `${guardian.phone}|${fullName(guardian)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return {
      admissionNumber: adm,
      levels: levels.map((level) => level.name),
      arms: arms.map((room) => ({ id: room.id, name: armName(room), level: room.classLevel?.name ?? "", seats: Math.max(0, room.capacity - room._count.students) })),
      terms: terms.map((term) => `${term.name} ${term.academicSession?.name ?? ""}`.trim()),
      guardians: uniqueGuardians.slice(0, 300).map((guardian) => ({ id: guardian.id, name: fullName(guardian), phone: guardian.phone, children: guardian.students.length }))
    };
  }

  async enrol(session: SessionPayload, body: unknown) {
    const input = enrolSchema.parse(body);
    const schoolId = session.schoolId;
    if (!input.consent.some((entry) => entry.startsWith("Core record processing"))) {
      throw new BadRequestException("Core record processing cannot be waived — it is the basis for holding the record.");
    }
    const parts = input.name.trim().split(/\s+/);
    if (parts.length < 2) throw new BadRequestException("Give the child's first name and surname.");
    const [firstName, ...rest] = parts;
    const lastName = rest.pop() as string;
    const middleName = rest.join(" ") || null;
    const dateOfBirth = new Date(input.dob);
    if (Number.isNaN(dateOfBirth.getTime())) throw new BadRequestException("That is not a date of birth.");

    const level = await prisma.classLevel.findFirst({ where: { schoolId, name: input.level } });
    if (!level) throw new BadRequestException("That level does not exist at this school.");
    const rooms = await prisma.classRoom.findMany({ where: { schoolId, classLevelId: level.id }, include: { _count: { select: { students: true } } }, orderBy: { arm: "asc" } });
    const picked =
      input.arm === "Any arm with space"
        ? rooms.filter((room) => room._count.students < room.capacity).sort((a, b) => a._count.students - b._count.students)[0]
        : rooms.find((room) => room.arm === input.arm || armName(room) === input.arm);
    if (!picked) throw new BadRequestException(input.arm === "Any arm with space" ? `Every ${level.name} arm is full.` : `${level.name} has no arm called ${input.arm}.`);
    if (picked._count.students >= picked.capacity) throw new BadRequestException(`${armName(picked)} is full — ${picked.capacity} of ${picked.capacity}.`);

    const admission = input.adm?.trim() || (await nextAdmissionNumber(schoolId));
    if (await prisma.student.findFirst({ where: { schoolId, admissionNumber: admission } })) throw new BadRequestException(`${admission} is already taken by another child.`);

    const existingGuardianId = Array.isArray(input.guardianId) ? input.guardianId[0] : input.guardianId;
    const linking = input.guardianMode.startsWith("Link") && existingGuardianId;
    if (!linking) {
      if (!input.guardianName?.trim()) throw new BadRequestException("Give the guardian's name, or link one who is already in the school.");
      if (!input.phone?.trim()) throw new BadRequestException("A guardian needs a phone number — it becomes their login.");
    }
    const session0 = await prisma.academicSession.findFirst({ where: { schoolId, isCurrent: true } });

    const created = await prisma.$transaction(async (tx) => {
      let guardianId = existingGuardianId as string | undefined;
      if (!linking) {
        const [gFirst, ...gRest] = (input.guardianName as string).trim().split(/\s+/);
        const guardian = await tx.guardian.create({
          data: { schoolId, firstName: gFirst, lastName: gRest.join(" ") || "Guardian", phone: (input.phone as string).trim(), email: input.email?.trim() || null, relationship: input.relation }
        });
        guardianId = guardian.id;
      } else if (!(await tx.guardian.findFirst({ where: { id: guardianId, schoolId } }))) {
        throw new BadRequestException("That guardian is not in this school.");
      }
      const student = await tx.student.create({
        data: {
          schoolId,
          admissionNumber: admission,
          firstName,
          middleName,
          lastName,
          gender: input.gender === "Male" ? "MALE" : input.gender === "Female" ? "FEMALE" : "OTHER",
          dateOfBirth,
          admissionDate: new Date(),
          nationality: input.nationality,
          previousSchool: input.previousSchool?.trim() || null,
          currentClassId: picked.id,
          currentSessionId: session0?.id,
          guardians: { create: { guardianId: guardianId as string, isPrimary: true, relation: input.relation, visibility: ["Results and report cards", "Attendance", "Fee amounts", "Announcements"] } }
        }
      });
      const code = (label: string) =>
        label.startsWith("Core record") ? "core" : label.startsWith("Health") ? "health" : label.startsWith("Photography") ? "photo" : label.startsWith("Result publication") ? "third-party" : label.startsWith("Notification") ? "channels" : label.toLowerCase().replace(/[^a-z]+/g, "-");
      for (const label of input.consent) {
        await tx.familyConsent.upsert({
          where: { guardianId_typeCode: { guardianId: guardianId as string, typeCode: code(label) } },
          update: { status: "GIVEN", means: "IN_PERSON", recordedById: session.userId, recordedAt: new Date() },
          create: { schoolId, guardianId: guardianId as string, typeCode: code(label), status: "GIVEN", means: "IN_PERSON", recordedById: session.userId }
        });
      }
      return student;
    });
    await this.audit(session, AuditAction.CREATE, "Student", created.id, { summary: `Student enrolled · ${admission} · ${armName(picked)}`, boarding: input.boarding });
    return { id: created.id, adm: admission, arm: armName(picked), name: fullName(created), boardingNote: input.boarding === "Boarding" ? "Boarding is allocated in the hostel once a room is chosen — the child is enrolled as a day student until then." : null };
  }

  /** The classes a bulk move may target. */
  async moveOptions(session: SessionPayload) {
    const rooms = await prisma.classRoom.findMany({ where: { schoolId: session.schoolId }, include: { classLevel: true, _count: { select: { students: true } } }, orderBy: [{ name: "asc" }, { arm: "asc" }] });
    return rooms.map((room) => ({ id: room.id, name: armName(room), level: room.classLevel?.name ?? "", seats: Math.max(0, room.capacity - room._count.students) }));
  }

  async move(session: SessionPayload, body: unknown) {
    const input = z.object({ students: z.array(z.string()).min(1, "Choose who is moving."), arm: z.string().min(1, "Choose the arm they move to."), reason: z.string().trim().min(5, "Say why — it is kept on every record."), tell: z.coerce.boolean().default(true) }).parse(body);
    const schoolId = session.schoolId;
    const rooms = await prisma.classRoom.findMany({ where: { schoolId }, include: { _count: { select: { students: true } } } });
    const target = rooms.find((room) => room.id === input.arm || armName(room) === input.arm);
    if (!target) throw new BadRequestException("That arm does not exist.");
    if (target._count.students + input.students.length > target.capacity) throw new BadRequestException(`${armName(target)} has ${Math.max(0, target.capacity - target._count.students)} seats — ${input.students.length} are moving.`);
    const moved = await prisma.student.updateMany({ where: { schoolId, id: { in: input.students } }, data: { currentClassId: target.id } });
    await this.audit(session, AuditAction.UPDATE, "Student", target.id, { summary: `${moved.count} students moved to ${armName(target)}`, reason: input.reason });
    return { moved: moved.count, arm: armName(target) };
  }

  async resend(session: SessionPayload, body: unknown) {
    const input = z.object({ students: z.array(z.string()).optional() }).parse(body ?? {});
    const schoolId = session.schoolId;
    const students = await prisma.student.findMany({
      where: { schoolId, ...(input.students?.length ? { id: { in: input.students } } : {}) },
      include: { guardians: { include: { guardian: { select: { id: true, phone: true, user: { select: { lastLoginAt: true } } } } } } }
    });
    const guardians = new Map<string, string>();
    for (const student of students) for (const link of student.guardians) if (!link.guardian.user?.lastLoginAt) guardians.set(link.guardian.id, link.guardian.phone);
    for (const [guardianId, phone] of guardians) {
      await prisma.guardianContact.create({ data: { schoolId, guardianId, kind: "INVITE", channel: "SMS and email", summary: "Portal invitation resent", detail: { phone }, createdById: session.userId } });
    }
    await this.audit(session, AuditAction.UPDATE, "Guardian", schoolId, { summary: `Portal invitations resent · ${guardians.size} families` });
    return { families: guardians.size, children: students.filter((student) => student.guardians.some((link) => guardians.has(link.guardian.id))).length };
  }
}

