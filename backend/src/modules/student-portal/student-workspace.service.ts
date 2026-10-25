import { randomBytes } from "node:crypto";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { switchedOffModules } from "../platform-sync/availability";
import { isForStudents } from "./student-notify";
import { hiddenPages, loadStudentPolicy, type StudentVisible } from "./student-policy";
import { resolveGradeLabel } from "../../../../src/lib/domain/grading";
import { formatNigeriaClassName } from "../../../../src/lib/school-options";

/**
 * The student's own workspace: what they are taught, set, marked on and told, read from the school's records as the student is entitled to
 * see them. Nothing here is written by the student except a hand-in, a question to a teacher and their own notification choices, and none
 * of it reaches a family unless the school's own settings say so.
 *
 * A mark is shown once the school releases it — a component score is released when its subject's sheet for this class is approved —
 * and is "Pending" before that, never zero.
 */

const DAY = 86_400_000;
/** Lagos has no daylight saving: the school's day is UTC+1 all year. */
const lagos = (at = new Date()) => new Date(at.getTime() + 3_600_000);
const isoDay = (at: Date) => lagos(at).toISOString().slice(0, 10);
const clock = (at = new Date()) => lagos(at).toISOString().slice(11, 16);
const dayOf = (iso: string) => new Date(`${iso}T00:00:00Z`);

const armName = (name?: string | null, arm?: string | null) => (name ? formatNigeriaClassName(arm ? `${name} - ${arm}` : name) : "Unassigned");
const fullName = (person: { firstName: string; lastName: string } | null | undefined) => (person ? `${person.firstName} ${person.lastName}` : "");

const askSchema = z.object({
  to: z.string().min(1).optional(),
  topic: z.string().trim().min(1).max(160),
  text: z.string().trim().min(1).max(4000)
});
const handInSchema = z.object({ comment: z.string().trim().max(2000).optional(), fileUrl: z.string().trim().max(1000).optional() }).refine((value) => value.comment || value.fileUrl, "Say something about it, or attach it.");
const prefsSchema = z.object({
  matrix: z.record(z.string(), z.boolean()).optional(),
  quiet: z.string().max(40).optional(),
  remind: z.string().max(40).optional(),
  readAnnouncements: z.array(z.string()).max(500).optional(),
  /** The secret in the student's calendar feed address. Whoever holds the address can read the feed, so it can be replaced. */
  feedToken: z.string().regex(/^[a-f0-9]{48}$/).optional()
});

const PREFS_RESOURCE = "student-prefs";

/** Part of the address is hidden: enough to recognise a network, not enough to place a home. */
export function hide(address: string | null | undefined): string {
  if (!address) return "";
  return address.replace(/(\d+\.\d+)\.\d+\.\d+/, "$1.•.•").replace(/([0-9a-f]+:[0-9a-f]+):.*/i, "$1:•");
}

/** "Mozilla/5.0 (Macintosh; …) … Chrome/152 …" → "Chrome on Mac". A person recognises a device by its name, not its user-agent string. */
export function deviceName(agent: string | null | undefined): string {
  if (!agent) return "Unknown device";
  const browser = /Edg\//.test(agent) ? "Edge" : /OPR\/|Opera/.test(agent) ? "Opera" : /Firefox\//.test(agent) ? "Firefox" : /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : /^curl\//i.test(agent) ? "A script" : null;
  const system = /Android/.test(agent) ? "Android" : /iPhone|iPad|iOS/.test(agent) ? "iPhone or iPad" : /Windows/.test(agent) ? "Windows" : /Mac OS X|Macintosh/.test(agent) ? "Mac" : /Linux/.test(agent) ? "Linux" : null;
  return browser && system ? `${browser} on ${system}` : browser ?? system ?? agent.slice(0, 40);
}

const icsText = (value: string) => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const ymd = (iso: string) => iso.replace(/-/g, "");
/** "09:00 – 10:30" on a Lagos day → the same moment in UTC, which a calendar can place anywhere. */
const utcStamp = (iso: string, clockText: string) => {
  const moment = new Date(`${iso}T${clockText}:00Z`);
  moment.setUTCHours(moment.getUTCHours() - 1);
  return moment.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
};

/** A calendar feed in the one format every phone reads. Whole days stay whole days; timed events are placed in UTC. */
export function icsFor(name: string, entries: Array<{ id: string; date: string; end: string; title: string; time: string; where: string; note: string }>): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FutureRealm//Student calendar//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${icsText(name)}`];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  for (const entry of entries) {
    const times = entry.time.match(/(\d{2}:\d{2})\D+(\d{2}:\d{2})/);
    lines.push("BEGIN:VEVENT", `UID:${entry.id}@futurerealm`, `DTSTAMP:${stamp}`, `SUMMARY:${icsText(entry.title)}`);
    if (times) {
      lines.push(`DTSTART:${utcStamp(entry.date, times[1]!)}`, `DTEND:${utcStamp(entry.end, times[2]!)}`);
    } else {
      const after = new Date(`${entry.end}T00:00:00Z`);
      after.setUTCDate(after.getUTCDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${ymd(entry.date)}`, `DTEND;VALUE=DATE:${ymd(after.toISOString().slice(0, 10))}`);
    }
    if (entry.where) lines.push(`LOCATION:${icsText(entry.where)}`);
    if (entry.note) lines.push(`DESCRIPTION:${icsText(entry.note.slice(0, 500))}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

@Injectable()
export class StudentWorkspaceService {
  private assert(session: SessionPayload) {
    if (session.role !== "STUDENT") throw new ForbiddenException("This is the student's own workspace.");
  }

  /** What the school has decided a student may see and do. A page the school has not made visible answers plainly, rather than with an empty list. */
  private async allow(session: SessionPayload, what: StudentVisible) {
    if (!(await loadStudentPolicy(session.schoolId)).sees.has(what)) throw new ForbiddenException(`Your school has not made ${what === "Announcements" ? "announcements" : what.toLowerCase()} visible to students.`);
  }

  private async context(session: SessionPayload) {
    this.assert(session);
    const student = await prisma.student.findFirst({
      where: { schoolId: session.schoolId, userId: session.userId },
      include: { user: true, currentClass: { include: { classLevel: true } }, guardians: { include: { guardian: true } } }
    });
    if (!student) throw new NotFoundException("No enrolled student profile is linked to this account.");
    const [term, school] = await Promise.all([
      prisma.term.findFirst({ where: { schoolId: session.schoolId, isCurrent: true }, include: { academicSession: true } }),
      prisma.school.findUnique({ where: { id: session.schoolId }, select: { name: true } })
    ]);
    const formMaster = student.currentClass?.classTeacherId
      ? await prisma.user.findUnique({ where: { id: student.currentClass.classTeacherId }, select: { id: true, firstName: true, lastName: true } })
      : null;
    return { student, term, school, formMaster };
  }

  /* ───────────────────────── who and when ───────────────────────── */

  async me(session: SessionPayload) {
    const { student, term, school, formMaster } = await this.context(session);
    const policy = await loadStudentPolicy(session.schoolId);
    const guardian = (student.guardians.find((link) => link.isPrimary) ?? student.guardians[0])?.guardian;
    const today = isoDay(new Date());
    // Whether a child boards is not a field on them — it is whether the school
    // has given them a bed this term. Reading it from the allocation means the
    // record cannot say "Boarding" about a child who has no bed.
    const [bed, collectors] = await Promise.all([
      prisma.hostelAllocation.findFirst({
        where: { studentId: student.id, schoolId: session.schoolId, OR: [{ endDate: null }, { endDate: { gte: new Date() } }] },
        select: { id: true }
      }),
      prisma.authorisedCollector.findMany({
        where: { studentId: student.id, schoolId: session.schoolId, OR: [{ until: null }, { until: { gte: new Date() } }] },
        select: { name: true, relation: true },
        orderBy: { createdAt: "asc" },
        take: 4
      })
    ]);
    const start = term ? isoDay(term.startDate) : null;
    const end = term ? isoDay(term.endDate) : null;
    const weeks = term ? Math.max(1, Math.ceil((term.endDate.getTime() - term.startDate.getTime()) / (7 * DAY))) : 0;
    const week = term && start ? Math.min(weeks, Math.max(0, Math.floor((dayOf(today).getTime() - dayOf(start).getTime()) / (7 * DAY)) + 1)) : 0;
    return {
      id: student.id,
      name: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
      first: student.user?.preferredName?.trim() || student.firstName,
      admissionNumber: student.admissionNumber,
      arm: armName(student.currentClass?.name, student.currentClass?.arm),
      classId: student.currentClassId,
      level: student.currentClass?.classLevel?.name ?? student.currentClass?.name ?? "",
      category: student.currentClass?.category ?? null,
      stream: student.currentClass?.stream ?? null,
      room: student.currentClass?.room ?? null,
      gender: student.gender,
      house: student.houseName ?? null,
      boarding: bed ? "Boarding" : "Day student",
      collectors: collectors.map((row) => ({ name: row.name, relation: row.relation })),
      dateOfBirth: student.dateOfBirth.toISOString().slice(0, 10),
      enrolled: student.admissionDate.toISOString().slice(0, 10),
      email: student.user?.email ?? null,
      formMaster: formMaster ? { id: formMaster.id, name: fullName(formMaster) } : null,
      guardian: guardian ? { name: `${guardian.firstName} ${guardian.lastName}`, relationship: guardian.relationship ?? null, phone: guardian.phone ?? null } : null,
      school: school?.name ?? "",
      policy: { homework: policy.homework, questions: policy.questions, calendarLink: policy.calendarLink },
      term: term ? { id: term.id, name: term.name, session: term.academicSession.name, start, end, week, weeks, onBreak: Boolean(term.breakStart && term.breakEnd && today >= isoDay(term.breakStart) && today <= isoDay(term.breakEnd)) } : null,
      today,
      now: clock()
    };
  }

  /** What the rail counts: work still to hand in, how much of it is late, and what has not been read. */
  async badges(session: SessionPayload) {
    const { student } = await this.context(session);
    const classId = student.currentClassId;
    const [open, unreadMessages, notices, prefs] = await Promise.all([
      classId ? prisma.assignment.findMany({ where: { schoolId: session.schoolId, classId, status: "PUBLISHED", submissions: { none: { studentId: student.id, submittedAt: { not: null } } } }, select: { dueAt: true } }) : Promise.resolve([]),
      prisma.internalMessage.count({ where: { schoolId: session.schoolId, recipientId: session.userId, readAt: null } }),
      prisma.announcement.findMany({ where: { schoolId: session.schoolId, publishedAt: { lte: new Date() }, OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] }, select: { id: true, audience: true }, take: 40 }),
      this.readPrefs(session)
    ]);
    const arm = armName(student.currentClass?.name, student.currentClass?.arm).toLowerCase();
    const read = new Set(prefs.readAnnouncements ?? []);
    const unreadNotices = notices.filter((notice) => isForStudents(notice.audience, arm) && !read.has(notice.id)).length;
    const own = await prisma.user.findUnique({ where: { id: session.userId }, select: { passwordResetRequired: true } });
    const policy = await loadStudentPolicy(session.schoolId);
    return { work: open.length, late: open.filter((row) => row.dueAt.getTime() < Date.now()).length, unread: unreadMessages + (policy.sees.has("Announcements") ? unreadNotices : 0), mustChangePassword: own?.passwordResetRequired ?? false, hidden: hiddenPages(policy), questions: policy.questions, homework: policy.homework };
  }

  /* ───────────────────────── timetable ───────────────────────── */

  async timetable(session: SessionPayload) {
    await this.allow(session, "Timetable");
    const { student, term } = await this.context(session);
    if (!student.currentClassId || !term) return { slots: [], periods: [], exams: [], components: [], published: false };
    const [entries, exams, components] = await Promise.all([
      prisma.timetableEntry.findMany({
        where: { schoolId: session.schoolId, classId: student.currentClassId, termId: term.id, isPublished: true },
        include: { subject: true },
        orderBy: [{ dayOfWeek: "asc" }, { periodNumber: "asc" }]
      }),
      prisma.examTimetableEntry.findMany({
        where: { schoolId: session.schoolId, classId: student.currentClassId, OR: [{ termId: term.id }, { termId: null }] },
        include: { subject: true },
        orderBy: { examDate: "asc" }
      }),
      prisma.assessmentComponent.findMany({ where: { schoolId: session.schoolId, isActive: true, OR: [{ termId: term.id }, { termId: null }] }, orderBy: { order: "asc" } })
    ]);
    const teacherIds = [...new Set(entries.map((entry) => entry.teacherId).filter(Boolean))] as string[];
    const teachers = teacherIds.length ? new Map((await prisma.user.findMany({ where: { id: { in: teacherIds } }, select: { id: true, firstName: true, lastName: true } })).map((person) => [person.id, fullName(person)])) : new Map<string, string>();
    const isLesson = (entry: (typeof entries)[number]) => entry.slotType === "lesson" && Boolean(entry.subjectId);
    const label = (entry: (typeof entries)[number]) => entry.subject?.name ?? (entry.slotType === "lesson" ? "Free period" : entry.slotType.charAt(0).toUpperCase() + entry.slotType.slice(1));
    const slots = entries.map((entry) => ({
      day: entry.dayOfWeek, n: entry.periodNumber, from: entry.startsAt, to: entry.endsAt, kind: isLesson(entry) ? "lesson" : "break",
      subject: label(entry), teacher: entry.teacherId ? teachers.get(entry.teacherId) ?? "" : "", venue: entry.venue ?? "", lab: /lab/i.test(entry.venue ?? "")
    }));
    const seen = new Set<string>();
    const periods = slots
      .filter((slot) => (seen.has(`${slot.n}|${slot.kind}|${slot.from}`) ? false : (seen.add(`${slot.n}|${slot.kind}|${slot.from}`), true)))
      .map((slot) => ({ n: slot.n, from: slot.from, to: slot.to, kind: slot.kind }))
      .sort((a, b) => a.from.localeCompare(b.from));
    return {
      slots, periods, published: entries.length > 0,
      exams: exams.map((exam) => ({ id: exam.id, subject: exam.subject.name, date: isoDay(exam.examDate), from: exam.startsAt, to: exam.endsAt, venue: exam.venue ?? "" })),
      components: components.map((component) => ({ code: component.code, name: component.name, weight: component.weight, max: component.maxScore }))
    };
  }

  /* ───────────────────────── subjects ───────────────────────── */

  async subjects(session: SessionPayload) {
    const { student, term } = await this.context(session);
    if (!student.currentClassId) return { subjects: [], components: [] };
    const classId = student.currentClassId;
    const [offered, slots, components, assignments] = await Promise.all([
      prisma.classSubject.findMany({
        where: { schoolId: session.schoolId, classId, isActive: true, subject: { deletedAt: null, isActive: true } },
        include: { subject: true },
        orderBy: [{ subject: { sortOrder: "asc" } }, { subject: { name: "asc" } }]
      }),
      term ? prisma.timetableEntry.findMany({ where: { schoolId: session.schoolId, classId, termId: term.id, isPublished: true, subjectId: { not: null }, slotType: "lesson" }, select: { subjectId: true, venue: true } }) : Promise.resolve([]),
      prisma.assessmentComponent.findMany({ where: { schoolId: session.schoolId, isActive: true, OR: [{ termId: term?.id ?? "-" }, { termId: null }] }, orderBy: { order: "asc" } }),
      prisma.assignment.findMany({ where: { schoolId: session.schoolId, classId, status: "PUBLISHED" }, include: { submissions: { where: { studentId: student.id } } } })
    ]);
    const teacherIds = [...new Set(offered.map((row) => row.teacherId).filter(Boolean))] as string[];
    const teachers = teacherIds.length ? new Map((await prisma.user.findMany({ where: { id: { in: teacherIds } }, select: { id: true, firstName: true, lastName: true } })).map((person) => [person.id, fullName(person)])) : new Map<string, string>();

    /* marks the school has released: an approved sheet's entries for this child, never a draft */
    // With Score Entry & Results switched off for the school there is nothing to release: every mark stays pending.
    const resultsOff = (await switchedOffModules(session.schoolId)).some((module) => module.slug === "score-entry-results") || !(await loadStudentPolicy(session.schoolId)).sees.has("Results");
    const approved = term && !resultsOff ? await prisma.scoreSheet.findMany({ where: { schoolId: session.schoolId, termId: term.id, classId, status: "APPROVED" }, select: { subjectId: true } }) : [];
    const released = new Set(approved.map((sheet) => sheet.subjectId));
    const entries = term && released.size
      ? await prisma.scoreEntry.findMany({ where: { schoolId: session.schoolId, studentId: student.id, subjectId: { in: [...released] }, isDraft: false, resultSheet: { termId: term.id } }, select: { subjectId: true, assessmentComponentId: true, score: true } })
      : [];
    const scoreOf = new Map(entries.map((entry) => [`${entry.subjectId}|${entry.assessmentComponentId}`, entry.score]));
    /* the school's own release date for each assessment: an approved mark still waits for it, exactly as it does for a guardian */
    const windows = term ? await prisma.assessmentWindow.findMany({ where: { schoolId: session.schoolId, termId: term.id }, select: { componentId: true, releaseAt: true, appliesTo: true } }) : [];
    const armLabel = armName(student.currentClass?.name, student.currentClass?.arm).toLowerCase();
    const releaseOf = new Map(windows.filter((window) => /^every class$/i.test(window.appliesTo) || window.appliesTo.toLowerCase().includes(armLabel)).map((window) => [window.componentId, window.releaseAt.getTime()]));
    const opened = (componentId: string) => (releaseOf.get(componentId) ?? 0) <= Date.now();

    /* this week's topic, from the subject's scheme of work */
    const week = term ? Math.max(1, Math.floor((dayOf(isoDay(new Date())).getTime() - dayOf(isoDay(term.startDate)).getTime()) / (7 * DAY)) + 1) : 0;
    const schemes = term ? await prisma.schemeOfWork.findMany({ where: { schoolId: session.schoolId, classId, termId: term.id }, include: { topics: { select: { weekNumber: true, topic: true, weekType: true } } } }) : [];
    const topicOf = new Map(schemes.map((scheme) => [scheme.subjectId, scheme.topics.find((topic) => topic.weekNumber === week && topic.weekType === "TEACHING")?.topic ?? null]));

    const now = Date.now();
    return {
      components: components.map((component) => ({ id: component.id, code: component.code, name: component.name, weight: component.weight, max: component.maxScore })),
      subjects: offered.map((row) => {
        const own = slots.filter((slot) => slot.subjectId === row.subjectId);
        const open = assignments.filter((a) => a.subjectId === row.subjectId && !a.submissions[0]?.submittedAt);
        const next = open.filter((a) => a.dueAt.getTime() >= now - 7 * DAY).sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
        return {
          id: row.subjectId, name: row.subject.name, code: row.subject.code, core: row.subject.isCore, teacher: row.teacherId ? teachers.get(row.teacherId) ?? "" : "",
          periods: own.length || row.subject.periodsPerWeek || 0, labs: own.filter((slot) => /lab/i.test(slot.venue ?? "")).length,
          topic: topicOf.get(row.subjectId) ?? null, open: open.length, nextDue: next[0] ? isoDay(next[0].dueAt) : null, late: open.filter((a) => a.dueAt.getTime() < now).length,
          released: released.has(row.subjectId),
          parts: components.map((component) => ({ code: component.code, name: component.name, max: component.maxScore, score: released.has(row.subjectId) && opened(component.id) ? scoreOf.get(`${row.subjectId}|${component.id}`) ?? null : null, releaseOn: opened(component.id) ? null : isoDay(new Date(releaseOf.get(component.id)!)) }))
        };
      })
    };
  }

  /* ───────────────────────── assignments ───────────────────────── */

  async assignments(session: SessionPayload) {
    const { student } = await this.context(session);
    if (!student.currentClassId) return { items: [] };
    const rows = await prisma.assignment.findMany({
      where: { schoolId: session.schoolId, classId: student.currentClassId, status: "PUBLISHED" },
      include: { subject: true, teacher: { select: { id: true, firstName: true, lastName: true } }, submissions: { where: { studentId: student.id } } },
      orderBy: { dueAt: "asc" }
    });
    const now = Date.now();
    return {
      items: rows.map((row) => {
        const sub = row.submissions[0];
        const state = sub?.gradedAt ? "marked" : sub?.submittedAt ? "handed" : row.dueAt.getTime() < now ? "overdue" : "todo";
        return {
          id: row.id, title: row.title, description: row.description ?? "", subject: row.subject.name, subjectId: row.subjectId, teacher: fullName(row.teacher), teacherId: row.teacher.id,
          set: isoDay(row.createdAt), due: isoDay(row.dueAt), dueAt: row.dueAt.toISOString(), state, attachmentUrl: row.attachmentUrl ?? null, out: row.maxScore,
          handedAt: sub?.submittedAt?.toISOString() ?? null, late: sub?.submittedAt ? sub.submittedAt.getTime() > row.dueAt.getTime() : false,
          comment: sub?.comment ?? null, score: sub?.score ?? null, feedback: sub?.feedback ?? null, markedAt: sub?.gradedAt ? isoDay(sub.gradedAt) : null
        };
      })
    };
  }

  async handIn(session: SessionPayload, assignmentId: string, body: unknown) {
    if (!(await loadStudentPolicy(session.schoolId)).homework) throw new ForbiddenException("Your school takes homework on paper, so it is not handed in here.");
    const parsed = handInSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "That could not be handed in.");
    const { student } = await this.context(session);
    const assignment = await prisma.assignment.findFirst({ where: { id: assignmentId, schoolId: session.schoolId, classId: student.currentClassId ?? "-", status: "PUBLISHED" }, include: { subject: true } });
    if (!assignment) throw new NotFoundException("That piece of work was not set for your class.");
    const existing = await prisma.assignmentSubmission.findUnique({ where: { assignmentId_studentId: { assignmentId, studentId: student.id } } });
    if (existing?.gradedAt) throw new BadRequestException("It has been marked already, so it cannot be handed in again.");
    const now = new Date();
    const data = { submittedAt: now, comment: parsed.data.comment ?? null, fileUrl: parsed.data.fileUrl ?? null };
    await (existing
      ? prisma.assignmentSubmission.update({ where: { id: existing.id }, data })
      : prisma.assignmentSubmission.create({ data: { schoolId: session.schoolId, assignmentId, studentId: student.id, ...data } }));
    const late = now.getTime() > assignment.dueAt.getTime();
    await prisma.notificationLog.create({
      data: { schoolId: session.schoolId, userId: assignment.teacherId, channel: "IN_APP", title: `${student.firstName} ${student.lastName} handed in ${assignment.title}`, body: `${assignment.subject.name} · ${late ? "handed in late" : "on time"}.`, status: "SENT", sentAt: now, metadata: { kind: "ASSIGNMENT_HANDED_IN", assignmentId, studentId: student.id } }
    });
    return { handedAt: now.toISOString(), late };
  }

  /* ───────────────────────── attendance ───────────────────────── */

  async attendance(session: SessionPayload) {
    await this.allow(session, "Attendance");
    const { student, term } = await this.context(session);
    const [records, terms, closed] = await Promise.all([
      prisma.studentAttendance.findMany({ where: { schoolId: session.schoolId, studentId: student.id, subjectId: null }, include: { markedBy: { select: { firstName: true, lastName: true } }, classRoom: { select: { name: true, arm: true } } }, orderBy: { date: "asc" } }),
      prisma.term.findMany({ where: { schoolId: session.schoolId }, include: { academicSession: true }, orderBy: { startDate: "asc" } }),
      prisma.calendarEvent.findMany({ where: { schoolId: session.schoolId, schoolClosed: true }, select: { startsAt: true, endsAt: true, title: true } })
    ]);
    const classByTerm = new Map<string, string>();
    for (const record of records) classByTerm.set(record.termId, armName(record.classRoom.name, record.classRoom.arm));
    const heldTerms = terms.filter((row) => classByTerm.has(row.id) || row.id === term?.id);
    return {
      current: term?.id ?? null,
      terms: heldTerms.map((row) => ({ id: row.id, name: row.name, session: row.academicSession.name, start: isoDay(row.startDate), end: isoDay(row.endDate), arm: classByTerm.get(row.id) ?? armName(student.currentClass?.name, student.currentClass?.arm), days: row.schoolDays })),
      records: records.map((record) => ({
        date: isoDay(record.date), status: record.status, term: record.termId, reason: record.reason ?? null, code: record.reasonCode ?? null, by: fullName(record.markedBy), at: record.markedAt?.toISOString() ?? null
      })),
      closed: closed.map((row) => ({ from: isoDay(row.startsAt), to: isoDay(row.endsAt), title: row.title }))
    };
  }

  /* ───────────────────────── calendar ───────────────────────── */

  async calendar(session: SessionPayload) {
    const { student, term } = await this.context(session);
    const arm = armName(student.currentClass?.name, student.currentClass?.arm);
    const [events, exams, windows] = await Promise.all([
      prisma.calendarEvent.findMany({ where: { schoolId: session.schoolId, endsAt: { gte: new Date(Date.now() - 30 * DAY) } }, orderBy: { startsAt: "asc" }, take: 200 }),
      student.currentClassId ? prisma.examTimetableEntry.findMany({ where: { schoolId: session.schoolId, classId: student.currentClassId }, include: { subject: true }, orderBy: { examDate: "asc" } }) : Promise.resolve([]),
      term ? prisma.assessmentWindow.findMany({ where: { schoolId: session.schoolId, termId: term.id }, include: { component: true } }) : Promise.resolve([])
    ]);
    const mine = events.filter((event) => {
      // The school's own "visible to" list is the answer when it has one; the words of the audience only when it does not.
      return event.visibleTo.length ? event.visibleTo.includes("Students") : isForStudents(event.audience, arm);
    });
    const cat = (type: string) => (/exam/i.test(type) ? "Assessment" : /holiday|closure/i.test(type) ? "Holiday" : "Event");
    return {
      events: [
        ...mine.map((event) => ({ id: event.id, date: isoDay(event.startsAt), end: isoDay(event.endsAt), title: event.title, cat: event.schoolClosed ? "Holiday" : cat(event.type), time: event.allDay ? "All day" : [event.startTime, event.endTime].filter(Boolean).join(" – "), where: event.location ?? "", note: event.description ?? "" })),
        ...exams.map((exam) => ({ id: `x-${exam.id}`, date: isoDay(exam.examDate), end: isoDay(exam.examDate), title: `${exam.subject.name} examination`, cat: "Assessment", time: `${exam.startsAt} – ${exam.endsAt}`, where: exam.venue ?? "", note: "" })),
        ...windows.filter((window) => window.releaseAt).map((window) => ({ id: `r-${window.id}`, date: isoDay(window.releaseAt!), end: isoDay(window.releaseAt!), title: `${window.component.name} results released`, cat: "Results", time: "", where: "", note: "" }))
      ].sort((a, b) => a.date.localeCompare(b.date))
    };
  }

  /* ───────────────────────── sign-in and security ───────────────────────── */

  /** How this account is protected, and the last times someone signed in — so a student can spot a sign-in that was not them. */
  async security(session: SessionPayload) {
    this.assert(session);
    const user = await prisma.user.findFirst({ where: { id: session.userId, schoolId: session.schoolId, deletedAt: null }, select: { mfaEnabled: true, mfaEnrolledAt: true, passwordChangedAt: true, passwordResetRequired: true, createdAt: true } });
    if (!user) throw new NotFoundException("No account found.");
    const attempts = await prisma.loginAttempt.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "desc" }, take: 12 });
    return {
      mustChangePassword: user.passwordResetRequired, mfaEnabled: user.mfaEnabled, mfaEnrolledAt: user.mfaEnrolledAt?.toISOString() ?? null, passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null, createdAt: user.createdAt.toISOString(),
      signIns: attempts.map((attempt) => ({ id: attempt.id, at: attempt.createdAt.toISOString(), success: attempt.success, device: deviceName(attempt.device), where: attempt.location || hide(attempt.ipAddress), newDevice: attempt.newDevice, reason: attempt.success ? null : attempt.reason }))
    };
  }

  /**
   * The devices this account is signed in on, and how to sign one out.
   *
   * Every sign-in already records a session — who, from where, on what — and
   * the session guard already refuses a token whose session has been revoked.
   * So a student can be shown the list and be given the one control that
   * matters: signing out of a device they do not recognise.
   */
  async sessions(session: SessionPayload, currentTokenHash: string | undefined) {
    this.assert(session);
    const rows = await prisma.platformSession.findMany({
      where: { userId: session.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastActivityAt: "desc" },
      take: 10,
    });
    return rows.map((row) => ({
      id: row.id,
      device: deviceName(row.device),
      where: hide(row.ipAddress),
      lastActiveAt: row.lastActivityAt.toISOString(),
      startedAt: row.createdAt.toISOString(),
      current: Boolean(currentTokenHash) && row.tokenHash === currentTokenHash,
    }));
  }

  /** Sign a device out. The one you are reading this on is refused — use Sign out for that. */
  async revokeSession(session: SessionPayload, id: string, currentTokenHash: string | undefined) {
    this.assert(session);
    const row = await prisma.platformSession.findFirst({ where: { id, userId: session.userId } });
    if (!row) throw new NotFoundException("That device is not signed in.");
    if (currentTokenHash && row.tokenHash === currentTokenHash) {
      throw new BadRequestException("This is the device you are using. Use Sign out at the top of the page to leave it.");
    }
    if (row.revokedAt) return { device: deviceName(row.device), alreadyOut: true };
    await prisma.platformSession.update({ where: { id }, data: { revokedAt: new Date() } });
    return { device: deviceName(row.device), alreadyOut: false };
  }

  /* ───────────────────────── the calendar feed ───────────────────────── */

  /** The student's private feed address, made the first time it is asked for. `reset` replaces it, so a link that got out stops working. */
  async calendarLink(session: SessionPayload, reset = false) {
    if (!(await loadStudentPolicy(session.schoolId)).calendarLink) throw new ForbiddenException("Your school has not switched phone calendar links on for students.");
    this.assert(session);
    const prefs = await this.readPrefs(session);
    const token = !prefs.feedToken || reset ? randomBytes(24).toString("hex") : prefs.feedToken;
    if (token !== prefs.feedToken) await this.writePrefs(session, { ...prefs, feedToken: token });
    return { path: `/api/v1/student-calendar/${token}.ics` };
  }

  /** The feed itself, read by a phone's calendar with no sign-in: school events, the student's tests and examinations, and the dates their work is due. */
  async feed(token: string): Promise<string> {
    if (!/^[a-f0-9]{48}$/.test(token)) throw new NotFoundException("That calendar link is not one we issued.");
    const row = await prisma.configurationItem.findFirst({ where: { resource: PREFS_RESOURCE, deletedAt: null, data: { path: ["feedToken"], equals: token } } });
    if (!row) throw new NotFoundException("That calendar link is not one we issued.");
    if ((await switchedOffModules(row.schoolId)).some((module) => module.slug === "student-portal")) throw new NotFoundException("That calendar link is not one we issued.");
    if (!(await loadStudentPolicy(row.schoolId)).calendarLink) throw new NotFoundException("That calendar link is not one we issued.");
    const session = { userId: row.name, schoolId: row.schoolId, role: "STUDENT" } as unknown as SessionPayload;
    const [{ events }, { items }, me] = await Promise.all([this.calendar(session), this.assignments(session), this.me(session)]);
    const entries = [
      ...events.map((event) => ({ id: event.id, date: event.date, end: event.end, title: event.title, time: event.time, where: event.where, note: event.note })),
      ...items.filter((work) => work.state === "todo" || work.state === "overdue").map((work) => ({ id: `due-${work.id}`, date: work.due, end: work.due, title: `${work.subject} due · ${work.title}`, time: "", where: "", note: work.description })),
    ];
    return icsFor(`${me.name} · ${me.school}`, entries);
  }

  /* ───────────────────────── messages ───────────────────────── */

  async messages(session: SessionPayload) {
    const { student, formMaster } = await this.context(session);
    const arm = armName(student.currentClass?.name, student.currentClass?.arm);
    const seesNotices = (await loadStudentPolicy(session.schoolId)).sees.has("Announcements");
    const [received, sent, noticeRows, prefs] = await Promise.all([
      prisma.internalMessage.findMany({ where: { schoolId: session.schoolId, recipientId: session.userId }, include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } }, orderBy: { createdAt: "desc" }, take: 80 }),
      prisma.internalMessage.findMany({ where: { schoolId: session.schoolId, senderId: session.userId }, include: { recipient: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, take: 80 }),
      prisma.announcement.findMany({ where: { schoolId: session.schoolId, publishedAt: { lte: new Date() }, OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] }, orderBy: { publishedAt: "desc" }, take: 40 }),
      this.readPrefs(session)
    ]);
    const notices = seesNotices ? noticeRows : [];
    const readNotices = new Set(prefs.readAnnouncements ?? []);
    const audience = (value: string) => isForStudents(value, arm);
    return {
      formMaster: formMaster ? { id: formMaster.id, name: fullName(formMaster) } : null,
      items: [
        ...received.map((message) => ({ id: message.id, cat: "From teachers", from: fullName(message.sender), fromId: message.sender.id, role: String(message.sender.role).replace(/_/g, " ").toLowerCase(), title: message.subject, body: message.body.split(/\n{2,}/), at: message.createdAt.toISOString(), read: Boolean(message.readAt), to: "" })),
        ...notices.filter((notice) => audience(notice.audience)).map((notice) => ({ id: `a-${notice.id}`, cat: "School", from: "The school office", fromId: "", role: "", title: notice.title, body: notice.body.split(/\n{2,}/), at: notice.publishedAt.toISOString(), read: readNotices.has(notice.id), to: "" })),
        ...sent.map((message) => ({ id: message.id, cat: "Sent", from: "You", fromId: "", role: "", title: message.subject, body: message.body.split(/\n{2,}/), at: message.createdAt.toISOString(), read: true, to: fullName(message.recipient) }))
      ].sort((a, b) => b.at.localeCompare(a.at))
    };
  }

  async markRead(session: SessionPayload, id: string) {
    this.assert(session);
    if (id.startsWith("a-")) {
      const prefs = await this.readPrefs(session);
      const next = [...new Set([...(prefs.readAnnouncements ?? []), id.slice(2)])].slice(-500);
      await this.writePrefs(session, { ...prefs, readAnnouncements: next });
      return { read: true };
    }
    await prisma.internalMessage.updateMany({ where: { id, schoolId: session.schoolId, recipientId: session.userId, readAt: null }, data: { readAt: new Date() } });
    return { read: true };
  }

  async markAllRead(session: SessionPayload) {
    this.assert(session);
    await prisma.internalMessage.updateMany({ where: { schoolId: session.schoolId, recipientId: session.userId, readAt: null }, data: { readAt: new Date() } });
    const notices = await prisma.announcement.findMany({ where: { schoolId: session.schoolId, publishedAt: { lte: new Date() } }, select: { id: true }, orderBy: { publishedAt: "desc" }, take: 200 });
    const prefs = await this.readPrefs(session);
    await this.writePrefs(session, { ...prefs, readAnnouncements: [...new Set([...(prefs.readAnnouncements ?? []), ...notices.map((notice) => notice.id)])].slice(-500) });
    return { read: true };
  }

  /** A question to a teacher or the form master. It is an in-app message the person answers from their own Messages. */
  async ask(session: SessionPayload, body: unknown) {
    if (!(await loadStudentPolicy(session.schoolId)).questions) throw new ForbiddenException("Your school does not take students’ questions on the portal. Ask in person.");
    const parsed = askSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "That could not be sent.");
    const { student, formMaster } = await this.context(session);
    const target = parsed.data.to ?? formMaster?.id;
    if (!target) throw new BadRequestException("Choose who to ask.");
    // A student may ask their own teachers and their form master — not anyone who happens to be at the school.
    const allowed = await this.askable(session);
    if (!allowed.people.some((person) => person.id === target)) throw new ForbiddenException("You can ask your form master and the teachers of your own subjects.");
    const recipient = await prisma.user.findFirst({ where: { id: target, schoolId: session.schoolId, isActive: true }, select: { id: true, firstName: true, lastName: true } });
    if (!recipient) throw new NotFoundException("That person is not at your school.");
    const message = await prisma.internalMessage.create({ data: { schoolId: session.schoolId, senderId: session.userId, recipientId: recipient.id, subject: parsed.data.topic, body: parsed.data.text } });
    await prisma.notificationLog.create({
      data: { schoolId: session.schoolId, userId: recipient.id, channel: "IN_APP", title: `${student.firstName} ${student.lastName} asked: ${parsed.data.topic}`, body: parsed.data.text.slice(0, 240), status: "SENT", sentAt: new Date(), metadata: { kind: "STUDENT_QUESTION", messageId: message.id } }
    });
    return { id: message.id, to: fullName(recipient) };
  }

  /** The people a student may ask: the teachers of their own subjects, and their form master. */
  async askable(session: SessionPayload) {
    if (!(await loadStudentPolicy(session.schoolId)).questions) return { formMasterReads: false, people: [] as Array<{ id: string; name: string; role: string }> };
    const { student, formMaster } = await this.context(session);
    const rows = student.currentClassId ? await prisma.classSubject.findMany({ where: { schoolId: session.schoolId, classId: student.currentClassId, isActive: true, teacherId: { not: null } }, include: { subject: { select: { name: true } } } }) : [];
    const ids = [...new Set(rows.map((row) => row.teacherId).filter(Boolean))] as string[];
    const people = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } }) : [];
    const subjectsOf = (id: string) => rows.filter((row) => row.teacherId === id).map((row) => row.subject.name).join(", ");
    const readers = (await loadStudentPolicy(session.schoolId)).formMasterReads;
    return {
      formMasterReads: readers,
      people: [
        ...(formMaster ? [{ id: formMaster.id, name: fullName(formMaster), role: "Form master" }] : []),
        ...people.filter((person) => person.id !== formMaster?.id).map((person) => ({ id: person.id, name: fullName(person), role: subjectsOf(person.id) }))
      ]
    };
  }

  /* ───────────────────────── preferences ───────────────────────── */

  private async readPrefs(session: SessionPayload): Promise<z.infer<typeof prefsSchema>> {
    const row = await prisma.configurationItem.findFirst({ where: { schoolId: session.schoolId, resource: PREFS_RESOURCE, name: session.userId, deletedAt: null } });
    const parsed = prefsSchema.safeParse(row?.data ?? {});
    return parsed.success ? parsed.data : {};
  }

  private async writePrefs(session: SessionPayload, data: z.infer<typeof prefsSchema>) {
    const existing = await prisma.configurationItem.findFirst({ where: { schoolId: session.schoolId, resource: PREFS_RESOURCE, name: session.userId } });
    if (existing) await prisma.configurationItem.update({ where: { id: existing.id }, data: { data, deletedAt: null } });
    else await prisma.configurationItem.create({ data: { schoolId: session.schoolId, resource: PREFS_RESOURCE, name: session.userId, data } });
  }

  async prefs(session: SessionPayload) {
    this.assert(session);
    const prefs = await this.readPrefs(session);
    return { matrix: prefs.matrix ?? {}, quiet: prefs.quiet ?? (await loadStudentPolicy(session.schoolId)).quietHours, remind: prefs.remind ?? "The day before" };
  }

  async savePrefs(session: SessionPayload, body: unknown) {
    this.assert(session);
    const parsed = prefsSchema.pick({ matrix: true, quiet: true, remind: true }).safeParse(body);
    if (!parsed.success) throw new BadRequestException("Those choices could not be saved.");
    const current = await this.readPrefs(session);
    await this.writePrefs(session, { ...current, ...parsed.data, matrix: { ...(current.matrix ?? {}), ...(parsed.data.matrix ?? {}) } });
    return this.prefs(session);
  }

  /* ───────────────────────── results (what the school has published, with the arm it was in) ───────────────────────── */

  async cards(session: SessionPayload) {
    await this.allow(session, "Results");
    const { student } = await this.context(session);
    const sheets = await prisma.resultSheet.findMany({
      where: { schoolId: session.schoolId, studentId: student.id, status: "PUBLISHED", publishedAt: { not: null } },
      include: { term: { include: { academicSession: true } }, classRoom: { select: { name: true, arm: true } }, scoreEntries: { where: { isDraft: false }, include: { subject: true, assessmentComponent: true } } },
      orderBy: { publishedAt: "desc" }
    });
    const sizes = await Promise.all(sheets.map((sheet) => prisma.resultSheet.count({ where: { schoolId: session.schoolId, classId: sheet.classId, termId: sheet.termId, status: "PUBLISHED" } })));
    const attendance = await Promise.all(sheets.map((sheet) => prisma.studentAttendance.groupBy({ by: ["status"], where: { schoolId: session.schoolId, studentId: student.id, termId: sheet.termId, subjectId: null }, _count: { _all: true } })));
    /* each subject's total for every child in the same class and term, so a position and a class average can be read honestly */
    const peers = await Promise.all(sheets.map((sheet) => prisma.scoreEntry.groupBy({
      by: ["studentId", "subjectId"], where: { schoolId: session.schoolId, isDraft: false, resultSheet: { classId: sheet.classId, termId: sheet.termId, status: "PUBLISHED" } }, _sum: { score: true }
    })));
    return {
      cards: sheets.map((sheet, index) => {
        const bySubject = new Map<string, { id: string; name: string; parts: Array<{ code: string; name: string; max: number; score: number }> }>();
        for (const entry of sheet.scoreEntries) {
          const slot = bySubject.get(entry.subjectId) ?? { id: entry.subjectId, name: entry.subject.name, parts: [] };
          slot.parts.push({ code: entry.assessmentComponent.code, name: entry.assessmentComponent.name, max: entry.maxScore, score: entry.score });
          bySubject.set(entry.subjectId, slot);
        }
        const days = attendance[index]!.reduce((sum, row) => sum + row._count._all, 0);
        const present = attendance[index]!.filter((row) => row.status === "PRESENT" || row.status === "LATE").reduce((sum, row) => sum + row._count._all, 0);
        return {
          id: sheet.id, term: sheet.term.name, session: sheet.term.academicSession.name, arm: armName(sheet.classRoom.name, sheet.classRoom.arm), average: Number(sheet.averageScore), grade: sheet.grade ?? "", position: sheet.position ?? null, size: sizes[index] ?? 0,
          published: sheet.publishedAt!.toISOString().slice(0, 10), teacherComment: sheet.teacherComment ?? "", principalComment: sheet.principalComment ?? "", attendance: { present, days },
          subjects: [...bySubject.values()].map((subject) => {
            const total = subject.parts.reduce((sum, part) => sum + part.score, 0);
            const field = peers[index]!.filter((row) => row.subjectId === subject.id).map((row) => row._sum.score ?? 0);
            return {
              ...subject, total, grade: resolveGradeLabel(total).label, position: field.length ? 1 + field.filter((value) => value > total).length : null, of: field.length,
              classAverage: field.length ? Math.round((field.reduce((sum, value) => sum + value, 0) / field.length) * 10) / 10 : null
            };
          })
        };
      })
    };
  }
}
