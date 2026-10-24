import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { formatNigeriaClassName } from "../../../../src/lib/school-options";
import { notifyStudents } from "../student-portal/student-notify";

/**
 * What students have asked this person, and what was said back. A student's question is an in-app message to one teacher; the answer is one
 * back. It is a conversation between the two — nothing here is posted to a family or the office.
 */

const replySchema = z.object({ text: z.string().trim().min(1, "Write your answer first.").max(4000) });

@Injectable()
export class TeacherStudentQuestionsService {
  private assertStaff(session: SessionPayload) {
    if (session.role === "STUDENT" || session.role === "PARENT") throw new ForbiddenException("Students’ questions are answered by their teachers.");
  }

  async list(session: SessionPayload) {
    this.assertStaff(session);
    const received = await prisma.internalMessage.findMany({
      where: { schoolId: session.schoolId, recipientId: session.userId, sender: { role: "STUDENT" } },
      include: { sender: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, take: 100
    });
    const senderIds = [...new Set(received.map((message) => message.senderId))];
    const [students, answers] = await Promise.all([
      senderIds.length ? prisma.student.findMany({ where: { schoolId: session.schoolId, userId: { in: senderIds } }, select: { userId: true, currentClass: { select: { name: true, arm: true } } } }) : Promise.resolve([]),
      senderIds.length ? prisma.internalMessage.findMany({ where: { schoolId: session.schoolId, senderId: session.userId, recipientId: { in: senderIds } }, orderBy: { createdAt: "asc" } }) : Promise.resolve([])
    ]);
    const arm = new Map(students.map((student) => [student.userId, student.currentClass ? formatNigeriaClassName(`${student.currentClass.name} - ${student.currentClass.arm}`) : ""]));
    const items = received.map((message) => {
      const mine = answers.filter((answer) => answer.recipientId === message.senderId && answer.createdAt > message.createdAt);
      return {
        id: message.id, student: `${message.sender.firstName} ${message.sender.lastName}`, arm: arm.get(message.senderId) ?? "", topic: message.subject, text: message.body, at: message.createdAt.toISOString(), read: Boolean(message.readAt),
        replies: mine.map((answer) => ({ text: answer.body, at: answer.createdAt.toISOString() })), answered: mine.length > 0
      };
    });
    return { items, waiting: items.filter((item) => !item.answered).length };
  }

  async reply(session: SessionPayload, id: string, body: unknown) {
    this.assertStaff(session);
    const parsed = replySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Write your answer first.");
    const original = await prisma.internalMessage.findFirst({ where: { id, schoolId: session.schoolId, recipientId: session.userId, sender: { role: "STUDENT" } }, include: { sender: { select: { id: true, firstName: true } } } });
    if (!original) throw new NotFoundException("That question was not put to you.");
    const subject = original.subject.startsWith("Re:") ? original.subject : `Re: ${original.subject}`;
    const [message] = await prisma.$transaction([
      prisma.internalMessage.create({ data: { schoolId: session.schoolId, senderId: session.userId, recipientId: original.senderId, subject, body: parsed.data.text } }),
      prisma.internalMessage.update({ where: { id: original.id }, data: { readAt: original.readAt ?? new Date() } })
    ]);
    await notifyStudents(session.schoolId, [{ userId: original.senderId, kind: "messages", title: `Your teacher answered: ${original.subject}`, body: parsed.data.text.slice(0, 240), meta: { kind: "STUDENT_QUESTION_ANSWERED", messageId: original.id } }]);
    return { id: message.id };
  }

  /** How many are waiting, for My Day and the rail. */
  async waiting(session: SessionPayload) {
    if (session.role === "STUDENT" || session.role === "PARENT") return { waiting: 0, oldest: null as string | null };
    const received = await prisma.internalMessage.findMany({ where: { schoolId: session.schoolId, recipientId: session.userId, sender: { role: "STUDENT" } }, select: { senderId: true, createdAt: true } });
    if (!received.length) return { waiting: 0, oldest: null };
    const answers = await prisma.internalMessage.findMany({ where: { schoolId: session.schoolId, senderId: session.userId, recipientId: { in: [...new Set(received.map((row) => row.senderId))] } }, select: { recipientId: true, createdAt: true } });
    const open = received.filter((row) => !answers.some((answer) => answer.recipientId === row.senderId && answer.createdAt > row.createdAt));
    return { waiting: open.length, oldest: open.length ? open.reduce((min, row) => (row.createdAt < min ? row.createdAt : min), open[0]!.createdAt).toISOString() : null };
  }
}
