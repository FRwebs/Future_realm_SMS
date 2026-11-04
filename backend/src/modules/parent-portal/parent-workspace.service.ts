import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import { prisma } from "../../../../src/lib/db/prisma";
import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { categoryOfMessage } from "../../../../src/lib/messaging/family-choices";
import { QUIET_HOURS, preferencesSchema, type Preferences } from "../../../../src/lib/preferences";
import { ANSWERS, FORMS, answerCode, reaches, type Answer, type FormData } from "../guardian-management/forms.shared";
import { ConfigStore } from "../staff-access/staff-access.shared";
import { loadConsentTypes } from "../student-records/consent.shared";
import { openSubmission, submissionTypes } from "../guardian-management/submission-intake";
import { deviceName, hide, icsFor } from "../student-portal/student-workspace.service";
import { randomBytes } from "node:crypto";
import { plansFeatures } from "../plans-features/plans-features.service";
import { loadGuardianPolicy, type GuardianVisible } from "./guardian-policy";
import { clockIn, todayIn } from "./school-time";

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

  /**
   * The family behind the session: every school this login is a guardian at, and
   * every child across them.
   *
   * A parent with children at two schools is one family with one login, not two
   * accounts — so this reads every guardian record the login owns and the whole
   * portal is built over the lot. Each school keeps its own everything: its own
   * current term, its own visibility policy, its own currency. Nothing is
   * averaged or merged across them, because a school's term and a school's
   * decision about what parents may see are not the other school's to change.
   *
   * The school they signed in to leads, and for the ordinary single-school
   * family every field below is exactly what it was.
   */
  private async context(session: SessionPayload) {
    this.assert(session);
    const rows = await prisma.guardian.findMany({
      where: { userId: session.userId, mergedIntoId: null },
      include: {
        user: true,
        students: {
          include: { student: { include: { currentClass: { include: { classLevel: true } } } } },
          orderBy: { student: { dateOfBirth: "asc" } },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    if (!rows.length) throw new NotFoundException("No guardian profile is linked to this account.");
    const guardian = rows.find((row) => row.schoolId === session.schoolId) ?? rows[0]!;
    const schoolIds = [...new Set(rows.map((row) => row.schoolId))];
    const guardianIds = rows.map((row) => row.id);
    const [terms, sites, policies] = await Promise.all([
      prisma.term.findMany({ where: { schoolId: { in: schoolIds }, isCurrent: true }, include: { academicSession: true } }),
      prisma.school.findMany({ where: { id: { in: schoolIds } }, select: { id: true, name: true, shortName: true, currency: true, timezone: true, mainPhone: true, website: true, city: true, state: true } }),
      Promise.all(schoolIds.map(async (id) => [id, await loadGuardianPolicy(id)] as const)),
    ]);
    const termAt = (schoolId: string) => terms.find((term) => term.schoolId === schoolId) ?? null;
    const siteAt = (schoolId: string) => sites.find((site) => site.id === schoolId) ?? null;
    const policyAt = (schoolId: string) => policies.find(([id]) => id === schoolId)?.[1] ?? { sees: new Set<GuardianVisible>() };
    const guardianAt = (schoolId: string) => rows.find((row) => row.schoolId === schoolId) ?? guardian;
    const zoneAt = (schoolId: string) => siteAt(schoolId)?.timezone || "Africa/Lagos";
    const todayAt = (schoolId: string) => todayIn(zoneAt(schoolId));
    const nowAt = (schoolId: string) => clockIn(zoneAt(schoolId));
    const children = rows.flatMap((row) => row.students.map((link) => link.student));
    return {
      guardian, rows, guardianIds, schoolIds, children,
      /** True when this family is spread across schools — the one case the portal has to name out loud. */
      many: schoolIds.length > 1,
      term: termAt(guardian.schoolId),
      school: siteAt(guardian.schoolId),
      policy: policyAt(guardian.schoolId),
      termAt, siteAt, policyAt, guardianAt, zoneAt, todayAt, nowAt,
      /** The day and the clock at the school the parent signed in to: the page's own "today", which every school's own day can differ from. */
      todayLead: todayAt(guardian.schoolId),
      nowLead: nowAt(guardian.schoolId),
      /** Everything about the school a child attends: used wherever a page reads or writes about one child. */
      at: (studentId: string) => {
        const schoolId = children.find((student) => student.id === studentId)?.schoolId ?? guardian.schoolId;
        return { schoolId, guardianId: guardianAt(schoolId).id, term: termAt(schoolId), site: siteAt(schoolId), policy: policyAt(schoolId), today: todayAt(schoolId), now: nowAt(schoolId) };
      },
      /** What any of this family's schools shows parents: a page is in the rail if one school shows it. */
      sees: new Set(policies.flatMap(([, policy]) => [...policy.sees])),
    };
  }

  /** One of this family's children, refused if the child is not theirs. */
  private async child(session: SessionPayload, studentId: string) {
    const { children } = await this.context(session);
    const student = children.find((item) => item.id === studentId);
    if (!student) throw new ForbiddenException("That child is not linked to your account.");
    return student;
  }

  /* ───────────────────────── who the family is ───────────────────────── */

  /**
   * The family: who the parent is, which children they have, and what the
   * school lets them see. Everything else in the portal is read against this.
   */
  async me(session: SessionPayload) {
    const { guardian, guardianIds, term, school, children, many, schoolIds, termAt, siteAt, policyAt, sees, todayAt, nowAt, zoneAt, todayLead, nowLead } = await this.context(session);
    // What the rail counts on Messages: what any of this family's schools has sent that has not been opened.
    const unread = await prisma.messageDelivery.count({ where: { guardianId: { in: guardianIds }, readAt: null, status: { in: ["DELIVERED", "PENDING"] }, campaign: { status: "SENT" } } });
    const today = todayLead;
    const termWeek = (row: { startDate: Date; endDate: Date } | null, day = today) => {
      if (!row) return { start: null, end: null, week: 0, weeks: 0 };
      const weeks = Math.max(1, Math.ceil((row.endDate.getTime() - row.startDate.getTime()) / (7 * DAY)));
      const week = Math.min(weeks, Math.max(0, Math.floor((dayOf(day).getTime() - dayOf(isoDay(row.startDate)).getTime()) / (7 * DAY)) + 1));
      return { start: isoDay(row.startDate), end: isoDay(row.endDate), week, weeks };
    };
    const { start, end, week, weeks } = termWeek(term);
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
      now: nowLead,
      /** What this family's schools show parents. A page every one of them keeps back is not in the rail. */
      sees: [...sees],
      /** True when this family's children are at more than one school, which the portal has to say out loud rather than quietly total. */
      manySchools: many,
      /**
       * Every school this family belongs to, each with its own term, currency and
       * visibility choice. A one-school family has one entry and never sees it named.
       */
      schools: schoolIds.map((id) => {
        const site = siteAt(id);
        const row = termAt(id);
        const { start: from, end: to, week: at, weeks: of } = termWeek(row, todayAt(id));
        return {
          id,
          name: site?.name ?? "",
          short: site?.shortName?.trim() || site?.name || "",
          currency: site?.currency ?? "NGN",
          /** This school's own time zone, and the day and the clock in it — two schools can be an hour apart. */
          timezone: zoneAt(id), today: todayAt(id), now: nowAt(id), place: site?.city?.trim() || "",
          sees: [...policyAt(id).sees],
          term: row ? { id: row.id, name: row.name, session: row.academicSession.name, start: from, end: to, week: at, weeks: of } : null,
        };
      }),
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
        /** Which school this child is at: only ever drawn when the family spans more than one. */
        schoolId: student.schoolId,
        school: siteAt(student.schoolId)?.shortName?.trim() || siteAt(student.schoolId)?.name || "",
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
    const { rows, guardianIds, schoolIds, children, at, termAt, siteAt, many, todayAt } = await this.context(session);
    const mine = scope === "all" ? children : children.filter((student) => student.id === scope);
    if (!mine.length) return { items: [] };
    const ids = mine.map((student) => student.id);
    // Each school runs its own term, so "this term's absences" is one question per school, not one for the family.
    const thisTerm = schoolIds.map((id) => ({ schoolId: id, ...(termAt(id) ? { termId: termAt(id)!.id } : {}) }));

    const [invoices, absences, explanations, consents, meetings, instalments] = await Promise.all([
      // Only what is still owed. A paid invoice is not a thing that needs you.
      prisma.invoice.findMany({
        // A draft has not been issued to the family, and a void one is withdrawn.
        where: { schoolId: { in: schoolIds }, studentId: { in: ids }, balance: { gt: 0 }, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } },
        select: { id: true, studentId: true, invoiceNumber: true, balance: true, dueOn: true },
        orderBy: { dueOn: "asc" },
      }),
      prisma.studentAttendance.findMany({
        where: { studentId: { in: ids }, status: "ABSENT", OR: thisTerm },
        select: { studentId: true, date: true, reason: true },
        orderBy: { date: "desc" },
        take: 40,
      }),
      // An absence the family has already written in about is not unexplained,
      // even while the school is still reading the explanation.
      prisma.guardianSubmission.findMany({
        where: { guardianId: { in: guardianIds }, type: { contains: "absence", mode: "insensitive" } },
        select: { studentId: true, dates: true },
      }),
      prisma.familyConsent.findMany({
        where: { guardianId: { in: guardianIds } },
        select: { schoolId: true, typeCode: true, status: true },
      }),
      prisma.parentMeeting.findMany({
        where: { guardianId: { in: guardianIds }, deletedAt: null, status: { in: ["SCHEDULED", "INVITED"] }, scheduledAt: { gte: new Date() } },
        select: { id: true, studentId: true, title: true, scheduledAt: true, status: true },
        orderBy: { scheduledAt: "asc" },
      }),
      prisma.installmentPlanItem.findMany({
        where: { plan: { schoolId: { in: schoolIds }, studentId: { in: ids }, status: { notIn: ["PAID", "CANCELLED"] } }, status: { notIn: ["PAID", "CANCELLED"] } },
        select: { id: true, dueOn: true, amount: true, paidAmount: true, plan: { select: { studentId: true } } },
        orderBy: { dueOn: "asc" },
      }),
    ]);

    const firstOf = new Map(mine.map((student) => [student.id, student.firstName]));
    const explained = new Set(explanations.flatMap((row) => (row.dates ?? []).map((date) => `${row.studentId ?? ""}:${date}`)));
    const items: NeedItem[] = [];

    for (const invoice of invoices) {
      if (at(invoice.studentId).policy.sees.has("Fees")) {
        // Overdue is counted on the day it is at the school that billed it.
        const over = Math.floor((dayOf(at(invoice.studentId).today).getTime() - dayOf(isoDay(invoice.dueOn)).getTime()) / DAY);
        items.push({
          kind: "fee", childId: invoice.studentId, child: firstOf.get(invoice.studentId) ?? "",
          label: `Balance · ${money(Number(invoice.balance))}`,
          sub: over > 0 ? `${over} ${over === 1 ? "day" : "days"} overdue on ${invoice.invoiceNumber}. Pay, report a transfer, or ask for a plan.` : `Due ${isoDay(invoice.dueOn)} on ${invoice.invoiceNumber}.`,
          pill: over > 0 ? "Overdue" : `Due ${shortDay(isoDay(invoice.dueOn))}`, tone: over > 0 ? "negative" : "progress",
          action: "Pay", href: `/portals/parent/fees?child=${invoice.studentId}`, due: isoDay(invoice.dueOn),
        });
      }
    }

    for (const row of absences) {
      if (at(row.studentId).policy.sees.has("Attendance")) {
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

    // Consents are a school's own list, asked of a school's own guardian record: a family at two
    // schools owes each of them an answer, and is told which school is asking.
    const askedBy = [...new Set(mine.map((student) => student.schoolId))];
    const recorded = new Set(consents.map((row) => `${row.schoolId}:${row.typeCode}`));
    for (const schoolId of askedBy) {
      for (const consent of await loadConsentTypes(schoolId)) {
        if (recorded.has(`${schoolId}:${consent.code}`)) continue;
        const asking = many ? `${siteAt(schoolId)?.shortName?.trim() || siteAt(schoolId)?.name || "The school"} needs` : "The school needs";
        items.push({
          kind: "consent", childId: null, child: "",
          label: `${consent.name} has never been recorded`,
          sub: `${asking} a yes or no. ${consent.blocks ? `Without one: ${consent.blocks.charAt(0).toLowerCase()}${consent.blocks.slice(1)}.` : ""}`.trim(),
          pill: "Not recorded", tone: "attention",
          action: "Decide", href: "/portals/parent/consents", due: "9999-12-31",
        });
      }
    }

    for (const form of await this.formsFor(rows, children)) {
      if (form.answer || form.data.status !== "OPEN") continue;
      items.push({
        kind: "form", childId: null, child: form.children.length ? form.children.map((child) => child.first).join(" and ") : "",
        label: form.data.title, sub: `${form.data.kind} form from the school${form.data.due ? ` · reply by ${longDay(form.data.due)}` : ""}.`,
        pill: form.data.due ? `Reply by ${shortDay(form.data.due)}` : "Waiting", tone: form.data.due && form.data.due < todayAt(form.schoolId) ? "negative" : "attention",
        action: "Review", href: "/portals/parent/consents?tab=Forms+to+sign", due: form.data.due ?? "9999-12-30",
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

    for (const item of instalments) {
      const child = item.plan.studentId;
      if (at(child).policy.sees.has("Fees")) {
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
    const { children, schoolIds, guardianIds, at, siteAt, many, sees } = await this.context(session);
    if (!sees.has("Fees")) throw new ForbiddenException("Your school has not made fee details visible to parents.");
    // A child whose own school keeps fees back is left out rather than shown an empty bill.
    const shown = children.filter((student) => at(student.id).policy.sees.has("Fees"));
    const mine = scope === "all" ? shown : shown.filter((student) => student.id === scope);
    const ids = mine.map((student) => student.id);
    if (!ids.length) return { children: [], invoices: [], payments: [], plans: [], reports: [] };

    const invoices = await prisma.invoice.findMany({
      where: { schoolId: { in: schoolIds }, studentId: { in: ids }, status: { not: "DRAFT" } },
      include: {
        items: { select: { description: true, amount: true, quantity: true, isWaived: true } },
        payments: { include: { receipts: { select: { id: true, receiptNumber: true, issuedAt: true } }, recordedBy: { select: { firstName: true, lastName: true } } }, orderBy: { paidAt: "desc" } },
        term: { select: { id: true, name: true, academicSession: { select: { name: true } } } },
      },
      orderBy: { issuedOn: "desc" },
    });
    const plans = await prisma.installmentPlan.findMany({
      where: { schoolId: { in: schoolIds }, studentId: { in: ids }, status: { notIn: ["CANCELLED"] } },
      include: { items: { orderBy: { dueOn: "asc" } } },
    });
    // What the family has told the bursar they paid, and the bursar has not yet matched to the bank: shown as reported, never as a receipt.
    const asked = await prisma.guardianSubmission.findMany({
      where: { guardianId: { in: guardianIds }, type: "Fee query", state: { notIn: ["RESOLVED", "DECLINED"] }, studentId: { in: ids } },
      orderBy: { createdAt: "desc" },
    });
    const reports = asked
      .map((row) => ({ row, payload: row.payload as { kind?: string; amount?: number; method?: string; date?: string; reference?: string } | null }))
      .filter((entry) => entry.payload?.kind === "payment-report")
      .map((entry) => ({ id: entry.row.id, childId: entry.row.studentId, amount: Number(entry.payload!.amount ?? 0), method: entry.payload!.method ?? "", date: entry.payload!.date ?? isoDay(entry.row.createdAt), reference: entry.payload!.reference ?? "", owner: entry.row.ownerName, sent: isoDay(entry.row.createdAt) }));

    const firstOf = new Map(mine.map((student) => [student.id, student.firstName]));
    const nameOf = new Map(mine.map((student) => [student.id, [student.firstName, student.lastName].filter(Boolean).join(" ")]));
    const armOf = new Map(mine.map((student) => [student.id, armName(student.currentClass?.name, student.currentClass?.arm)]));

    // This term's position per child: what a parent means by "the fees".
    // An invoice the bursar never tied to a term cannot be placed by date alone, so when none belongs to this term the most recent of those is
    // shown as the bill in hand — a page that calls every bill "earlier" has nothing to show for a family whose invoices carry no term.
    const currentOf = (studentId: string) => {
      const theirs = invoices.filter((invoice) => invoice.studentId === studentId);
      // "This term" is the term of the school that billed this child, which for a family at two schools is two different terms.
      const term = at(studentId).term;
      const matched = term ? theirs.filter((invoice) => invoice.termId === term.id) : [];
      if (matched.length) return matched;
      const loose = theirs.filter((invoice) => !invoice.termId).sort((a, b) => b.issuedOn.getTime() - a.issuedOn.getTime())[0];
      return loose ? [loose] : [];
    };
    const currentIds = new Set(mine.flatMap((student) => currentOf(student.id).map((invoice) => invoice.id)));
    const summary = mine.map((student) => {
      const theirs = invoices.filter((invoice) => invoice.studentId === student.id);
      const thisTerm = currentOf(student.id);
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
        invoiceId: thisTerm[0]?.id ?? null,
        // The bill a payment goes against: the oldest one still unpaid, which is the one the school will want cleared first.
        payInvoiceId: [...unpaid].sort((a, b) => a.dueOn.getTime() - b.dueOn.getTime())[0]?.id ?? null,
        payAmount: Number([...unpaid].sort((a, b) => a.dueOn.getTime() - b.dueOn.getTime())[0]?.balance ?? 0),
        term: thisTerm[0]?.term ? `${thisTerm[0]!.term!.name} ${thisTerm[0]!.term!.academicSession.name}` : thisTerm[0] ? `Issued ${longDate(isoDay(thisTerm[0].issuedOn))}` : at(student.id).term ? `${at(student.id).term!.name} ${at(student.id).term!.academicSession.name}` : "",
        /** Which school billed this child, and in what money — never summed across schools. */
        schoolId: student.schoolId,
        school: many ? siteAt(student.schoolId)?.shortName?.trim() || siteAt(student.schoolId)?.name || "" : "",
        currency: siteAt(student.schoolId)?.currency ?? "NGN",
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
        current: currentIds.has(invoice.id),
        lines: invoice.items.map((item) => ({ description: item.description, amount: Number(item.amount), quantity: item.quantity, waived: item.isWaived })),
      })),
      // Only what has actually been paid: an online attempt that was started and never completed is not a payment, and is not a receipt.
      payments: invoices.flatMap((invoice) =>
        invoice.payments.filter((payment) => payment.status === "SUCCESS").map((payment) => ({
          id: payment.id,
          childId: invoice.studentId,
          child: firstOf.get(invoice.studentId) ?? "",
          invoiceId: invoice.id,
          invoice: invoice.invoiceNumber,
          term: invoice.term ? `${invoice.term.name} ${invoice.term.academicSession.name}` : "",
          termId: invoice.termId,
          reference: payment.reference,
          bankRef: payment.schoolBankReference ?? payment.gatewayReference ?? "",
          receipt: payment.receipts[0]?.receiptNumber ?? null,
          amount: Number(payment.amount),
          method: payment.method,
          channel: payment.paymentChannel ?? "",
          status: payment.status,
          by: payment.recordedBy ? `${payment.recordedBy.firstName} ${payment.recordedBy.lastName}` : "",
          paidAt: payment.paidAt ? isoDay(payment.paidAt) : null,
        })),
      ),
      reports,
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
  /**
   * A parent tells the bursar they have paid: by bank transfer, or at the bursary counter.
   *
   * It is a request to the bursar, not a receipt — the bursar matches it to the bank statement and issues the receipt, and until then
   * the family sees it as reported, with the owner it was given to. Nothing here changes a balance.
   */
  async reportPayment(session: SessionPayload, body: unknown) {
    const input = reportSchema.parse(body);
    const student = await this.child(session, input.child);
    const { at } = await this.context(session);
    // It goes to the bursary of the school that billed the child, under that school's own guardian record.
    const { schoolId, guardianId, site } = at(student.id);
    const detail = `I paid ${moneyIn(site?.currency ?? "NGN", input.amount)} for ${student.firstName} by ${input.method.toLowerCase()} on ${input.date}${input.reference ? `, bank reference ${input.reference}` : ""}.${input.note ? ` ${input.note}` : ""}`;
    return openSubmission(schoolId, {
      guardianId, childId: student.id, type: "Fee query", detail, channel: "Portal", evidence: input.reference || null,
      payload: { kind: "payment-report", amount: input.amount, method: input.method, date: input.date, reference: input.reference ?? "" } as Prisma.InputJsonValue,
    });
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
    const { children, schoolIds, guardianIds, at, termAt, siteAt, many, sees, todayAt } = await this.context(session);
    const ids = children.map((student) => student.id);
    const thisTerm = schoolIds.map((id) => ({ schoolId: id, ...(termAt(id) ? { termId: termAt(id)!.id } : {}) }));

    const [needs, marks, termMarks, invoices, explanations] = await Promise.all([
      this.needs(session, "all"),
      ids.length
        ? prisma.studentAttendance.findMany({
            // Today's mark is the one for the day it is at each child's own school.
            where: { studentId: { in: ids }, OR: schoolIds.map((id) => ({ schoolId: id, date: dayOf(todayAt(id)) })) },
            select: { studentId: true, status: true },
          })
        : Promise.resolve([]),
      ids.length
        ? prisma.studentAttendance.findMany({
            where: { studentId: { in: ids }, OR: thisTerm },
            select: { studentId: true, status: true, date: true },
          })
        : Promise.resolve([]),
      ids.length && sees.has("Fees")
        ? prisma.invoice.findMany({
            where: { schoolId: { in: schoolIds }, studentId: { in: ids }, balance: { gt: 0 }, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } },
            select: { studentId: true, balance: true, dueOn: true },
          })
        : Promise.resolve([]),
      prisma.guardianSubmission.findMany({
        where: { guardianId: { in: guardianIds }, type: { contains: "absence", mode: "insensitive" } },
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
      // Each child is read under their own school's choice; the family line needs one school to show it.
      const showsAttendance = mine.some((student) => at(student.id).policy.sees.has("Attendance"));
      const showsFees = mine.some((student) => at(student.id).policy.sees.has("Fees"));
      const attendance: Stat = !showsAttendance
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
      const fees: Stat = !showsFees
        ? ["", ""]
        : family
          ? owed
            ? [`${late ? "Overdue · " : ""}${withBalance} with a balance`, late ? "negative" : "attention"]
            : ["All paid", "positive"]
          : owed
            ? [`${moneyIn(siteAt(mine[0]?.schoolId ?? "")?.currency ?? "NGN", owed)}${late ? " · overdue" : ""}`, late ? "negative" : "attention"]
            : ["Paid in full", "positive"];

      const student = family ? null : mine[0];
      return {
        home,
        attendance,
        fees,
        /** Everything else, until its own page is built and brings its own line. */
        fallback: (family
          // The one line that has to name the split: a parent reading "2 children" would not know the portal holds both schools.
          ? [`${children.length === 1 ? "1 child" : `${children.length} children`}${many ? ` · ${schoolIds.length} schools` : ""}`, ""]
          : [[armName(student?.currentClass?.name, student?.currentClass?.arm), many ? siteAt(student?.schoolId ?? "")?.shortName?.trim() || siteAt(student?.schoolId ?? "")?.name : ""].filter(Boolean).join(" · "), ""]) as Stat,
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
    const { children, schoolIds, guardianIds, at, siteAt, many, sees, todayLead } = await this.context(session);
    if (!sees.has("Attendance")) throw new ForbiddenException("Your school has not made attendance visible to parents.");
    const shown = children.filter((student) => at(student.id).policy.sees.has("Attendance"));
    const mine = scope === "all" ? shown : shown.filter((student) => student.id === scope);
    const ids = mine.map((student) => student.id);
    if (!ids.length) return { children: [], terms: [], days: [], explained: [] };

    const [terms, marks, explanations] = await Promise.all([
      prisma.term.findMany({
        where: { schoolId: { in: schoolIds } },
        include: { academicSession: { select: { name: true } } },
        orderBy: { startDate: "asc" },
      }),
      prisma.studentAttendance.findMany({
        where: { schoolId: { in: schoolIds }, studentId: { in: ids }, subjectId: null },
        select: { studentId: true, termId: true, date: true, status: true, reason: true, reasonCode: true, markedAt: true, markedBy: { select: { firstName: true, lastName: true } } },
        orderBy: { date: "desc" },
      }),
      // What the family has already written in about, so a mark the school has
      // not yet acted on is not counted against them twice.
      prisma.guardianSubmission.findMany({
        where: { guardianId: { in: guardianIds }, type: { contains: "absence", mode: "insensitive" } },
        select: { studentId: true, dates: true, state: true },
      }),
    ]);

    const explained = new Set(explanations.flatMap((row) => (row.dates ?? []).map((date) => `${row.studentId ?? ""}:${date}`)));
    const today = todayLead;
    const present = (status: string) => status === "PRESENT" || status === "LATE";

    // Only the terms this family actually has marks in, newest last.
    const termsWithMarks = terms.filter((term) => marks.some((mark) => mark.termId === term.id));

    const perChild = mine.map((student) => {
      const theirs = marks.filter((mark) => mark.studentId === student.id);
      // "Today" is the day it is at this child's own school.
      const todayMark = theirs.find((mark) => isoDay(mark.date) === at(student.id).today) ?? null;
      // A child's terms are their own school's: two schools do not share a calendar, so one child's list never shows the other's terms.
      const byTerm = termsWithMarks.filter((term) => term.schoolId === student.schoolId).map((term) => {
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
        school: many ? siteAt(student.schoolId)?.shortName?.trim() || siteAt(student.schoolId)?.name || "" : "",
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
    const { guardianIds, children, term, at, termAt, siteAt, many, sees, todayLead } = await this.context(session);
    const mine = scope === "all" ? children : children.filter((student) => student.id === scope);
    const ids = mine.map((student) => student.id);
    // Only the schools this view is actually about: opening one child must not bring the other school's term dates with it.
    const theirSchools = [...new Set(mine.map((student) => student.schoolId))];
    const classIds = [...new Set(mine.map((student) => student.currentClassId).filter((id): id is string => Boolean(id)))];
    const from = new Date(Date.now() - 45 * DAY);
    const tag = (list: typeof mine) => (list.length ? list : mine).map((student) => ({ id: student.id, first: student.firstName }));
    // Where the family is at two schools, every dated thing says which school it came from; where they are at one, it says nothing.
    const whose = (schoolId: string) => (many ? siteAt(schoolId)?.shortName?.trim() || siteAt(schoolId)?.name || "" : "");
    const resultWindows = theirSchools.filter((id) => termAt(id) && sees.has("Results"));
    const [events, exams, windows, meetings, invoices] = await Promise.all([
      prisma.calendarEvent.findMany({ where: { schoolId: { in: theirSchools }, endsAt: { gte: from } }, orderBy: { startsAt: "asc" }, take: 300 }),
      classIds.length ? prisma.examTimetableEntry.findMany({ where: { schoolId: { in: theirSchools }, classId: { in: classIds }, examDate: { gte: from } }, include: { subject: true }, orderBy: { examDate: "asc" } }) : Promise.resolve([]),
      resultWindows.length ? prisma.assessmentWindow.findMany({ where: { OR: resultWindows.map((id) => ({ schoolId: id, termId: termAt(id)!.id })) }, include: { component: true } }) : Promise.resolve([]),
      prisma.parentMeeting.findMany({ where: { schoolId: { in: theirSchools }, guardianId: { in: guardianIds }, deletedAt: null, scheduledAt: { gte: from } }, orderBy: { scheduledAt: "asc" } }),
      ids.length ? prisma.invoice.findMany({ where: { schoolId: { in: theirSchools }, studentId: { in: ids.filter((id) => at(id).policy.sees.has("Fees")) }, balance: { gt: 0 }, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] }, dueOn: { gte: from } }, select: { id: true, schoolId: true, studentId: true, invoiceNumber: true, dueOn: true } }) : Promise.resolve([]),
    ]);
    const kindOf = (type: string, closed: boolean) => (closed || /holiday|closure/i.test(type) ? "Holiday" : /exam|test|assess/i.test(type) ? "Assessment" : /meeting|conference|pta/i.test(type) ? "Meeting" : /trip|excursion/i.test(type) ? "Trip" : /deadline/i.test(type) ? "Notice" : "Event");
    const forGuardians = (event: (typeof events)[number]) => (event.visibleTo.length ? event.visibleTo.includes("Guardians") : /all|guardian|parent/i.test(event.audience));
    const out: Array<{ id: string; date: string; end: string; title: string; cat: string; time: string; where: string; note: string; school: string; kids: Array<{ id: string; first: string }> }> = [];
    for (const event of events.filter(forGuardians)) {
      out.push({ id: event.id, date: isoDay(event.startsAt), end: isoDay(event.endsAt), title: event.title, cat: kindOf(event.type, event.schoolClosed), time: event.allDay ? "All day" : [event.startTime, event.endTime].filter(Boolean).join(" – "), where: event.location ?? "", note: event.description ?? "", school: whose(event.schoolId), kids: tag(mine.filter((student) => student.schoolId === event.schoolId)) });
    }
    for (const exam of exams) {
      out.push({ id: `x-${exam.id}`, date: isoDay(exam.examDate), end: isoDay(exam.examDate), title: `${exam.subject.name} examination`, cat: "Assessment", time: `${exam.startsAt} – ${exam.endsAt}`, where: exam.venue ?? "", note: "", school: whose(exam.schoolId), kids: tag(mine.filter((student) => student.currentClassId === exam.classId)) });
    }
    for (const window of windows) {
      out.push({ id: `r-${window.id}`, date: isoDay(window.releaseAt), end: isoDay(window.releaseAt), title: `${window.component.name} results released`, cat: "Results", time: "", where: "", note: "", school: whose(window.schoolId), kids: tag(mine.filter((student) => student.schoolId === window.schoolId)) });
    }
    for (const meeting of meetings.filter((item) => item.status !== "CANCELLED")) {
      const child = mine.find((student) => student.id === meeting.studentId);
      if (meeting.studentId && !child) continue;
      out.push({ id: `m-${meeting.id}`, date: isoDay(meeting.scheduledAt), end: isoDay(meeting.scheduledAt), title: meeting.title, cat: "Meeting", time: meeting.scheduledAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }), where: "", note: meeting.notes ?? "", school: whose(meeting.schoolId), kids: tag(child ? [child] : []) });
    }
    for (const invoice of invoices) {
      const child = mine.find((student) => student.id === invoice.studentId);
      out.push({ id: `f-${invoice.id}`, date: isoDay(invoice.dueOn), end: isoDay(invoice.dueOn), title: `Fees due · ${invoice.invoiceNumber}`, cat: "Fees", time: "", where: "", note: "", school: whose(invoice.schoolId), kids: tag(child ? [child] : []) });
    }
    // One term per school: two schools do not begin and end on the same day, and a family at both has to see both.
    for (const schoolId of theirSchools) {
      const row = termAt(schoolId);
      if (!row) continue;
      const kids = tag(mine.filter((student) => student.schoolId === schoolId));
      out.push({ id: `t-start-${row.id}`, date: isoDay(row.startDate), end: isoDay(row.startDate), title: `${row.name} begins`, cat: "Term", time: "", where: "", note: "", school: whose(schoolId), kids });
      out.push({ id: `t-end-${row.id}`, date: isoDay(row.endDate), end: isoDay(row.endDate), title: `${row.name} ends`, cat: "Term", time: "", where: "", note: "", school: whose(schoolId), kids });
    }
    return { today: todayLead, term: term ? { name: term.name, start: isoDay(term.startDate), end: isoDay(term.endDate) } : null, events: out.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)) };
  }

  /**
   * The family's private calendar feed, made the first time it is asked for. `reset` replaces it, so a link that got out stops working.
   * The address is the secret — a phone's calendar reads it with no sign-in — so it is never shown to anyone but this parent.
   */
  async calendarLink(session: SessionPayload, reset = false) {
    this.assert(session);
    const existing = await prisma.configurationItem.findFirst({ where: { schoolId: session.schoolId, resource: CALENDAR_FEED, name: session.userId } });
    const current = (existing?.data as { token?: string } | null)?.token;
    const token = !current || reset ? randomBytes(24).toString("hex") : current;
    if (token !== current) {
      if (existing) await prisma.configurationItem.update({ where: { id: existing.id }, data: { data: { token }, deletedAt: null } });
      else await prisma.configurationItem.create({ data: { schoolId: session.schoolId, resource: CALENDAR_FEED, name: session.userId, data: { token } } });
    }
    return { path: `/api/v1/parent-calendar/${token}.ics` };
  }

  /** The feed itself, read by a phone's calendar: everything this family has coming, from the same read the Calendar page uses. */
  async calendarFeed(token: string): Promise<string> {
    if (!/^[a-f0-9]{48}$/.test(token)) throw new NotFoundException("That calendar link is not one we issued.");
    const row = await prisma.configurationItem.findFirst({ where: { resource: CALENDAR_FEED, deletedAt: null, data: { path: ["token"], equals: token } } });
    if (!row) throw new NotFoundException("That calendar link is not one we issued.");
    const session = { userId: row.name, schoolId: row.schoolId, role: "PARENT" } as unknown as SessionPayload;
    const [{ events }, me] = await Promise.all([this.calendar(session, "all"), this.me(session)]);
    return icsFor(`${me.name} · ${me.school}`, events.map((event) => ({ id: event.id, date: event.date, end: event.end, title: event.title, time: event.time, where: event.where, note: event.note })), "Family calendar");
  }

  /**
   * Meetings the school has set with this family, meetings they asked for, and what was agreed in the ones already held.
   *
   * A meeting the school proposes shows as waiting for an answer until the family says whether they can come; their answer is
   * recorded on the meeting itself, and the person who set it up is told.
   */
  async meetings(session: SessionPayload, scope: string) {
    const { guardianIds, children, siteAt, many, todayLead } = await this.context(session);
    const rows = await prisma.parentMeeting.findMany({
      where: { guardianId: { in: guardianIds }, deletedAt: null },
      include: { student: { select: { id: true, firstName: true } }, staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { scheduledAt: "asc" },
    });
    const now = Date.now();
    const asked = await prisma.guardianSubmission.findMany({
      where: { guardianId: { in: guardianIds }, type: "Meeting request", ...(scope === "all" ? {} : { OR: [{ studentId: scope }, { studentId: null }] }) },
      orderBy: { createdAt: "desc" }, take: 20, include: { student: { select: { firstName: true } } },
    });
    return {
      today: todayLead,
      children: children.map((student) => ({ id: student.id, first: student.firstName, school: many ? siteAt(student.schoolId)?.shortName?.trim() || siteAt(student.schoolId)?.name || "" : "" })),
      meetings: rows.filter((row) => scope === "all" || !row.studentId || row.studentId === scope).map((row) => ({
        id: row.id, title: row.title, at: row.scheduledAt.toISOString(), date: isoDay(row.scheduledAt),
        time: row.scheduledAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }),
        status: row.status, notes: row.notes, childId: row.studentId, child: row.student?.firstName ?? null,
        with: row.staff?.user ? `${row.staff.user.firstName} ${row.staff.user.lastName}` : null,
        school: many ? siteAt(row.schoolId)?.shortName?.trim() || siteAt(row.schoolId)?.name || "" : "",
        past: row.scheduledAt.getTime() < now, answerable: row.scheduledAt.getTime() >= now && ["INVITED", "SCHEDULED"].includes(row.status),
      })),
      asked: asked.map((row) => ({ id: row.id, type: row.type, detail: row.detail, state: stateWord(row.state), owner: row.ownerName, role: row.ownerRole, opened: isoDay(row.createdAt), child: row.student?.firstName ?? null, outcome: row.outcome })),
    };
  }

  /** The family answers a meeting the school proposed: they can come, or they cannot. */
  async respondMeeting(session: SessionPayload, id: string, body: unknown) {
    const input = z.object({ answer: z.enum(["CONFIRMED", "DECLINED"]) }).parse(body);
    const { guardian, guardianIds } = await this.context(session);
    const row = await prisma.parentMeeting.findFirst({ where: { id, guardianId: { in: guardianIds }, deletedAt: null } });
    if (!row) throw new NotFoundException("That meeting is not one of yours.");
    if (row.scheduledAt.getTime() < Date.now()) throw new BadRequestException("That meeting has already taken place.");
    if (row.status === input.answer) return { id, status: row.status };
    await prisma.parentMeeting.update({ where: { id }, data: { status: input.answer } });
    if (row.scheduledById) {
      await prisma.notificationLog.create({
        data: {
          // The person told is at the school that called the meeting, not at whichever school the parent signed in to.
          schoolId: row.schoolId, userId: row.scheduledById, channel: "IN_APP", status: "SENT", sentAt: new Date(),
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
    const { guardian, guardianIds, children, school, siteAt, many } = await this.context(session);
    const rows = await prisma.messageDelivery.findMany({
      where: { guardianId: { in: guardianIds }, status: { in: ["DELIVERED", "PENDING"] }, campaign: { status: "SENT" } },
      orderBy: { createdAt: "desc" }, take: 120, include: { campaign: { select: { sentAt: true, createdAt: true, audience: true, channel: true } } },
    });
    const replies = rows.length ? await prisma.guardianSubmission.findMany({ where: { guardianId: { in: guardianIds }, deliveryId: { in: rows.map((row) => row.id) } }, orderBy: { createdAt: "asc" } }) : [];
    const items = rows.map((row) => {
      const audience = (row.campaign.audience ?? {}) as { classIds?: string[]; guardianIds?: string[] };
      // A message is from one school, so it is never about a child at the other one.
      const theirs = children.filter((student) => student.schoolId === row.schoolId);
      const about = audience.classIds?.length
        ? theirs.filter((student) => student.currentClassId && audience.classIds!.includes(student.currentClassId))
        : theirs;
      const text = row.body ?? "";
      const first = (text.split(/\n/)[0] ?? text).trim();
      const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
      return {
        id: row.id, title: first.length > 80 ? `${first.slice(0, 77)}…` : first,
        preview: (lines[1] ?? lines[0] ?? "").slice(0, 140), body: lines.length > 1 ? lines.slice(1) : lines, category: categoryOfMessage(text),
        at: (row.campaign.sentAt ?? row.campaign.createdAt).toISOString(), channel: row.channel ?? row.campaign.channel ?? "IN_APP",
        read: Boolean(row.readAt), acknowledgeAsked: row.acknowledgeAsked, acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
        children: (about.length ? about : theirs).map((student) => ({ id: student.id, first: student.firstName })),
        school: many ? siteAt(row.schoolId)?.shortName?.trim() || siteAt(row.schoolId)?.name || "" : "",
        replies: replies.filter((reply) => reply.deliveryId === row.id).map((reply) => ({ id: reply.id, text: reply.detail, at: reply.createdAt.toISOString(), state: stateWord(reply.state), outcome: reply.outcome })),
      };
    });
    const mine = scope === "all" ? items : items.filter((item) => item.children.some((child) => child.id === scope));
    return { school: many ? "your schools" : school?.name ?? "Your school", you: `${guardian.firstName} ${guardian.lastName}`, unread: mine.filter((item) => !item.read).length, items: mine };
  }

  /* ───────────────────────── forms the school has sent ───────────────────────── */

  /**
   * The forms that reach this family, with what they have answered.
   *
   * A form the school has closed is shown only if the family answered it — a closed form nobody replied to is no longer a thing to do.
   * The family answers once for all its children; the children a form concerns are named so it never reads as being about someone else's.
   */
  private async formsFor(
    rows: Array<{ id: string; schoolId: string }>,
    children: Array<{ id: string; firstName: string; schoolId: string; currentClassId: string | null }>,
  ) {
    // A form belongs to the school that wrote it and is answered under that school's own guardian record, so each school is read on its own.
    const perSchool = await Promise.all(
      rows.map(async (row) => {
        const theirs = children.filter((child) => child.schoolId === row.schoolId);
        const [forms, answers] = await Promise.all([
          new ConfigStore(row.schoolId, FORMS).list<FormData>(),
          new ConfigStore(row.schoolId, ANSWERS).list<Answer & { formId: string; guardianId: string }>(),
        ]);
        const mine = new Map(answers.filter((answer) => answer.data.guardianId === row.id).map((answer) => [answer.data.formId, answer.data]));
        return forms
          .filter((form) => reaches(form.data, theirs.map((child) => child.currentClassId)))
          .map((form) => {
            const id = form.code ?? form.id;
            const concerned = theirs.filter((child) => form.data.classIds.length === 0 || (child.currentClassId && form.data.classIds.includes(child.currentClassId)));
            return { id, schoolId: row.schoolId, guardianId: row.id, data: form.data, answer: mine.get(id) ?? null, children: concerned.map((child) => ({ id: child.id, first: child.firstName })) };
          });
      }),
    );
    return perSchool
      .flat()
      .filter((form) => form.data.status === "OPEN" || form.answer)
      .sort((a, b) => b.data.createdAt.localeCompare(a.data.createdAt));
  }

  async forms(session: SessionPayload) {
    const { rows, children, siteAt, many, todayLead } = await this.context(session);
    const forms = await this.formsFor(rows, children);
    return {
      today: todayLead,
      forms: forms.map((form) => ({
        id: form.id, title: form.data.title, kind: form.data.kind, audience: form.data.audience, due: form.data.due, open: form.data.status === "OPEN",
        facts: form.data.facts, ask: form.data.ask, yes: form.data.yes, no: form.data.no, sentOn: form.data.createdAt.slice(0, 10), by: form.data.createdBy,
        children: form.children, answer: form.answer,
        school: many ? siteAt(form.schoolId)?.shortName?.trim() || siteAt(form.schoolId)?.name || "" : "",
      })),
    };
  }

  /** The family answers a form. They can change their answer until the school closes it. */
  async answerForm(session: SessionPayload, id: string, body: unknown) {
    const input = z.object({ decision: z.enum(["YES", "NO"]), text: z.string().trim().max(400).optional() }).parse(body);
    const { guardian, rows, children } = await this.context(session);
    const form = (await this.formsFor(rows, children)).find((item) => item.id === id);
    if (!form) throw new NotFoundException("That form is not one that was sent to you.");
    if (form.data.status !== "OPEN") throw new BadRequestException("The school has closed that form.");
    if (form.data.ask && input.decision === "YES" && (input.text ?? "").length < 2) throw new BadRequestException(`${form.data.ask} — please answer it.`);
    // The answer is written back to the school that asked, under its own guardian record.
    const answer = { decision: input.decision, text: input.text ?? "", at: new Date().toISOString(), by: `${guardian.firstName} ${guardian.lastName}`, formId: id, guardianId: form.guardianId };
    await new ConfigStore(form.schoolId, ANSWERS).put(answerCode(id, form.guardianId), `${form.data.title} · ${guardian.firstName} ${guardian.lastName}`, answer);
    return { id, decision: input.decision };
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
    const { rows: guardians, guardianIds, siteAt, many } = await this.context(session);
    // Each school asks for its own consents and keeps its own record of them, so a family at two schools answers both lists.
    const [lists, rows] = await Promise.all([
      Promise.all(guardians.map(async (row) => ({ schoolId: row.schoolId, guardianId: row.id, types: await loadConsentTypes(row.schoolId) }))),
      prisma.familyConsent.findMany({ where: { guardianId: { in: guardianIds } } }),
    ]);
    const types = lists.flatMap((list) => list.types.map((type) => ({ ...type, schoolId: list.schoolId, guardianId: list.guardianId })));
    const recorders = rows.map((row) => row.recordedById).filter((id): id is string => Boolean(id));
    const people = recorders.length ? new Map((await prisma.user.findMany({ where: { id: { in: recorders } }, select: { id: true, firstName: true, lastName: true } })).map((user) => [user.id, `${user.firstName} ${user.lastName}`])) : new Map<string, string>();
    return {
      types: types.map((type) => {
        const row = rows.find((item) => item.typeCode === type.code && item.guardianId === type.guardianId) ?? null;
        const means = row?.means === "PORTAL" ? "in the portal" : row?.means === "PAPER" ? "on paper" : row?.means === "IN_PERSON" ? "in person" : "";
        return {
          code: type.code, name: type.name, covers: type.covers, blocks: type.blocks, required: type.required, who: type.who,
          /** Which school asks for it: a family at one school never sees this, a family at two always does. */
          schoolId: type.schoolId,
          school: many ? siteAt(type.schoolId)?.shortName?.trim() || siteAt(type.schoolId)?.name || "" : "",
          state: !row ? "Not recorded" : row.status === "GIVEN" ? "Given" : row.status === "WITHDRAWN" ? "Withdrawn" : "Declined",
          on: row ? isoDay(row.recordedAt) : null,
          how: row ? [row.status === "GIVEN" && means ? `Given ${means}` : "", row.recordedById ? `recorded by ${row.recordedById === session.userId ? "you" : people.get(row.recordedById) ?? "the school"}` : ""].filter(Boolean).join(" · ") : null,
        };
      }),
    };
  }

  /** The family gives, declines or withdraws one consent. It is recorded at once, and the change is kept in the school's audit log. */
  async setConsent(session: SessionPayload, body: unknown) {
    const input = z.object({ code: z.string().min(1), status: z.enum(["GIVEN", "WITHDRAWN", "NOT_GIVEN"]), school: z.string().optional() }).parse(body);
    const { rows: guardians } = await this.context(session);
    // The answer belongs to the school that asked. A family at one school need not say which.
    const asked = input.school ? guardians.filter((row) => row.schoolId === input.school) : guardians;
    const lists = await Promise.all(asked.map(async (row) => ({ row, types: await loadConsentTypes(row.schoolId) })));
    const found = lists.map((list) => ({ row: list.row, type: list.types.find((item) => item.code === input.code) })).find((entry) => entry.type);
    const type = found?.type;
    const guardian = found?.row;
    if (!type || !guardian) throw new NotFoundException("The school does not ask for that consent.");
    if (type.required && input.status !== "GIVEN") {
      throw new BadRequestException(`${type.name} is what lets the school hold your child’s record, so it cannot be switched off here. Ask to speak to the school if you want to change it.`);
    }
    const existing = await prisma.familyConsent.findUnique({ where: { guardianId_typeCode: { guardianId: guardian.id, typeCode: type.code } } });
    if (existing?.status === input.status) return { code: type.code, state: input.status, changed: false };
    const stamp = new Date();
    await prisma.familyConsent.upsert({
      where: { guardianId_typeCode: { guardianId: guardian.id, typeCode: type.code } },
      update: { status: input.status, means: input.status === "GIVEN" ? "PORTAL" : existing?.means ?? null, recordedById: session.userId, recordedAt: stamp, note: null },
      create: { schoolId: guardian.schoolId, guardianId: guardian.id, typeCode: type.code, status: input.status, means: input.status === "GIVEN" ? "PORTAL" : null, recordedById: session.userId, recordedAt: stamp },
    });
    await prisma.auditLog.create({
      data: {
        schoolId: guardian.schoolId, actorId: session.userId, action: "UPDATE", entityType: "Consent", entityId: guardian.id,
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
    const { guardianIds, schoolIds, children, siteAt, many, todayLead, todayAt } = await this.context(session);
    // Each school sets its own answer times for its own kinds of request; where they differ, the slower one is the honest promise.
    const perSchool = await Promise.all(schoolIds.map((id) => submissionTypes(id)));
    const types = [...new Map(perSchool.flat().map((type) => [type.name, type])).values()].map((type) => ({
      ...type,
      target: Math.max(...perSchool.flat().filter((other) => other.name === type.name).map((other) => other.target)),
    }));
    const mine = scope === "all" ? null : children.find((student) => student.id === scope) ?? null;
    const rows = await prisma.guardianSubmission.findMany({
      where: {
        guardianId: { in: guardianIds }, deliveryId: null,
        ...(mine ? { OR: [{ studentId: mine.id }, { studentId: null }] } : {}),
      },
      orderBy: { createdAt: "desc" }, take: 80,
      include: { student: { select: { id: true, firstName: true } } },
    });
    const target = new Map(types.map((type) => [type.name, type.target]));
    const today = todayLead;
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
        // Late is judged on the day it is at the school that has the request.
        due, late: open && Boolean(due) && due! < todayAt(row.schoolId), channel: row.channel,
        school: many ? siteAt(row.schoolId)?.shortName?.trim() || siteAt(row.schoolId)?.name || "" : "",
      };
    });
    const answered = items.filter((item) => item.closed && item.state !== "Withdrawn");
    const typical = answered.length
      ? Math.round((answered.reduce((sum, item) => sum + (dayOf(item.closed!).getTime() - dayOf(item.opened).getTime()) / DAY, 0) / answered.length) * 10) / 10
      : null;
    return {
      today, items, typical,
      types: types.map((type) => ({ name: type.name, days: type.target, reviewer: type.reviewer, accepted: type.accepted })),
      children: children.map((student) => ({ id: student.id, first: student.firstName, name: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "), school: many ? siteAt(student.schoolId)?.shortName?.trim() || siteAt(student.schoolId)?.name || "" : "" })),
    };
  }

  /** A family withdraws a request they no longer need. It closes now, and the owner is told. */
  async withdrawRequest(session: SessionPayload, id: string) {
    const { guardian, guardianIds } = await this.context(session);
    const row = await prisma.guardianSubmission.findFirst({ where: { id, guardianId: { in: guardianIds } } });
    if (!row) throw new NotFoundException("That request is not one of yours.");
    if (row.state === "RESOLVED" || row.state === "DECLINED") throw new BadRequestException("That request is already closed.");
    const stamp = new Date();
    await prisma.guardianSubmission.update({ where: { id }, data: { state: "DECLINED", outcome: `Withdrawn by the family on ${isoDay(stamp)}.`, resolvedAt: stamp } });
    if (row.ownerUserId) {
      await prisma.notificationLog.create({
        data: { schoolId: row.schoolId, userId: row.ownerUserId, channel: "IN_APP", title: `A family withdrew their ${row.type.toLowerCase()}`, body: `${guardian.firstName} ${guardian.lastName} no longer needs it answered.`, status: "SENT", sentAt: stamp },
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
    const { children, term, at, termAt, siteAt, many, sees } = await this.context(session);
    if (!sees.has("Results")) throw new ForbiddenException("Your school has not made results visible to parents.");
    const shown = children.filter((student) => at(student.id).policy.sees.has("Results"));
    const mine = scope === "all" ? shown : shown.filter((student) => student.id === scope);
    const ids = mine.map((student) => student.id);
    const showCards = mine.some((student) => at(student.id).policy.sees.has("Report cards"));
    if (!ids.length) return { children: [], components: [], ahead: [], showCards, term: term ? { name: term.name, session: term.academicSession.name } : null };

    const classIds = [...new Set(mine.map((student) => student.currentClassId).filter((id): id is string => Boolean(id)))];
    // A school's assessment scheme, its release dates and its approved sheets are its own; each school is asked about its own current term.
    const theirSchools = [...new Set(mine.map((student) => student.schoolId))];
    const running = theirSchools.filter((id) => termAt(id));
    const inTerm = running.map((id) => ({ schoolId: id, termId: termAt(id)!.id }));
    const [cards, sheets, components, windows] = await Promise.all([
      showCards
        ? prisma.reportCard.findMany({
            where: { schoolId: { in: theirSchools }, studentId: { in: ids.filter((id) => at(id).policy.sees.has("Report cards")) }, status: { in: ["PUBLISHED", "LOCKED"] }, publishedAt: { not: null } },
            include: { term: { include: { academicSession: true } } },
            orderBy: { publishedAt: "desc" },
          })
        : Promise.resolve([]),
      inTerm.length && classIds.length ? prisma.scoreSheet.findMany({ where: { OR: inTerm, classId: { in: classIds }, status: "APPROVED" }, select: { schoolId: true, classId: true, subjectId: true } }) : Promise.resolve([]),
      running.length ? prisma.assessmentComponent.findMany({ where: { OR: running.map((id) => ({ schoolId: id, OR: [{ termId: termAt(id)!.id }, { termId: null }] })), isActive: true }, orderBy: { order: "asc" } }) : Promise.resolve([]),
      inTerm.length ? prisma.assessmentWindow.findMany({ where: { OR: inTerm }, select: { schoolId: true, componentId: true, releaseAt: true, appliesTo: true } }) : Promise.resolve([]),
    ]);
    const entries = sheets.length
      ? await prisma.scoreEntry.findMany({
          where: { OR: inTerm.map((pair) => ({ schoolId: pair.schoolId, resultSheet: { termId: pair.termId } })), studentId: { in: ids }, isDraft: false, subjectId: { in: [...new Set(sheets.map((sheet) => sheet.subjectId))] } },
          select: { studentId: true, subjectId: true, assessmentComponentId: true, score: true, maxScore: true, subject: { select: { name: true } } },
        })
      : [];
    const now = Date.now();
    const whose = (schoolId: string) => (many ? siteAt(schoolId)?.shortName?.trim() || siteAt(schoolId)?.name || "" : "");

    return {
      showCards,
      term: term ? { name: term.name, session: term.academicSession.name } : null,
      /** Every school's scheme, each saying whose it is, because a child is only ever marked under their own. */
      components: components.map((component) => ({ id: component.id, schoolId: component.schoolId, code: component.code, name: component.name, weight: component.weight, max: component.maxScore })),
      /** The days a school will release a set of scores, soonest first. */
      ahead: windows
        .filter((window) => window.releaseAt.getTime() > now)
        .sort((a, b) => a.releaseAt.getTime() - b.releaseAt.getTime())
        .map((window) => ({ what: components.find((component) => component.id === window.componentId)?.name ?? "Scores", on: isoDay(window.releaseAt), appliesTo: window.appliesTo, school: whose(window.schoolId) })),
      children: mine.map((student) => {
        const arm = armName(student.currentClass?.name, student.currentClass?.arm);
        const released = new Set(sheets.filter((sheet) => sheet.classId === student.currentClassId).map((sheet) => sheet.subjectId));
        const theirs = windows.filter((window) => window.schoolId === student.schoolId);
        const releaseOf = new Map(theirs.filter((window) => /^every class$/i.test(window.appliesTo) || window.appliesTo.toLowerCase().includes(arm.toLowerCase())).map((window) => [window.componentId, window.releaseAt]));
        const mineEntries = entries.filter((entry) => entry.studentId === student.id && released.has(entry.subjectId));
        const subjects = new Map<string, { name: string; parts: Array<{ code: string; name: string; max: number; score: number | null; on: string | null }> }>();
        for (const entry of mineEntries) {
          const component = components.find((item) => item.id === entry.assessmentComponentId && item.schoolId === student.schoolId);
          if (!component) continue;
          const at = releaseOf.get(component.id) ?? null;
          const open = !at || at.getTime() <= now;
          const slot = subjects.get(entry.subjectId) ?? { name: entry.subject.name, parts: [] };
          slot.parts.push({ code: component.code, name: component.name, max: entry.maxScore, score: open ? entry.score : null, on: at ? isoDay(at) : null });
          subjects.set(entry.subjectId, slot);
        }
        return {
          id: student.id, first: student.firstName, arm,
          schoolId: student.schoolId,
          school: whose(student.schoolId),
          term: termAt(student.schoolId) ? { name: termAt(student.schoolId)!.name, session: termAt(student.schoolId)!.academicSession.name } : null,
          cards: cards.filter((card) => card.studentId === student.id).map((card) => {
            const held = card.withheldAt ? { since: isoDay(card.withheldAt), reason: card.withheldReason ?? "" } : null;
            const data = held ? null : readCard(card.data);
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
    const { children, term, at, termAt, siteAt, many, sees, todayLead, todayAt, nowAt, zoneAt } = await this.context(session);
    if (!sees.has("Timetable")) throw new ForbiddenException("Your school has not made the timetable visible to parents.");
    const shown = children.filter((student) => at(student.id).policy.sees.has("Timetable"));
    const mine = scope === "all" ? shown : shown.filter((student) => student.id === scope);
    const classIds = [...new Set(mine.map((student) => student.currentClassId).filter((id): id is string => Boolean(id)))];
    // Each school's own current term: a child whose school is between terms has no week, whatever the other school is doing.
    const theirSchools = [...new Set(mine.map((student) => student.schoolId))];
    const running = theirSchools.filter((id) => termAt(id));
    const inTerm = running.map((id) => ({ schoolId: id, termId: termAt(id)!.id }));
    if (!classIds.length || !inTerm.length) return { week: 0, weeks: 0, today: todayLead, components: [], tests: [], children: mine.map((student) => emptyLearning(student)) };

    const today = todayLead;
    // A week is counted on the day it is at the school whose term it is.
    const weekIn = (row: { startDate: Date; endDate: Date; schoolId?: string } | null) => {
      if (!row) return { week: 0, weeks: 0 };
      const day = row.schoolId ? todayAt(row.schoolId) : today;
      const of = Math.max(1, Math.ceil((row.endDate.getTime() - row.startDate.getTime()) / (7 * DAY)));
      return { week: Math.min(of, Math.max(1, Math.floor((dayOf(day).getTime() - dayOf(isoDay(row.startDate)).getTime()) / (7 * DAY)) + 1)), weeks: of };
    };
    // The page's own heading follows the school they signed in to, falling back to whichever of their schools is in term.
    const lead = (term && running.includes(term.schoolId) ? term : termAt(running[0]!))!;
    const { week, weeks } = weekIn(lead);
    const [entries, exams, components, schemes, events] = await Promise.all([
      prisma.timetableEntry.findMany({
        where: { OR: inTerm, classId: { in: classIds }, isPublished: true },
        include: { subject: true },
        orderBy: [{ dayOfWeek: "asc" }, { periodNumber: "asc" }],
      }),
      prisma.examTimetableEntry.findMany({
        where: { OR: running.map((id) => ({ schoolId: id, examDate: { gte: dayOf(todayAt(id)) }, OR: [{ termId: termAt(id)!.id }, { termId: null }] })), classId: { in: classIds } },
        include: { subject: true },
        orderBy: { examDate: "asc" },
      }),
      prisma.assessmentComponent.findMany({ where: { OR: running.map((id) => ({ schoolId: id, OR: [{ termId: termAt(id)!.id }, { termId: null }] })), isActive: true }, orderBy: { order: "asc" } }),
      prisma.schemeOfWork.findMany({
        where: { OR: inTerm, classId: { in: classIds }, status: "APPROVED" },
        include: { subject: { select: { name: true } }, topics: { select: { weekNumber: true, topic: true, weekType: true } } },
      }),
      prisma.calendarEvent.findMany({
        where: {
          // Upcoming is judged on the day it is at the school that put the event on its calendar.
          OR: theirSchools.map((id) => ({ schoolId: id, endsAt: { gte: dayOf(todayAt(id)) } })),
          AND: [{ OR: ["exam", "test", "assess"].map((word) => ({ type: { contains: word, mode: "insensitive" as const } })) }],
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
      term: { name: lead.name, session: lead.academicSession.name },
      components: components.map((component) => ({ code: component.code, name: component.name, weight: component.weight, max: component.maxScore, school: many ? siteAt(component.schoolId)?.shortName?.trim() || siteAt(component.schoolId)?.name || "" : "" })),
      /** Tests and assessment weeks the school put on its calendar for families — not tied to one child's class. */
      tests: events
        .filter((event) => (event.visibleTo.length ? event.visibleTo.includes("Guardians") : /all|guardian|parent/i.test(event.audience)))
        .map((event) => ({ id: event.id, title: event.title, date: isoDay(event.startsAt), end: isoDay(event.endsAt), time: event.allDay ? "All day" : [event.startTime, event.endTime].filter(Boolean).join(" – "), where: event.location ?? "", school: many ? siteAt(event.schoolId)?.shortName?.trim() || siteAt(event.schoolId)?.name || "" : "" })),
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
          school: many ? siteAt(student.schoolId)?.shortName?.trim() || siteAt(student.schoolId)?.name || "" : "",
          /** The day and the clock at this child's school: a lesson is "now" by the school's clock, not the parent's. */
          today: todayAt(student.schoolId), now: nowAt(student.schoolId), zone: zoneAt(student.schoolId),
          published: own.length > 0, slots, periods,
          topics: schemes
            .filter((scheme) => scheme.classId === student.currentClassId)
            // Read against this child's own school's week, which is not the other school's.
            .map((scheme) => { const theirWeek = weekIn(termAt(student.schoolId)).week; return { subject: scheme.subject.name, teacher: scheme.teacherId ? teachers.get(scheme.teacherId) ?? "" : "", now: taught(scheme, theirWeek), next: taught(scheme, theirWeek + 1) }; })
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
    const { guardian, rows, children, schoolIds, siteAt } = await this.context(session);
    const site = await prisma.school.findUnique({ where: { id: guardian.schoolId }, select: { timezone: true } });
    const user = guardian.user;
    // Every school this login is a guardian at, named with the children it holds — one entry for the ordinary family.
    const mine = rows.flatMap((row) => row.students);
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
      schools: schoolIds.map((id) => {
        const place = siteAt(id);
        return {
          name: place?.name ?? "",
          short: place?.shortName?.trim() || place?.name || "",
          place: [place?.city, place?.state].filter(Boolean).join(", "),
          children: children.filter((student) => student.schoolId === id).map((student) => student.firstName),
        };
      }),
    };
  }

  /** Sign-in protection and the last times this account was used. */
  async security(session: SessionPayload) {
    this.assert(session);
    const user = await prisma.user.findFirst({
      where: { id: session.userId, deletedAt: null },
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
    const { rows } = await this.context(session);
    // Each school keeps its own contact list and its own copy of the record, and each rings its own
    // number in an emergency — so this goes to all of them, not only the one they signed in to.
    const toEach = async (type: string, detail: string) => {
      const sent = await Promise.all(rows.map((row) => openSubmission(row.schoolId, { guardianId: row.id, type, channel: "Portal", detail })));
      return sent[0]!;
    };
    if (input.kind === "copy") {
      return toEach("Data copy request", `I would like a copy of what the school holds about me and my children${input.note ? `. ${input.note}` : "."}`);
    }
    const changes = [
      input.phone && `phone number to ${input.phone}`,
      input.email && `email to ${input.email}`,
      input.address && `home address to ${input.address}`,
    ].filter(Boolean);
    if (!changes.length) throw new BadRequestException("Say what should change — a phone number, an email or an address.");
    return toEach("Contact update", `Please change my ${changes.join(", ")}.${input.note ? ` ${input.note}` : ""}`);
  }

  /* ───────────────────────── what reaches this parent ───────────────────────── */

  /**
   * Which kinds of school message reach this parent by SMS and email, and when they would rather not be disturbed.
   *
   * The choices are kept on the parent's own account, the same place the delivery worker already reads quiet hours from, and the
   * school's send path reads them before it counts a family as reached — so a switch here changes what is sent, not just what is shown.
   */
  async notifications(session: SessionPayload) {
    const { guardian, schoolIds } = await this.context(session);
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { preferences: true } });
    const prefs = (user?.preferences ?? {}) as Preferences;
    return {
      matrix: prefs.familyNotify ?? {},
      quiet: prefs.quietHours ?? "None",
      digest: prefs.digest ?? "combine",
      quietOptions: [...QUIET_HOURS],
      reach: {
        sms: Boolean(guardian.canReceiveSms && guardian.phone?.trim()),
        email: Boolean(guardian.canReceiveEmail && guardian.email?.trim()),
        // WhatsApp is only offered where the school's plan includes it, and only ever by the family's own choice.
        whatsapp: (await Promise.all(schoolIds.map((id) => plansFeatures.entitled(id, "communications.whatsapp")))).some((entitled) => entitled.allowed),
        phone: guardian.phone, address: guardian.email ?? null,
      },
    };
  }

  async saveNotifications(session: SessionPayload, body: unknown) {
    this.assert(session);
    const input = z.object({ matrix: preferencesSchema.shape.familyNotify, quiet: preferencesSchema.shape.quietHours, digest: preferencesSchema.shape.digest }).partial().parse(body);
    const current = await prisma.user.findUnique({ where: { id: session.userId }, select: { preferences: true } });
    const prefs = ((current?.preferences ?? {}) as Preferences);
    const next: Preferences = {
      ...prefs,
      ...(input.matrix ? { familyNotify: { ...(prefs.familyNotify ?? {}), ...input.matrix } } : {}),
      ...(input.quiet ? { quietHours: input.quiet } : {}),
      ...(input.digest ? { digest: input.digest } : {}),
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
    const { children, guardianIds, schoolIds, school, many } = await this.context(session);
    const mine = scope === "all" ? children : children.filter((student) => student.id === scope);
    const ids = mine.map((student) => student.id);
    if (!ids.length) return { school: { name: school?.name ?? "", short: school?.name ?? "", place: "", curriculum: "" }, children: [] };

    const [sites, health, collectors, links, documents, open, boarding] = await Promise.all([
      prisma.school.findMany({ where: { id: { in: schoolIds } }, select: { id: true, name: true, shortName: true, city: true, state: true, curriculumPreference: true } }),
      prisma.medicalRecord.findMany({ where: { studentId: { in: ids } } }),
      prisma.authorisedCollector.findMany({ where: { schoolId: { in: schoolIds }, studentId: { in: ids } }, orderBy: { createdAt: "asc" } }),
      prisma.studentGuardian.findMany({
        where: { studentId: { in: ids } },
        include: { guardian: { select: { id: true, firstName: true, lastName: true, relationship: true, phone: true, email: true, safeguardingRestrictedAt: true } } },
        orderBy: [{ isPrimary: "desc" }, { linkedAt: "asc" }],
      }),
      prisma.studentDocument.findMany({ where: { studentId: { in: ids } }, orderBy: { createdAt: "desc" } }),
      prisma.guardianSubmission.findMany({
        where: { guardianId: { in: guardianIds }, studentId: { in: ids }, type: { in: ["Record correction", "Collection change"] }, state: { notIn: ["RESOLVED", "DECLINED"] } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.hostelAllocation.findMany({ where: { schoolId: { in: schoolIds }, studentId: { in: ids }, endDate: null }, include: { room: { include: { building: { select: { name: true } } } } } }),
    ]);
    const teachers = await prisma.user.findMany({
      where: { id: { in: mine.map((student) => student.currentClass?.classTeacherId).filter((id): id is string => Boolean(id)) } },
      select: { id: true, firstName: true, lastName: true },
    });
    // The page's own heading is the school they signed in to; each child carries their own below.
    const site = sites.find((row) => row.id === (mine[0]?.schoolId ?? schoolIds[0])) ?? null;
    const place = [site?.city, site?.state].filter(Boolean).join(", ");
    const schoolOf = (id: string) => sites.find((row) => row.id === id) ?? null;

    return {
      school: { name: site?.name ?? "", short: site?.shortName?.trim() || site?.name || "", place, curriculum: site?.curriculumPreference ?? "" },
      children: mine.map((student) => {
        const record = health.find((item) => item.studentId === student.id) ?? null;
        const room = boarding.find((item) => item.studentId === student.id) ?? null;
        const tutor = teachers.find((teacher) => teacher.id === student.currentClass?.classTeacherId) ?? null;
        return {
          id: student.id,
          name: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
          title: `${student.firstName} ${student.lastName}`,
          first: student.firstName,
          initials: `${student.firstName[0] ?? ""}${student.lastName[0] ?? ""}`.toUpperCase(),
          admissionNumber: student.admissionNumber,
          dob: isoDay(student.dateOfBirth),
          gender: student.gender === "FEMALE" ? "Female" : student.gender === "MALE" ? "Male" : "Not recorded",
          arm: armName(student.currentClass?.name, student.currentClass?.arm),
          level: [student.currentClass?.classLevel?.name, student.currentClass?.stream].filter(Boolean).join(" · "),
          school: many ? schoolOf(student.schoolId)?.shortName?.trim() || schoolOf(student.schoolId)?.name || "" : "",
          curriculum: schoolOf(student.schoolId)?.curriculumPreference ?? "",
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
              const me = guardianIds.includes(link.guardian.id);
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
            .map((item) => ({ id: item.id, label: item.label, fileName: item.fileName, source: item.source ?? "", on: isoDay(item.documentOn ?? item.createdAt), checked: Boolean(item.verifiedAt), note: item.note, hasFile: item.fileUrl.startsWith("data:"), size: item.sizeBytes })),
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
    const { at } = await this.context(session);
    const { schoolId, guardianId } = at(student.id);
    const first = student.firstName;
    const detail = input.what === "Add a collection person"
      ? `Add a person who may collect ${first}: ${input.person?.name ?? ""}, ${input.person?.relation ?? ""}, ${input.person?.phone ?? ""}.${input.change ? ` ${input.change}` : ""}`
      : `${input.what} for ${first}: ${input.change}`;
    if (input.what === "Add a collection person" && !input.person) throw new BadRequestException("Say who should be added, and how the gate can reach them.");
    if (input.what !== "Add a collection person" && input.change.length < 4) throw new BadRequestException("Say what it should read instead.");
    return openSubmission(schoolId, {
      guardianId, childId: student.id, type: "Record correction", detail, channel: "Portal", evidence: input.evidence || null,
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
    let stored: { url: string; mime: string; bytes: number; name: string } | null = null;
    if (input.file) {
      const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(input.file.data);
      if (!match || !DOCUMENT_TYPES.includes(match[1]!)) throw new BadRequestException("Attach a PDF, or a PNG, JPEG or WebP photo.");
      stored = { url: input.file.data, mime: match[1]!, bytes: Math.floor((match[2]!.length * 3) / 4), name: input.file.name || input.fileName || input.type };
    }
    const made = await prisma.studentDocument.create({
      data: {
        studentId: student.id, label: input.type, fileName: stored?.name ?? (input.fileName || input.type), fileUrl: stored?.url ?? "",
        mimeType: stored?.mime ?? "application/octet-stream", sizeBytes: stored?.bytes ?? 0, source: "Uploaded by the family", documentOn: new Date(), note: input.note || null,
      },
    });
    return { id: made.id, kept: Boolean(stored) };
  }

  /** The file a family attached, handed back to them only. */
  async documentFile(session: SessionPayload, id: string) {
    const { children } = await this.context(session);
    const row = await prisma.studentDocument.findFirst({ where: { id, studentId: { in: children.map((student) => student.id) } } });
    if (!row || !row.fileUrl.startsWith("data:")) throw new NotFoundException("There is no file on that document.");
    const match = /^data:([^;]+);base64,(.+)$/s.exec(row.fileUrl);
    if (!match) throw new NotFoundException("There is no file on that document.");
    return { mime: match[1]!, bytes: Buffer.from(match[2]!, "base64"), name: row.fileName };
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
/** The same figure in the school's own money, because a family at two schools is billed in two currencies and the two never add up. */
const moneyIn = (currency: string, value: number) => {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return money(value);
  }
};
const shortDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const longDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const longDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** The shape of a published report card's snapshot, as the report-cards module writes it (version 2). */
type PublishedCard = {
  className: string; arm: string; formMaster: string | null; average: number | null; grade: string | null; gradeRemark: string | null;
  position: number | null; outOf: number; attendance: { days: number; present: number; absent: number; pct: number | null }; scheme: string; frameworkNote: string;
  classTeacherRemark: string; classTeacherBy: string | null; principalRemark: string; principalBy: string | null; resumption: string | null;
  traits: Array<{ title: string; items: Array<{ label: string; value: string }> }>;
  subjects: Array<{ subject: string; teacher: string | null; components: Array<{ name: string; short: string; max: number; score: number | "ABS" | null }>; total: number | null; grade: string | null; remark: string; pos: number | null; outOf: number; classAvg: number | null }>;
};

/**
 * A published card as the report-cards module now writes it (version 2), or as the first release did: a flat record with each subject's
 * continuous-assessment and examination totals. Both are read into one shape; a class size or a count of school days the older one never
 * kept is left at zero rather than invented.
 */
function readCard(raw: unknown): PublishedCard | null {
  const data = raw as Record<string, unknown> | null;
  if (!data || typeof data !== "object") return null;
  if (data.version === 2) return data as unknown as PublishedCard;
  const subjects = Array.isArray(data.subjects) ? (data.subjects as Array<Record<string, unknown>>) : [];
  if (!subjects.length || typeof data.average !== "number") return null;
  const pct = typeof data.attendance === "string" ? Number.parseFloat(data.attendance) : Number.NaN;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  return {
    className: text(data.className), arm: "", formMaster: null, average: data.average, grade: text(data.grade) || null, gradeRemark: text(data.promotionStatus) || null,
    position: typeof data.position === "number" ? data.position : null, outOf: 0,
    attendance: { days: 0, present: 0, absent: 0, pct: Number.isFinite(pct) ? pct : null }, scheme: "", frameworkNote: "",
    classTeacherRemark: text(data.classTeacherRemark), classTeacherBy: null, principalRemark: text(data.principalRemark), principalBy: null, resumption: null, traits: [],
    subjects: subjects.map((subject) => ({
      subject: text(subject.subject), teacher: null,
      components: [
        { name: "Continuous assessment", short: "CA", max: 0, score: typeof subject.caTotal === "number" ? subject.caTotal : null },
        { name: "Examination", short: "EXAM", max: 0, score: typeof subject.examTotal === "number" ? subject.examTotal : null },
      ],
      total: typeof subject.total === "number" ? subject.total : null, grade: text(subject.grade) || null, remark: text(subject.remark), pos: null, outOf: 0, classAvg: null,
    })),
  };
}

const reportSchema = z.object({
  child: z.string().min(1, "Choose which child this is for."),
  amount: z.coerce.number().min(1, "Say how much you paid."),
  method: z.enum(["Bank transfer", "At the bursary"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Say which day you paid."),
  reference: z.string().trim().max(60).optional(),
  note: z.string().trim().max(300).optional(),
});

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

/** What a family may attach: a scan or a photo of the paper, kept as a data URL so nothing depends on a file store. */
const DOCUMENT_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_DOCUMENT_CHARS = 2_200_000;

const documentSchema = z.object({
  child: z.string().min(1, "Choose which child this is for."),
  type: z.string().trim().min(2, "Say what the document is.").max(80),
  fileName: z.string().trim().max(120).optional(),
  note: z.string().trim().max(300).optional(),
  file: z.object({
    name: z.string().trim().max(160),
    data: z.string().max(MAX_DOCUMENT_CHARS, "That file is too large. Keep it under 1.5 MB."),
  }).optional(),
});

const stateWord = (state: string) => (state === "RESOLVED" ? "Resolved" : state === "DECLINED" ? "Declined" : state === "IN_PROGRESS" ? "In progress" : state === "ASSIGNED" ? "With the school" : "Received");

const CALENDAR_FEED = "parent-calendar-feed";
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
/** "JSS 1" + "Silver" → "JSS 1 Silver"; the school's own words for where a child sits. */
const armName = (name?: string | null, arm?: string | null) => [name, arm].filter(Boolean).join(" ") || "No class";
