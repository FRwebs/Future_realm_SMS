import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { addDays, dayOf, iso, today } from "../attendance-management/attendance.shared";
import { armName, fullName } from "../fee-management/fees.shared";
import { forgetTeachingScope } from "../../common/teaching-scope";
import { TeacherWorkspaceService } from "./workspace.service";

const LEADERS = new Set(["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "ADMINISTRATOR", "SUPER_ADMIN"]);
const MAX_COVER_DAYS = 120;
const DOC_TYPES = ["Teaching qualification", "TRCN certificate", "Safeguarding clearance", "First aid certificate", "NYSC clearance", "Professional membership", "Other"];

const absenceSchema = z.object({ reason: z.string().trim().min(3, "The office needs one line on why.") });
const coverSchema = z.object({
  coverUserId: z.string().min(1, "Choose who covers."),
  classId: z.string().min(1, "Choose the arm."),
  subjectId: z.string().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
  scope: z.enum(["REGISTER_AND_SCORES", "REGISTER"]).default("REGISTER_AND_SCORES"),
  startsOn: z.string().min(1, "Give the first day."),
  endsOn: z.string().min(1, "Cover always has an end date."),
  reason: z.string().trim().optional()
});
const documentSchema = z.object({
  title: z.string().trim().min(3, "Name the document."),
  type: z.string().min(1),
  issuedBy: z.string().trim().optional(),
  expiresOn: z.string().optional(),
  file: z.string().optional(),
  notes: z.string().trim().optional()
});

const dateLabel = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * My Employment, the parts that are about the person's work rather than their leave and appraisal: what they hold and cover (and who
 * has covered for them), the day they tell the school they cannot be in, their payslips, and the credentials on their record. Cover is
 * time-boxed by rule — an end date is mandatory, and it stops granting anything the day it ends without anyone taking it away.
 */
@Injectable()
export class TeacherEmploymentService {
  constructor(private readonly workspace: TeacherWorkspaceService) {}

  /* ───────────────────────── what they hold and cover ───────────────────────── */

  async assignments(session: SessionPayload) {
    const me = await this.workspace.me(session);
    const schoolId = session.schoolId;
    const now = today();
    const termStart = me.term ? dayOf(me.term.startsOn) : addDays(now, -120);
    const [mine, owned, absences] = await Promise.all([
      prisma.coverAssignment.findMany({ where: { schoolId, coverUserId: session.userId, endsOn: { gte: termStart } }, orderBy: { endsOn: "desc" }, take: 60 }),
      prisma.coverAssignment.findMany({ where: { schoolId, ownerUserId: session.userId, endsOn: { gte: termStart } }, orderBy: { startsOn: "desc" }, take: 60 }),
      prisma.staffAbsence.findMany({ where: { schoolId, userId: session.userId, day: { gte: termStart } }, orderBy: { day: "desc" }, take: 60 })
    ]);
    const people = await prisma.user.findMany({ where: { id: { in: [...new Set([...mine.map((row) => row.ownerUserId), ...owned.map((row) => row.coverUserId)].filter(Boolean) as string[])] } }, select: { id: true, firstName: true, lastName: true } });
    const nameOf = new Map(people.map((person) => [person.id, fullName(person)]));
    const rooms = await prisma.classRoom.findMany({ where: { id: { in: [...new Set([...mine, ...owned].map((row) => row.classId))] } }, select: { id: true, name: true, arm: true } });
    const subjects = await prisma.subject.findMany({ where: { id: { in: [...new Set([...mine, ...owned].map((row) => row.subjectId).filter(Boolean) as string[])] } }, select: { id: true, name: true } });
    const armOf = new Map(rooms.map((room) => [room.id, armName(room)]));
    const subjectOf = new Map(subjects.map((subject) => [subject.id, subject.name]));
    const shape = (row: (typeof mine)[number]) => ({
      id: row.id, what: row.subjectId ? subjectOf.get(row.subjectId) ?? "Subject" : "Daily register and form class", classId: row.classId, arm: armOf.get(row.classId) ?? "", forWhom: row.ownerUserId ? nameOf.get(row.ownerUserId) ?? "A colleague" : "Whoever is absent",
      cover: nameOf.get(row.coverUserId) ?? "", grants: row.scope === "REGISTER" ? "Register only" : "Register and scores", startsOn: iso(row.startsOn), endsOn: iso(row.endsOn), endsLabel: dateLabel(row.endsOn), live: row.endsOn >= now && row.startsOn <= now && !row.endedAt, ended: Boolean(row.endedAt) || row.endsOn < now,
      daysLeft: Math.max(0, Math.round((row.endsOn.getTime() - now.getTime()) / 86_400_000)), reason: row.reason
    });
    const absentToday = absences.some((row) => iso(row.day) === iso(now));
    /* what stops being owned the moment they are away */
    const registers = me.formArms.map((arm) => arm.name);
    const periodsToCome = await prisma.timetableEntry.count({ where: { schoolId, teacherId: session.userId, termId: me.term?.id ?? "-", dayOfWeek: new Date(now).getUTCDay(), isPublished: true } });
    return {
      persona: me.persona, department: me.department?.name ?? null, term: me.term ? { name: me.term.name, session: me.term.session } : null,
      holding: [
        ...me.formArms.map((arm) => ({ what: "Form master", where: arm.name, load: `Daily register · ${arm.roll} children`, kind: "form" as const })),
        ...me.teaching.map((row) => ({ what: row.subject, where: row.arm, load: row.assistant ? "Second teacher" : `${row.periods} period${row.periods === 1 ? "" : "s"} a week`, kind: "subject" as const }))
      ],
      covering: mine.map(shape),
      coveredFor: owned.map(shape),
      absences: absences.map((row) => ({ day: iso(row.day), label: dateLabel(row.day), reason: row.reason, covers: owned.filter((cover) => cover.startsOn <= row.day && cover.endsOn >= row.day).map((cover) => ({ by: nameOf.get(cover.coverUserId) ?? "", what: cover.subjectId ? subjectOf.get(cover.subjectId) ?? "" : "Daily register", arm: armOf.get(cover.classId) ?? "" })) })),
      absentToday, today: { label: dateLabel(now), periods: periodsToCome, registers }
    };
  }

  /** "I will not be in today." The school is told at once, and what they hold is listed until cover is named. */
  async reportAbsence(session: SessionPayload, body: unknown) {
    const input = absenceSchema.parse(body);
    const me = await this.workspace.me(session);
    const day = today();
    const existing = await prisma.staffAbsence.findUnique({ where: { userId_day: { userId: session.userId, day } } });
    if (existing) throw new BadRequestException("You have already told the school you are absent today.");
    await prisma.staffAbsence.create({ data: { schoolId: session.schoolId, userId: session.userId, day, reason: input.reason } });
    const leaders = await prisma.user.findMany({
      where: { schoolId: session.schoolId, isActive: true, deletedAt: null, id: { not: session.userId }, OR: [{ role: "PRINCIPAL" }, { role: "VICE_PRINCIPAL_ACADEMICS" }, ...(me.department ? [{ role: "HEAD_OF_DEPARTMENT" as const, staffProfile: { departmentId: me.department.id } }] : [])] },
      select: { id: true }
    });
    for (const leader of leaders) await prisma.notificationLog.create({ data: { schoolId: session.schoolId, userId: leader.id, channel: "IN_APP", title: "A teacher is absent today", body: `${me.person.name} · ${input.reason} · what they hold is waiting for cover`, status: "QUEUED", sentAt: new Date() } });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.CREATE, entityType: "StaffAbsence", entityId: iso(day), metadata: { summary: `Absence reported · ${me.person.name}`, reason: input.reason } } });
    return { day: iso(day), told: leaders.length };
  }

  /* ───────────────────────── assigning cover ───────────────────────── */

  private async scopeOf(session: SessionPayload) {
    if (LEADERS.has(session.role)) return { all: true as const, departmentId: null as string | null };
    if (session.role === "HEAD_OF_DEPARTMENT") {
      const profile = await prisma.staffProfile.findUnique({ where: { userId: session.userId }, select: { departmentId: true } });
      if (profile?.departmentId) return { all: false as const, departmentId: profile.departmentId };
    }
    throw new ForbiddenException("Cover is assigned by a head of department for their own subjects, or by the school's leadership.");
  }

  /** Who is away, what each holds that nobody covers yet, and who could cover — for the person who may fill the gap. */
  async gaps(session: SessionPayload) {
    const scope = await this.scopeOf(session);
    const schoolId = session.schoolId;
    const now = today();
    const away = await prisma.staffAbsence.findMany({ where: { schoolId, day: now }, take: 100 });
    const users = await prisma.user.findMany({ where: { id: { in: away.map((row) => row.userId) }, ...(scope.all ? {} : { staffProfile: { departmentId: scope.departmentId } }) }, select: { id: true, firstName: true, lastName: true, role: true } });
    const reasonOf = new Map(away.map((row) => [row.userId, row.reason]));
    const gaps = [];
    for (const user of users) {
      const [forms, taught, covers] = await Promise.all([
        prisma.classRoom.findMany({ where: { schoolId, classTeacherId: user.id, isActive: true, deletedAt: null }, select: { id: true, name: true, arm: true } }),
        prisma.classSubject.findMany({ where: { schoolId, teacherId: user.id, isActive: true, ...(scope.all ? {} : { subject: { departmentId: scope.departmentId } }) }, include: { subject: { select: { name: true } }, classRoom: { select: { id: true, name: true, arm: true } } } }),
        prisma.coverAssignment.findMany({ where: { schoolId, ownerUserId: user.id, startsOn: { lte: now }, endsOn: { gte: now }, endedAt: null } })
      ]);
      const covered = (classId: string, subjectId: string | null) => covers.some((cover) => cover.classId === classId && (cover.subjectId === subjectId || cover.subjectId === null));
      const holds = [
        ...forms.map((room) => ({ classId: room.id, subjectId: null as string | null, what: "Daily register", arm: armName(room), covered: covered(room.id, null) })),
        ...taught.map((row) => ({ classId: row.classId, subjectId: row.subjectId as string | null, what: row.subject.name, arm: armName(row.classRoom), covered: covered(row.classId, row.subjectId) }))
      ];
      gaps.push({ userId: user.id, name: fullName(user), reason: reasonOf.get(user.id) ?? "", holds });
    }
    const candidates = await prisma.user.findMany({ where: { schoolId, isActive: true, deletedAt: null, role: { in: ["TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER", "HEAD_OF_DEPARTMENT"] }, id: { notIn: users.map((user) => user.id) } }, select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: "asc" }, take: 200 });
    return { day: iso(now), scope: scope.all ? "school" : "department", gaps, candidates: candidates.map((person) => ({ id: person.id, name: fullName(person) })) };
  }

  async assignCover(session: SessionPayload, body: unknown) {
    const input = coverSchema.parse(body);
    const scope = await this.scopeOf(session);
    const schoolId = session.schoolId;
    const startsOn = dayOf(input.startsOn);
    const endsOn = dayOf(input.endsOn);
    if (endsOn < startsOn) throw new BadRequestException("Cover cannot end before it starts.");
    if ((endsOn.getTime() - startsOn.getTime()) / 86_400_000 > MAX_COVER_DAYS) throw new BadRequestException(`Cover is time-boxed. It cannot run longer than ${MAX_COVER_DAYS} days — assign the work instead.`);
    const cover = await prisma.user.findFirst({ where: { id: input.coverUserId, schoolId, isActive: true, deletedAt: null }, select: { id: true, firstName: true, lastName: true } });
    if (!cover) throw new NotFoundException("That person is not on the staff.");
    if (cover.id === input.ownerUserId) throw new BadRequestException("Someone cannot cover for themselves.");
    const room = await prisma.classRoom.findFirst({ where: { id: input.classId, schoolId, deletedAt: null }, select: { id: true, name: true, arm: true } });
    if (!room) throw new NotFoundException("That arm does not exist.");
    if (!scope.all && input.subjectId) {
      const inDepartment = await prisma.classSubject.findFirst({ where: { schoolId, classId: input.classId, subjectId: input.subjectId, subject: { departmentId: scope.departmentId } } });
      if (!inDepartment) throw new ForbiddenException("That subject is not your department's, so its cover is not yours to assign.");
    }
    if (!scope.all && !input.subjectId) {
      const person = input.ownerUserId ? await prisma.staffProfile.findUnique({ where: { userId: input.ownerUserId }, select: { departmentId: true } }) : null;
      if (person?.departmentId !== scope.departmentId) throw new ForbiddenException("Only the school's leadership assigns a form class's cover outside a department.");
    }
    const created = await prisma.coverAssignment.create({ data: { schoolId, coverUserId: cover.id, ownerUserId: input.ownerUserId || null, classId: room.id, subjectId: input.subjectId || null, scope: input.scope, startsOn, endsOn, reason: input.reason || null, createdById: session.userId } });
    forgetTeachingScope();
    await prisma.notificationLog.create({ data: { schoolId, userId: cover.id, channel: "IN_APP", title: "You have been given cover", body: `${armName(room)} · until ${dateLabel(endsOn)} · ${input.scope === "REGISTER" ? "register only" : "register and scores"}`, status: "QUEUED", sentAt: new Date() } });
    await prisma.auditLog.create({ data: { schoolId, actorId: session.userId, action: AuditAction.CREATE, entityType: "CoverAssignment", entityId: created.id, metadata: { summary: `Cover assigned · ${fullName(cover)} · ${armName(room)}`, endsOn: iso(endsOn) } } });
    return { id: created.id };
  }

  async endCover(session: SessionPayload, id: string) {
    const scope = await this.scopeOf(session);
    const row = await prisma.coverAssignment.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!row) throw new NotFoundException("That cover does not exist.");
    if (!scope.all && row.createdById !== session.userId) throw new ForbiddenException("You can end cover you assigned.");
    await prisma.coverAssignment.update({ where: { id }, data: { endedAt: new Date() } });
    forgetTeachingScope();
    return { id };
  }

  /* ───────────────────────── payslips and the record ───────────────────────── */

  async payslips(session: SessionPayload) {
    const schoolId = session.schoolId;
    const profile = await prisma.staffProfile.findUnique({ where: { userId: session.userId }, include: { user: true, payBand: { select: { code: true, name: true } } } });
    if (!profile) throw new NotFoundException("This account has no staff record.");
    const [items, documents, supervisor, school] = await Promise.all([
      prisma.payrollItem.findMany({ where: { schoolId, staffId: profile.id, status: { in: ["APPROVED", "PAID"] }, payrollRun: { status: { in: ["PROCESSED", "PUBLISHED"] } } }, include: { payrollRun: { select: { month: true, year: true } } }, orderBy: [{ payrollRun: { year: "desc" } }, { payrollRun: { month: "desc" } }], take: 24 }),
      prisma.profileDocument.findMany({ where: { schoolId, userId: session.userId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 50 }),
      profile.supervisorId ? prisma.user.findUnique({ where: { id: profile.supervisorId }, select: { firstName: true, lastName: true, jobTitle: true } }) : Promise.resolve(null),
      prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } })
    ]);
    const naira = (value: unknown) => Number(value ?? 0);
    const slips = items.map((item) => {
      const allowances = Array.isArray(item.allowances) ? (item.allowances as Array<{ name: string; amount: number; inPay?: boolean }>).filter((line) => line.inPay !== false) : [];
      const deductionsObj = (item.deductions ?? {}) as Record<string, number>;
      const deductions = Object.entries(deductionsObj).map(([name, amount]) => ({ name: name === "paye" ? "PAYE" : name === "nhf" ? "NHF" : name.charAt(0).toUpperCase() + name.slice(1), amount: naira(amount) }));
      const allowTotal = allowances.reduce((sum, line) => sum + naira(line.amount), 0);
      const deductTotal = deductions.reduce((sum, line) => sum + line.amount, 0);
      return {
        id: item.id, month: item.payrollRun.month, year: item.payrollRun.year, label: new Date(Date.UTC(item.payrollRun.year, item.payrollRun.month - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
        gross: naira(item.basicSalary), allowances, allowTotal, deductions, deductTotal, net: naira(item.netSalary), status: item.status, paidAt: item.paidAt?.toISOString() ?? null, method: item.method, reference: item.reference, band: item.bandCode, step: item.step
      };
    });
    const now = Date.now();
    return {
      school: school?.name ?? "", person: { name: fullName(profile.user), employeeNo: profile.employeeNo, designation: profile.designation, email: profile.user.email },
      band: profile.payBand ? { code: profile.payBand.code, name: profile.payBand.name, step: profile.payStep } : null,
      record: { started: profile.employmentDate.toISOString(), employment: profile.employmentType ?? "Full time", reportsTo: supervisor ? { name: fullName(supervisor), title: supervisor.jobTitle ?? "" } : null },
      slips,
      documents: documents.map((document) => {
        const days = document.expiresOn ? Math.ceil((document.expiresOn.getTime() - now) / 86_400_000) : null;
        return {
          id: document.id, title: document.title, type: document.type, issuedBy: document.issuedBy, expiresOn: document.expiresOn?.toISOString() ?? null, expiresLabel: document.expiresOn ? dateLabel(document.expiresOn) : null, days,
          expiry: days === null ? "No expiry" : days < 0 ? "Expired" : days <= 60 ? "Expiring" : "Current", verification: document.verificationStatus === "VERIFIED" ? "Verified" : document.verificationStatus === "REJECTED" ? "Not accepted" : "Waiting for the office", hasFile: Boolean(document.fileUrl), note: document.notes
        };
      }),
      docTypes: DOC_TYPES
    };
  }

  async addDocument(session: SessionPayload, body: unknown) {
    const input = documentSchema.parse(body);
    let expires: Date | null = null;
    if (input.expiresOn) {
      expires = dayOf(input.expiresOn);
      if (expires < today()) throw new BadRequestException("That date has already passed — a lapsed credential is renewed, not filed.");
    }
    const file = input.file && input.file.startsWith("data:") ? input.file : null;
    if (file && file.length > 2_500_000) throw new BadRequestException("That photo is too large. Use a clearer, smaller one.");
    const created = await prisma.profileDocument.create({
      data: { schoolId: session.schoolId, userId: session.userId, title: input.title, type: input.type, issuedBy: input.issuedBy || null, expiresOn: expires, fileUrl: file, fileName: file ? `${input.title}.jpg` : null, notes: input.notes || null, uploadedById: session.userId, verificationStatus: "PENDING" }
    });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.CREATE, entityType: "ProfileDocument", entityId: created.id, metadata: { summary: `Document filed · ${input.type}`, userId: session.userId } } });
    return { id: created.id };
  }
}
