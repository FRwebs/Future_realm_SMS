import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { assertStudentArmReadable, teachingScope } from "../../common/teaching-scope";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { PAYMENT_MODE } from "../fee-management/fees.shared";
import { loadConsentTypes } from "./consent.shared";
import { SupportPlansService } from "./support-plans.service";
import {
  STANDING,
  ageOf,
  armName,
  currentTerm,
  daysSince,
  feeStateOf,
  fullName,
  LEADERS,
  WELFARE,
  genderLabel,
  gradeBands,
  gradeOf,
  initials,
  normalPhone,
  num,
  portalOf,
  relevantInvoice,
  stateOf,
  validMobile
} from "./records.shared";

/**
 * One child, in full: who they are, how they are scoring, what has reached their family, what
 * they owe and what has been recorded about their wellbeing. Everything is read once here, so the
 * arm list, the registry, this page and a printed card can never disagree.
 */

export const REQUIRED_DOCUMENTS = ["Birth certificate", "Previous school report", "Immunisation record", "Photograph", "Transfer certificate"];

const noteSchema = z.object({
  kind: z.string().default("Guidance"),
  date: z.string().optional(),
  entry: z.string().trim().min(8, "Say what happened, in plain language — the next person to open this record reads exactly this."),
  action: z.string().optional(),
  outcome: z.string().default("Closed"),
  visible: z.string().default("Form master, counsellor and leadership"),
  tell: z.coerce.boolean().default(false)
});

const collectorSchema = z.object({
  name: z.string().trim().min(3, "Give the collector's full name."),
  relation: z.string().min(1),
  phone: z.string().trim().min(10, "Give a mobile number."),
  photo: z.string().trim().min(3, "A collector with no photograph on file cannot collect."),
  applies: z.string().default("This child only"),
  until: z.string().optional(),
  notify: z.coerce.boolean().default(true)
});

const documentSchema = z.object({
  type: z.string().min(1, "Choose what it is."),
  file: z.string().trim().min(3, "Give the file name."),
  date: z.string().optional(),
  verifiedBy: z.string().default("Not verified yet"),
  note: z.string().optional()
});

const mapSchema = z.object({
  guardian: z.union([z.string(), z.array(z.string())]).optional(),
  name: z.string().optional(),
  relation: z.string().default("Mother"),
  order: z.string().default("Primary contact"),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  occupation: z.string().optional(),
  language: z.string().optional(),
  see: z.array(z.string()).default(["Results and report cards", "Attendance", "Fee amounts", "Announcements"]),
  collect: z.coerce.boolean().default(true),
  invite: z.coerce.boolean().default(true)
});

function isoDate(date: Date | null | undefined) {
  return date ? date.toISOString() : null;
}

@Injectable()
export class RecordService {
  constructor(private readonly plans: SupportPlansService) {}

  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType, entityId, metadata } });
  }

  private async studentOrThrow(schoolId: string, id: string) {
    const student = await prisma.student.findFirst({ where: { id, schoolId }, select: { id: true, firstName: true, lastName: true, admissionNumber: true, currentClassId: true } });
    if (!student) throw new NotFoundException("That student is not on this school's roll.");
    return student;
  }

  /**
   * One child, in full — and, for a teaching person, only what a teacher holds: the class they answer for or the children they teach,
   * with wellbeing reduced to a flag, family to a number to call, and a fee to paid or unpaid. Never an amount, never a file.
   */
  async dossier(session: SessionPayload, id: string) {
    const full = await this.dossierFull(session, id);
    if (!(await teachingScope(session))) return { ...full, support: await this.plans.forStudent(session, id, "manager") };
    await assertStudentArmReadable(session, full.arm?.id);
    return {
      ...full,
      // A teacher reads what they must do for the child — never why.
      support: await this.plans.forStudent(session, id, "teacher"),
      address: null, previousSchool: null,
      wellbeing: { log: [], counselling: 0, visits: 0, health: full.wellbeing.health && (full.wellbeing.health.conditions || full.wellbeing.health.allergies) ? { conditions: null, allergies: null, bloodGroup: null, genotype: null, notes: null, alert: true } : null },
      fees: { billed: 0, paid: 0, owing: 0, state: full.fees.state, days: 0, structures: [], items: [], invoices: [], receipts: [], familyId: "" },
      records: { ...full.records, audit: [], documents: [], missing: [], changes: [] },
      family: { ...full.family, consent: [], sent: full.family.sent }
    };
  }

  private async dossierFull(session: SessionPayload, id: string) {
    const schoolId = session.schoolId;
    const [student, term, bands] = await Promise.all([
      prisma.student.findFirst({
        where: { id, schoolId },
        include: {
          currentClass: { include: { classLevel: true, classTeacher: { select: { id: true, firstName: true, lastName: true, role: true, phone: true, email: true, createdAt: true, lastLoginAt: true } } } },
          user: { select: { lastLoginAt: true } },
          guardians: { include: { guardian: { include: { user: { select: { lastLoginAt: true } } } } } },
          medicalRecord: true,
          documents: { orderBy: { createdAt: "desc" } },
          collectors: { orderBy: { createdAt: "desc" } },
          hostelAllocation: { where: { OR: [{ endDate: null }, { endDate: { gt: new Date() } }] }, include: { room: { include: { building: { select: { name: true } } } } }, take: 1 },
          changeRequests: { orderBy: { createdAt: "desc" }, take: 20 }
        }
      }),
      currentTerm(schoolId),
      gradeBands(schoolId)
    ]);
    if (!student) throw new NotFoundException("That student is not on this school's roll.");
    const classId = student.currentClassId;

    const [attendanceRows, sheets, cards, behaviour, counselling, visits, invoices, payments, subjectLinks, combination, classmates, audits, guardianContacts, feeContacts, consents, siblings] = await Promise.all([
      prisma.studentAttendance.findMany({ where: { schoolId, studentId: id }, include: { term: { include: { academicSession: { select: { name: true } } } } }, orderBy: { date: "desc" } }),
      prisma.resultSheet.findMany({ where: { schoolId, studentId: id }, include: { term: { include: { academicSession: { select: { name: true } } } }, scoreEntries: { include: { subject: { include: { subjectCategory: { select: { name: true } }, department: { select: { name: true } } } }, assessmentComponent: { select: { name: true, code: true, order: true, maxScore: true } } } } }, orderBy: { term: { startDate: "asc" } } }),
      prisma.reportCard.findMany({ where: { schoolId, studentId: id }, include: { term: { include: { academicSession: { select: { name: true } } } } }, orderBy: { term: { startDate: "desc" } } }),
      prisma.behaviorLog.findMany({ where: { studentId: id }, orderBy: { loggedAt: "desc" }, take: 30 }),
      prisma.counselingRecord.count({ where: { schoolId, studentId: id, deletedAt: null } }),
      prisma.healthVisit.count({ where: { schoolId, studentId: id, deletedAt: null } }),
      prisma.invoice.findMany({ where: { schoolId, studentId: id, status: { not: "VOID" } }, include: { items: true, feeStructure: { select: { name: true, ref: true, kind: true } }, term: { include: { academicSession: { select: { name: true } } } } }, orderBy: { issuedOn: "desc" } }),
      prisma.payment.findMany({ where: { schoolId, studentId: id, status: "SUCCESS", isReversed: false }, include: { recordedBy: { select: { firstName: true, lastName: true } }, invoice: { select: { invoiceNumber: true, term: { include: { academicSession: { select: { name: true } } } } } } }, orderBy: { paidAt: "desc" } }),
      classId ? prisma.classSubject.findMany({ where: { schoolId, classId, isActive: true }, include: { subject: { include: { subjectCategory: { select: { name: true } }, department: { select: { name: true } } } } } }) : Promise.resolve([]),
      prisma.subjectCombination.findFirst({ where: { schoolId, studentId: id }, orderBy: { id: "desc" } }),
      classId ? prisma.student.count({ where: { schoolId, currentClassId: classId, status: "ACTIVE" } }) : Promise.resolve(0),
      prisma.auditLog.findMany({ where: { schoolId, entityType: "Student", entityId: id }, include: { actor: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, take: 12 }),
      prisma.guardianContact.findMany({ where: { schoolId, guardianId: { in: (await prisma.studentGuardian.findMany({ where: { studentId: id }, select: { guardianId: true } })).map((row) => row.guardianId) } }, orderBy: { createdAt: "desc" }, take: 10 }),
      prisma.feeContact.findMany({ where: { schoolId, studentId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
      prisma.familyConsent.findMany({ where: { schoolId, guardianId: { in: (await prisma.studentGuardian.findMany({ where: { studentId: id }, select: { guardianId: true } })).map((row) => row.guardianId) } } }),
      prisma.studentGuardian.count({ where: { guardianId: { in: (await prisma.studentGuardian.findMany({ where: { studentId: id }, select: { guardianId: true } })).map((row) => row.guardianId) }, studentId: { not: id } } })
    ]);

    /* attendance, by session and term */
    const sessions = new Map<string, { session: string; start: number; terms: Map<string, { term: string; start: number; days: number; present: number; absent: number; late: number; excused: number; current: boolean }> }>();
    const entries: Array<{ date: string; mark: string; reason: string | null; accepted: string; source: string }> = [];
    for (const row of attendanceRows) {
      const sessionName = row.term.academicSession?.name ?? "";
      const session0 = sessions.get(sessionName) ?? { session: sessionName, start: row.term.startDate.getTime(), terms: new Map() };
      const entry = session0.terms.get(row.term.id) ?? { term: row.term.name, start: row.term.startDate.getTime(), days: 0, present: 0, absent: 0, late: 0, excused: 0, current: term?.id === row.term.id };
      entry.days += 1;
      if (row.status === "ABSENT") entry.absent += 1;
      else entry.present += 1;
      if (row.status === "LATE") entry.late += 1;
      if (row.status === "EXCUSED") entry.excused += 1;
      session0.terms.set(row.term.id, entry);
      session0.start = Math.min(session0.start, row.term.startDate.getTime());
      sessions.set(sessionName, session0);
      if (term?.id === row.term.id && row.status !== "PRESENT" && entries.length < 40) {
        entries.push({ date: row.date.toISOString(), mark: row.status === "ABSENT" ? "Absent" : row.status === "LATE" ? "Late" : "Excused", reason: row.reason, accepted: row.status === "EXCUSED" ? "Accepted" : "—", source: row.reason ? "Form master" : "—" });
      }
    }
    const sessionList = Array.from(sessions.values())
      .sort((a, b) => b.start - a.start)
      .map((entry) => {
        const termsList = Array.from(entry.terms.values()).sort((a, b) => a.start - b.start);
        const sum = (key: "days" | "present" | "absent" | "late" | "excused") => termsList.reduce((total, item) => total + item[key], 0);
        const days = sum("days");
        return { session: entry.session, terms: termsList.map((item) => ({ term: item.term, days: item.days, present: item.present, absent: item.absent, late: item.late, excused: item.excused, state: item.current ? "In progress" : "Complete" })), days, present: sum("present"), absent: sum("absent"), late: sum("late"), excused: sum("excused"), pct: days ? Math.round((sum("present") / days) * 1000) / 10 : null, marked: termsList.length };
      });
    const nowTerm = term ? Array.from(sessions.values()).flatMap((entry) => Array.from(entry.terms.entries())).find(([termId]) => termId === term.id)?.[1] : undefined;
    const attendance = {
      days: nowTerm?.days ?? 0,
      present: nowTerm?.present ?? 0,
      absent: nowTerm?.absent ?? 0,
      late: nowTerm?.late ?? 0,
      excused: nowTerm?.excused ?? 0,
      pct: nowTerm && nowTerm.days ? Math.round((nowTerm.present / nowTerm.days) * 1000) / 10 : null,
      sessions: sessionList,
      entries
    };

    /* this term, subject by subject, ranked against the class */
    const sheet = term ? sheets.find((row) => row.termId === term.id) ?? null : null;
    const peerTotals = classId && term ? await prisma.scoreEntry.groupBy({ by: ["studentId", "subjectId"], where: { schoolId, resultSheet: { classId, termId: term.id } }, _sum: { score: true } }) : [];
    const bySubject = new Map<string, Array<{ studentId: string; total: number }>>();
    for (const row of peerTotals) bySubject.set(row.subjectId, [...(bySubject.get(row.subjectId) ?? []), { studentId: row.studentId, total: row._sum.score ?? 0 }]);
    const teachers = await prisma.user.findMany({ where: { id: { in: subjectLinks.map((link) => link.teacherId).filter((value): value is string => Boolean(value)) } }, select: { id: true, firstName: true, lastName: true } });
    const teacherName = new Map(teachers.map((user) => [user.id, fullName(user)]));
    const mine = new Map<string, { total: number; components: Array<{ name: string; score: number; max: number }> }>();
    for (const entry of sheet?.scoreEntries ?? []) {
      const row = mine.get(entry.subjectId) ?? { total: 0, components: [] };
      row.total += entry.score;
      row.components.push({ name: entry.assessmentComponent.name, score: entry.score, max: entry.maxScore });
      mine.set(entry.subjectId, row);
    }
    const subjects = subjectLinks
      .map((link) => {
        const scored = mine.get(link.subjectId);
        const field = bySubject.get(link.subjectId) ?? [];
        const classAvg = field.length ? field.reduce((sum, row) => sum + row.total, 0) / field.length : null;
        const total = scored ? Math.round(scored.total * 10) / 10 : null;
        const position = total === null ? null : 1 + field.filter((row) => row.total > (scored?.total ?? 0)).length;
        return {
          id: link.subjectId,
          name: link.subject.name,
          category: link.subject.subjectCategory?.name ?? (link.subject.isCore ? "Core" : "Elective"),
          teacher: link.teacherId ? teacherName.get(link.teacherId) ?? null : null,
          dept: link.subject.department?.name ?? "—",
          total,
          grade: gradeOf(bands, total),
          pos: position,
          outOf: field.length,
          classAvg: classAvg === null ? null : Math.round(classAvg * 10) / 10,
          standing: total === null ? "Waiting on the sheet" : classAvg === null ? "Around the class" : STANDING(total, classAvg),
          state: total === null ? "Not started" : sheet?.status === "PUBLISHED" ? "Published" : sheet?.status === "APPROVED" ? "Approved" : sheet?.status === "SUBMITTED" || sheet?.status === "UNDER_REVIEW" ? "Submitted" : sheet?.status === "REJECTED" || sheet?.status === "RETURNED" ? "Blocked" : "Draft",
          components: scored?.components ?? []
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    const scoredSubjects = subjects.filter((row) => row.total !== null);
    const passMark = 40;
    const strongest = scoredSubjects.slice().sort((a, b) => (b.total ?? 0) - (a.total ?? 0))[0] ?? null;
    const weakest = scoredSubjects.slice().sort((a, b) => (a.total ?? 0) - (b.total ?? 0))[0] ?? null;
    const registered = Array.isArray(combination?.subjectIds) ? (combination?.subjectIds as unknown[]).length : subjects.length;

    const history = sheets
      .slice()
      .sort((a, b) => a.term.startDate.getTime() - b.term.startDate.getTime())
      .map((row) => {
        const card = cards.find((entry) => entry.termId === row.termId);
        return {
          termId: row.termId,
          term: row.term.name,
          session: row.term.academicSession?.name ?? "",
          avg: Math.round(row.averageScore * 10) / 10,
          pos: row.position,
          grade: row.grade ?? gradeOf(bands, row.averageScore),
          state: card?.status === "PUBLISHED" || row.status === "PUBLISHED" ? "Published" : row.status === "REJECTED" || row.status === "RETURNED" ? "Blocked" : card ? "Generated" : "Not generated",
          published: isoDate(card?.publishedAt ?? row.publishedAt),
          current: term?.id === row.termId
        };
      });

    const cardRows = cards.map((card) => {
      const row = sheets.find((entry) => entry.termId === card.termId);
      return {
        id: card.id,
        termId: card.termId,
        term: card.term.name,
        session: card.term.academicSession?.name ?? "",
        avg: row ? Math.round(row.averageScore * 10) / 10 : null,
        pos: row?.position ?? null,
        grade: row?.grade ?? "—",
        state: card.status === "PUBLISHED" || card.status === "LOCKED" ? "Published" : card.status === "GENERATED" ? "Generated" : "Draft",
        published: isoDate(card.publishedAt)
      };
    });

    /* wellbeing */
    const log = behaviour.map((entry) => ({
      id: entry.id,
      date: entry.loggedAt.toISOString(),
      kind: entry.category,
      entry: entry.description,
      by: entry.recordedById ?? null,
      outcome: entry.outcome ?? "Closed",
      visibleTo: entry.visibleTo ?? "Form master, counsellor and leadership"
    }));
    // Incidents a teacher reports are discipline records; they belong in the same conduct log the form master and leadership read.
    const incidents = await prisma.disciplineRecord.findMany({ where: { schoolId, studentId: id, deletedAt: null }, orderBy: { occurredAt: "desc" }, take: 30 });
    for (const incident of incidents) log.push({ id: incident.id, date: incident.occurredAt.toISOString(), kind: "Conduct", entry: `${incident.category} · ${incident.severity}: ${incident.description}`, by: incident.reporterId ?? null, outcome: incident.status === "OPEN" ? "Open" : incident.status.charAt(0) + incident.status.slice(1).toLowerCase(), visibleTo: "Leadership and the form master" });
    log.sort((a, b) => b.date.localeCompare(a.date));
    const recorders = await prisma.user.findMany({ where: { id: { in: Array.from(new Set(log.map((entry) => entry.by).filter((value): value is string => Boolean(value)))) } }, select: { id: true, firstName: true, lastName: true, role: true } });
    const recorderName = new Map(recorders.map((user) => [user.id, `${fullName(user)} · ${String(user.role).replace(/_/g, " ").toLowerCase()}`]));
    const medical = student.medicalRecord;

    /* family */
    const consentTypes = await loadConsentTypes(schoolId);
    const guardianIds = student.guardians.map((link) => link.guardianId);
    const primaryLink = student.guardians.find((link) => link.isPrimary) ?? student.guardians[0];
    const consentOf = (guardianId: string, code: string) => consents.find((row) => row.guardianId === guardianId && row.typeCode === code);
    const sent = [
      ...guardianContacts
        // A call is about one child: it is on that child's record, and not on a sibling's.
        .filter((entry) => entry.kind !== "CALL" || !(entry.detail as { studentId?: string } | null)?.studentId || (entry.detail as { studentId?: string }).studentId === student.id)
        .map((entry) => {
          const call = entry.kind === "CALL" ? ((entry.detail ?? {}) as { outcome?: string; note?: string; by?: string }) : null;
          const day = entry.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
          return call
            ? { at: entry.createdAt, label: `Call · ${call.outcome ?? "logged"}${call.note ? ` — ${call.note}` : ""}`, sub: `Phone · ${day} · ${call.by ?? "A teacher"}`, pill: call.outcome === "Spoke to them" ? "Reached" : "Not reached" }
            : { at: entry.createdAt, label: entry.summary, sub: `${entry.channel ?? "In-app"} · ${day}`, pill: "Delivered" };
        }),
      ...feeContacts.map((entry) => ({ at: entry.createdAt, label: entry.summary, sub: `${entry.channel ?? "In-app"} · ${entry.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`, pill: "Delivered" }))
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 8)
      .map(({ label, sub, pill }) => ({ label, sub, pill }));

    /* fees */
    const termInvoices = invoices.filter((invoice) => relevantInvoice(invoice, term?.id));
    const billed = termInvoices.reduce((sum, invoice) => sum + num(invoice.total), 0);
    const owing = termInvoices.reduce((sum, invoice) => sum + num(invoice.balance), 0);
    const paid = billed - owing;
    const feeItems = termInvoices.flatMap((invoice) => invoice.items.map((item) => ({ name: item.description, amount: num(item.amount) * (item.quantity ?? 1), structure: invoice.feeStructure?.name ?? "Fees", invoice: invoice.invoiceNumber })));
    const oldest = termInvoices.filter((invoice) => num(invoice.balance) > 0).sort((a, b) => a.issuedOn.getTime() - b.issuedOn.getTime())[0];

    /* records */
    const have = new Set(student.documents.map((document) => document.label));
    if (student.photoUrl) have.add("Photograph");
    const documents = [
      ...student.documents.map((document) => ({ id: document.id, label: document.label, source: document.source ?? "School upload", on: isoDate(document.createdAt), state: document.verifiedAt ? "Verified" : "Recorded", file: document.fileName })),
      ...REQUIRED_DOCUMENTS.filter((label) => !have.has(label)).map((label) => ({ id: `missing-${label}`, label, source: "—", on: null, state: "Missing", file: "" }))
    ];
    const portal = portalOf(student.user);
    const house = student.houseName ?? null;
    const boarding = student.hostelAllocation[0];
    const fm = student.currentClass?.classTeacher;

    return {
      id: student.id,
      name: fullName(student),
      fullName: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
      initials: initials(fullName(student)),
      adm: student.admissionNumber,
      status: student.status,
      state: stateOf(student.status),
      gender: genderLabel(student.gender),
      dob: isoDate(student.dateOfBirth),
      age: ageOf(student.dateOfBirth),
      nationality: student.nationality,
      stateOfOrigin: student.stateOfOrigin,
      language: student.languageAtHome ?? "English",
      address: student.address ?? null,
      house,
      admitted: isoDate(student.admissionDate),
      previousSchool: student.previousSchool ?? null,
      boarding: boarding ? { is: true, where: `${boarding.room.building?.name ?? "Hostel"} · ${boarding.room.name ?? ""}`.trim() } : { is: false, where: null },
      hasPhoto: Boolean(student.photoUrl),
      portal,
      arm: student.currentClass ? { id: student.currentClass.id, name: armName(student.currentClass), level: student.currentClass.classLevel?.name ?? "", capacity: student.currentClass.capacity } : null,
      roll: classmates,
      formMaster: fm ? { id: fm.id, name: fullName(fm), role: String(fm.role).replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()), phone: fm.phone ?? "—", email: fm.email, since: fm.createdAt.getFullYear(), portal: portalOf(fm) } : null,
      term: term ? { id: term.id, name: term.name, session: term.academicSession?.name ?? "", label: `${term.name} ${term.academicSession?.name ?? ""}`.trim() } : null,
      attendance,
      academic: {
        sheet: sheet
          ? { avg: Math.round(sheet.averageScore * 10) / 10, total: Math.round(sheet.totalScore * 10) / 10, grade: sheet.grade ?? gradeOf(bands, sheet.averageScore), position: sheet.position, outOf: classmates, status: sheet.status, passed: scoredSubjects.filter((row) => (row.total ?? 0) >= passMark + 10).length }
          : null,
        subjects,
        scored: scoredSubjects.length,
        strongest: strongest ? { name: strongest.name, total: strongest.total } : null,
        weakest: weakest ? { name: weakest.name, total: weakest.total } : null,
        history,
        registration: { count: registered, track: combination?.track ?? "Registered with the arm's offering", fixed: Boolean(combination) },
        passMark
      },
      cards: cardRows,
      wellbeing: {
        log: log.map((entry) => ({ ...entry, by: entry.by ? recorderName.get(entry.by) ?? "A member of staff" : "—" })),
        counselling,
        visits,
        health: medical
          ? { conditions: medical.conditions ?? null, allergies: medical.allergies ?? null, bloodGroup: medical.bloodGroup ?? null, genotype: medical.genotype ?? null, notes: medical.notes ?? null }
          : null
      },
      family: {
        guardians: student.guardians.map((link) => ({
          id: link.guardianId,
          name: fullName(link.guardian),
          initials: initials(fullName(link.guardian)),
          relation: link.relation ?? link.guardian.relationship,
          phone: link.guardian.phone,
          email: link.guardian.email,
          occupation: link.guardian.occupation,
          primary: link.isPrimary,
          portal: portalOf(link.guardian.user),
          delivery: !link.guardian.phone ? "No number" : !validMobile(link.guardian.phone) ? "Failing" : "Delivered",
          visibility: Array.isArray(link.visibility) ? (link.visibility as string[]) : ["Results and report cards", "Attendance", "Fee amounts", "Announcements"],
          canCollect: link.canCollect
        })),
        primaryId: primaryLink?.guardianId ?? null,
        consent: consentTypes.map((type) => {
          const record = primaryLink ? consentOf(primaryLink.guardianId, type.code) : undefined;
          return { code: type.code, name: type.name, required: type.required, status: record?.status ?? "NOT_GIVEN", means: record?.means ?? null, on: isoDate(record?.recordedAt) };
        }),
        collectors: [
          ...student.guardians.filter((link) => link.canCollect).map((link) => ({ id: `g-${link.guardianId}`, name: fullName(link.guardian), relation: String(link.relation ?? link.guardian.relationship).toLowerCase(), note: link.isPrimary ? "Primary contact · photograph on file" : "Photograph on file", own: false })),
          ...student.collectors.map((collector) => ({ id: collector.id, name: collector.name, relation: collector.relation.toLowerCase(), note: collector.photoFile ? `Photograph on file${collector.until ? ` · until ${collector.until.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}` : "No photograph — cannot collect", own: true }))
        ],
        sent,
        siblings,
        guardianIds
      },
      fees: {
        billed,
        paid,
        owing,
        state: feeStateOf(termInvoices),
        days: oldest ? daysSince(oldest.issuedOn) : 0,
        structures: Array.from(new Set(termInvoices.map((invoice) => invoice.feeStructure?.name).filter((name): name is string => Boolean(name)))),
        items: feeItems,
        invoices: invoices.map((invoice) => ({ id: invoice.id, number: invoice.invoiceNumber, term: invoice.term ? `${invoice.term.name} ${invoice.term.academicSession?.name ?? ""}`.trim() : "—", total: num(invoice.total), balance: num(invoice.balance), status: invoice.status })),
        receipts: payments.map((payment) => ({
          id: payment.id,
          ref: payment.receiptNumber ?? payment.paymentNumber ?? payment.reference,
          amount: num(payment.amount),
          mode: PAYMENT_MODE[String(payment.method)] ?? String(payment.method),
          reference: payment.schoolBankReference ?? payment.reference,
          at: isoDate(payment.paidAt),
          term: payment.invoice?.term ? `${payment.invoice.term.name} ${payment.invoice.term.academicSession?.name ?? ""}`.trim() : "—",
          by: payment.recordedBy ? fullName(payment.recordedBy) : "—"
        })),
        familyId: primaryLink?.guardianId ?? `s_${student.id}`
      },
      records: {
        documents,
        missing: documents.filter((document) => document.state === "Missing").map((document) => document.label),
        required: REQUIRED_DOCUMENTS.length,
        changes: student.changeRequests.map((request) => ({ id: request.id, field: request.field, before: request.before, after: request.after, status: request.status, at: request.createdAt.toISOString() })),
        pending: student.changeRequests.filter((request) => request.status === "PENDING").length,
        audit: audits.map((entry) => ({ label: String((entry.metadata as { summary?: string } | null)?.summary ?? `${entry.action.toLowerCase()} · ${entry.entityType}`), by: entry.actor ? fullName(entry.actor) : "System", at: entry.createdAt.toISOString() }))
      }
    };
  }

  /** One term's whole result — every subject, every component. */
  async termResult(session: SessionPayload, id: string, termId: string) {
    const schoolId = session.schoolId;
    await this.studentOrThrow(schoolId, id);
    const bands = await gradeBands(schoolId);
    const sheet = await prisma.resultSheet.findFirst({
      where: { schoolId, studentId: id, termId },
      include: { term: { include: { academicSession: true } }, classRoom: true, scoreEntries: { include: { subject: { include: { subjectCategory: { select: { name: true } } } }, assessmentComponent: { select: { name: true, code: true, order: true, maxScore: true } } } } }
    });
    if (!sheet) throw new NotFoundException("There is no result for that term.");
    const peers = await prisma.scoreEntry.groupBy({ by: ["studentId", "subjectId"], where: { schoolId, resultSheet: { classId: sheet.classId, termId } }, _sum: { score: true } });
    const field = new Map<string, number[]>();
    for (const row of peers) field.set(row.subjectId, [...(field.get(row.subjectId) ?? []), row._sum.score ?? 0]);
    const subjects = new Map<string, { id: string; name: string; category: string; components: Array<{ name: string; code: string; order: number; score: number; max: number }>; total: number }>();
    for (const entry of sheet.scoreEntries) {
      const row = subjects.get(entry.subjectId) ?? { id: entry.subjectId, name: entry.subject.name, category: entry.subject.subjectCategory?.name ?? (entry.subject.isCore ? "Core" : "Elective"), components: [], total: 0 };
      row.components.push({ name: entry.assessmentComponent.name, code: entry.assessmentComponent.code, order: entry.assessmentComponent.order, score: entry.score, max: entry.maxScore });
      row.total += entry.score;
      subjects.set(entry.subjectId, row);
    }
    const peerCount = await prisma.resultSheet.count({ where: { schoolId, classId: sheet.classId, termId } });
    const card = await prisma.reportCard.findFirst({ where: { schoolId, studentId: id, termId } });
    const [school, learner, attendance] = await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, address: true, city: true, mainPhone: true, ownerEmail: true } }),
      prisma.student.findUniqueOrThrow({ where: { id }, select: { firstName: true, middleName: true, lastName: true, admissionNumber: true, gender: true } }),
      prisma.studentAttendance.groupBy({ by: ["status"], where: { schoolId, studentId: id, termId }, _count: { _all: true } })
    ]);
    const marked = attendance.reduce((sum, row) => sum + row._count._all, 0);
    const absent = attendance.find((row) => row.status === "ABSENT")?._count._all ?? 0;
    return {
      school: { name: school?.name ?? "", address: [school?.address, school?.city].filter(Boolean).join(", "), phone: school?.mainPhone ?? "", email: school?.ownerEmail ?? "" },
      student: { name: [learner.firstName, learner.middleName, learner.lastName].filter(Boolean).join(" "), adm: learner.admissionNumber, gender: genderLabel(learner.gender) },
      attendance: { days: marked, present: marked - absent, pct: marked ? Math.round(((marked - absent) / marked) * 1000) / 10 : null },
      term: { id: termId, name: sheet.term.name, session: sheet.term.academicSession?.name ?? "" },
      arm: armName(sheet.classRoom),
      avg: Math.round(sheet.averageScore * 10) / 10,
      total: Math.round(sheet.totalScore * 10) / 10,
      grade: sheet.grade ?? gradeOf(bands, sheet.averageScore),
      position: sheet.position,
      outOf: peerCount,
      status: sheet.status,
      state: card?.status === "PUBLISHED" || sheet.status === "PUBLISHED" ? "Published" : sheet.status === "REJECTED" || sheet.status === "RETURNED" ? "Blocked" : "Not published",
      published: isoDate(card?.publishedAt ?? sheet.publishedAt),
      teacherComment: sheet.teacherComment,
      principalComment: sheet.principalComment,
      components: Array.from(new Set(sheet.scoreEntries.map((entry) => entry.assessmentComponent.name))),
      subjects: Array.from(subjects.values())
        .map((row) => {
          const scores = field.get(row.id) ?? [];
          const average = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;
          const total = Math.round(row.total * 10) / 10;
          return { id: row.id, name: row.name, category: row.category, components: row.components.sort((a, b) => a.order - b.order), total, grade: gradeOf(bands, total), classAvg: average === null ? null : Math.round(average * 10) / 10, standing: average === null ? "Around the class" : STANDING(total, average) };
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    };
  }

  /* ───────────────────────── writing to a record ───────────────────────── */

  async addNote(session: SessionPayload, id: string, body: unknown) {
    const input = noteSchema.parse(body);
    const student = await this.studentOrThrow(session.schoolId, id);
    const created = await prisma.behaviorLog.create({
      data: {
        studentId: id,
        category: input.kind,
        description: input.entry,
        severity: input.kind === "Safeguarding concern" ? "HIGH" : input.kind === "Conduct" ? "MEDIUM" : "LOW",
        loggedAt: input.date ? new Date(input.date) : new Date(),
        actionTaken: input.action || null,
        outcome: input.outcome,
        visibleTo: input.visible,
        recordedById: session.userId
      }
    });
    if (input.tell) {
      const link = await prisma.studentGuardian.findFirst({ where: { studentId: id, isPrimary: true } });
      if (link) await prisma.guardianContact.create({ data: { schoolId: session.schoolId, guardianId: link.guardianId, kind: "MESSAGE", channel: "In-app", summary: `A ${input.kind.toLowerCase()} note about ${student.firstName}`, createdById: session.userId } });
    }
    await this.audit(session, AuditAction.CREATE, "Student", id, { summary: `Guidance note recorded · ${input.kind}` });
    return { id: created.id };
  }

  async addCollector(session: SessionPayload, id: string, body: unknown) {
    const input = collectorSchema.parse(body);
    const schoolId = session.schoolId;
    await this.studentOrThrow(schoolId, id);
    const everyChild = input.applies.startsWith("Every");
    const links = everyChild ? await prisma.studentGuardian.findMany({ where: { guardianId: { in: (await prisma.studentGuardian.findMany({ where: { studentId: id }, select: { guardianId: true } })).map((row) => row.guardianId) } }, select: { studentId: true } }) : [{ studentId: id }];
    const studentIds = Array.from(new Set(links.map((row) => row.studentId).concat(id)));
    for (const studentId of studentIds) {
      await prisma.authorisedCollector.create({ data: { schoolId, studentId, name: input.name, relation: input.relation, phone: input.phone, photoFile: input.photo, until: input.until ? new Date(input.until) : null, addedById: session.userId } });
    }
    await this.audit(session, AuditAction.CREATE, "Student", id, { summary: `Authorised collector added · ${input.name}` });
    return { children: studentIds.length };
  }

  async addDocument(session: SessionPayload, id: string, body: unknown) {
    const input = documentSchema.parse(body);
    await this.studentOrThrow(session.schoolId, id);
    const verified = !input.verifiedBy.startsWith("Not verified");
    const doc = await prisma.studentDocument.create({
      data: { studentId: id, label: input.type, fileName: input.file, fileUrl: "", mimeType: "application/octet-stream", sizeBytes: 0, source: "School upload", documentOn: input.date ? new Date(input.date) : null, note: input.note || null, verifiedAt: verified ? new Date() : null, verifiedById: verified ? session.userId : null }
    });
    await this.audit(session, AuditAction.CREATE, "Student", id, { summary: `Document recorded · ${input.type}` });
    return { id: doc.id };
  }

  async mapGuardian(session: SessionPayload, id: string, body: unknown) {
    const input = mapSchema.parse(body);
    const schoolId = session.schoolId;
    const student = await this.studentOrThrow(schoolId, id);
    const existing = Array.isArray(input.guardian) ? input.guardian[0] : input.guardian;
    const primary = input.order.startsWith("Primary");
    let guardianId = existing;
    if (existing) {
      if (!(await prisma.guardian.findFirst({ where: { id: existing, schoolId } }))) throw new BadRequestException("That guardian is not in this school.");
    } else {
      if (!input.name?.trim()) throw new BadRequestException("Give the guardian's full name.");
      if (!input.phone?.trim()) throw new BadRequestException("A guardian needs a mobile number — it is their login.");
      const [first, ...rest] = input.name.trim().split(/\s+/);
      const created = await prisma.guardian.create({ data: { schoolId, firstName: first, lastName: rest.join(" ") || "Guardian", phone: input.phone.trim(), email: input.email?.trim() || null, relationship: input.relation, occupation: input.occupation || null, address: input.address || null, language: input.language || "English" } });
      guardianId = created.id;
    }
    if (await prisma.studentGuardian.findUnique({ where: { studentId_guardianId: { studentId: id, guardianId: guardianId as string } } })) throw new BadRequestException("That guardian is already on this child's record.");
    if (primary) await prisma.studentGuardian.updateMany({ where: { studentId: id }, data: { isPrimary: false } });
    await prisma.studentGuardian.create({ data: { studentId: id, guardianId: guardianId as string, isPrimary: primary, relation: input.relation, visibility: input.see, canCollect: input.collect } });
    if (input.invite && !existing) await prisma.guardianContact.create({ data: { schoolId, guardianId: guardianId as string, kind: "INVITE", channel: "SMS and email", summary: "Portal invitation sent", createdById: session.userId } });
    await this.audit(session, AuditAction.UPDATE, "Student", id, { summary: `Guardian mapped · ${student.firstName}` });
    return { guardianId };
  }

  /** The full health and welfare record — opened on purpose, and logged at the moment it is opened. */
  async reveal(session: SessionPayload, id: string, body: unknown) {
    const input = z.object({ reason: z.string().trim().min(5, "Say why you need it — it is written to the audit log.") }).parse(body);
    if (!LEADERS.has(session.role) && !WELFARE.has(session.role)) throw new ForbiddenException("Only the leadership, the nurse and the counsellor may open this record.");
    const student = await this.studentOrThrow(session.schoolId, id);
    const [record, counselling, discipline] = await Promise.all([
      prisma.medicalRecord.findUnique({ where: { studentId: id } }),
      prisma.counselingRecord.count({ where: { schoolId: session.schoolId, studentId: id, deletedAt: null } }),
      prisma.disciplineRecord.count({ where: { schoolId: session.schoolId, studentId: id, deletedAt: null } })
    ]);
    await this.audit(session, AuditAction.EXPORT, "Student", id, { summary: `Sensitive record revealed · ${student.firstName} ${student.lastName}`, reason: input.reason });
    const fields: Array<[string, string]> = [
      ["Blood group", record?.bloodGroup ?? "Not recorded"],
      ["Genotype", record?.genotype ?? "Not recorded"],
      ["Known conditions", record?.conditions ?? "None recorded"],
      ["Allergies", record?.allergies ?? "None recorded"],
      ["Notes", record?.notes ?? "None"],
      ["Counselling sessions", String(counselling)],
      ["Disciplinary records", String(discipline)]
    ];
    return { fields };
  }

  /** Normalise a phone so a duplicate can be told from a different family. */
  samePhone(a: string, b: string) {
    return normalPhone(a) === normalPhone(b);
  }
}
