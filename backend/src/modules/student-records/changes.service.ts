import { assertSubmission } from "../approvals/hub.shared";
import { ruleFor } from "../approvals/standing-rules";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { STATE_TO_STATUS, armName, currentTerm, dayText, daysSince, fullName, genderLabel } from "./records.shared";

/**
 * Changes: what has been asked of a child's record, what is pending, and what is incomplete.
 * A change to a record is never made quietly — it is asked for, with the before and the after,
 * and decided by someone other than whoever asked.
 */

/** The fields a record change may touch, by the name a person sees. */
const FIELDS = ["Given name", "Surname", "Date of birth", "Gender", "Status", "Arm", "Home address", "Nationality", "Previous school", "Languages at home", "House"] as const;
type Field = (typeof FIELDS)[number];

const requestSchema = z.object({
  student: z.union([z.string(), z.array(z.string())]).transform((value) => (Array.isArray(value) ? value[0] : value)),
  field: z.string().refine((value): value is Field => (FIELDS as readonly string[]).includes(value), "Choose which part of the record is wrong."),
  after: z.string().trim().min(1, "Give the correct value."),
  reason: z.string().trim().min(5, "Say why — whoever decides reads exactly this."),
  evidence: z.string().optional()
});

const decideSchema = z.object({ decision: z.enum(["approve", "decline"]), note: z.string().trim().optional() });

const dobText = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

@Injectable()
export class ChangesService {
  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType, entityId, metadata } });
  }

  private async names(ids: Array<string | null | undefined>) {
    const unique = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
    const users = unique.length ? await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, firstName: true, lastName: true, role: true } }) : [];
    return new Map(users.map((user) => [user.id, { name: fullName(user), role: String(user.role).replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) }]));
  }

  /** What the field holds now, in the words a person would use for it. */
  private async currentValue(studentId: string, field: Field): Promise<string> {
    const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: { currentClass: true } });
    switch (field) {
      case "Given name":
        return student.firstName;
      case "Surname":
        return student.lastName;
      case "Date of birth":
        return dobText(student.dateOfBirth);
      case "Gender":
        return genderLabel(student.gender);
      case "Status": {
        const state = student.status === "SUSPENDED" ? "Blocked" : student.status === "WITHDRAWN" ? "Withdrawn" : student.status === "ACTIVE" ? "Enrolled" : "Alumni";
        return state;
      }
      case "Arm":
        return student.currentClass ? armName(student.currentClass) : "No arm";
      case "Home address":
        return student.address ?? "—";
      case "Nationality":
        return student.nationality;
      case "Previous school":
        return student.previousSchool ?? "—";
      case "Languages at home":
        return student.languageAtHome ?? "—";
      case "House":
        return student.houseName ?? "—";
    }
  }

  async overview(session: SessionPayload) {
    const schoolId = session.schoolId;
    const term = await currentTerm(schoolId);
    const [pending, decided, students, migration, hostel] = await Promise.all([
      prisma.studentChangeRequest.findMany({ where: { schoolId, status: "PENDING" }, include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } }, orderBy: { createdAt: "asc" } }),
      prisma.studentChangeRequest.findMany({ where: { schoolId, status: { not: "PENDING" }, ...(term ? { decidedAt: { gte: term.startDate } } : {}) }, include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } }, orderBy: { decidedAt: "desc" }, take: 60 }),
      prisma.student.findMany({
        where: { schoolId, status: { in: ["ACTIVE", "SUSPENDED"] } },
        select: { id: true, firstName: true, lastName: true, middleName: true, admissionNumber: true, dateOfBirth: true, photoUrl: true, currentClassId: true, currentClass: { select: { name: true, arm: true } }, guardians: { select: { guardianId: true, isPrimary: true, guardian: { select: { phone: true } } } }, documents: { select: { label: true } } }
      }),
      prisma.migrationJob.findFirst({ where: { schoolId, signedOffAt: { not: null } }, orderBy: { signedOffAt: "desc" }, include: { signedOffBy: { select: { firstName: true, lastName: true } } } }),
      prisma.hostelAllocation.count({ where: { schoolId } })
    ]);
    void hostel;

    const people = await this.names([...pending.map((row) => row.requestedById), ...decided.map((row) => row.decidedById), ...decided.map((row) => row.requestedById)]);
    const who = (id: string | null) => (id ? people.get(id) ?? { name: "A member of staff", role: "Staff" } : { name: "—", role: "" });

    const coreByGuardian = new Set(
      (await prisma.familyConsent.findMany({ where: { schoolId, typeCode: "core", status: "GIVEN" }, select: { guardianId: true } })).map((row) => row.guardianId)
    );
    const completeness = {
      photo: students.filter((student) => !student.photoUrl && !student.documents.some((document) => document.label === "Photograph")),
      guardian: students.filter((student) => !student.guardians.length || student.guardians.every((link) => !link.guardian.phone)),
      arm: students.filter((student) => !student.currentClassId),
      consent: students.filter((student) => student.guardians.length && !student.guardians.some((link) => coreByGuardian.has(link.guardianId)))
    };
    const brief = (rows: typeof students) => rows.slice(0, 12).map((student) => ({ id: student.id, label: `${fullName(student)} · ${student.admissionNumber}`, sub: student.currentClass ? armName(student.currentClass) : "No arm" }));

    const groups = new Map<string, typeof students>();
    for (const student of students) {
      const key = `${student.firstName.toLowerCase()}|${student.lastName.toLowerCase()}|${student.dateOfBirth.toISOString().slice(0, 10)}`;
      groups.set(key, [...(groups.get(key) ?? []), student]);
    }
    const duplicates = Array.from(groups.values())
      .filter((group) => group.length > 1)
      .map((group) => ({ ids: group.map((student) => student.id), label: `${fullName(group[0])} · ${group.map((student) => student.admissionNumber).join(" and ")}`, sub: group.every((student) => student.guardians[0]?.guardian.phone === group[0].guardians[0]?.guardian.phone) ? "Same name, same date of birth, same guardian phone." : "Same name, same date of birth, different guardian phone." }));

    const itemRow = (row: (typeof pending)[number]) => ({
      id: row.id,
      studentId: row.studentId,
      student: fullName(row.student),
      adm: row.student.admissionNumber,
      field: row.field,
      before: row.before ?? "—",
      after: row.after,
      reason: row.reason,
      evidence: row.evidence,
      by: who(row.requestedById),
      byId: row.requestedById,
      ownRequest: row.requestedById === session.userId,
      age: daysSince(row.createdAt),
      hours: Math.max(1, Math.round((Date.now() - row.createdAt.getTime()) / 3_600_000)),
      at: row.createdAt.toISOString()
    });

    return {
      term: term ? { name: term.name, session: term.academicSession?.name ?? "", label: `${term.name} ${term.academicSession?.name ?? ""}`.trim() } : null,
      pending: pending.map(itemRow),
      approved: decided.map((row) => ({ ...itemRow(row), status: row.status, decidedBy: who(row.decidedById), decidedAt: row.decidedAt?.toISOString() ?? null, note: row.decisionNote })),
      completeness: [
        { key: "photo", label: "Missing photograph", sub: "the card prints without one", count: completeness.photo.length, tone: "attention", items: brief(completeness.photo) },
        { key: "guardian", label: "No guardian contact", sub: "unreachable by any channel", count: completeness.guardian.length, tone: "critical", items: brief(completeness.guardian) },
        { key: "arm", label: "No arm assigned", sub: "excluded from every register", count: completeness.arm.length, tone: "critical", items: brief(completeness.arm) },
        { key: "consent", label: "No core consent recorded", sub: "results cannot be published to guardians", count: completeness.consent.length, tone: "critical", items: brief(completeness.consent) }
      ],
      duplicates,
      migration: migration
        ? {
            job: `${migration.sourceSystem} import · ${dayText(migration.createdAt)}`,
            presented: migration.studentsExpected,
            signedOffBy: migration.signedOffBy ? fullName(migration.signedOffBy) : null,
            signedOffOn: migration.signedOffAt ? dayText(migration.signedOffAt) : null,
            rolledBack: Boolean(migration.rolledBackAt)
          }
        : null,
      total: students.length,
      fields: FIELDS
    };
  }

  async request(session: SessionPayload, body: unknown) {
    const input = requestSchema.parse(body);
    const schoolId = session.schoolId;
    await assertSubmission(session, "RECORD_CHANGE", { evidence: Boolean(input.evidence) });
    const student = await prisma.student.findFirst({ where: { id: input.student, schoolId } });
    if (!student) throw new NotFoundException("That student is not on this school's roll.");
    const field = input.field as Field;
    const before = await this.currentValue(student.id, field);
    if (before === input.after) throw new BadRequestException(`${field} already reads “${before}”.`);
    if (await prisma.studentChangeRequest.findFirst({ where: { studentId: student.id, field, status: "PENDING" } })) throw new BadRequestException(`A change to ${field} is already waiting for a decision.`);
    const created = await prisma.studentChangeRequest.create({ data: { schoolId, studentId: student.id, field, before, after: input.after, reason: input.reason, evidence: input.evidence || null, requestedById: session.userId } });
    await this.audit(session, AuditAction.CREATE, "Student", student.id, { summary: `Record change requested · ${field}`, before, after: input.after });
    // A change so small it can only be a correction may already have been agreed to need no human.
    const rule = await ruleFor(schoolId, { field, before, after: input.after });
    if (rule) {
      await prisma.student.update({ where: { id: student.id }, data: await this.apply(student.id, field, input.after, schoolId) });
      await prisma.studentChangeRequest.update({ where: { id: created.id }, data: { status: "APPROVED", decidedAt: new Date(), decisionNote: `Approved by the standing rule “${rule.name}”` } });
      await this.audit(session, AuditAction.APPROVE, "Student", student.id, { summary: `Record change approved by standing rule · ${field}`, rule: rule.name, before, after: input.after });
      return { id: created.id, field, before, autoApproved: rule.name };
    }
    return { id: created.id, field, before };
  }

  async decide(session: SessionPayload, id: string, body: unknown) {
    const input = decideSchema.parse(body);
    const schoolId = session.schoolId;
    const request = await prisma.studentChangeRequest.findFirst({ where: { id, schoolId }, include: { student: true } });
    if (!request) throw new NotFoundException("That request does not exist.");
    if (request.status !== "PENDING") throw new BadRequestException("That request has already been decided.");
    if (request.requestedById === session.userId) throw new ForbiddenException("Whoever asked for a change cannot also decide it.");
    if (input.decision === "decline" && !input.note) throw new BadRequestException("Say why it is declined — they need to know what to fix.");

    if (input.decision === "approve") {
      const data = await this.apply(request.studentId, request.field as Field, request.after, schoolId);
      await prisma.student.update({ where: { id: request.studentId }, data });
    }
    await prisma.studentChangeRequest.update({ where: { id }, data: { status: input.decision === "approve" ? "APPROVED" : "DECLINED", decidedById: session.userId, decidedAt: new Date(), decisionNote: input.note || null } });
    await this.audit(session, input.decision === "approve" ? AuditAction.APPROVE : AuditAction.REJECT, "Student", request.studentId, { summary: `Record change ${input.decision === "approve" ? "approved" : "declined"} · ${request.field}`, before: request.before, after: request.after, note: input.note });
    return { id, decision: input.decision };
  }

  private async apply(studentId: string, field: Field, after: string, schoolId: string): Promise<Prisma.StudentUpdateInput> {
    switch (field) {
      case "Given name":
        return { firstName: after };
      case "Surname":
        return { lastName: after };
      case "Date of birth": {
        const date = new Date(after);
        if (Number.isNaN(date.getTime())) throw new BadRequestException("That is not a date of birth.");
        return { dateOfBirth: date };
      }
      case "Gender":
        return { gender: after.startsWith("M") ? "MALE" : after.startsWith("F") ? "FEMALE" : "OTHER" };
      case "Status": {
        const status = STATE_TO_STATUS[after];
        if (!status) throw new BadRequestException("Status must be Enrolled, Blocked, Withdrawn or Alumni.");
        return { status: status as never };
      }
      case "Arm": {
        const rooms = await prisma.classRoom.findMany({ where: { schoolId }, include: { _count: { select: { students: true } } } });
        const room = rooms.find((entry) => armName(entry) === after || entry.id === after);
        if (!room) throw new BadRequestException(`There is no arm called ${after}.`);
        void studentId;
        return { currentClass: { connect: { id: room.id } } };
      }
      case "Home address":
        return { address: after };
      case "Nationality":
        return { nationality: after };
      case "Previous school":
        return { previousSchool: after };
      case "Languages at home":
        return { languageAtHome: after };
      case "House":
        return { houseName: after };
    }
  }
}
