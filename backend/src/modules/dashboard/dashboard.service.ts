import { Injectable } from "@nestjs/common";
import { endOfDay, format, startOfDay, subDays } from "date-fns";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { demoDashboardSummary } from "../../../../src/lib/demo/data";
import { canSeeDashboardWidget, getDashboardQuickActions } from "../../../../src/lib/domain/dashboard";
import { DashboardActionItem, DashboardSummary } from "../../../../src/lib/domain/types";
import { formatNigeriaClassName } from "../../../../src/lib/school-options";
import { env } from "../../../../src/lib/utils/env";
import { formatCurrency } from "../../../../src/lib/utils/formatters";

function className(classRoom?: { name: string; arm: string | null } | null) {
  if (!classRoom) return "Unassigned";
  return formatNigeriaClassName(classRoom.arm ? `${classRoom.name} - ${classRoom.arm}` : classRoom.name);
}

function studentName(student: { firstName: string; lastName: string; middleName?: string | null }) {
  return [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
}

function isSchemaDriftError(error: unknown) {
  return error instanceof Error && /does not exist in the current database|column .* does not exist/i.test(error.message);
}

@Injectable()
export class DashboardService {
  async getOverview(session: SessionPayload): Promise<DashboardSummary> {
    if (env.DEMO_MODE) {
      const quickActions = getDashboardQuickActions(session.role);
      const roleWidgets = (demoDashboardSummary.roleWidgets ?? []).filter((widget) => {
        if (widget.label.toLowerCase().includes("payment")) return canSeeDashboardWidget(session.role, "finance");
        return true;
      });
      return {
        ...demoDashboardSummary,
        quickActions,
        roleWidgets,
        pendingActions: this.filterPendingActions(session.role, demoDashboardSummary.pendingActions ?? [])
      };
    }

    const schoolId = session.schoolId;
    const today = new Date();
    const weekStart = startOfDay(subDays(today, 6));
    const [school, studentsCount, staffCount, admissions, todayAttendance, weekAttendance, invoiceAgg, overdueInvoices, recentPayments, upcomingExams, announcements, resultCounts, pendingLeave, auditLogs, enrollmentByClass, classCount, subjectCount, pendingBroadsheets] =
      await Promise.all([
        prisma.school.findUniqueOrThrow({
          where: { id: schoolId },
          include: {
            academicSessions: { where: { isCurrent: true }, include: { terms: { where: { isCurrent: true } } } }
          }
        }),
        prisma.student.count({ where: { schoolId, status: "ACTIVE" } }),
        prisma.staffProfile.count({ where: { schoolId } }),
        prisma.admissionApplication.groupBy({ by: ["status"], where: { schoolId }, _count: true }),
        prisma.studentAttendance.findMany({
          where: { schoolId, date: { gte: startOfDay(today), lte: endOfDay(today) } },
          select: { status: true, student: { select: { currentClass: { select: { name: true, arm: true } } } } }
        }),
        prisma.studentAttendance.findMany({
          where: { schoolId, date: { gte: weekStart, lte: endOfDay(today) } },
          select: { date: true, status: true }
        }),
        prisma.invoice.aggregate({ where: { schoolId, status: { not: "VOID" } }, _sum: { total: true, balance: true } }),
        prisma.invoice.findMany({
          where: { schoolId, balance: { gt: 0 }, dueOn: { lt: today }, status: { notIn: ["PAID", "VOID"] } },
          include: { student: { include: { currentClass: true } } },
          orderBy: { dueOn: "asc" },
          take: 5
        }),
        prisma.payment.findMany({
          where: { schoolId },
          include: { student: true },
          orderBy: [{ paidAt: "desc" }, { reference: "desc" }],
          take: 5
        }),
        prisma.examTimetableEntry.findMany({
          where: { schoolId, examDate: { gte: today } },
          include: { subject: true, classRoom: true },
          orderBy: { examDate: "asc" },
          take: 5
        }),
        prisma.announcement.findMany({
          where: { schoolId, publishedAt: { lte: today }, OR: [{ expiresAt: null }, { expiresAt: { gte: today } }] },
          orderBy: { publishedAt: "desc" },
          take: 5
        }),
        prisma.resultSheet.groupBy({ by: ["status"], where: { schoolId }, _count: true }),
        prisma.leaveRequest.count({ where: { schoolId, status: "PENDING" } }),
        prisma.auditLog.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 8 }),
        prisma.student.groupBy({ by: ["currentClassId"], where: { schoolId, status: "ACTIVE" }, _count: true }),
        prisma.classRoom.count({ where: { schoolId } }),
        prisma.subject.count({ where: { schoolId, status: "ACTIVE" } }),
        prisma.broadsheet.count({ where: { schoolId, status: { in: ["DRAFT", "IN_REVIEW", "CORRECTION_REQUESTED", "APPROVED"] } } })
      ]);

    const currentSession = school.academicSessions[0]?.name ?? "No active session";
    const currentTerm = school.academicSessions[0]?.terms[0]?.name ?? "No active term";
    const presentCount = todayAttendance.filter((record) => record.status !== "ABSENT").length;
    const attendanceRate = todayAttendance.length ? (presentCount / todayAttendance.length) * 100 : 0;
    const collected = Number(invoiceAgg._sum.total ?? 0) - Number(invoiceAgg._sum.balance ?? 0);
    const admissionsInProgress = admissions
      .filter((item) => !["REJECTED", "DECLINED", "ENROLLED", "ACTIVE"].includes(item.status))
      .reduce((sum, item) => sum + item._count, 0);
    const pendingApprovals = admissions
      .filter((item) => ["RECOMMENDED", "APPROVED", "CONDITIONALLY_APPROVED", "ACCEPTED"].includes(item.status))
      .reduce((sum, item) => sum + item._count, 0);

    const classIds = enrollmentByClass.map((item) => item.currentClassId).filter(Boolean) as string[];
    const classRooms = classIds.length
      ? await prisma.classRoom.findMany({ where: { schoolId, id: { in: classIds } }, select: { id: true, name: true, arm: true } })
      : [];
    const classNameMap = new Map(classRooms.map((item) => [item.id, className(item)]));
    const [curriculumTotals, staffLateToday, trainingParticipants] = await Promise.all([
      prisma.curriculumTopic.groupBy({
        by: ["progressStatus"],
        where: { schoolId },
        _count: true
      }).catch((error: unknown) => {
        if (isSchemaDriftError(error)) return [];
        throw error;
      }),
      prisma.staffAttendance.count({
        where: { schoolId, date: { gte: startOfDay(today), lte: endOfDay(today) }, status: "LATE" }
      }),
      prisma.trainingParticipant.findMany({
        where: { schoolId, trainingProgram: { mandatory: true, archivedAt: null } },
        include: { trainingProgram: true },
        take: 500
      }).catch((error: unknown) => {
        if (isSchemaDriftError(error)) return [];
        throw error;
      })
    ]);
    const curriculumCount = curriculumTotals.reduce((sum, item) => sum + item._count, 0);
    const curriculumComplete = curriculumTotals
      .filter((item) => item.progressStatus === "COMPLETED" || item.progressStatus === "TAUGHT")
      .reduce((sum, item) => sum + item._count, 0);
    const curriculumCoverage = curriculumCount === 0 ? 0 : Number(((curriculumComplete / curriculumCount) * 100).toFixed(1));
    const trainingCompliance =
      trainingParticipants.length === 0
        ? 100
        : Number(((trainingParticipants.filter((item) => item.status === "COMPLETED").length / trainingParticipants.length) * 100).toFixed(1));

    const pendingActions = this.filterPendingActions(session.role, [
      {
        id: "admissions-pending-approval",
        title: `${pendingApprovals} admission item(s) awaiting decision or clearance`,
        detail: "Review principal decisions, offers, accepted applicants, and enrollment clearance.",
        href: "/admissions",
        tone: pendingApprovals > 0 ? "warning" : "neutral",
        roleScope: ["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "ADMISSIONS_OFFICER", "ACCOUNTANT"]
      },
      {
        id: "finance-overdue",
        title: `${overdueInvoices.length} overdue invoice sample(s) need follow-up`,
        detail: overdueInvoices[0] ? `${overdueInvoices[0].invoiceNumber} · ${studentName(overdueInvoices[0].student)}` : "No overdue invoices in the current sample.",
        href: "/finance/reports",
        tone: overdueInvoices.length ? "danger" : "neutral",
        roleScope: ["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "ACCOUNTANT"]
      },
      {
        id: "attendance-anomalies",
        title: `${todayAttendance.filter((item) => item.status === "ABSENT").length} absence record(s) today`,
        detail: "Check classes with absences and follow up with parents where required.",
        href: "/attendance",
        tone: todayAttendance.some((item) => item.status === "ABSENT") ? "warning" : "neutral",
        roleScope: ["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER"]
      },
      {
        id: "staff-leave",
        title: `${pendingLeave} pending staff leave request(s)`,
        detail: "Leadership should review leave requests before payroll export.",
        href: "/teachers",
        tone: pendingLeave ? "warning" : "neutral",
        roleScope: ["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER"]
      }
    ]);

    return {
      schoolName: school.name,
      schoolId: school.id,
      currentSession,
      currentTerm,
      metrics: [
        { label: "Total students", value: studentsCount.toLocaleString("en-NG"), change: "Active student register" },
        { label: "Total staff", value: staffCount.toLocaleString("en-NG"), change: "Staff profiles on record" },
        { label: "Admissions in progress", value: admissionsInProgress.toLocaleString("en-NG"), change: `${pendingApprovals} pending approvals/clearance` },
        { label: "Attendance Today", value: `${attendanceRate.toFixed(1)}%`, change: `${presentCount}/${todayAttendance.length || 0} marked present or excused` }
      ],
      roleWidgets: [
        ...(canSeeDashboardWidget(session.role, "finance")
          ? [
              { label: "Outstanding fees", value: formatCurrency(Number(invoiceAgg._sum.balance ?? 0)), change: "Open invoice balances" },
              { label: "Recent payments", value: formatCurrency(recentPayments.reduce((sum, item) => sum + Number(item.amount), 0)), change: "Latest 5 payment records" }
            ]
          : []),
        ...(canSeeDashboardWidget(session.role, "academics")
          ? [
              { label: "Classes", value: classCount.toLocaleString("en-NG"), change: "Configured Nigerian classes and arms" },
              { label: "Subjects", value: subjectCount.toLocaleString("en-NG"), change: "Active Nigerian curriculum subjects" },
              { label: "Pending approvals", value: pendingBroadsheets.toLocaleString("en-NG"), change: "Broadsheets awaiting action" },
              { label: "Published results", value: String(resultCounts.filter((item) => item.status === "PUBLISHED").reduce((sum, item) => sum + item._count, 0)), change: "Visible to portals" },
              { label: "Unpublished results", value: String(resultCounts.filter((item) => item.status !== "PUBLISHED").reduce((sum, item) => sum + item._count, 0)), change: "Awaiting publish/review" },
              { label: "Scheme coverage", value: `${curriculumCoverage}%`, change: "Termly scheme-of-work topics taught/completed" }
            ]
          : []),
        ...(canSeeDashboardWidget(session.role, "staff")
          ? [
              { label: "Teacher lateness", value: String(staffLateToday), change: "Late staff clock-ins today" },
              { label: "Training compliance", value: `${trainingCompliance}%`, change: "Mandatory teacher CPD completion" }
            ]
          : [])
      ],
      attendanceTrend: this.buildAttendanceTrend(weekAttendance),
      feeTrend: [{ month: format(today, "MMM"), collected: Number((collected / 1_000_000).toFixed(2)), outstanding: Number((Number(invoiceAgg._sum.balance ?? 0) / 1_000_000).toFixed(2)) }],
      enrollmentTrend: enrollmentByClass.map((item) => ({ label: item.currentClassId ? classNameMap.get(item.currentClassId) ?? "Unassigned" : "Unassigned", count: item._count })),
      admissionsByStage: admissions.map((item) => ({ stage: item.status, count: item._count })),
      quickActions: getDashboardQuickActions(session.role),
      pendingActions,
      upcomingExams: upcomingExams.map((exam) => ({
        id: exam.id,
        title: exam.subject.name,
        detail: `${className(exam.classRoom)} · ${exam.venue ?? "Exam venue pending"}`,
        startsAt: exam.examDate.toISOString(),
        href: "/academics/results"
      })),
      recentPayments: canSeeDashboardWidget(session.role, "finance")
        ? recentPayments.map((payment) => ({
            id: payment.id,
            reference: payment.reference,
            studentName: studentName(payment.student),
            amount: Number(payment.amount),
            status: payment.status,
            paidAt: payment.paidAt?.toISOString()
          }))
        : [],
      recentAnnouncements: announcements.map((announcement) => ({
        id: announcement.id,
        title: announcement.title,
        detail: announcement.body,
        publishedAt: announcement.publishedAt.toISOString(),
        href: "/communications"
      })),
      recentActivity: auditLogs
        .filter((log) => (log.entityType.toLowerCase().includes("payment") || log.entityType.toLowerCase().includes("invoice") ? canSeeDashboardWidget(session.role, "finance") : true))
        .map((log) => ({
          id: log.id,
          title: `${log.action} ${log.entityType}`,
          detail: log.entityId,
          time: log.createdAt.toISOString(),
          category: log.entityType.toLowerCase().includes("admission")
            ? "admissions"
            : log.entityType.toLowerCase().includes("invoice") || log.entityType.toLowerCase().includes("payment")
              ? "finance"
              : "system"
        })),
      alerts: pendingActions.map((item) => ({ id: item.id, title: item.title, detail: item.detail, tone: item.tone }))
    };
  }

  private filterPendingActions(role: SessionPayload["role"], actions: DashboardActionItem[]) {
    return actions.filter((item) => !item.roleScope || item.roleScope.includes(role));
  }

  private buildAttendanceTrend(records: Array<{ date: Date; status: string }>) {
    const trend = new Map<string, { present: number; total: number }>();
    for (let index = 6; index >= 0; index -= 1) {
      const day = subDays(new Date(), index);
      trend.set(format(day, "EEE"), { present: 0, total: 0 });
    }
    for (const record of records) {
      const key = format(record.date, "EEE");
      const entry = trend.get(key);
      if (!entry) continue;
      entry.total += 1;
      if (record.status !== "ABSENT") entry.present += 1;
    }
    return Array.from(trend.entries()).map(([day, value]) => ({
      day,
      rate: value.total === 0 ? 0 : Number(((value.present / value.total) * 100).toFixed(1))
    }));
  }
}
