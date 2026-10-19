import { Injectable } from "@nestjs/common";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { armName, currentTerm } from "../attendance-management/attendance.shared";
import { loadAll, type ArmData } from "../score-results/arm";
import { CREDIT_MARK, loadBands, round1 } from "../score-results/scores.shared";

/**
 * What the school's own records say, in four segments: academic, attendance, financial and engagement.
 *
 * Every figure is read from the tables at the moment it is asked for, against this school's own grading bands — never a
 * generic scale. Where the records cannot answer (expenses are not kept here, nothing records who read an announcement)
 * the answer says so, rather than presenting a guess.
 */

const DAY = 86_400_000;
const num = (value: unknown) => Number(value ?? 0);
const pct = (part: number, whole: number) => (whole ? round1((part / whole) * 100) : null);

type TermRef = { id: string; name: string; startDate: Date; endDate: Date };

async function termsOf(schoolId: string): Promise<{ term: TermRef | null; previous: TermRef | null; session: string }> {
  const current = await currentTerm(schoolId);
  if (!current) return { term: null, previous: null, session: "" };
  const previous = await prisma.term.findFirst({ where: { schoolId, endDate: { lt: current.startDate } }, orderBy: { endDate: "desc" }, select: { id: true, name: true, startDate: true, endDate: true } });
  return { term: { id: current.id, name: current.name, startDate: current.startDate, endDate: current.endDate }, previous, session: current.academicSession?.name ?? "" };
}

async function attendanceRate(schoolId: string, termId: string | null) {
  if (!termId) return null;
  const marks = await prisma.studentAttendance.groupBy({ by: ["status"], where: { schoolId, termId, subjectId: null }, _count: { _all: true } });
  const total = marks.reduce((sum, row) => sum + row._count._all, 0);
  const absent = marks.find((row) => row.status === "ABSENT")?._count._all ?? 0;
  return total ? { rate: pct(total - absent, total) as number, marks: total } : null;
}

async function collection(schoolId: string, termId: string | null, current = false) {
  if (!termId) return null;
  // An invoice raised with no term still belongs to the term it was raised in, so the current term reads those too.
  const rows = await prisma.invoice.aggregate({ where: { schoolId, status: { notIn: ["VOID", "DRAFT"] }, ...(current ? { OR: [{ termId }, { termId: null }] } : { termId }) }, _sum: { total: true, balance: true } });
  const billed = num(rows._sum.total);
  return billed ? { billed, collected: billed - num(rows._sum.balance), rate: pct(billed - num(rows._sum.balance), billed) as number } : null;
}

function bySubject(arms: ArmData[]) {
  const map = new Map<string, { totals: number[]; pass: number; arms: Array<{ arm: string; mean: number | null; roll: number }>; unassigned: string[] }>();
  for (const arm of arms) for (const subject of arm.subjects) {
    const entry = map.get(subject.name) ?? { totals: [], pass: subject.passMark, arms: [], unassigned: [] };
    const totals = subject.rows.map((row) => row.total).filter((value): value is number => value !== null);
    entry.totals.push(...totals);
    entry.arms.push({ arm: arm.room.name, mean: subject.mean, roll: totals.length });
    if (subject.state === "Unassigned") entry.unassigned.push(arm.room.name);
    map.set(subject.name, entry);
  }
  return map;
}

@Injectable()
export class InsightsService {
  async overview(session: SessionPayload) {
    const schoolId = session.schoolId;
    const { term, previous, session: sessionName } = await termsOf(schoolId);
    const bandsInfo = await loadBands(schoolId);
    const termId = term?.id ?? null;

    const [sheets, previousSheets, attendance, previousAttendance, fees, previousFees, guardians, activated, loggedRecently, admitted, left] = await Promise.all([
      termId ? prisma.resultSheet.findMany({ where: { schoolId, termId, averageScore: { gt: 0 } }, select: { studentId: true, averageScore: true, grade: true } }) : [],
      previous ? prisma.resultSheet.aggregate({ where: { schoolId, termId: previous.id, averageScore: { gt: 0 } }, _avg: { averageScore: true } }) : null,
      attendanceRate(schoolId, termId),
      attendanceRate(schoolId, previous?.id ?? null),
      collection(schoolId, termId, true),
      collection(schoolId, previous?.id ?? null),
      prisma.guardian.count({ where: { schoolId, mergedIntoId: null } }),
      prisma.guardian.count({ where: { schoolId, mergedIntoId: null, user: { lastLoginAt: { not: null } } } }),
      prisma.guardian.count({ where: { schoolId, mergedIntoId: null, user: { lastLoginAt: { gte: new Date(Date.now() - 30 * DAY) } } } }),
      term ? prisma.student.count({ where: { schoolId, admissionDate: { gte: term.startDate, lte: term.endDate } } }) : 0,
      term ? prisma.studentChangeRequest.count({ where: { schoolId, field: "Status", after: "Withdrawn", status: "APPROVED", decidedAt: { gte: term.startDate } } }) : 0,
    ]);

    const average = sheets.length ? round1(sheets.reduce((sum, row) => sum + row.averageScore, 0) / sheets.length) : null;
    const previousAverage = previousSheets?._avg.averageScore ? round1(previousSheets._avg.averageScore) : null;

    /* academic · grade distribution, in this school's own bands */
    const counts = new Map<string, number>();
    for (const row of sheets) counts.set(row.grade ?? "—", (counts.get(row.grade ?? "—") ?? 0) + 1);
    const top = Math.max(...Array.from(counts.values()), 1);
    const grades = bandsInfo.bands.slice().sort((a, b) => b.min - a.min).map((band) => ({ label: band.label, remark: band.remark, min: band.min, max: Math.floor(band.max), count: counts.get(band.label) ?? 0, pct: Math.round(((counts.get(band.label) ?? 0) / top) * 100) }));
    const failing = grades.length ? grades[grades.length - 1] : null;

    /* the most persuasive chart: attendance against performance */
    const marks = termId ? await prisma.studentAttendance.groupBy({ by: ["studentId", "status"], where: { schoolId, termId, subjectId: null }, _count: { _all: true } }) : [];
    const perChild = new Map<string, { total: number; absent: number }>();
    for (const row of marks) {
      const entry = perChild.get(row.studentId) ?? { total: 0, absent: 0 };
      entry.total += row._count._all;
      if (row.status === "ABSENT") entry.absent += row._count._all;
      perChild.set(row.studentId, entry);
    }
    const buckets = [{ label: "Above 95%", test: (rate: number) => rate > 95 }, { label: "85 to 95%", test: (rate: number) => rate >= 85 && rate <= 95 }, { label: "Below 85%", test: (rate: number) => rate < 85 }].map((bucket) => {
      const group = sheets.filter((sheet) => { const entry = perChild.get(sheet.studentId); return entry && entry.total ? bucket.test(((entry.total - entry.absent) / entry.total) * 100) : false; });
      return { label: bucket.label, students: group.length, average: group.length ? round1(group.reduce((sum, row) => sum + row.averageScore, 0) / group.length) : null };
    });

    /* subjects across the school, against the last term */
    const arms = term ? await loadAll(schoolId, term) : [];
    const before = previous ? bySubject(await loadAll(schoolId, previous)) : new Map();
    const subjects = Array.from(bySubject(arms).entries()).map(([name, entry]) => {
      const mean = entry.totals.length ? round1(entry.totals.reduce((sum, value) => sum + value, 0) / entry.totals.length) : null;
      const prior = before.get(name);
      const priorMean = prior && prior.totals.length ? prior.totals.reduce((sum: number, value: number) => sum + value, 0) / prior.totals.length : null;
      const scored = entry.arms.filter((arm) => arm.mean !== null && arm.roll > 0);
      const lowest = scored.slice().sort((a, b) => (a.mean as number) - (b.mean as number))[0];
      const others = scored.filter((arm) => arm !== lowest);
      const otherMean = others.length ? others.reduce((sum, arm) => sum + (arm.mean as number), 0) / others.length : null;
      const gap = lowest && otherMean !== null ? Math.round(otherMean - (lowest.mean as number)) : 0;
      return {
        name,
        scored: entry.totals.length,
        average: mean,
        difficulty: mean === null ? null : mean >= 70 ? "Accessible" : mean >= 60 ? "Moderate" : "Demanding",
        pass: pct(entry.totals.filter((value) => value >= entry.pass).length, entry.totals.length),
        credit: pct(entry.totals.filter((value) => value >= CREDIT_MARK).length, entry.totals.length),
        movement: mean !== null && priorMean !== null ? round1(mean - priorMean) : null,
        insight: entry.totals.length === 0 ? (entry.unassigned.length ? `${entry.unassigned.length} ${entry.unassigned.length === 1 ? "arm has" : "arms have"} no teacher assigned` : "No scores entered yet") : entry.unassigned.length ? `${entry.unassigned.length} ${entry.unassigned.length === 1 ? "arm has" : "arms have"} no teacher assigned` : gap >= 8 ? `${lowest.arm} is ${gap} points below the other arms` : mean !== null && mean < 50 ? "The average is below the pass mark across the school" : "Consistent across the arms",
      };
    }).sort((a, b) => (b.average ?? -1) - (a.average ?? -1));

    /* attendance by weekday */
    const days = termId ? await prisma.studentAttendance.groupBy({ by: ["date", "status"], where: { schoolId, termId, subjectId: null }, _count: { _all: true } }) : [];
    const weekday = new Map<number, { total: number; absent: number }>();
    for (const row of days) {
      const index = new Date(row.date).getUTCDay();
      const entry = weekday.get(index) ?? { total: 0, absent: 0 };
      entry.total += row._count._all;
      if (row.status === "ABSENT") entry.absent += row._count._all;
      weekday.set(index, entry);
    }
    const weekdays = [1, 2, 3, 4, 5].map((index) => { const entry = weekday.get(index); return { label: ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][index], rate: entry && entry.total ? pct(entry.total - entry.absent, entry.total) : null }; });

    /* financial */
    const [aged, adjustments] = await Promise.all([
      prisma.invoice.aggregate({ where: { schoolId, balance: { gt: 0 }, status: { notIn: ["VOID", "DRAFT"] }, dueOn: { lt: new Date(Date.now() - 90 * DAY) } }, _sum: { balance: true }, _count: { _all: true } }),
      prisma.invoiceAdjustment.groupBy({ by: ["type"], where: { schoolId, type: { in: ["DISCOUNT", "WAIVER", "SCHOLARSHIP"] } }, _sum: { amount: true }, _count: { _all: true } }),
    ]);
    const agedFamilies = await prisma.invoice.groupBy({ by: ["studentId"], where: { schoolId, balance: { gt: 0 }, status: { notIn: ["VOID", "DRAFT"] }, dueOn: { lt: new Date(Date.now() - 90 * DAY) } } });
    const discounts = adjustments.reduce((sum, row) => sum + num(row._sum.amount), 0);
    const billedAll = await prisma.invoice.aggregate({ where: { schoolId, status: { notIn: ["VOID", "DRAFT"] } }, _sum: { total: true, balance: true } });

    /* engagement */
    const delivery = await prisma.notificationLog.groupBy({ by: ["channel", "status"], where: { schoolId }, _count: { _all: true } });
    const channels = new Map<string, { total: number; sent: number }>();
    for (const row of delivery) {
      const entry = channels.get(String(row.channel)) ?? { total: 0, sent: 0 };
      entry.total += row._count._all;
      if (/sent|deliver/i.test(row.status)) entry.sent += row._count._all;
      channels.set(String(row.channel), entry);
    }
    const unreachable = await prisma.student.findMany({ where: { schoolId, status: "ACTIVE", guardians: { some: { isPrimary: true, guardian: { userId: null, canReceiveSms: false } } } }, select: { currentClass: { select: { name: true, arm: true } } } });
    const unreachableBy = new Map<string, number>();
    for (const student of unreachable) unreachableBy.set(student.currentClass ? armName(student.currentClass) : "No arm", (unreachableBy.get(student.currentClass ? armName(student.currentClass) : "No arm") ?? 0) + 1);
    const worst = Array.from(unreachableBy.entries()).sort((a, b) => b[1] - a[1]);

    return {
      term: term ? { name: term.name, session: sessionName, previous: previous?.name ?? null } : null,
      kpis: {
        average, averageMove: average !== null && previousAverage !== null ? round1(average - previousAverage) : null, results: sheets.length,
        attendance: attendance?.rate ?? null, attendanceMove: attendance && previousAttendance ? round1(attendance.rate - previousAttendance.rate) : null,
        collection: fees?.rate ?? null, collectionMove: fees && previousFees ? round1(fees.rate - previousFees.rate) : null, billed: fees?.billed ?? 0,
        portal: { activated, guardians, never: guardians - activated, pct: pct(activated, guardians) },
        growth: { admitted, left, net: admitted - left },
      },
      grades, failing: failing ? { label: failing.label, count: failing.count, pct: pct(failing.count, sheets.length) } : null, scheme: bandsInfo.scheme,
      correlation: buckets,
      subjects,
      weekdays,
      financial: { billed: num(billedAll._sum.total), outstanding: num(billedAll._sum.balance), aged: num(aged._sum.balance), agedInvoices: aged._count._all, agedFamilies: agedFamilies.length, discounts, discountRules: adjustments.length, discountPct: pct(discounts, num(billedAll._sum.total)) },
      engagement: {
        signedIn30: loggedRecently, activated, signedInPct: pct(loggedRecently, activated),
        channels: Array.from(channels.entries()).map(([channel, entry]) => ({ channel, total: entry.total, sent: entry.sent })),
        unreachable: unreachable.length, worst: worst[0] ? { arm: worst[0][0], count: worst[0][1] } : null,
      },
    };
  }
}
