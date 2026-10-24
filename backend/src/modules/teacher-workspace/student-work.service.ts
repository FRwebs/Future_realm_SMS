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
  dueAt: z.string().min(8, "Choose the day it is due.")
});
const markSchema = z.object({ score: z.coerce.number().min(0, "A mark is 0 to 100.").max(100, "A mark is 0 to 100."), feedback: z.string().trim().max(2000).optional() });

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
        include: { student: { select: { firstName: true, lastName: true } }, assignment: { select: { id: true, title: true, dueAt: true, subject: { select: { name: true } }, classRoom: { select: { name: true, arm: true } } } } },
        orderBy: { submittedAt: "asc" }, take: 200
      })
    ]);
    return {
      options,
      set: set.map((row) => ({
        id: row.id, title: row.title, subject: row.subject.name, arm: arm(row.classRoom.name, row.classRoom.arm), due: row.dueAt.toISOString().slice(0, 10), roll: row.classRoom._count.students,
        handed: row.submissions.filter((entry) => entry.submittedAt).length, marked: row.submissions.filter((entry) => entry.gradedAt).length
      })),
      waiting: waiting.map((row) => ({
        id: row.id, student: `${row.student.firstName} ${row.student.lastName}`, title: row.assignment.title, subject: row.assignment.subject.name, arm: arm(row.assignment.classRoom.name, row.assignment.classRoom.arm),
        handedAt: row.submittedAt!.toISOString(), late: row.submittedAt!.getTime() > row.assignment.dueAt.getTime(), note: row.comment ?? "", link: row.fileUrl ?? ""
      }))
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
    const created = await prisma.assignment.create({ data: { schoolId: session.schoolId, classId: choice.classId, subjectId: choice.subjectId, teacherId: session.userId, title: parsed.data.title, description: parsed.data.description || null, dueAt: due, status: "PUBLISHED" } });
    const students = await prisma.student.findMany({ where: { schoolId: session.schoolId, currentClassId: choice.classId, status: "ACTIVE", userId: { not: null } }, select: { userId: true } });
    await notifyStudents(session.schoolId, students.filter((student) => student.userId).map((student) => ({ userId: student.userId!, kind: "work" as const, title: `New homework: ${created.title}`, body: `${choice.label} · due ${due.toISOString().slice(0, 10)}`, meta: { kind: "ASSIGNMENT_SET", assignmentId: created.id } })));
    return { id: created.id, students: students.length };
  }

  async mark(session: SessionPayload, submissionId: string, body: unknown) {
    this.assertStaff(session);
    const parsed = markSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "That could not be marked.");
    const submission = await prisma.assignmentSubmission.findFirst({ where: { id: submissionId, schoolId: session.schoolId, submittedAt: { not: null }, assignment: { teacherId: session.userId } }, include: { assignment: { select: { title: true } }, student: { select: { userId: true } } } });
    if (!submission) throw new NotFoundException("That was not handed in to you.");
    await prisma.assignmentSubmission.update({ where: { id: submission.id }, data: { score: parsed.data.score, feedback: parsed.data.feedback || null, gradedAt: new Date() } });
    if (submission.student.userId) {
      await notifyStudents(session.schoolId, [{ userId: submission.student.userId, kind: "work", title: `Marked: ${submission.assignment.title}`, body: `${parsed.data.score}%${parsed.data.feedback ? ` · ${parsed.data.feedback.slice(0, 160)}` : ""}`, meta: { kind: "ASSIGNMENT_MARKED", assignmentId: submission.assignmentId } }]);
    }
    return { marked: true };
  }
}
