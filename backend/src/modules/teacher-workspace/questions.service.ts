import { Injectable } from "@nestjs/common";
import { ApprovalKind, ApprovalStatus, UserRole } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { fullName } from "../fee-management/fees.shared";
import { TeacherWorkspaceService } from "./workspace.service";

/**
 * A teacher cannot change what they are assigned to; the office can. This is the one route between the two: say which assignment,
 * what is wrong and what it should be, and the question arrives in the office's queue already knowing who, which arm and why.
 * It is a question, not a change — nothing about an assignment moves until the office moves it.
 */

export const QUESTION_SUBJECT = "AssignmentQuestion";

const KINDS = {
  missing: "Ask the office to add an assignment",
  wrong: "Ask the office to correct an assignment",
  cover: "Ask the office to change your cover",
  drop: "Ask the office to take an assignment back",
} as const;

const URGENCY: Record<string, number> = { "Before my next period": 80, "This week": 40, "No rush": 10 };

const urgency = z.enum(["Before my next period", "This week", "No rush"]).default("This week");
const text = (message: string) => z.string().trim().min(1, message);

/** What each kind of question carries. The words the office reads are composed here, so they read the same however it was asked. */
const askSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("missing"), subject: text("Say which subject."), arm: text("Say which arm."), periods: z.coerce.number().int().min(1).max(12).default(3), since: z.string().default("Since the start of term"), basis: z.string().default("It is mine"), note: z.string().trim().optional(), urgency }),
  z.object({ kind: z.literal("wrong"), which: text("Say which assignment."), problem: text("Say what is wrong."), shouldBe: text("Say what it should be."), note: z.string().trim().optional(), urgency }),
  z.object({ kind: z.literal("cover"), which: text("Say which cover."), change: text("Say what should change."), newDate: z.string().trim().optional(), why: text("Say why."), urgency }),
  z.object({ kind: z.literal("drop"), which: text("Say which assignment."), why: text("Say why."), from: z.string().default("The end of this week"), note: z.string().trim().optional(), urgency }),
]);

function words(input: z.infer<typeof askSchema>): { about: string; detail: string } {
  switch (input.kind) {
    case "missing": return { about: `${input.subject} · ${input.arm}`, detail: `Add it · ${input.periods} a week · ${input.since.toLowerCase()} · ${input.basis.toLowerCase()}${input.note ? `\n\n${input.note}` : ""}` };
    case "wrong": return { about: input.which, detail: `${input.problem} · should be ${input.shouldBe}${input.note ? `\n\n${input.note}` : ""}` };
    case "cover": return { about: input.which, detail: `${input.change}${input.newDate ? ` · to ${input.newDate}` : ""}\n\n${input.why}` };
    case "drop": return { about: input.which, detail: `Take it back · ${input.why.toLowerCase()} · from ${input.from.toLowerCase()}${input.note ? `\n\n${input.note}` : ""}` };
  }
}

@Injectable()
export class TeacherQuestionsService {
  constructor(private readonly workspace: TeacherWorkspaceService) {}

  /** Who the office is: the academic lead where the school has one, otherwise the principal. */
  private async office(schoolId: string): Promise<{ role: UserRole; label: string }> {
    const lead = await prisma.user.count({ where: { schoolId, role: "VICE_PRINCIPAL_ACADEMICS", isActive: true, deletedAt: null } });
    return lead ? { role: "VICE_PRINCIPAL_ACADEMICS", label: "The academic office" } : { role: "PRINCIPAL", label: "The Principal’s office" };
  }

  async ask(session: SessionPayload, body: unknown) {
    const input = askSchema.parse(body);
    const me = await this.workspace.me(session);
    const office = await this.office(session.schoolId);
    const said = words(input);
    const row = await prisma.approvalRequest.create({
      data: {
        schoolId: session.schoolId, kind: ApprovalKind.OTHER, subjectType: QUESTION_SUBJECT, subjectId: input.kind,
        title: `${me.person.name} · ${KINDS[input.kind].replace(/^Ask the office to /, "")}`,
        summary: said.detail, blocking: said.about,
        priority: URGENCY[input.urgency] ?? 40, requestedById: session.userId, assigneeRole: office.role
      }
    });
    // The head of department is told, so they know — it is not routed to them.
    if (me.persona !== "head-of-department" && me.department) {
      const head = await prisma.user.findFirst({ where: { schoolId: session.schoolId, role: "HEAD_OF_DEPARTMENT", isActive: true, deletedAt: null, staffProfile: { departmentId: me.department.id } }, select: { id: true } });
      if (head) await prisma.notificationLog.create({ data: { schoolId: session.schoolId, userId: head.id, channel: "IN_APP", title: `${me.person.name} has asked the office about an assignment`, body: `${said.about} — ${said.detail.split("\n")[0]}`, status: "QUEUED", sentAt: new Date() } });
    }
    return { id: row.id, to: office.label };
  }

  async mine(session: SessionPayload) {
    const rows = await prisma.approvalRequest.findMany({ where: { schoolId: session.schoolId, requestedById: session.userId, subjectType: QUESTION_SUBJECT }, orderBy: { createdAt: "desc" }, take: 25, include: { decidedBy: { select: { firstName: true, lastName: true } } } });
    return rows.map((row) => {
      const answered = row.status !== ApprovalStatus.PENDING;
      return {
        id: row.id, kind: row.subjectId, title: (row.title.split(" · ")[1] ?? row.title).replace(/^./, (c) => c.toUpperCase()), about: row.blocking ?? "", detail: row.summary ?? "",
        sentAt: row.createdAt.toISOString(), state: answered ? "Answered" : "Sent", answer: row.decisionNote, outcome: answered ? row.status : null,
        answeredBy: row.decidedBy ? fullName(row.decidedBy) : null, answeredAt: row.decidedAt?.toISOString() ?? null,
        urgency: row.priority >= 80 ? "Before my next period" : row.priority >= 40 ? "This week" : "No rush"
      };
    });
  }
}
