import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { notifyGuardian } from "../guardian-management/guardians.shared";
import { type Tally, add, armName, currentTerm, dayOf, emptyTally, fullName, iso, loadPolicy, longDay, notifyStaff, rate, today, weekStart } from "./attendance.shared";

/**
 * What leaves Attendance: an official extract (a "spool"), the record sent to a family, and a
 * notification to staff. Each is logged under the person's name; none of them changes a mark.
 */

const list = (value: string | string[] | undefined) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const spoolSchema = z.object({
  for: z.string().default("A class arm"),
  arm: z.union([z.string(), z.array(z.string())]).optional(),
  student: z.union([z.string(), z.array(z.string())]).optional(),
  teacher: z.union([z.string(), z.array(z.string())]).optional(),
  period: z.string().default("This term"),
  from: z.string().optional(),
  to: z.string().optional(),
  include: z.union([z.string(), z.array(z.string())]).optional(),
  format: z.string().default("PDF · for printing and filing"),
  purpose: z.string().default("School records"),
  letterhead: z.coerce.boolean().default(true)
});

const sendSchema = z.object({
  students: z.union([z.string(), z.array(z.string())]).transform(list),
  period: z.string().default("This term"),
  detail: z.string().default("Summary only · one line per period"),
  channels: z.union([z.string(), z.array(z.string())]).transform(list),
  language: z.string().default("Match each guardian’s own preference"),
  who: z.string().default("Every guardian on the record"),
  note: z.string().trim().optional(),
  letterhead: z.coerce.boolean().default(true)
});

const notifySchema = z.object({
  users: z.union([z.string(), z.array(z.string())]).optional().transform(list),
  /** Arms whose form masters are the people to tell. */
  arms: z.union([z.string(), z.array(z.string())]).optional().transform(list),
  channels: z.union([z.string(), z.array(z.string())]).transform(list).default([]),
  urgency: z.string().default("Reminder"),
  due: z.string().optional(),
  copy: z.union([z.string(), z.array(z.string())]).optional().transform(list),
  message: z.string().trim().min(8, "Write the message that will be sent."),
  link: z.coerce.boolean().default(true),
  kicker: z.string().default("Attendance"),
  href: z.string().optional()
});

export type Section = { title: string; head: string[]; rows: string[][] };

@Injectable()
export class OutputsService {
  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType, entityId, metadata } });
  }

  /** Turns a period the way a person says it into the dates it means. */
  private async window(schoolId: string, period: string, from?: string, to?: string) {
    const term = await currentTerm(schoolId);
    if (!term) throw new BadRequestException("No term is current.");
    const now = today();
    const name = period.toLowerCase();
    if (name.startsWith("a date range")) {
      if (!from || !to) throw new BadRequestException("Give both dates for a range.");
      return { from: dayOf(from), to: dayOf(to), label: `${longDay(dayOf(from))} to ${longDay(dayOf(to))}` };
    }
    if (name.startsWith("this week")) return { from: weekStart(now), to: now, label: "This week" };
    if (name.startsWith("this month")) return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), to: now, label: "This month" };
    if (name.startsWith("last term")) {
      const previous = await prisma.term.findFirst({ where: { schoolId, startDate: { lt: term.startDate } }, orderBy: { startDate: "desc" } });
      if (!previous) throw new BadRequestException("There is no earlier term on record.");
      return { from: dayOf(previous.startDate), to: dayOf(previous.endDate), label: previous.name };
    }
    if (name.startsWith("the whole session") || name.startsWith("every term")) {
      const terms = await prisma.term.findMany({ where: { schoolId, academicSessionId: term.academicSessionId }, orderBy: { startDate: "asc" } });
      return { from: dayOf(terms[0].startDate), to: dayOf(terms[terms.length - 1].endDate), label: `${term.academicSession?.name ?? "The session"}` };
    }
    return { from: dayOf(term.startDate), to: dayOf(term.endDate), label: term.name };
  }

  /* ───────────────────────── the extract ───────────────────────── */

  async spool(session: SessionPayload, query: Record<string, string | string[] | undefined>, log = false) {
    const input = spoolSchema.parse(query);
    const schoolId = session.schoolId;
    const scope = input.for.toLowerCase();
    const window = await this.window(schoolId, input.period, input.from, input.to);
    const include = list(input.include);
    const policy = await loadPolicy(schoolId);

    let where: Prisma.StudentAttendanceWhereInput = { schoolId, subjectId: null, date: { gte: window.from, lte: window.to } };
    let subject = "The whole school";
    if (scope.includes("arm")) {
      const armId = one(input.arm);
      const room = armId ? await prisma.classRoom.findFirst({ where: { id: armId, schoolId } }) : null;
      if (!room) throw new BadRequestException("Choose the arm to spool.");
      where = { ...where, classId: room.id };
      subject = armName(room);
    } else if (scope.includes("student")) {
      const studentId = one(input.student);
      const student = studentId ? await prisma.student.findFirst({ where: { id: studentId, schoolId } }) : null;
      if (!student) throw new BadRequestException("Choose the child to spool.");
      where = { ...where, studentId: student.id };
      subject = fullName(student);
    } else if (scope.includes("teacher")) {
      const teacherId = one(input.teacher);
      const teacher = teacherId ? await prisma.user.findFirst({ where: { id: teacherId, schoolId } }) : null;
      if (!teacher) throw new BadRequestException("Choose the teacher to spool.");
      const rooms = await prisma.classRoom.findMany({ where: { schoolId, classTeacherId: teacher.id }, select: { id: true } });
      where = { ...where, classId: { in: rooms.map((room) => room.id) } };
      subject = `${fullName(teacher)}'s arms`;
    }
    if (!include.length) throw new BadRequestException("Choose what the extract should include.");

    const rows = await prisma.studentAttendance.findMany({
      where, orderBy: [{ classId: "asc" }, { date: "asc" }], take: 20000,
      select: { studentId: true, classId: true, date: true, status: true, reason: true, reasonCode: true, student: { select: { firstName: true, lastName: true, admissionNumber: true } }, classRoom: { select: { name: true, arm: true } } }
    });
    const sections: Section[] = [];
    if (include.includes("Daily marks")) {
      sections.push({ title: "Daily marks", head: ["Arm", "Student", "Admission no", "Date", "Mark"], rows: rows.map((row) => [armName(row.classRoom), fullName(row.student), row.student.admissionNumber, iso(dayOf(row.date)), row.status.charAt(0) + row.status.slice(1).toLowerCase()]) });
    }
    if (include.includes("Weekly summary")) {
      const weeks = new Map<string, { arm: string; week: string; tally: Tally }>();
      for (const row of rows) {
        const key = `${row.classId}|${iso(weekStart(dayOf(row.date)))}`;
        const entry = weeks.get(key) ?? { arm: armName(row.classRoom), week: iso(weekStart(dayOf(row.date))), tally: emptyTally() };
        add(entry.tally, row.status);
        weeks.set(key, entry);
      }
      sections.push({ title: "Weekly summary", head: ["Arm", "Week beginning", "Present", "Late", "Absent", "Excused", "Attendance"], rows: Array.from(weeks.values()).sort((a, b) => a.arm.localeCompare(b.arm) || a.week.localeCompare(b.week)).map((entry) => [entry.arm, entry.week, String(entry.tally.present), String(entry.tally.late), String(entry.tally.absent), String(entry.tally.excused), `${rate(entry.tally, policy.lateCounts) ?? "—"}${rate(entry.tally, policy.lateCounts) === null ? "" : "%"}`]) });
    }
    if (include.includes("Reasons and explanations")) {
      sections.push({ title: "Reasons and explanations", head: ["Arm", "Student", "Date", "Mark", "Reason"], rows: rows.filter((row) => row.status !== "PRESENT" && (row.reason || row.reasonCode)).map((row) => [armName(row.classRoom), fullName(row.student), iso(dayOf(row.date)), row.status.charAt(0) + row.status.slice(1).toLowerCase(), row.reason ?? row.reasonCode ?? ""]) });
    }
    const studentIds = Array.from(new Set(rows.map((row) => row.studentId)));
    if (include.includes("Corrections and backdating")) {
      const corrections = await prisma.attendanceCorrection.findMany({ where: { schoolId, date: { gte: window.from, lte: window.to }, ...(scope.includes("school") ? {} : { studentId: { in: studentIds } }) }, orderBy: { date: "asc" }, take: 5000 });
      const names = new Map((await prisma.student.findMany({ where: { id: { in: Array.from(new Set(corrections.map((entry) => entry.studentId))) } }, select: { id: true, firstName: true, lastName: true } })).map((student) => [student.id, fullName(student)]));
      sections.push({ title: "Corrections and backdating", head: ["Student", "Date", "From", "To", "Kind", "State", "Reason"], rows: corrections.map((entry) => [names.get(entry.studentId) ?? "—", iso(dayOf(entry.date)), entry.fromStatus, entry.toStatus, entry.kind, entry.status, `${entry.reasonCode} · ${entry.explanation}`]) });
    }
    if (include.includes("Guardian contact history")) {
      const links = await prisma.studentGuardian.findMany({ where: { studentId: { in: studentIds } }, select: { studentId: true, guardianId: true } });
      const contacts = await prisma.guardianContact.findMany({ where: { schoolId, kind: { startsWith: "Attendance" }, guardianId: { in: links.map((link) => link.guardianId) }, createdAt: { gte: window.from } }, orderBy: { createdAt: "asc" }, take: 5000 });
      const owner = new Map(links.map((link) => [link.guardianId, link.studentId]));
      const names = new Map((await prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, firstName: true, lastName: true } })).map((student) => [student.id, fullName(student)]));
      sections.push({ title: "Guardian contact history", head: ["Student", "Date", "Channel", "What was sent"], rows: contacts.map((entry) => [names.get(owner.get(entry.guardianId) ?? "") ?? "—", iso(entry.createdAt), entry.channel ?? "—", entry.summary]) });
    }

    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } });
    const by = await prisma.user.findUnique({ where: { id: session.userId }, select: { firstName: true, lastName: true } });
    const meta = {
      title: `Attendance record · ${subject}`, subject, period: window.label, from: iso(window.from), to: iso(window.to), purpose: input.purpose, letterhead: input.letterhead,
      school: school?.name ?? "", generatedAt: new Date().toISOString(), by: by ? fullName(by) : "", marks: rows.length, children: studentIds.length, format: input.format
    };
    if (log) {
      await this.audit(session, AuditAction.EXPORT, "AttendanceSpool", subject, { summary: `Attendance record spooled · ${subject} · ${window.label} · ${input.purpose}`, include, marks: rows.length, format: input.format });
    }
    return { meta, sections };
  }

  /** Records the spool and says where the extract can be fetched; the extract itself is read from the same rules. */
  async spoolRecord(session: SessionPayload, body: Record<string, unknown>) {
    const result = await this.spool(session, body as Record<string, string | string[] | undefined>, true);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      if (value === undefined || value === null || value === "") continue;
      for (const item of Array.isArray(value) ? value : [value]) params.append(key, String(item));
    }
    const print = /print|pdf/i.test(String(body.format ?? ""));
    return { href: `/attendance/spool?${params.toString()}`, hrefLabel: print ? "Open the printable record" : "Download the record", print, marks: result.meta.marks, children: result.meta.children, subject: result.meta.subject };
  }

  /* ───────────────────────── to families ───────────────────────── */

  async send(session: SessionPayload, body: unknown) {
    const input = sendSchema.parse(body);
    const schoolId = session.schoolId;
    if (!input.students.length) throw new BadRequestException("Choose at least one child.");
    if (!input.channels.length) throw new BadRequestException("Choose how it should reach them.");
    const window = await this.window(schoolId, input.period);
    const policy = await loadPolicy(schoolId);
    const students = await prisma.student.findMany({
      where: { schoolId, id: { in: input.students } },
      select: { id: true, firstName: true, lastName: true, currentClass: { select: { name: true, arm: true } }, guardians: { select: { isPrimary: true, guardianId: true, guardian: { select: { firstName: true, lastName: true } } } } }
    });
    if (!students.length) throw new NotFoundException("Those children are not in this school.");

    const marks = await prisma.studentAttendance.findMany({ where: { schoolId, subjectId: null, studentId: { in: students.map((student) => student.id) }, date: { gte: window.from, lte: window.to } }, orderBy: { date: "asc" }, select: { studentId: true, status: true, date: true, reason: true } });
    const channels = input.channels.flatMap((channel) => (/app/i.test(channel) ? ["In-app"] : /email/i.test(channel) ? ["Email"] : /sms|whatsapp/i.test(channel) ? ["SMS"] : []));
    const whatsapp = input.channels.some((channel) => /whatsapp/i.test(channel));
    const printed = input.channels.some((channel) => /printed/i.test(channel));
    const channelSet = Array.from(new Set(["In-app", ...channels]));

    let families = 0;
    const reached = new Set<string>();
    const unreached: string[] = [];
    for (const student of students) {
      const tally = emptyTally();
      const mine = marks.filter((mark) => mark.studentId === student.id);
      for (const mark of mine) add(tally, mark.status);
      const value = rate(tally, policy.lateCounts);
      const lines = [`Attendance for ${fullName(student)}${student.currentClass ? ` (${armName(student.currentClass)})` : ""} · ${window.label}: ${value === null ? "no register on record" : `${value}%`} — ${tally.present} present, ${tally.late} late, ${tally.absent} absent, ${tally.excused} excused.`];
      if (/day-by-day/i.test(input.detail)) lines.push(mine.filter((mark) => mark.status !== "PRESENT").map((mark) => `${iso(dayOf(mark.date))} ${mark.status.toLowerCase()}`).join("; ") || "No absences or lates in this period.");
      if (/reasons/i.test(input.detail)) lines.push(mine.filter((mark) => mark.status === "EXCUSED" && mark.reason).map((mark) => `${iso(dayOf(mark.date))}: ${mark.reason}`).join("; "));
      if (input.note) lines.push(input.note);
      const text = lines.filter(Boolean).join(" ");
      const links = input.who.startsWith("The primary") ? student.guardians.filter((link) => link.isPrimary).slice(0, 1) : student.guardians;
      if (!student.guardians.length) unreached.push(`${fullName(student)} · no guardian on record`);
      for (const link of links.length ? links : student.guardians.slice(0, 1)) {
        const result = await notifyGuardian(schoolId, link.guardianId, `Attendance record · ${fullName(student)}`, text, channelSet);
        await prisma.guardianContact.create({ data: { schoolId, guardianId: link.guardianId, kind: "Attendance record", channel: result.sent.join(", ") || null, summary: `${window.label} · ${value === null ? "no record" : `${value}%`} · ${input.detail.split(" · ")[0]}`, createdById: session.userId, detail: { period: window.label, language: input.language, letterhead: input.letterhead, printed, whatsappRequested: whatsapp } as Prisma.InputJsonValue } });
        families += 1;
        if (result.sent.length) reached.add(link.guardianId);
        else unreached.push(`${fullName(student)} · ${fullName(link.guardian)}`);
      }
    }
    await this.audit(session, AuditAction.UPDATE, "AttendanceRecordSent", students[0].id, { summary: `Attendance record sent to ${families} ${families === 1 ? "guardian" : "guardians"} · ${window.label}`, channels: channelSet });
    return {
      children: students.length, guardians: families, reached: reached.size, unreached, whatsapp, printed,
      fields: [
        ["Children", String(students.length)],
        ["Guardians written to", `${reached.size} of ${families}`],
        ...(unreached.length ? [["Not reached", unreached.slice(0, 4).join("; ")]] : []),
        ...(whatsapp ? [["WhatsApp", "Not connected — nothing was sent on it"]] : []),
        ...(printed ? [["Printed copy", "Recorded; print it from the extract"]] : [])
      ],
      note: "Messages are queued on each channel the family can be reached by. Nothing is delivered from this system until a provider is connected."
    };
  }

  /* ───────────────────────── to staff ───────────────────────── */

  async notify(session: SessionPayload, body: unknown) {
    const input = notifySchema.parse(body);
    if (input.arms.length) {
      const rooms = await prisma.classRoom.findMany({ where: { schoolId: session.schoolId, id: { in: input.arms } }, select: { classTeacherId: true } });
      input.users = Array.from(new Set([...input.users, ...rooms.flatMap((room) => (room.classTeacherId ? [room.classTeacherId] : []))]));
    }
    if (!input.users.length) throw new BadRequestException("Choose who to notify — none of those arms has a form master.");
    const channels = input.channels.length ? input.channels : ["In-app inbox"];
    const copyTo = input.copy.length
      ? await prisma.user.findMany({
          where: { schoolId: session.schoolId, isActive: true, deletedAt: null, role: { in: input.copy.flatMap((entry) => (/head of department/i.test(entry) ? ["HEAD_OF_DEPARTMENT"] : /principal/i.test(entry) ? ["PRINCIPAL"] : /exam/i.test(entry) ? ["EXAM_OFFICER", "EXAMINATION_OFFICER"] : [])) as never[] } },
          select: { id: true }
        })
      : [];
    const recipients = Array.from(new Set([...input.users, ...copyTo.map((user) => user.id)]));
    const result = await notifyStaff(session.schoolId, session.userId, recipients, {
      title: `${input.kicker} · ${input.urgency.split(" · ")[0].toLowerCase()}`, body: `${input.message}${input.due ? ` (Please do it by ${input.due.toLowerCase()}.)` : ""}`,
      channels, urgency: input.urgency, link: input.link ? input.href : undefined, copy: input.copy
    });
    await this.audit(session, AuditAction.CREATE, "StaffNotification", input.users[0], { summary: `${input.kicker} notification sent to ${result.notified} ${result.notified === 1 ? "person" : "people"}`, urgency: input.urgency, channels });
    return result;
  }

}
