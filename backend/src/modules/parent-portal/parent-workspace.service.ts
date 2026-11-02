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
}

/** A line and the tone it reads in. An empty tone means plain text. */
type Stat = [string, string];

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
