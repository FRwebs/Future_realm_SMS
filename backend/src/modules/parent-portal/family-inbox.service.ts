import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { MessageDeliveryStatus } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { armName } from "../fee-management/fees.shared";
import { openSubmission, submissionTypes } from "../guardian-management/submission-intake";
import { currentTerm, fullName } from "../student-records/records.shared";
import { formatDay } from "../../common/date-format";

/** The types of submission a family may open themselves. The others are the school's to start. */
const FAMILY_TYPES = ["Absence explanation", "Collection change", "Contact update", "Record correction", "Result query", "Fee query", "Meeting request", "Data copy request"];

const stateLabel = (state: string) => (state === "RESOLVED" ? "Resolved" : state === "DECLINED" ? "Declined" : state === "IN_PROGRESS" ? "In progress" : state === "ASSIGNED" ? "With the school" : "Received");

const submitSchema = z.object({
  child: z.string().optional(),
  /** For a request about no child in particular, which of the family's schools it is for. Left out, it goes to the school they signed in to. */
  school: z.string().optional(),
  type: z.string().min(1, "Choose what this is about."),
  detail: z.string().trim().min(8, "Say a little more — the person who reads it has only your words."),
  evidence: z.string().trim().max(300).optional(),
  dates: z.union([z.string(), z.array(z.string())]).optional().transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value])),
  collector: z.object({ name: z.string().trim().min(2, "Who will collect?"), relation: z.string().trim().min(2, "Their relation to the child."), phone: z.string().trim().min(7, "A number the school can check."), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Which day?") }).optional(),
});

/**
 * What a family does in the portal about the school's messages and about telling the school something: read what was sent, acknowledge it
 * where asked, answer it — and send in an absence explanation, a change of who collects, or a query, with an owner and a clock from the
 * moment it arrives.
 */
@Injectable()
export class FamilyInboxService {
  /**
   * Every guardian record this login owns, across every school.
   *
   * One parent, one inbox: a family with a child at two schools reads both
   * schools' messages here and sends to whichever school the message or the
   * child belongs to. `rows` is the lot; `guardian` is the one at the school
   * they signed in to, which for most families is the only one there is.
   */
  private async guardian(session: SessionPayload) {
    if (session.role !== "PARENT") throw new ForbiddenException("The family inbox is for parent and guardian accounts.");
    const rows = await prisma.guardian.findMany({
      where: { userId: session.userId, mergedIntoId: null },
      include: { students: { include: { student: { select: { id: true, firstName: true, lastName: true, schoolId: true, currentClass: { select: { name: true, arm: true } } } } } } },
      orderBy: { createdAt: "asc" },
    });
    if (!rows.length) throw new NotFoundException("No guardian profile is linked to this account.");
    const guardian = rows.find((row) => row.schoolId === session.schoolId) ?? rows[0]!;
    return Object.assign(guardian, {
      rows,
      ids: rows.map((row) => row.id),
      schoolIds: [...new Set(rows.map((row) => row.schoolId))],
      /** Every child across every school, each with the guardian record and school it belongs to. */
      links: rows.flatMap((row) => row.students.map((link) => ({ ...link, guardianId: row.id, schoolId: row.schoolId }))),
    });
  }

  async messages(session: SessionPayload) {
    const guardian = await this.guardian(session);
    const schools = await prisma.school.findMany({ where: { id: { in: guardian.schoolIds } }, select: { id: true, name: true } });
    const rows = await prisma.messageDelivery.findMany({
      where: { guardianId: { in: guardian.ids }, status: { in: [MessageDeliveryStatus.DELIVERED, MessageDeliveryStatus.PENDING] }, campaign: { status: "SENT" } },
      orderBy: { createdAt: "desc" }, take: 80, include: { campaign: { select: { sentAt: true, createdAt: true } } },
    });
    const replies = rows.length ? await prisma.guardianSubmission.findMany({ where: { guardianId: { in: guardian.ids }, deliveryId: { in: rows.map((row) => row.id) } }, orderBy: { createdAt: "asc" } }) : [];
    return {
      school: schools.length > 1 ? "your schools" : schools[0]?.name ?? "Your school",
      unread: rows.filter((row) => !row.readAt).length,
      messages: rows.map((row) => ({
        id: row.id, text: row.body ?? "", channel: row.channel ?? "IN_APP", at: (row.campaign.sentAt ?? row.campaign.createdAt).toISOString(), read: Boolean(row.readAt),
        school: schools.length > 1 ? schools.find((school) => school.id === row.schoolId)?.name ?? "" : "",
        acknowledgeAsked: row.acknowledgeAsked, acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
        replies: replies.filter((reply) => reply.deliveryId === row.id).map((reply) => ({ id: reply.id, text: reply.detail, at: reply.createdAt.toISOString(), state: stateLabel(reply.state), outcome: reply.outcome })),
      })),
    };
  }

  private async mine(session: SessionPayload, id: string) {
    const guardian = await this.guardian(session);
    const row = await prisma.messageDelivery.findFirst({ where: { id, guardianId: { in: guardian.ids } } });
    if (!row) throw new NotFoundException("That message is not one of yours.");
    return { guardian, row };
  }

  async read(session: SessionPayload, id: string) {
    const { row } = await this.mine(session, id);
    if (!row.readAt) await prisma.messageDelivery.update({ where: { id }, data: { readAt: new Date() } });
    return { id };
  }

  async acknowledge(session: SessionPayload, id: string) {
    const { row } = await this.mine(session, id);
    if (!row.acknowledgeAsked) throw new BadRequestException("This message did not ask for an acknowledgement.");
    if (!row.acknowledgedAt) await prisma.messageDelivery.update({ where: { id }, data: { acknowledgedAt: new Date(), readAt: row.readAt ?? new Date() } });
    return { id };
  }

  /** A reply reaches the office, not the teacher's phone: it is opened as a submission with an owner, so it has a clock like anything else a family sends. */
  async reply(session: SessionPayload, id: string, body: unknown) {
    const input = z.object({ text: z.string().trim().min(2, "Write your reply.").max(1500) }).parse(body);
    const { guardian, row } = await this.mine(session, id);
    const campaign = await prisma.messageCampaign.findUnique({ where: { id: row.campaignId }, select: { name: true } });
    // The reply goes back to the school that wrote, under that school's own guardian record.
    const made = await openSubmission(row.schoolId, { guardianId: row.guardianId ?? guardian.rows.find((entry) => entry.schoolId === row.schoolId)?.id ?? guardian.id, type: "Reply to a school message", detail: input.text, channel: "Portal", deliveryId: id, office: true });
    if (!row.readAt) await prisma.messageDelivery.update({ where: { id }, data: { readAt: new Date() } });
    void campaign;
    return { id: made.id };
  }

  async submissions(session: SessionPayload) {
    const guardian = await this.guardian(session);
    const rows = await prisma.guardianSubmission.findMany({ where: { guardianId: { in: guardian.ids }, deliveryId: null }, orderBy: { createdAt: "desc" }, take: 60, include: { student: { select: { firstName: true, lastName: true } } } });
    return rows.map((row) => ({
      id: row.id, type: row.type, child: row.student ? fullName(row.student) : null, detail: row.detail, state: stateLabel(row.state), open: row.state !== "RESOLVED" && row.state !== "DECLINED",
      outcome: row.outcome, at: row.createdAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null, with: row.ownerRole ?? null,
    }));
  }

  /** What a family may send in, and — for an absence — the days their child is down as absent, so they explain the days the school actually recorded. */
  async options(session: SessionPayload) {
    const guardian = await this.guardian(session);
    // Each school has its own list of what it accepts and its own current term; where two schools
    // promise different answer times for the same kind of request, the slower one is the honest one.
    const perSchool = await Promise.all(guardian.schoolIds.map(async (id) => ({ id, types: await submissionTypes(id), term: await currentTerm(id) })));
    const types = [...new Map(perSchool.flatMap((school) => school.types).map((type) => [type.name, type])).values()].map((type) => ({
      ...type,
      target: Math.max(...perSchool.flatMap((school) => school.types).filter((other) => other.name === type.name).map((other) => other.target)),
    }));
    const inTerm = perSchool.filter((school) => school.term).map((school) => ({ schoolId: school.id, termId: school.term!.id }));
    // Every child's absent days in one query, not one per child.
    const absent = inTerm.length && guardian.links.length
      ? await prisma.studentAttendance.findMany({ where: { OR: inTerm, studentId: { in: guardian.links.map((link) => link.studentId) }, subjectId: null, status: "ABSENT" }, orderBy: { date: "desc" }, select: { studentId: true, date: true } })
      : [];
    const children = guardian.links.map((link) => ({
      id: link.studentId, name: fullName(link.student), arm: link.student.currentClass ? armName(link.student.currentClass) : "",
      absences: absent.filter((entry) => entry.studentId === link.studentId).slice(0, 20).map((entry) => ({ date: entry.date.toISOString().slice(0, 10), label: formatDay(entry.date, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) })),
    }));
    return { children, types: types.filter((type) => type.accepted && FAMILY_TYPES.includes(type.name)).map((type) => ({ name: type.name, target: type.target })) };
  }

  async submit(session: SessionPayload, body: unknown) {
    const input = submitSchema.parse(body);
    const guardian = await this.guardian(session);
    if (!FAMILY_TYPES.includes(input.type)) throw new BadRequestException("That is not something you can send from here.");
    const aboutChild = ["Absence explanation", "Collection change", "Record correction", "Result query"].includes(input.type);
    const child = input.child ? guardian.links.find((link) => link.studentId === input.child) : undefined;
    if (input.child && !child) throw new ForbiddenException("That child is not linked to your account.");
    if (aboutChild && !child) throw new BadRequestException("Choose which child this is about.");
    if (input.type === "Absence explanation" && !input.dates.length) throw new BadRequestException("Choose the days you are explaining.");
    if (input.type === "Collection change" && !input.collector) throw new BadRequestException("Say who will collect your child, and on which day.");
    // It goes to the school the child is at. A request about no child goes to the school the parent names, or else the one they signed in
    // to — and only ever to a school they are a guardian at.
    const named = !child && input.school ? guardian.rows.find((row) => row.schoolId === input.school) : undefined;
    if (!child && input.school && !named) throw new ForbiddenException("You are not a guardian at that school.");
    const made = await openSubmission(child?.schoolId ?? named?.schoolId ?? guardian.schoolId, {
      guardianId: child?.guardianId ?? named?.id ?? guardian.id, childId: child?.studentId, type: input.type, detail: input.detail, channel: "Portal", evidence: input.evidence, dates: input.type === "Absence explanation" ? input.dates : [],
      payload: input.type === "Collection change" ? input.collector : undefined,
    });
    return made;
  }
}
