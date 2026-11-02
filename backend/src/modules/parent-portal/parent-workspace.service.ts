import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import { prisma } from "../../../../src/lib/db/prisma";
import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { categoryOfMessage } from "../../../../src/lib/messaging/family-choices";
import { QUIET_HOURS, preferencesSchema, type Preferences } from "../../../../src/lib/preferences";
import { loadConsentTypes } from "../student-records/consent.shared";
import { openSubmission, submissionTypes } from "../guardian-management/submission-intake";
import { deviceName, hide } from "../student-portal/student-workspace.service";
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
      prisma.school.findUnique({ where: { id: session.schoolId }, select: { name: true, mainPhone: true, website: true, city: true, state: true } }),
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
    // What the rail counts on Messages: what the school has sent that has not been opened.
    const unread = await prisma.messageDelivery.count({ where: { guardianId: guardian.id, schoolId: session.schoolId, readAt: null, status: { in: ["DELIVERED", "PENDING"] }, campaign: { status: "SENT" } } });
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
      /** How to reach the school office — a parent's first recourse, so it sits at the foot of the rail. */
      office: {
        name: school?.name ?? "",
        phone: school?.mainPhone ?? null,
        website: school?.website ?? null,
        where: [school?.city, school?.state].filter(Boolean).join(", ") || null,
      },
      term: term ? { id: term.id, name: term.name, session: term.academicSession.name, start, end, week, weeks } : null,
      today,
      now: clock(),
      /** What this school has chosen to show parents. A page it keeps back is not in the rail. */
      sees: [...policy.sees],
      unread,
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
        where: { schoolId: session.schoolId, studentId: { in: ids }, status: "ABSENT", ...(term ? { termId: term.id } : {}) },
        select: { studentId: true, date: true, reason: true },
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
          sub: row.reason ? `Marked absent. The school noted: ${row.reason}` : "Marked absent on the morning register. No explanation yet.",
          pill: "Not explained", tone: "attention",
          action: "Explain", href: `/portals/parent/attendance?child=${row.studentId}`, due: date,
        });
      }
    }

    const consentTypes = await loadConsentTypes(session.schoolId);
    const recorded = new Map(consents.map((row) => [row.typeCode, row.status]));
    for (const consent of consentTypes) {
      if (recorded.has(consent.code)) continue;
      items.push({
        kind: "consent", childId: null, child: "",
        label: `${consent.name} has never been recorded`,
        sub: `The school needs a yes or no. ${consent.blocks ? `Without one: ${consent.blocks.charAt(0).toLowerCase()}${consent.blocks.slice(1)}.` : ""}`.trim(),
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
/* ───────────────────────── fees ───────────────────────── */

  /**
   * What the family owes, and everything already paid.
   *
   * A parent checking fees is usually answering one of two questions: "how much
   * is left" and "did my payment land". So the balance leads, and every payment
   * the bursar has recorded is listed with its receipt number — a parent who
   * paid last week needs to see it here, or they will ring the office.
   *
   * Figures come from the invoice's own balance rather than from a sum of
   * payments, because the bursar may have applied a discount or a fine that no
   * payment explains.
   */
  async fees(session: SessionPayload, scope: string) {
    const { children, policy, term } = await this.context(session);
    if (!policy.sees.has("Fees")) throw new ForbiddenException("Your school has not made fee details visible to parents.");
    const mine = scope === "all" ? children : children.filter((student) => student.id === scope);
    const ids = mine.map((student) => student.id);
    if (!ids.length) return { children: [], invoices: [], payments: [], plans: [] };

    const invoices = await prisma.invoice.findMany({
      where: { schoolId: session.schoolId, studentId: { in: ids }, status: { not: "DRAFT" } },
      include: {
        items: { select: { description: true, amount: true, quantity: true } },
        payments: { include: { receipts: { select: { receiptNumber: true } } }, orderBy: { paidAt: "desc" } },
        term: { select: { id: true, name: true, academicSession: { select: { name: true } } } },
      },
      orderBy: { issuedOn: "desc" },
    });
    const plans = await prisma.installmentPlan.findMany({
      where: { schoolId: session.schoolId, studentId: { in: ids }, status: { notIn: ["CANCELLED"] } },
      include: { items: { orderBy: { dueOn: "asc" } } },
    });

    const firstOf = new Map(mine.map((student) => [student.id, student.firstName]));
    const nameOf = new Map(mine.map((student) => [student.id, [student.firstName, student.lastName].filter(Boolean).join(" ")]));
    const armOf = new Map(mine.map((student) => [student.id, armName(student.currentClass?.name, student.currentClass?.arm)]));

    // This term's position per child: what a parent means by "the fees".
    const summary = mine.map((student) => {
      const theirs = invoices.filter((invoice) => invoice.studentId === student.id);
      const thisTerm = term ? theirs.filter((invoice) => invoice.termId === term.id) : theirs;
      const billed = thisTerm.reduce((sum, invoice) => sum + Number(invoice.total), 0);
      const balance = thisTerm.reduce((sum, invoice) => sum + Number(invoice.balance), 0);
      // What is actually owed is every unpaid invoice, not this term's. A bill
      // from an earlier term that was never settled is still owed, and a page
      // that says "nothing owed" while the overview says otherwise is a page a
      // parent stops trusting.
      const outstanding = theirs.reduce((sum, invoice) => sum + Number(invoice.balance), 0);
      const unpaid = theirs.filter((invoice) => Number(invoice.balance) > 0);
      const oldestDue = unpaid.map((invoice) => isoDay(invoice.dueOn)).sort()[0] ?? null;
      const overdue = unpaid.some((invoice) => invoice.dueOn.getTime() < Date.now());
      const fromEarlier = outstanding - balance;
      return {
        id: student.id,
        name: nameOf.get(student.id) ?? "",
        first: firstOf.get(student.id) ?? "",
        arm: armOf.get(student.id) ?? "",
        invoiceNo: thisTerm[0]?.invoiceNumber ?? "",
        term: thisTerm[0]?.term ? `${thisTerm[0]!.term!.name} ${thisTerm[0]!.term!.academicSession.name}` : term ? `${term.name} ${term.academicSession.name}` : "",
        billed,
        paid: billed - balance,
        balance,
        /** Every unpaid invoice, this term's and any earlier one's. */
        outstanding,
        /** How much of it belongs to a term that has already ended. */
        fromEarlier,
        oldestDue,
        status: outstanding <= 0 ? (billed ? "Paid in full" : "Nothing billed") : overdue ? "Overdue" : "Part paid",
        tone: outstanding <= 0 ? "positive" : overdue ? "negative" : "attention",
      };
    });

    return {
      children: summary,
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        childId: invoice.studentId,
        child: firstOf.get(invoice.studentId) ?? "",
        number: invoice.invoiceNumber,
        term: invoice.term ? `${invoice.term.name} ${invoice.term.academicSession.name}` : "",
        termId: invoice.termId,
        issued: isoDay(invoice.issuedOn),
        due: isoDay(invoice.dueOn),
        total: Number(invoice.total),
        discount: Number(invoice.discount),
        fine: Number(invoice.fine),
        balance: Number(invoice.balance),
        status: invoice.status,
        lines: invoice.items.map((item) => ({ description: item.description, amount: Number(item.amount), quantity: item.quantity })),
      })),
      payments: invoices.flatMap((invoice) =>
        invoice.payments.map((payment) => ({
          id: payment.id,
          childId: invoice.studentId,
          child: firstOf.get(invoice.studentId) ?? "",
          invoice: invoice.invoiceNumber,
          reference: payment.reference,
          receipt: payment.receipts[0]?.receiptNumber ?? null,
          amount: Number(payment.amount),
          method: payment.method,
          status: payment.status,
          paidAt: payment.paidAt ? isoDay(payment.paidAt) : null,
        })),
      ),
      plans: plans.map((plan) => ({
        id: plan.id,
        childId: plan.studentId,
        child: firstOf.get(plan.studentId) ?? "",
        number: plan.planNumber,
        total: Number(plan.totalAmount),
        balance: Number(plan.balance),
        status: plan.status,
        items: plan.items.map((item) => ({
          id: item.id,
          due: isoDay(item.dueOn),
          amount: Number(item.amount),
          paid: Number(item.paidAmount),
          status: item.status,
        })),
      })),
    };
  }
/* ───────────────────────── the switcher's own line ───────────────────────── */

  /**
   * What to say under each child's name in the top bar, for each page.
   *
   * The mockup changes this line with the page, and that is the whole point of
   * it: on Attendance a parent wants each child's attendance, on Fees each
   * child's balance. A single fixed line — their class, say — would waste the
   * one place in the portal that can answer "and the other one?" without a
   * second click.
   *
   * Pages whose module is not built yet get the child's class, which is true
   * and says nothing it cannot back up.
   */
  async switcher(session: SessionPayload) {
    const { children, term, policy, guardian } = await this.context(session);
    const ids = children.map((student) => student.id);
    const today = isoDay(new Date());

    const [needs, marks, termMarks, invoices, explanations] = await Promise.all([
      this.needs(session, "all"),
      ids.length
        ? prisma.studentAttendance.findMany({
            where: { schoolId: session.schoolId, studentId: { in: ids }, date: dayOf(today) },
            select: { studentId: true, status: true },
          })
        : Promise.resolve([]),
      ids.length && term
        ? prisma.studentAttendance.findMany({
            where: { schoolId: session.schoolId, studentId: { in: ids }, termId: term.id },
            select: { studentId: true, status: true, date: true },
          })
        : Promise.resolve([]),
      ids.length && policy.sees.has("Fees")
        ? prisma.invoice.findMany({
            where: { schoolId: session.schoolId, studentId: { in: ids }, balance: { gt: 0 }, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } },
            select: { studentId: true, balance: true, dueOn: true },
          })
        : Promise.resolve([]),
      prisma.guardianSubmission.findMany({
        where: { schoolId: session.schoolId, guardianId: guardian.id, type: { contains: "absence", mode: "insensitive" } },
        select: { studentId: true, dates: true },
      }),
    ]);
    const explainedDates = new Set(explanations.flatMap((row) => (row.dates ?? []).map((date) => `${row.studentId ?? ""}:${date}`)));

    const statFor = (id: string | null) => {
      const family = id === null;
      const mine = family ? children : children.filter((student) => student.id === id);
      const theirIds = new Set(mine.map((student) => student.id));
      // A child's own line counts what belongs to that child. A consent is the
      // family's, not one child's, so counting it against each of them would
      // make the line disagree with the badge beside it.
      const need = family ? needs.items : needs.items.filter((item) => item.childId === id);

      // Home: what is outstanding.
      const home: Stat = need.length
        ? [`${need.length} ${need.length === 1 ? "thing needs" : "things need"} you`, need.some((item) => item.tone === "negative") ? "negative" : "attention"]
        : ["All caught up", "positive"];

      // Attendance: who is in school, and what is still unexplained.
      const presentToday = marks.filter((mark) => theirIds.has(mark.studentId) && (mark.status === "PRESENT" || mark.status === "LATE")).length;
      const markedToday = marks.filter((mark) => theirIds.has(mark.studentId)).length;
      const theirTerm = termMarks.filter((mark) => theirIds.has(mark.studentId));
      const unexplained = theirTerm.filter((mark) => mark.status === "ABSENT" && !explainedDates.has(`${mark.studentId}:${isoDay(mark.date)}`)).length;
      const present = theirTerm.filter((mark) => mark.status === "PRESENT" || mark.status === "LATE").length;
      const pct = theirTerm.length ? `${Math.round((present / theirTerm.length) * 1000) / 10}%` : null;
      const attendance: Stat = !policy.sees.has("Attendance")
        ? ["", ""]
        : family
          ? markedToday
            ? [`${presentToday} of ${mine.length} in school${unexplained ? ` · ${unexplained} to explain` : ""}`, unexplained ? "attention" : "positive"]
            : [unexplained ? `${unexplained} to explain` : pct ? `${pct} this term` : "No register yet", unexplained ? "attention" : "positive"]
          : [pct ? `${pct} · ${unexplained ? `${unexplained} to explain` : "all explained"}` : "No register yet", unexplained ? "attention" : pct ? "positive" : ""];

      // Fees: the balance, and whether any of it is late.
      const theirInvoices = invoices.filter((invoice) => theirIds.has(invoice.studentId));
      const owed = theirInvoices.reduce((sum, invoice) => sum + Number(invoice.balance), 0);
      const late = theirInvoices.some((invoice) => invoice.dueOn.getTime() < Date.now());
      const withBalance = new Set(theirInvoices.map((invoice) => invoice.studentId)).size;
      const fees: Stat = !policy.sees.has("Fees")
        ? ["", ""]
        : family
          ? owed
            ? [`${late ? "Overdue · " : ""}${withBalance} with a balance`, late ? "negative" : "attention"]
            : ["All paid", "positive"]
          : owed
            ? [`${money(owed)}${late ? " · overdue" : ""}`, late ? "negative" : "attention"]
            : ["Paid in full", "positive"];

      const student = family ? null : mine[0];
      return {
        home,
        attendance,
        fees,
        /** Everything else, until its own page is built and brings its own line. */
        fallback: (family
          ? [`${children.length === 1 ? "1 child" : `${children.length} children`}`, ""]
          : [armName(student?.currentClass?.name, student?.currentClass?.arm), ""]) as Stat,
      };
    };

    return {
      family: statFor(null),
      children: Object.fromEntries(children.map((student) => [student.id, statFor(student.id)])),
    };
  }
/* ───────────────────────── attendance ───────────────────────── */

  /**
   * Every mark the school has made, for one child or the whole family.
   *
   * A parent asks three things of attendance: is my child in school today, how
   * has the term gone, and is there anything I still owe the school an
   * explanation for. The third is the one that matters most and the one a
   * school chases, so an absence with no reason against it is carried
   * separately rather than left to be counted out of a calendar.
   *
   * Late counts as present, because that is what the register means — a child
   * who arrived late was in school.
   */
  async attendance(session: SessionPayload, scope: string) {
    const { children, policy, guardian } = await this.context(session);
    if (!policy.sees.has("Attendance")) throw new ForbiddenException("Your school has not made attendance visible to parents.");
    const mine = scope === "all" ? children : children.filter((student) => student.id === scope);
    const ids = mine.map((student) => student.id);
    if (!ids.length) return { children: [], terms: [], days: [], explained: [] };

    const [terms, marks, explanations] = await Promise.all([
      prisma.term.findMany({
        where: { schoolId: session.schoolId },
        include: { academicSession: { select: { name: true } } },
        orderBy: { startDate: "asc" },
      }),
      prisma.studentAttendance.findMany({
        where: { schoolId: session.schoolId, studentId: { in: ids }, subjectId: null },
        select: { studentId: true, termId: true, date: true, status: true, reason: true, reasonCode: true, markedAt: true, markedBy: { select: { firstName: true, lastName: true } } },
        orderBy: { date: "desc" },
      }),
      // What the family has already written in about, so a mark the school has
      // not yet acted on is not counted against them twice.
      prisma.guardianSubmission.findMany({
        where: { schoolId: session.schoolId, guardianId: guardian.id, type: { contains: "absence", mode: "insensitive" } },
        select: { studentId: true, dates: true, state: true },
      }),
    ]);

    const explained = new Set(explanations.flatMap((row) => (row.dates ?? []).map((date) => `${row.studentId ?? ""}:${date}`)));
    const today = isoDay(new Date());
    const present = (status: string) => status === "PRESENT" || status === "LATE";

    // Only the terms this family actually has marks in, newest last.
    const termsWithMarks = terms.filter((term) => marks.some((mark) => mark.termId === term.id));

    const perChild = mine.map((student) => {
      const theirs = marks.filter((mark) => mark.studentId === student.id);
      const todayMark = theirs.find((mark) => isoDay(mark.date) === today) ?? null;
      const byTerm = termsWithMarks.map((term) => {
        const days = theirs.filter((mark) => mark.termId === term.id);
        const marked = days.length;
        const here = days.filter((mark) => present(mark.status)).length;
        const away = days.filter((mark) => !present(mark.status)).length;
        const late = days.filter((mark) => mark.status === "LATE").length;
        const unexplained = days.filter((mark) => mark.status === "ABSENT" && !explained.has(`${student.id}:${isoDay(mark.date)}`)).length;
        return {
          id: term.id,
          label: `${term.name} ${term.academicSession.name}`,
          short: term.name.replace(/ Term$/, ""),
          session: term.academicSession.name,
          start: isoDay(term.startDate),
          end: isoDay(term.endDate),
          current: Boolean(term.isCurrent),
          marked,
          present: here,
          away,
          late,
          unexplained,
          pct: marked ? Math.round((here / marked) * 1000) / 10 : null,
        };
      });
      return {
        id: student.id,
        name: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
        first: student.firstName,
        arm: armName(student.currentClass?.name, student.currentClass?.arm),
        today: todayMark ? { status: todayMark.status, reason: todayMark.reason, at: todayMark.markedAt ? todayMark.markedAt.toISOString() : null } : null,
        terms: byTerm,
      };
    });

    return {
      children: perChild,
      /** Every mark, so a page can draw a calendar or a list without asking again. */
      days: marks.map((mark) => ({
        childId: mark.studentId,
        termId: mark.termId,
        date: isoDay(mark.date),
        status: mark.status,
        reason: mark.reason,
        code: mark.reasonCode,
        by: mark.markedBy ? `${mark.markedBy.firstName} ${mark.markedBy.lastName}` : "",
        at: mark.markedAt ? mark.markedAt.toISOString() : null,
        /** The family has written in about this one; the school has not changed the mark yet. */
        explained: explained.has(`${mark.studentId}:${isoDay(mark.date)}`),
      })),
      today,
    };
  }

  /* ───────────────────────── what is coming, and what was agreed ───────────────────────── */

  /**
   * Everything dated that concerns this family: the school's own calendar, each child's examinations, the days results are
   * released, meetings, the date a balance falls due, and the term's own start and end.
   *
   * The school's calendar is read as a guardian reads it: an event is shown only if the school marked it visible to guardians
   * (or, where it never marked anything, wrote an audience that includes them). Each carries the children it concerns.
   */
  async calendar(session: SessionPayload, scope: string) {
    const { guardian, children, term, policy } = await this.context(session);
    const mine = scope === "all" ? children : children.filter((student) => student.id === scope);
    const ids = mine.map((student) => student.id);
    const classIds = [...new Set(mine.map((student) => student.currentClassId).filter((id): id is string => Boolean(id)))];
    const from = new Date(Date.now() - 45 * DAY);
    const tag = (list: typeof mine) => (list.length ? list : mine).map((student) => ({ id: student.id, first: student.firstName }));
    const [events, exams, windows, meetings, invoices] = await Promise.all([
      prisma.calendarEvent.findMany({ where: { schoolId: session.schoolId, endsAt: { gte: from } }, orderBy: { startsAt: "asc" }, take: 300 }),
      classIds.length ? prisma.examTimetableEntry.findMany({ where: { schoolId: session.schoolId, classId: { in: classIds }, examDate: { gte: from } }, include: { subject: true }, orderBy: { examDate: "asc" } }) : Promise.resolve([]),
      term && policy.sees.has("Results") ? prisma.assessmentWindow.findMany({ where: { schoolId: session.schoolId, termId: term.id }, include: { component: true } }) : Promise.resolve([]),
      prisma.parentMeeting.findMany({ where: { schoolId: session.schoolId, guardianId: guardian.id, deletedAt: null, scheduledAt: { gte: from } }, orderBy: { scheduledAt: "asc" } }),
      policy.sees.has("Fees") && ids.length ? prisma.invoice.findMany({ where: { schoolId: session.schoolId, studentId: { in: ids }, balance: { gt: 0 }, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] }, dueOn: { gte: from } }, select: { id: true, studentId: true, invoiceNumber: true, dueOn: true } }) : Promise.resolve([]),
    ]);
    const kindOf = (type: string, closed: boolean) => (closed || /holiday|closure/i.test(type) ? "Holiday" : /exam|test|assess/i.test(type) ? "Assessment" : /meeting|conference|pta/i.test(type) ? "Meeting" : /trip|excursion/i.test(type) ? "Trip" : /deadline/i.test(type) ? "Notice" : "Event");
    const forGuardians = (event: (typeof events)[number]) => (event.visibleTo.length ? event.visibleTo.includes("Guardians") : /all|guardian|parent/i.test(event.audience));
    const out: Array<{ id: string; date: string; end: string; title: string; cat: string; time: string; where: string; note: string; kids: Array<{ id: string; first: string }> }> = [];
    for (const event of events.filter(forGuardians)) {
      out.push({ id: event.id, date: isoDay(event.startsAt), end: isoDay(event.endsAt), title: event.title, cat: kindOf(event.type, event.schoolClosed), time: event.allDay ? "All day" : [event.startTime, event.endTime].filter(Boolean).join(" – "), where: event.location ?? "", note: event.description ?? "", kids: tag([]) });
    }
    for (const exam of exams) {
      out.push({ id: `x-${exam.id}`, date: isoDay(exam.examDate), end: isoDay(exam.examDate), title: `${exam.subject.name} examination`, cat: "Assessment", time: `${exam.startsAt} – ${exam.endsAt}`, where: exam.venue ?? "", note: "", kids: tag(mine.filter((student) => student.currentClassId === exam.classId)) });
    }
    for (const window of windows) {
      out.push({ id: `r-${window.id}`, date: isoDay(window.releaseAt), end: isoDay(window.releaseAt), title: `${window.component.name} results released`, cat: "Results", time: "", where: "", note: "", kids: tag([]) });
    }
    for (const meeting of meetings.filter((item) => item.status !== "CANCELLED")) {
      const child = mine.find((student) => student.id === meeting.studentId);
      if (meeting.studentId && !child) continue;
      out.push({ id: `m-${meeting.id}`, date: isoDay(meeting.scheduledAt), end: isoDay(meeting.scheduledAt), title: meeting.title, cat: "Meeting", time: meeting.scheduledAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }), where: "", note: meeting.notes ?? "", kids: tag(child ? [child] : []) });
    }
    for (const invoice of invoices) {
      const child = mine.find((student) => student.id === invoice.studentId);
      out.push({ id: `f-${invoice.id}`, date: isoDay(invoice.dueOn), end: isoDay(invoice.dueOn), title: `Fees due · ${invoice.invoiceNumber}`, cat: "Fees", time: "", where: "", note: "", kids: tag(child ? [child] : []) });
    }
    if (term) {
      out.push({ id: `t-start-${term.id}`, date: isoDay(term.startDate), end: isoDay(term.startDate), title: `${term.name} begins`, cat: "Term", time: "", where: "", note: "", kids: tag([]) });
      out.push({ id: `t-end-${term.id}`, date: isoDay(term.endDate), end: isoDay(term.endDate), title: `${term.name} ends`, cat: "Term", time: "", where: "", note: "", kids: tag([]) });
    }
    return { today: isoDay(new Date()), term: term ? { name: term.name, start: isoDay(term.startDate), end: isoDay(term.endDate) } : null, events: out.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)) };
  }

  /**
   * Meetings the school has set with this family, meetings they asked for, and what was agreed in the ones already held.
   *
   * A meeting the school proposes shows as waiting for an answer until the family says whether they can come; their answer is
   * recorded on the meeting itself, and the person who set it up is told.
   */
  async meetings(session: SessionPayload, scope: string) {
    const { guardian, children } = await this.context(session);
    const rows = await prisma.parentMeeting.findMany({
      where: { schoolId: session.schoolId, guardianId: guardian.id, deletedAt: null },
      include: { student: { select: { id: true, firstName: true } }, staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { scheduledAt: "asc" },
    });
    const now = Date.now();
    const asked = await prisma.guardianSubmission.findMany({
      where: { schoolId: session.schoolId, guardianId: guardian.id, type: "Meeting request", ...(scope === "all" ? {} : { OR: [{ studentId: scope }, { studentId: null }] }) },
      orderBy: { createdAt: "desc" }, take: 20, include: { student: { select: { firstName: true } } },
    });
    return {
      today: isoDay(new Date()),
      children: children.map((student) => ({ id: student.id, first: student.firstName })),
      meetings: rows.filter((row) => scope === "all" || !row.studentId || row.studentId === scope).map((row) => ({
        id: row.id, title: row.title, at: row.scheduledAt.toISOString(), date: isoDay(row.scheduledAt),
        time: row.scheduledAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }),
        status: row.status, notes: row.notes, childId: row.studentId, child: row.student?.firstName ?? null,
        with: row.staff?.user ? `${row.staff.user.firstName} ${row.staff.user.lastName}` : null,
        past: row.scheduledAt.getTime() < now, answerable: row.scheduledAt.getTime() >= now && ["INVITED", "SCHEDULED"].includes(row.status),
      })),
      asked: asked.map((row) => ({ id: row.id, type: row.type, detail: row.detail, state: stateWord(row.state), owner: row.ownerName, role: row.ownerRole, opened: isoDay(row.createdAt), child: row.student?.firstName ?? null, outcome: row.outcome })),
    };
  }

  /** The family answers a meeting the school proposed: they can come, or they cannot. */
  async respondMeeting(session: SessionPayload, id: string, body: unknown) {
    const input = z.object({ answer: z.enum(["CONFIRMED", "DECLINED"]) }).parse(body);
    const { guardian } = await this.context(session);
    const row = await prisma.parentMeeting.findFirst({ where: { id, schoolId: session.schoolId, guardianId: guardian.id, deletedAt: null } });
    if (!row) throw new NotFoundException("That meeting is not one of yours.");
    if (row.scheduledAt.getTime() < Date.now()) throw new BadRequestException("That meeting has already taken place.");
    if (row.status === input.answer) return { id, status: row.status };
    await prisma.parentMeeting.update({ where: { id }, data: { status: input.answer } });
    if (row.scheduledById) {
      await prisma.notificationLog.create({
        data: {
          schoolId: session.schoolId, userId: row.scheduledById, channel: "IN_APP", status: "SENT", sentAt: new Date(),
          title: `${guardian.firstName} ${guardian.lastName} ${input.answer === "CONFIRMED" ? "can come to" : "cannot come to"} “${row.title}”`,
          body: `The meeting is on ${isoDay(row.scheduledAt)}. The family answered through the parent portal.`,
        },
      });
    }
    return { id, status: input.answer };
  }

  /* ───────────────────────── what the school has written ───────────────────────── */

  /**
   * Every message the school has sent this family, in full, with what has been read and answered.
   *
   * A message is written to the family, not to one child, so it is tagged with the children it concerns: the ones in the class it was
   * sent to when it was sent to a class, and every child when it was sent to everyone. Its heading is its own first line, since a
   * school writes a message as plain text, and its kind is read from its words — a safety message is marked as one.
   */
  async messages(session: SessionPayload, scope: string) {
    const { guardian, children, school } = await this.context(session);
    const rows = await prisma.messageDelivery.findMany({
      where: { guardianId: guardian.id, schoolId: session.schoolId, status: { in: ["DELIVERED", "PENDING"] }, campaign: { status: "SENT" } },
      orderBy: { createdAt: "desc" }, take: 120, include: { campaign: { select: { sentAt: true, createdAt: true, audience: true, channel: true } } },
    });
    const replies = rows.length ? await prisma.guardianSubmission.findMany({ where: { guardianId: guardian.id, deliveryId: { in: rows.map((row) => row.id) } }, orderBy: { createdAt: "asc" } }) : [];
    const items = rows.map((row) => {
      const audience = (row.campaign.audience ?? {}) as { classIds?: string[]; guardianIds?: string[] };
      const about = audience.classIds?.length
        ? children.filter((student) => student.currentClassId && audience.classIds!.includes(student.currentClassId))
        : children;
      const text = row.body ?? "";
      const first = (text.split(/\n/)[0] ?? text).trim();
      const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
      return {
        id: row.id, title: first.length > 80 ? `${first.slice(0, 77)}…` : first,
        preview: (lines[1] ?? lines[0] ?? "").slice(0, 140), body: lines.length > 1 ? lines.slice(1) : lines, category: categoryOfMessage(text),
        at: (row.campaign.sentAt ?? row.campaign.createdAt).toISOString(), channel: row.channel ?? row.campaign.channel ?? "IN_APP",
        read: Boolean(row.readAt), acknowledgeAsked: row.acknowledgeAsked, acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
        children: (about.length ? about : children).map((student) => ({ id: student.id, first: student.firstName })),
        replies: replies.filter((reply) => reply.deliveryId === row.id).map((reply) => ({ id: reply.id, text: reply.detail, at: reply.createdAt.toISOString(), state: stateWord(reply.state), outcome: reply.outcome })),
      };
    });
    const mine = scope === "all" ? items : items.filter((item) => item.children.some((child) => child.id === scope));
    return { school: school?.name ?? "Your school", you: `${guardian.firstName} ${guardian.lastName}`, unread: mine.filter((item) => !item.read).length, items: mine };
  }

  /* ───────────────────────── what this family has agreed to ───────────────────────── */

  /**
   * Every consent the school holds from this family, and what each one has been recorded as.
   *
   * A consent is recorded against the family, never the child — one guardian answers once, however many children they
   * have at the school — and each line says who recorded it and how. A school's own list of consent types is what is
   * shown; one marked required is the basis on which the school holds the record at all, so a parent cannot switch it
   * off here and is pointed to a conversation with the school instead.
   */
  async consents(session: SessionPayload) {
    const { guardian } = await this.context(session);
    const [types, rows] = await Promise.all([
      loadConsentTypes(session.schoolId),
      prisma.familyConsent.findMany({ where: { schoolId: session.schoolId, guardianId: guardian.id } }),
    ]);
    const recorders = rows.map((row) => row.recordedById).filter((id): id is string => Boolean(id));
    const people = recorders.length ? new Map((await prisma.user.findMany({ where: { id: { in: recorders } }, select: { id: true, firstName: true, lastName: true } })).map((user) => [user.id, `${user.firstName} ${user.lastName}`])) : new Map<string, string>();
    return {
      types: types.map((type) => {
        const row = rows.find((item) => item.typeCode === type.code) ?? null;
        const means = row?.means === "PORTAL" ? "in the portal" : row?.means === "PAPER" ? "on paper" : row?.means === "IN_PERSON" ? "in person" : "";
        return {
          code: type.code, name: type.name, covers: type.covers, blocks: type.blocks, required: type.required, who: type.who,
          state: !row ? "Not recorded" : row.status === "GIVEN" ? "Given" : row.status === "WITHDRAWN" ? "Withdrawn" : "Declined",
          on: row ? isoDay(row.recordedAt) : null,
          how: row ? [row.status === "GIVEN" && means ? `Given ${means}` : "", row.recordedById ? `recorded by ${row.recordedById === session.userId ? "you" : people.get(row.recordedById) ?? "the school"}` : ""].filter(Boolean).join(" · ") : null,
        };
      }),
    };
  }

  /** The family gives, declines or withdraws one consent. It is recorded at once, and the change is kept in the school's audit log. */
  async setConsent(session: SessionPayload, body: unknown) {
    const input = z.object({ code: z.string().min(1), status: z.enum(["GIVEN", "WITHDRAWN", "NOT_GIVEN"]) }).parse(body);
    const { guardian } = await this.context(session);
    const types = await loadConsentTypes(session.schoolId);
    const type = types.find((item) => item.code === input.code);
    if (!type) throw new NotFoundException("The school does not ask for that consent.");
    if (type.required && input.status !== "GIVEN") {
      throw new BadRequestException(`${type.name} is what lets the school hold your child’s record, so it cannot be switched off here. Ask to speak to the school if you want to change it.`);
    }
    const existing = await prisma.familyConsent.findUnique({ where: { guardianId_typeCode: { guardianId: guardian.id, typeCode: type.code } } });
    if (existing?.status === input.status) return { code: type.code, state: input.status, changed: false };
    const stamp = new Date();
    await prisma.familyConsent.upsert({
      where: { guardianId_typeCode: { guardianId: guardian.id, typeCode: type.code } },
      update: { status: input.status, means: input.status === "GIVEN" ? "PORTAL" : existing?.means ?? null, recordedById: session.userId, recordedAt: stamp, note: null },
      create: { schoolId: session.schoolId, guardianId: guardian.id, typeCode: type.code, status: input.status, means: input.status === "GIVEN" ? "PORTAL" : null, recordedById: session.userId, recordedAt: stamp },
    });
    await prisma.auditLog.create({
      data: {
        schoolId: session.schoolId, actorId: session.userId, action: "UPDATE", entityType: "Consent", entityId: guardian.id,
        metadata: { summary: `Consent ${input.status === "GIVEN" ? "given" : input.status === "WITHDRAWN" ? "withdrawn" : "declined"} by the family · ${type.name}`, by: "portal" } as Prisma.InputJsonValue,
      },
    });
    return { code: type.code, state: input.status, changed: true };
  }

  /* ───────────────────────── what this family has asked the school ───────────────────────── */

  /**
   * Everything this family has sent the school, who has it, and when an answer was promised.
   *
   * Each request goes to one named person and has a clock from the day it arrives: the school's own target for its type, counted
   * in school days. A request is closed only with a written outcome, so the outcome is shown beside it. The steps shown are the
   * ones the school's records actually hold — sent, with whom, and closed — never a story filled in around them.
   */
  async requests(session: SessionPayload, scope: string) {
    const { guardian, children } = await this.context(session);
    const types = await submissionTypes(session.schoolId);
    const mine = scope === "all" ? null : children.find((student) => student.id === scope) ?? null;
    const rows = await prisma.guardianSubmission.findMany({
      where: {
        schoolId: session.schoolId, guardianId: guardian.id, deliveryId: null,
        ...(mine ? { OR: [{ studentId: mine.id }, { studentId: null }] } : {}),
      },
      orderBy: { createdAt: "desc" }, take: 80,
      include: { student: { select: { id: true, firstName: true } } },
    });
    const target = new Map(types.map((type) => [type.name, type.target]));
    const today = isoDay(new Date());
    const items = rows.map((row) => {
      const open = row.state !== "RESOLVED" && row.state !== "DECLINED";
      const withdrawn = row.state === "DECLINED" && /^withdrawn by/i.test(row.outcome ?? "");
      const days = target.get(row.type) ?? 0;
      const due = days ? addSchoolDays(isoDay(row.createdAt), days) : null;
      return {
        id: row.id, type: row.type, detail: row.detail, evidence: row.evidence, dates: row.dates,
        childId: row.studentId, child: row.student?.firstName ?? null,
        state: withdrawn ? "Withdrawn" : stateWord(row.state), open,
        owner: row.ownerName, role: row.ownerRole, outcome: row.outcome,
        opened: isoDay(row.createdAt), closed: row.resolvedAt ? isoDay(row.resolvedAt) : null,
        due, late: open && Boolean(due) && due! < today, channel: row.channel,
      };
    });
    const answered = items.filter((item) => item.closed && item.state !== "Withdrawn");
    const typical = answered.length
      ? Math.round((answered.reduce((sum, item) => sum + (dayOf(item.closed!).getTime() - dayOf(item.opened).getTime()) / DAY, 0) / answered.length) * 10) / 10
      : null;
    return {
      today, items, typical,
      types: types.map((type) => ({ name: type.name, days: type.target, reviewer: type.reviewer, accepted: type.accepted })),
      children: children.map((student) => ({ id: student.id, first: student.firstName, name: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ") })),
    };
  }

  /** A family withdraws a request they no longer need. It closes now, and the owner is told. */
  async withdrawRequest(session: SessionPayload, id: string) {
    const { guardian } = await this.context(session);
    const row = await prisma.guardianSubmission.findFirst({ where: { id, guardianId: guardian.id, schoolId: session.schoolId } });
    if (!row) throw new NotFoundException("That request is not one of yours.");
    if (row.state === "RESOLVED" || row.state === "DECLINED") throw new BadRequestException("That request is already closed.");
    const stamp = new Date();
    await prisma.guardianSubmission.update({ where: { id }, data: { state: "DECLINED", outcome: `Withdrawn by the family on ${isoDay(stamp)}.`, resolvedAt: stamp } });
    if (row.ownerUserId) {
      await prisma.notificationLog.create({
        data: { schoolId: session.schoolId, userId: row.ownerUserId, channel: "IN_APP", title: `A family withdrew their ${row.type.toLowerCase()}`, body: `${guardian.firstName} ${guardian.lastName} no longer needs it answered.`, status: "SENT", sentAt: stamp },
      });
    }
    return { id, state: "Withdrawn" };
  }

  /* ───────────────────────── how each child is doing ───────────────────────── */

  /**
   * Each child's published report cards, and what has been released since the last one.
   *
   * A report card is the school's own snapshot, so it is read as it was published — a score changing later does not
   * change what a family holds. A card the school is withholding (an unpaid balance, say) is listed as held with the
   * school's reason and carries no marks. What has been released this term is only what an approved score sheet and
   * its release date allow, exactly as a student sees it: a draft or an unreleased mark is never shown.
   */
  async results(session: SessionPayload, scope: string) {
    const { children, policy, term } = await this.context(session);
    if (!policy.sees.has("Results")) throw new ForbiddenException("Your school has not made results visible to parents.");
    const mine = scope === "all" ? children : children.filter((student) => student.id === scope);
    const ids = mine.map((student) => student.id);
    const showCards = policy.sees.has("Report cards");
    if (!ids.length) return { children: [], components: [], ahead: [], showCards, term: term ? { name: term.name, session: term.academicSession.name } : null };

    const classIds = [...new Set(mine.map((student) => student.currentClassId).filter((id): id is string => Boolean(id)))];
    const [cards, sheets, components, windows] = await Promise.all([
      showCards
        ? prisma.reportCard.findMany({
            where: { schoolId: session.schoolId, studentId: { in: ids }, status: { in: ["PUBLISHED", "LOCKED"] }, publishedAt: { not: null } },
            include: { term: { include: { academicSession: true } } },
            orderBy: { publishedAt: "desc" },
          })
        : Promise.resolve([]),
      term && classIds.length ? prisma.scoreSheet.findMany({ where: { schoolId: session.schoolId, termId: term.id, classId: { in: classIds }, status: "APPROVED" }, select: { classId: true, subjectId: true } }) : Promise.resolve([]),
      term ? prisma.assessmentComponent.findMany({ where: { schoolId: session.schoolId, isActive: true, OR: [{ termId: term.id }, { termId: null }] }, orderBy: { order: "asc" } }) : Promise.resolve([]),
      term ? prisma.assessmentWindow.findMany({ where: { schoolId: session.schoolId, termId: term.id }, select: { componentId: true, releaseAt: true, appliesTo: true } }) : Promise.resolve([]),
    ]);
    const entries = term && sheets.length
      ? await prisma.scoreEntry.findMany({
          where: { schoolId: session.schoolId, studentId: { in: ids }, isDraft: false, resultSheet: { termId: term.id }, subjectId: { in: [...new Set(sheets.map((sheet) => sheet.subjectId))] } },
          select: { studentId: true, subjectId: true, assessmentComponentId: true, score: true, maxScore: true, subject: { select: { name: true } } },
        })
      : [];
    const now = Date.now();

    return {
      showCards,
      term: term ? { name: term.name, session: term.academicSession.name } : null,
      components: components.map((component) => ({ id: component.id, code: component.code, name: component.name, weight: component.weight, max: component.maxScore })),
      /** The days the school will release a set of scores, soonest first. */
      ahead: windows
        .filter((window) => window.releaseAt.getTime() > now)
        .sort((a, b) => a.releaseAt.getTime() - b.releaseAt.getTime())
        .map((window) => ({ what: components.find((component) => component.id === window.componentId)?.name ?? "Scores", on: isoDay(window.releaseAt), appliesTo: window.appliesTo })),
      children: mine.map((student) => {
        const arm = armName(student.currentClass?.name, student.currentClass?.arm);
        const released = new Set(sheets.filter((sheet) => sheet.classId === student.currentClassId).map((sheet) => sheet.subjectId));
        const releaseOf = new Map(windows.filter((window) => /^every class$/i.test(window.appliesTo) || window.appliesTo.toLowerCase().includes(arm.toLowerCase())).map((window) => [window.componentId, window.releaseAt]));
        const mineEntries = entries.filter((entry) => entry.studentId === student.id && released.has(entry.subjectId));
        const subjects = new Map<string, { name: string; parts: Array<{ code: string; name: string; max: number; score: number | null; on: string | null }> }>();
        for (const entry of mineEntries) {
          const component = components.find((item) => item.id === entry.assessmentComponentId);
          if (!component) continue;
          const at = releaseOf.get(component.id) ?? null;
          const open = !at || at.getTime() <= now;
          const slot = subjects.get(entry.subjectId) ?? { name: entry.subject.name, parts: [] };
          slot.parts.push({ code: component.code, name: component.name, max: entry.maxScore, score: open ? entry.score : null, on: at ? isoDay(at) : null });
          subjects.set(entry.subjectId, slot);
        }
        return {
          id: student.id, first: student.firstName, arm,
          cards: cards.filter((card) => card.studentId === student.id).map((card) => {
            const held = card.withheldAt ? { since: isoDay(card.withheldAt), reason: card.withheldReason ?? "" } : null;
            const data = !held && (card.data as { version?: number } | null)?.version === 2 ? (card.data as unknown as PublishedCard) : null;
            return {
              id: card.id, term: card.term.name, session: card.term.academicSession.name, published: isoDay(card.publishedAt!), reference: card.reference ?? null, held,
              card: data
                ? {
                    arm: data.arm ? `${data.className} ${data.arm}`.trim() : data.className, formMaster: data.formMaster, average: data.average, grade: data.grade, gradeRemark: data.gradeRemark,
                    position: data.position, outOf: data.outOf, attendance: data.attendance, scheme: data.scheme, frameworkNote: data.frameworkNote,
                    teacherRemark: data.classTeacherRemark, teacherBy: data.classTeacherBy, principalRemark: data.principalRemark, principalBy: data.principalBy, resumption: data.resumption,
                    traits: data.traits,
                    subjects: data.subjects.map((subject) => ({ name: subject.subject, teacher: subject.teacher, components: subject.components, total: subject.total, grade: subject.grade, remark: subject.remark, pos: subject.pos, outOf: subject.outOf, classAvg: subject.classAvg })),
                  }
                : null,
            };
          }),
          released: [...subjects.values()].sort((a, b) => a.name.localeCompare(b.name)),
        };
      }),
    };
  }

  /* ───────────────────────── where each child is in the week ───────────────────────── */

  /**
   * Each child's published timetable, what each teacher is teaching this week and next, and the tests and examinations ahead.
   *
   * Only what the school has published reaches a parent: a timetable that is not published is not shown, and a topic comes from a
   * scheme of work only once it has been approved — a teacher's draft is not a promise to a family.
   */
  async learning(session: SessionPayload, scope: string) {
    const { children, policy, term } = await this.context(session);
    if (!policy.sees.has("Timetable")) throw new ForbiddenException("Your school has not made the timetable visible to parents.");
    const mine = scope === "all" ? children : children.filter((student) => student.id === scope);
    const classIds = [...new Set(mine.map((student) => student.currentClassId).filter((id): id is string => Boolean(id)))];
    if (!classIds.length || !term) return { week: 0, weeks: 0, today: isoDay(new Date()), components: [], tests: [], children: mine.map((student) => emptyLearning(student)) };

    const today = isoDay(new Date());
    const weeks = Math.max(1, Math.ceil((term.endDate.getTime() - term.startDate.getTime()) / (7 * DAY)));
    const week = Math.min(weeks, Math.max(1, Math.floor((dayOf(today).getTime() - dayOf(isoDay(term.startDate)).getTime()) / (7 * DAY)) + 1));
    const [entries, exams, components, schemes, events] = await Promise.all([
      prisma.timetableEntry.findMany({
        where: { schoolId: session.schoolId, classId: { in: classIds }, termId: term.id, isPublished: true },
        include: { subject: true },
        orderBy: [{ dayOfWeek: "asc" }, { periodNumber: "asc" }],
      }),
      prisma.examTimetableEntry.findMany({
        where: { schoolId: session.schoolId, classId: { in: classIds }, OR: [{ termId: term.id }, { termId: null }], examDate: { gte: dayOf(today) } },
        include: { subject: true },
        orderBy: { examDate: "asc" },
      }),
      prisma.assessmentComponent.findMany({ where: { schoolId: session.schoolId, isActive: true, OR: [{ termId: term.id }, { termId: null }] }, orderBy: { order: "asc" } }),
      prisma.schemeOfWork.findMany({
        where: { schoolId: session.schoolId, classId: { in: classIds }, termId: term.id, status: "APPROVED" },
        include: { subject: { select: { name: true } }, topics: { select: { weekNumber: true, topic: true, weekType: true } } },
      }),
      prisma.calendarEvent.findMany({
        where: {
          schoolId: session.schoolId, endsAt: { gte: dayOf(today) },
          OR: ["exam", "test", "assess"].map((word) => ({ type: { contains: word, mode: "insensitive" as const } })),
        },
        orderBy: { startsAt: "asc" }, take: 40,
      }),
    ]);
    const teacherIds = [...new Set([...entries.map((entry) => entry.teacherId), ...schemes.map((scheme) => scheme.teacherId)].filter((id): id is string => Boolean(id)))];
    const teachers = teacherIds.length
      ? new Map((await prisma.user.findMany({ where: { id: { in: teacherIds } }, select: { id: true, firstName: true, lastName: true } })).map((person) => [person.id, `${person.firstName} ${person.lastName}`]))
      : new Map<string, string>();
    const taught = (scheme: (typeof schemes)[number], number: number) => scheme.topics.find((topic) => topic.weekNumber === number && topic.weekType === "TEACHING")?.topic ?? null;

    return {
      week, weeks, today,
      term: { name: term.name, session: term.academicSession.name },
      components: components.map((component) => ({ code: component.code, name: component.name, weight: component.weight, max: component.maxScore })),
      /** Tests and assessment weeks the school put on its calendar for families — not tied to one child's class. */
      tests: events
        .filter((event) => (event.visibleTo.length ? event.visibleTo.includes("Guardians") : /all|guardian|parent/i.test(event.audience)))
        .map((event) => ({ id: event.id, title: event.title, date: isoDay(event.startsAt), end: isoDay(event.endsAt), time: event.allDay ? "All day" : [event.startTime, event.endTime].filter(Boolean).join(" – "), where: event.location ?? "" })),
      children: mine.map((student) => {
        const own = entries.filter((entry) => entry.classId === student.currentClassId);
        const slots = own.map((entry) => ({
          day: entry.dayOfWeek, n: entry.periodNumber, from: entry.startsAt, to: entry.endsAt,
          kind: entry.slotType === "lesson" && entry.subjectId ? "lesson" : "break",
          subject: entry.subject?.name ?? (entry.slotType === "lesson" ? "Free period" : entry.slotType.charAt(0).toUpperCase() + entry.slotType.slice(1)),
          teacher: entry.teacherId ? teachers.get(entry.teacherId) ?? "" : "", lab: /lab/i.test(entry.venue ?? ""),
        }));
        const seen = new Set<string>();
        const periods = slots
          .filter((slot) => (seen.has(`${slot.n}|${slot.kind}|${slot.from}`) ? false : (seen.add(`${slot.n}|${slot.kind}|${slot.from}`), true)))
          .map((slot) => ({ n: slot.n, from: slot.from, to: slot.to, kind: slot.kind }))
          .sort((a, b) => a.from.localeCompare(b.from));
        return {
          id: student.id, first: student.firstName, arm: armName(student.currentClass?.name, student.currentClass?.arm),
          published: own.length > 0, slots, periods,
          topics: schemes
            .filter((scheme) => scheme.classId === student.currentClassId)
            .map((scheme) => ({ subject: scheme.subject.name, teacher: scheme.teacherId ? teachers.get(scheme.teacherId) ?? "" : "", now: taught(scheme, week), next: taught(scheme, week + 1) }))
            .sort((a, b) => a.subject.localeCompare(b.subject)),
          exams: exams
            .filter((exam) => exam.classId === student.currentClassId)
            .map((exam) => ({ id: exam.id, subject: exam.subject.name, date: isoDay(exam.examDate), from: exam.startsAt, to: exam.endsAt, venue: exam.venue ?? "" })),
        };
      }),
    };
  }

  /* ───────────────────────── the parent's own account ───────────────────────── */

  /**
   * Who this parent is on the school's books, and how they sign in.
   *
   * The sign-in ID is the one the school issued; the phone and email are the guardian's own record
   * (a parent changes them by asking the school, never directly, because the school's own contact
   * list is what it rings in an emergency).
   */
  async account(session: SessionPayload) {
    const { guardian, school, children } = await this.context(session);
    const site = await prisma.school.findUnique({ where: { id: session.schoolId }, select: { name: true, shortName: true, city: true, state: true, timezone: true } });
    const user = guardian.user;
    const mine = guardian.students;
    return {
      name: `${guardian.firstName} ${guardian.lastName}`,
      userId: user?.userCode ?? user?.username ?? null,
      relationship: guardian.relationship,
      primaryFor: mine.filter((link) => link.isPrimary).map((link) => link.student.firstName),
      email: guardian.email ?? user?.email ?? null,
      phone: guardian.phone,
      address: guardian.address ?? null,
      timezone: site?.timezone ?? "Africa/Lagos",
      language: guardian.language,
      since: isoDay(user?.createdAt ?? guardian.createdAt),
      sms: guardian.canReceiveSms,
      emailOn: guardian.canReceiveEmail,
      schools: [{
        name: school?.name ?? "", short: site?.shortName?.trim() || school?.name || "", place: [site?.city, site?.state].filter(Boolean).join(", "),
        children: children.map((student) => student.firstName),
      }],
    };
  }

  /** Sign-in protection and the last times this account was used. */
  async security(session: SessionPayload) {
    this.assert(session);
    const user = await prisma.user.findFirst({
      where: { id: session.userId, schoolId: session.schoolId, deletedAt: null },
      select: { mfaEnabled: true, mfaEnrolledAt: true, passwordChangedAt: true, passwordResetRequired: true, phone: true },
    });
    if (!user) throw new NotFoundException("No account found.");
    const attempts = await prisma.loginAttempt.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "desc" }, take: 12 });
    return {
      mustChangePassword: user.passwordResetRequired,
      mfaEnabled: user.mfaEnabled,
      mfaEnrolledAt: user.mfaEnrolledAt?.toISOString() ?? null,
      passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
      signIns: attempts.map((attempt) => ({
        id: attempt.id, at: attempt.createdAt.toISOString(), success: attempt.success, device: deviceName(attempt.device),
        where: attempt.location || hide(attempt.ipAddress), newDevice: attempt.newDevice, reason: attempt.success ? null : attempt.reason,
      })),
    };
  }

  /** The devices this account is signed in on. The hash of the token this request arrived with says which one is this one. */
  async sessions(session: SessionPayload, currentTokenHash: string | undefined) {
    this.assert(session);
    const rows = await prisma.platformSession.findMany({
      where: { userId: session.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastActivityAt: "desc" },
      take: 10,
    });
    return rows.map((row) => ({
      id: row.id, device: deviceName(row.device), where: hide(row.ipAddress),
      lastActiveAt: row.lastActivityAt.toISOString(), startedAt: row.createdAt.toISOString(),
      current: Boolean(currentTokenHash) && row.tokenHash === currentTokenHash,
    }));
  }

  /** Sign a device out. The one being used is refused — leaving it is Sign out at the top of the page. */
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

  /**
   * A parent asks the school to change the contact details it holds for them, or for a copy of what it holds.
   * Both are requests a person at the school answers: the contact list is what the school rings in an
   * emergency, so a parent proposes a change and the school confirms it, and a copy of the data is
   * prepared by the registrar.
   */
  async requestAccount(session: SessionPayload, body: unknown) {
    const input = accountRequestSchema.parse(body);
    const { guardian } = await this.context(session);
    if (input.kind === "copy") {
      return openSubmission(session.schoolId, {
        guardianId: guardian.id, type: "Data copy request", channel: "Portal",
        detail: `I would like a copy of what the school holds about me and my children${input.note ? `. ${input.note}` : "."}`,
      });
    }
    const changes = [
      input.phone && `phone number to ${input.phone}`,
      input.email && `email to ${input.email}`,
      input.address && `home address to ${input.address}`,
    ].filter(Boolean);
    if (!changes.length) throw new BadRequestException("Say what should change — a phone number, an email or an address.");
    return openSubmission(session.schoolId, {
      guardianId: guardian.id, type: "Contact update", channel: "Portal",
      detail: `Please change my ${changes.join(", ")}.${input.note ? ` ${input.note}` : ""}`,
    });
  }

  /* ───────────────────────── what reaches this parent ───────────────────────── */

  /**
   * Which kinds of school message reach this parent by SMS and email, and when they would rather not be disturbed.
   *
   * The choices are kept on the parent's own account, the same place the delivery worker already reads quiet hours from, and the
   * school's send path reads them before it counts a family as reached — so a switch here changes what is sent, not just what is shown.
   */
  async notifications(session: SessionPayload) {
    const { guardian } = await this.context(session);
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { preferences: true } });
    const prefs = (user?.preferences ?? {}) as Preferences;
    return {
      matrix: prefs.familyNotify ?? {},
      quiet: prefs.quietHours ?? "None",
      quietOptions: [...QUIET_HOURS],
      reach: {
        sms: Boolean(guardian.canReceiveSms && guardian.phone?.trim()),
        email: Boolean(guardian.canReceiveEmail && guardian.email?.trim()),
        phone: guardian.phone, address: guardian.email ?? null,
      },
    };
  }

  async saveNotifications(session: SessionPayload, body: unknown) {
    this.assert(session);
    const input = z.object({ matrix: preferencesSchema.shape.familyNotify, quiet: preferencesSchema.shape.quietHours }).partial().parse(body);
    const current = await prisma.user.findUnique({ where: { id: session.userId }, select: { preferences: true } });
    const prefs = ((current?.preferences ?? {}) as Preferences);
    const next: Preferences = {
      ...prefs,
      ...(input.matrix ? { familyNotify: { ...(prefs.familyNotify ?? {}), ...input.matrix } } : {}),
      ...(input.quiet ? { quietHours: input.quiet } : {}),
    };
    await prisma.user.update({ where: { id: session.userId }, data: { preferences: next as Prisma.InputJsonValue } });
    return { saved: true };
  }

  /* ───────────────────────── what the school holds ───────────────────────── */

  /**
   * What each school holds about each child, as the family is allowed to see it.
   *
   * Other guardians appear by name and relation only: a parent is shown who else
   * is linked to their child, never how to reach them, and a guardian under a
   * safeguarding restriction is left out altogether. Health is the record the
   * school keeps, read as it stands — this portal does not claim a consent
   * switch the school has not built.
   */
  async profile(session: SessionPayload, scope: string) {
    const { children, guardian, school } = await this.context(session);
    const mine = scope === "all" ? children : children.filter((student) => student.id === scope);
    const ids = mine.map((student) => student.id);
    if (!ids.length) return { school: { name: school?.name ?? "", short: school?.name ?? "", place: "", curriculum: "" }, children: [] };

    const [site, health, collectors, links, documents, open, boarding] = await Promise.all([
      prisma.school.findUnique({ where: { id: session.schoolId }, select: { name: true, shortName: true, city: true, state: true, curriculumPreference: true } }),
      prisma.medicalRecord.findMany({ where: { studentId: { in: ids } } }),
      prisma.authorisedCollector.findMany({ where: { schoolId: session.schoolId, studentId: { in: ids } }, orderBy: { createdAt: "asc" } }),
      prisma.studentGuardian.findMany({
        where: { studentId: { in: ids } },
        include: { guardian: { select: { id: true, firstName: true, lastName: true, relationship: true, phone: true, email: true, safeguardingRestrictedAt: true } } },
        orderBy: [{ isPrimary: "desc" }, { linkedAt: "asc" }],
      }),
      prisma.studentDocument.findMany({ where: { studentId: { in: ids } }, orderBy: { createdAt: "desc" } }),
      prisma.guardianSubmission.findMany({
        where: { schoolId: session.schoolId, guardianId: guardian.id, studentId: { in: ids }, type: { in: ["Record correction", "Collection change"] }, state: { notIn: ["RESOLVED", "DECLINED"] } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.hostelAllocation.findMany({ where: { schoolId: session.schoolId, studentId: { in: ids }, endDate: null }, include: { room: { include: { building: { select: { name: true } } } } } }),
    ]);
    const teachers = await prisma.user.findMany({
      where: { id: { in: mine.map((student) => student.currentClass?.classTeacherId).filter((id): id is string => Boolean(id)) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const place = [site?.city, site?.state].filter(Boolean).join(", ");

    return {
      school: { name: site?.name ?? "", short: site?.shortName?.trim() || site?.name || "", place, curriculum: site?.curriculumPreference ?? "" },
      children: mine.map((student) => {
        const record = health.find((item) => item.studentId === student.id) ?? null;
        const room = boarding.find((item) => item.studentId === student.id) ?? null;
        const tutor = teachers.find((teacher) => teacher.id === student.currentClass?.classTeacherId) ?? null;
        return {
          id: student.id,
          name: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
          first: student.firstName,
          initials: `${student.firstName[0] ?? ""}${student.lastName[0] ?? ""}`.toUpperCase(),
          admissionNumber: student.admissionNumber,
          dob: isoDay(student.dateOfBirth),
          gender: student.gender === "FEMALE" ? "Girl" : student.gender === "MALE" ? "Boy" : "Not recorded",
          arm: armName(student.currentClass?.name, student.currentClass?.arm),
          level: student.currentClass?.classLevel?.name ?? "",
          tutor: tutor ? `${tutor.firstName} ${tutor.lastName}` : null,
          house: student.houseName ?? null,
          boarding: room ? { boarder: true, where: [room.room.building?.name, room.room.name].filter(Boolean).join(" · ") } : { boarder: false, where: "" },
          enrolled: isoDay(student.admissionDate),
          status: student.status,
          health: record
            ? { bloodGroup: record.bloodGroup, genotype: record.genotype, allergies: record.allergies, conditions: record.conditions, notes: record.notes }
            : null,
          collectors: collectors
            .filter((item) => item.studentId === student.id)
            .map((item) => ({ id: item.id, name: item.name, relation: item.relation, phone: item.phone, hasPhoto: Boolean(item.photoFile), until: item.until ? isoDay(item.until) : null })),
          guardians: links
            .filter((link) => link.studentId === student.id && !link.guardian.safeguardingRestrictedAt)
            .map((link) => {
              const me = link.guardian.id === guardian.id;
              return {
                id: link.guardian.id,
                name: `${link.guardian.firstName} ${link.guardian.lastName}`,
                relation: link.relation || link.guardian.relationship,
                primary: link.isPrimary,
                me,
                phone: me ? link.guardian.phone : null,
                email: me ? link.guardian.email : null,
              };
            }),
          documents: documents
            .filter((item) => item.studentId === student.id)
            .map((item) => ({ id: item.id, label: item.label, fileName: item.fileName, source: item.source ?? "", on: isoDay(item.documentOn ?? item.createdAt), checked: Boolean(item.verifiedAt), note: item.note })),
          pending: open
            .filter((item) => item.studentId === student.id)
            .map((item) => ({ id: item.id, type: item.type, detail: item.detail, state: stateWord(item.state), owner: item.ownerName, role: item.ownerRole, opened: isoDay(item.createdAt) })),
        };
      }),
    };
  }

  /**
   * A parent asks the school to change what it holds, or to add someone to the people who may collect.
   *
   * A parent never edits the record: the school corrects its own, and keeps the history. So this opens
   * the same "Record correction" request the rest of the portal uses, with the owner and clock every
   * submission gets, and the words composed so the registrar reads one clear sentence.
   */
  async requestChange(session: SessionPayload, body: unknown) {
    const input = changeSchema.parse(body);
    const student = await this.child(session, input.child);
    const { guardian } = await this.context(session);
    const first = student.firstName;
    const detail = input.what === "Add a collection person"
      ? `Add a person who may collect ${first}: ${input.person?.name ?? ""}, ${input.person?.relation ?? ""}, ${input.person?.phone ?? ""}.${input.change ? ` ${input.change}` : ""}`
      : `${input.what} for ${first}: ${input.change}`;
    if (input.what === "Add a collection person" && !input.person) throw new BadRequestException("Say who should be added, and how the gate can reach them.");
    if (input.what !== "Add a collection person" && input.change.length < 4) throw new BadRequestException("Say what it should read instead.");
    return openSubmission(session.schoolId, {
      guardianId: guardian.id, childId: student.id, type: "Record correction", detail, channel: "Portal", evidence: input.evidence || null,
    });
  }

  /**
   * A parent adds a document to a child's record.
   *
   * Only what the document is and what it is called is kept — the school holds
   * no file store, and the record says so by showing the entry as "Being checked"
   * until the registrar has seen the paper. Nothing here pretends the file arrived.
   */
  async addDocument(session: SessionPayload, body: unknown) {
    const input = documentSchema.parse(body);
    const student = await this.child(session, input.child);
    const made = await prisma.studentDocument.create({
      data: {
        studentId: student.id, label: input.type, fileName: input.fileName || input.type, fileUrl: "",
        mimeType: "application/octet-stream", sizeBytes: 0, source: "Uploaded by you", documentOn: new Date(), note: input.note || null,
      },
    });
    return { id: made.id };
  }
}

/** A line and the tone it reads in. An empty tone means plain text. */
type Stat = [string, string];

type NeedItem = {
  kind: string; childId: string | null; child: string;
  label: string; sub: string; pill: string; tone: string;
  action: string; href: string; due: string;
};

const money = (value: number) => `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
const shortDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const longDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** The shape of a published report card's snapshot, as the report-cards module writes it (version 2). */
type PublishedCard = {
  className: string; arm: string; formMaster: string | null; average: number | null; grade: string | null; gradeRemark: string | null;
  position: number | null; outOf: number; attendance: { days: number; present: number; absent: number; pct: number | null }; scheme: string; frameworkNote: string;
  classTeacherRemark: string; classTeacherBy: string | null; principalRemark: string; principalBy: string | null; resumption: string | null;
  traits: Array<{ title: string; items: Array<{ label: string; value: string }> }>;
  subjects: Array<{ subject: string; teacher: string | null; components: Array<{ name: string; short: string; max: number; score: number | "ABS" | null }>; total: number | null; grade: string | null; remark: string; pos: number | null; outOf: number; classAvg: number | null }>;
};

const accountRequestSchema = z.object({
  kind: z.enum(["contact", "copy"]),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(120).optional(),
  address: z.string().trim().max(200).optional(),
  note: z.string().trim().max(300).optional(),
});

const changeSchema = z.object({
  child: z.string().min(1, "Choose which child this is about."),
  what: z.string().trim().min(2, "Say what needs changing.").max(80),
  change: z.string().trim().max(400).default(""),
  evidence: z.string().trim().max(300).optional(),
  person: z.object({
    name: z.string().trim().min(2, "Who should be added?"),
    relation: z.string().trim().min(2, "Their relation to the child."),
    phone: z.string().trim().min(7, "A number the school can check."),
  }).optional(),
});

const documentSchema = z.object({
  child: z.string().min(1, "Choose which child this is for."),
  type: z.string().trim().min(2, "Say what the document is.").max(80),
  fileName: z.string().trim().max(120).optional(),
  note: z.string().trim().max(300).optional(),
});

const stateWord = (state: string) => (state === "RESOLVED" ? "Resolved" : state === "DECLINED" ? "Declined" : state === "IN_PROGRESS" ? "In progress" : state === "ASSIGNED" ? "With the school" : "Received");

const DAY = 86_400_000;
/** The day a reply is promised by: `days` school days after it was sent, skipping weekends. */
const addSchoolDays = (iso: string, days: number) => {
  const at = dayOf(iso);
  let left = days;
  while (left > 0) { at.setUTCDate(at.getUTCDate() + 1); if (at.getUTCDay() !== 0 && at.getUTCDay() !== 6) left -= 1; }
  return isoDay(at);
};
const emptyLearning = (student: { id: string; firstName: string; currentClass?: { name?: string | null; arm?: string | null } | null }) => ({
  id: student.id, first: student.firstName, arm: armName(student.currentClass?.name, student.currentClass?.arm),
  published: false, slots: [], periods: [], topics: [], exams: [],
});
const dayOf = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoDay = (value: Date) => value.toISOString().slice(0, 10);
const clock = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
/** "JSS 1" + "Silver" → "JSS 1 Silver"; the school's own words for where a child sits. */
const armName = (name?: string | null, arm?: string | null) => [name, arm].filter(Boolean).join(" ") || "No class";
