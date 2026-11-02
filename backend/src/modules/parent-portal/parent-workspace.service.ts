import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import { prisma } from "../../../../src/lib/db/prisma";
import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { loadGuardianPolicy } from "./guardian-policy";

/**
 * What a parent's own workspace reads.
 *
 * The parent portal is not the school's portal with fewer buttons. A school
 * asks "how is this class doing"; a parent asks "is my child all right, and is
 * there anything I have to do". So every read here is shaped around one family:
 * it starts from the guardian's linked children and never widens, and the
 * school's own visibility policy is applied on top, because a school may keep
 * results or fees back from parents and this portal must honour that.
 *
 * A family with more than one child is the normal case, not an edge: the
 * switcher at the top of the portal moves between them and a whole-family view,
 * so most reads come in two shapes — one child, or all of them.
 */
@Injectable()
export class ParentWorkspaceService {
  private assert(session: SessionPayload) {
    if (session.role !== "PARENT") throw new ForbiddenException("This is a parent's own workspace.");
  }

  /** The guardian behind the session, with their children and each child's class. */
  private async context(session: SessionPayload) {
    this.assert(session);
    const guardian = await prisma.guardian.findFirst({
      where: { schoolId: session.schoolId, userId: session.userId },
      include: {
        user: true,
        students: {
          include: { student: { include: { currentClass: { include: { classLevel: true } } } } },
          orderBy: { student: { dateOfBirth: "asc" } },
        },
      },
    });
    if (!guardian) throw new NotFoundException("No guardian profile is linked to this account.");
    const [term, school, policy] = await Promise.all([
      prisma.term.findFirst({ where: { schoolId: session.schoolId, isCurrent: true }, include: { academicSession: true } }),
      prisma.school.findUnique({ where: { id: session.schoolId }, select: { name: true } }),
      loadGuardianPolicy(session.schoolId),
    ]);
    return { guardian, term, school, policy, children: guardian.students.map((link) => link.student) };
  }

  /** One of this guardian's children, refused if the child is not theirs. */
  private async child(session: SessionPayload, studentId: string) {
    const { guardian } = await this.context(session);
    const link = guardian.students.find((item) => item.studentId === studentId);
    if (!link) throw new ForbiddenException("That child is not linked to your account.");
    return link.student;
  }

  /* ───────────────────────── who the family is ───────────────────────── */

  /**
   * The family: who the parent is, which children they have, and what the
   * school lets them see. Everything else in the portal is read against this.
   */
  async me(session: SessionPayload) {
    const { guardian, term, school, policy, children } = await this.context(session);
    const today = isoDay(new Date());
    const start = term ? isoDay(term.startDate) : null;
    const end = term ? isoDay(term.endDate) : null;
    const weeks = term ? Math.max(1, Math.ceil((term.endDate.getTime() - term.startDate.getTime()) / (7 * DAY))) : 0;
    const week = term && start ? Math.min(weeks, Math.max(0, Math.floor((dayOf(today).getTime() - dayOf(start).getTime()) / (7 * DAY)) + 1)) : 0;
    return {
      id: guardian.id,
      name: `${guardian.firstName} ${guardian.lastName}`,
      first: guardian.user?.preferredName?.trim() || guardian.firstName,
      relationship: guardian.relationship,
      phone: guardian.phone,
      email: guardian.email ?? guardian.user?.email ?? null,
      language: guardian.language,
      school: school?.name ?? "",
      term: term ? { id: term.id, name: term.name, session: term.academicSession.name, start, end, week, weeks } : null,
      today,
      now: clock(),
      /** What this school has chosen to show parents. A page it keeps back is not in the rail. */
      sees: [...policy.sees],
      children: children.map((student) => ({
        id: student.id,
        name: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
        first: student.firstName,
        initials: `${student.firstName[0] ?? ""}${student.lastName[0] ?? ""}`.toUpperCase(),
        admissionNumber: student.admissionNumber,
        arm: armName(student.currentClass?.name, student.currentClass?.arm),
        level: student.currentClass?.classLevel?.name ?? student.currentClass?.name ?? "",
        classId: student.currentClassId,
        photoUrl: student.photoUrl ?? null,
      })),
    };
  }

  /* ───────────────────────── what needs this parent ───────────────────────── */

  /**
   * The things this family has to act on, newest problem first.
   *
   * This is the spine of the portal: the overview leads with it, the child
   * switcher counts it, and the rail badges it. It is deliberately built from
   * what is actually outstanding rather than from a notification feed, because
   * a parent wants to know what is still undone, not what they were once told.
   *
   * Each entry says what it is, how late it is, and the one thing that clears
   * it. `scope` is a child's id, or "all" for the whole family.
   */
  async needs(session: SessionPayload, scope: string) {
    const { guardian, children, term, policy } = await this.context(session);
    const mine = scope === "all" ? children : children.filter((student) => student.id === scope);
    if (!mine.length) return { items: [] };
    const ids = mine.map((student) => student.id);
    const today = isoDay(new Date());

    const [invoices, absences, explanations, consents, meetings, instalments] = await Promise.all([
      // Only what is still owed. A paid invoice is not a thing that needs you.
      prisma.invoice.findMany({
        // A draft has not been issued to the family, and a void one is withdrawn.
        where: { schoolId: session.schoolId, studentId: { in: ids }, balance: { gt: 0 }, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } },
        select: { id: true, studentId: true, invoiceNumber: true, balance: true, dueOn: true },
        orderBy: { dueOn: "asc" },
      }),
      prisma.studentAttendance.findMany({
        where: { schoolId: session.schoolId, studentId: { in: ids }, status: "ABSENT", reason: null, ...(term ? { termId: term.id } : {}) },
        select: { studentId: true, date: true },
        orderBy: { date: "desc" },
        take: 40,
      }),
      // An absence the family has already written in about is not unexplained,
      // even while the school is still reading the explanation.
      prisma.guardianSubmission.findMany({
        where: { schoolId: session.schoolId, guardianId: guardian.id, type: { contains: "absence", mode: "insensitive" } },
        select: { studentId: true, dates: true },
      }),
      prisma.familyConsent.findMany({
        where: { schoolId: session.schoolId, guardianId: guardian.id },
        select: { typeCode: true, status: true },
      }),
      prisma.parentMeeting.findMany({
        where: { schoolId: session.schoolId, guardianId: guardian.id, deletedAt: null, status: { in: ["SCHEDULED", "INVITED"] }, scheduledAt: { gte: new Date() } },
        select: { id: true, studentId: true, title: true, scheduledAt: true, status: true },
        orderBy: { scheduledAt: "asc" },
      }),
      prisma.installmentPlanItem.findMany({
        where: { plan: { schoolId: session.schoolId, studentId: { in: ids }, status: { notIn: ["PAID", "CANCELLED"] } }, status: { notIn: ["PAID", "CANCELLED"] } },
        select: { id: true, dueOn: true, amount: true, paidAmount: true, plan: { select: { studentId: true } } },
        orderBy: { dueOn: "asc" },
      }),
    ]);

    const firstOf = new Map(mine.map((student) => [student.id, student.firstName]));
    const explained = new Set(explanations.flatMap((row) => (row.dates ?? []).map((date) => `${row.studentId ?? ""}:${date}`)));
    const items: NeedItem[] = [];

    if (policy.sees.has("Fees")) {
      for (const invoice of invoices) {
        const over = Math.floor((dayOf(today).getTime() - dayOf(isoDay(invoice.dueOn)).getTime()) / DAY);
        items.push({
          kind: "fee", childId: invoice.studentId, child: firstOf.get(invoice.studentId) ?? "",
          label: `Balance · ${money(Number(invoice.balance))}`,
          sub: over > 0 ? `${over} ${over === 1 ? "day" : "days"} overdue on ${invoice.invoiceNumber}. Pay, report a transfer, or ask for a plan.` : `Due ${isoDay(invoice.dueOn)} on ${invoice.invoiceNumber}.`,
          pill: over > 0 ? "Overdue" : `Due ${shortDay(isoDay(invoice.dueOn))}`, tone: over > 0 ? "negative" : "progress",
          action: "Pay", href: `/portals/parent/fees?child=${invoice.studentId}`, due: isoDay(invoice.dueOn),
        });
      }
    }

    if (policy.sees.has("Attendance")) {
      for (const row of absences) {
        const date = isoDay(row.date);
        if (explained.has(`${row.studentId}:${date}`)) continue;
        items.push({
          kind: "absence", childId: row.studentId, child: firstOf.get(row.studentId) ?? "",
          label: `Away on ${longDay(date)}`,
          sub: "Marked absent on the morning register. No explanation yet.",
          pill: "Not explained", tone: "attention",
          action: "Explain", href: `/portals/parent/requests?child=${row.studentId}&new=absence&date=${date}`, due: date,
        });
      }
    }

    const recorded = new Map(consents.map((row) => [row.typeCode, row.status]));
    for (const consent of CONSENTS) {
      if (recorded.has(consent.code)) continue;
      items.push({
        kind: "consent", childId: null, child: "",
        label: `${consent.title} has never been recorded`,
        sub: `The school needs a yes or no before it ${consent.because}.`,
        pill: "Not recorded", tone: "attention",
        action: "Decide", href: "/portals/parent/consents", due: "9999-12-31",
      });
    }

    for (const meeting of meetings) {
      if (meeting.status !== "INVITED") continue;
      items.push({
        kind: "meeting", childId: meeting.studentId, child: meeting.studentId ? firstOf.get(meeting.studentId) ?? "" : "",
        label: meeting.title, sub: `${longDay(isoDay(meeting.scheduledAt))} · confirm that you can come.`,
        pill: "Not confirmed", tone: "attention",
        action: "Confirm", href: "/portals/parent/meetings", due: isoDay(meeting.scheduledAt),
      });
    }

    if (policy.sees.has("Fees")) {
      for (const item of instalments) {
        const child = item.plan.studentId;
        items.push({
          kind: "instalment", childId: child, child: firstOf.get(child) ?? "",
          label: `Instalment · ${money(Number(item.amount) - Number(item.paidAmount))}`,
          sub: `Due ${longDay(isoDay(item.dueOn))} under the payment plan the school approved.`,
          pill: `Due ${shortDay(isoDay(item.dueOn))}`, tone: "progress",
          action: "Pay", href: `/portals/parent/fees?child=${child}`, due: isoDay(item.dueOn),
        });
      }
    }

    // Anything overdue comes first, then by the date it is due.
    const rank = (item: NeedItem) => (item.tone === "negative" ? 0 : 1);
    items.sort((a, b) => rank(a) - rank(b) || a.due.localeCompare(b.due));
    return { items };
  }
}

type NeedItem = {
  kind: string; childId: string | null; child: string;
  label: string; sub: string; pill: string; tone: string;
  action: string; href: string; due: string;
};

/**
 * The consents a school asks every family for.
 *
 * They are a fixed list rather than rows, because a consent that has never been
 * recorded has no row — and "never recorded" is exactly the state a parent has
 * to resolve. Recording one writes the FamilyConsent row.
 */
const CONSENTS = [
  { code: "photo", title: "Photography consent", because: "uses your child's photograph" },
  { code: "trips", title: "Local trips consent", because: "takes your child off the premises" },
  { code: "medical", title: "Emergency medical consent", because: "treats your child in an emergency" },
  { code: "data", title: "Data sharing consent", because: "shares your child's record outside the school" },
] as const;

const money = (value: number) => `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
const shortDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const longDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

const DAY = 86_400_000;
const dayOf = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoDay = (value: Date) => value.toISOString().slice(0, 10);
const clock = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
/** "JSS 1" + "Silver" → "JSS 1 Silver"; the school's own words for where a child sits. */
const armName = (name?: string | null, arm?: string | null) => [name, arm].filter(Boolean).join(" ") || "No class";
