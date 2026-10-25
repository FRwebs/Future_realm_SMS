import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { formatNigeriaClassName } from "../../../../src/lib/school-options";
import { notifyStudents } from "../student-portal/student-notify";

/**
 * Homework, from the teacher's side: set it for an arm they teach, see what has been handed in, and mark it with a word back.
 * Homework is practice — it is never part of a CA — so a mark here is out of 100 and goes to the student, nobody else.
 */

const arm = (name?: string | null, a?: string | null) => (name ? formatNigeriaClassName(a ? `${name} - ${a}` : name) : "");
const setSchema = z.object({
  to: z.string().min(1, "Choose the arm and subject."),
  title: z.string().trim().min(1, "Give it a title.").max(160),
  description: z.string().trim().max(4000).optional(),
  dueAt: z.string().min(8, "Choose the day it is due."),
  /** What a full mark is. Left out, homework is out of 100. */
  max: z.coerce.number().min(1, "A full mark must be at least 1.").max(1000, "A full mark cannot be more than 1000.").optional()
});
const markSchema = z.object({ score: z.coerce.number().min(0, "A mark cannot be below 0."), feedback: z.string().trim().max(2000).optional() });

@Injectable()
export class TeacherStudentWorkService {
  private assertStaff(session: SessionPayload) {
    if (session.role === "STUDENT" || session.role === "PARENT") throw new ForbiddenException("Homework is set and marked by teachers.");
  }

  /** The arm-and-subject pairs this person is named on. */
  private async mine(session: SessionPayload) {
    const rows = await prisma.classSubject.findMany({
      where: { schoolId: session.schoolId, teacherId: session.userId, isActive: true, subject: { deletedAt: null } },
      include: { subject: { select: { name: true } }, classRoom: { select: { name: true, arm: true } } }, orderBy: [{ classRoom: { name: "asc" } }, { subject: { name: "asc" } }]
    });
    return rows.map((row) => ({ classId: row.classId, subjectId: row.subjectId, label: `${row.subject.name} · ${arm(row.classRoom.name, row.classRoom.arm)}` }));
  }

  async overview(session: SessionPayload) {
    this.assertStaff(session);
    const [options, set, waiting] = await Promise.all([
      this.mine(session),
      prisma.assignment.findMany({
        where: { schoolId: session.schoolId, teacherId: session.userId },
        include: { subject: { select: { name: true } }, classRoom: { select: { id: true, name: true, arm: true, _count: { select: { students: true } } } }, submissions: { select: { submittedAt: true, gradedAt: true } } },
        orderBy: { dueAt: "desc" }, take: 80
      }),
      prisma.assignmentSubmission.findMany({
        where: { schoolId: session.schoolId, submittedAt: { not: null }, gradedAt: null, assignment: { teacherId: session.userId } },
        include: { student: { select: { firstName: true, lastName: true } }, assignment: { select: { id: true, title: true, dueAt: true, maxScore: true, subject: { select: { name: true } }, classRoom: { select: { name: true, arm: true } } } } },
        orderBy: { submittedAt: "asc" }, take: 200
      })
    ]);
    return {
      options,
      set: set.map((row) => ({
        id: row.id, title: row.title, subject: row.subject.name, arm: arm(row.classRoom.name, row.classRoom.arm), due: row.dueAt.toISOString().slice(0, 10), max: row.maxScore, roll: row.classRoom._count.students,
        handed: row.submissions.filter((entry) => entry.submittedAt).length, marked: row.submissions.filter((entry) => entry.gradedAt).length
      })),
      waiting: waiting.map((row) => ({
        id: row.id, student: `${row.student.firstName} ${row.student.lastName}`, title: row.assignment.title, subject: row.assignment.subject.name, arm: arm(row.assignment.classRoom.name, row.assignment.classRoom.arm),
        handedAt: row.submittedAt!.toISOString(), late: row.submittedAt!.getTime() > row.assignment.dueAt.getTime(), max: row.assignment.maxScore, note: row.comment ?? "", link: row.fileUrl ?? ""
      }))
    };
  }

  /**
   * Homework across the school for the people who answer for it — leadership and heads of department. It is oversight, not surveillance:
   * how much is set, how much comes back, and how long marked work waits, by teacher and by arm. It reads no student's answer.
   */
  async school(session: SessionPayload) {
    const term = await prisma.term.findFirst({ where: { schoolId: session.schoolId, isCurrent: true }, select: { name: true, startDate: true, endDate: true, academicSession: { select: { name: true } } } });
    const since = term ? new Date(Math.min(term.startDate.getTime(), Date.now() - 60 * 86_400_000)) : new Date(Date.now() - 90 * 86_400_000);
    const rows = await prisma.assignment.findMany({
      where: { schoolId: session.schoolId, status: "PUBLISHED", createdAt: { gte: since } },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true } }, subject: { select: { name: true } },
        classRoom: { select: { id: true, name: true, arm: true, _count: { select: { students: { where: { status: "ACTIVE" } } } } } },
        submissions: { select: { submittedAt: true, gradedAt: true } }
      }
    });
    const teachers = await prisma.classSubject.findMany({ where: { schoolId: session.schoolId, isActive: true, teacherId: { not: null } }, select: { teacherId: true } });
    const now = Date.now();
    const age = (date: Date) => Math.floor((now - date.getTime()) / 86_400_000);
    type Tally = { name: string; set: number; expected: number; handed: number; marked: number; waiting: number; oldest: number; stale: number };
    const blank = (name: string): Tally => ({ name, set: 0, expected: 0, handed: 0, marked: 0, waiting: 0, oldest: 0, stale: 0 });
    const byTeacher = new Map<string, Tally>();
    const byArm = new Map<string, Tally>();
    for (const row of rows) {
      const teacher = byTeacher.get(row.teacher.id) ?? blank(`${row.teacher.firstName} ${row.teacher.lastName}`);
      const armTally = byArm.get(row.classRoom.id) ?? blank(arm(row.classRoom.name, row.classRoom.arm));
      const handed = row.submissions.filter((entry) => entry.submittedAt);
      const marked = handed.filter((entry) => entry.gradedAt);
      const waiting = handed.filter((entry) => !entry.gradedAt);
      const oldest = waiting.reduce((max, entry) => Math.max(max, age(entry.submittedAt!)), 0);
      for (const tally of [teacher, armTally]) {
        tally.set += 1; tally.expected += row.classRoom._count.students; tally.handed += handed.length; tally.marked += marked.length; tally.waiting += waiting.length;
        tally.oldest = Math.max(tally.oldest, oldest); tally.stale += waiting.filter((entry) => age(entry.submittedAt!) > 7).length;
      }
      byTeacher.set(row.teacher.id, teacher);
      byArm.set(row.classRoom.id, armTally);
    }
    const all = [...byTeacher.values()];
    const teachersNamed = new Set(teachers.map((row) => row.teacherId!)).size;
    return {
      term: term ? `${term.name} ${term.academicSession.name}` : null,
      since: since.toISOString().slice(0, 10),
      totals: {
        set: rows.length, handed: all.reduce((sum, row) => sum + row.handed, 0), expected: all.reduce((sum, row) => sum + row.expected, 0), waiting: all.reduce((sum, row) => sum + row.waiting, 0),
        stale: all.reduce((sum, row) => sum + row.stale, 0), teachersSetting: all.length, teachersNamed
      },
      teachers: all.sort((a, b) => b.stale - a.stale || b.waiting - a.waiting || a.name.localeCompare(b.name)),
      arms: [...byArm.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    };
  }

  async waitingCount(session: SessionPayload) {
    if (session.role === "STUDENT" || session.role === "PARENT") return 0;
    return prisma.assignmentSubmission.count({ where: { schoolId: session.schoolId, submittedAt: { not: null }, gradedAt: null, assignment: { teacherId: session.userId } } });
  }

  async setHomework(session: SessionPayload, body: unknown) {
    this.assertStaff(session);
    const parsed = setSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "That could not be set.");
    const options = await this.mine(session);
    const choice = options.find((option) => option.label === parsed.data.to);
    if (!choice) throw new ForbiddenException("You can only set homework for an arm and subject you teach.");
    const due = new Date(`${parsed.data.dueAt.slice(0, 10)}T22:59:00Z`);
    if (Number.isNaN(due.getTime())) throw new BadRequestException("Choose the day it is due.");
    if (due.getTime() < Date.now() - 86_400_000) throw new BadRequestException("It cannot be due in the past.");
    const created = await prisma.assignment.create({ data: { schoolId: session.schoolId, classId: choice.classId, subjectId: choice.subjectId, teacherId: session.userId, title: parsed.data.title, description: parsed.data.description || null, dueAt: due, maxScore: parsed.data.max ?? 100, status: "PUBLISHED" } });
    const students = await prisma.student.findMany({ where: { schoolId: session.schoolId, currentClassId: choice.classId, status: "ACTIVE", userId: { not: null } }, select: { userId: true } });
    await notifyStudents(session.schoolId, students.filter((student) => student.userId).map((student) => ({ userId: student.userId!, kind: "work" as const, title: `New homework: ${created.title}`, body: `${choice.label} · due ${due.toISOString().slice(0, 10)}`, meta: { kind: "ASSIGNMENT_SET", assignmentId: created.id } })));
    return { id: created.id, students: students.length };
  }

  async mark(session: SessionPayload, submissionId: string, body: unknown) {
    this.assertStaff(session);
    const parsed = markSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "That could not be marked.");
    const submission = await prisma.assignmentSubmission.findFirst({ where: { id: submissionId, schoolId: session.schoolId, submittedAt: { not: null }, assignment: { teacherId: session.userId } }, include: { assignment: { select: { title: true, maxScore: true } }, student: { select: { userId: true } } } });
    if (!submission) throw new NotFoundException("That was not handed in to you.");
    if (parsed.data.score > submission.assignment.maxScore) throw new BadRequestException(`A mark here is out of ${submission.assignment.maxScore}.`);
    await prisma.assignmentSubmission.update({ where: { id: submission.id }, data: { score: parsed.data.score, feedback: parsed.data.feedback || null, gradedAt: new Date() } });
    if (submission.student.userId) {
      await notifyStudents(session.schoolId, [{ userId: submission.student.userId, kind: "work", title: `Marked: ${submission.assignment.title}`, body: `${parsed.data.score} out of ${submission.assignment.maxScore}${parsed.data.feedback ? ` · ${parsed.data.feedback.slice(0, 160)}` : ""}`, meta: { kind: "ASSIGNMENT_MARKED", assignmentId: submission.assignmentId } }]);
    }
    return { marked: true };
  }
}
