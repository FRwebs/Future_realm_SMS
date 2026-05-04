import { Injectable } from "@nestjs/common";
import { endOfDay, format, startOfDay, subDays } from "date-fns";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { hasRole } from "../../../../src/lib/auth/roles";
import { prisma } from "../../../../src/lib/db/prisma";
import { canSeeDashboardWidget, getDashboardQuickActions } from "../../../../src/lib/domain/dashboard";
import { DashboardActionItem, DashboardSummary, SchoolContextView } from "../../../../src/lib/domain/types";
import { formatNigeriaClassName } from "../../../../src/lib/school-options";
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
  async getSchoolContext(session: SessionPayload): Promise<SchoolContextView> {
    const school = await prisma.school.findUniqueOrThrow({
      where: { id: session.schoolId },
      include: {
        academicSessions: {
          where: { isCurrent: true },
          include: { terms: { where: { isCurrent: true } } },
          orderBy: { startDate: "desc" },
          take: 1,
        },
      },
    });

    return {
      schoolName: school.name,
      currentSession: school.academicSessions[0]?.name ?? "No active session",
      currentTerm: school.academicSessions[0]?.terms[0]?.name ?? "No active term",
    };
  }

  async getOverview(session: SessionPayload): Promise<DashboardSummary> {
    if (session.role === "PARENT") {
      return this.getParentOverview(session);
    }

    if (session.role === "STUDENT") {
      return this.getStudentOverview(session);
    }

    if (["TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER"].includes(session.role)) {
      return this.getTeacherOverview(session);
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
          : []),
        ...this.roleOperationalWidgets({
          role: session.role,
          admissionsInProgress,
          pendingApprovals,
          studentsCount,
          staffCount,
          todayAttendanceTotal: todayAttendance.length,
          absentToday: todayAttendance.filter((item) => item.status === "ABSENT").length,
          classCount,
          subjectCount,
          pendingLeave,
          staffLateToday,
          trainingCompliance,
          pendingBroadsheets,
          curriculumCoverage
        })
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
    return actions.filter((item) => !item.roleScope || hasRole(role, item.roleScope));
  }

  private roleOperationalWidgets(params: {
    role: SessionPayload["role"];
    admissionsInProgress: number;
    pendingApprovals: number;
    studentsCount: number;
    staffCount: number;
    todayAttendanceTotal: number;
    absentToday: number;
    classCount: number;
    subjectCount: number;
    pendingLeave: number;
    staffLateToday: number;
    trainingCompliance: number;
    pendingBroadsheets: number;
    curriculumCoverage: number;
  }) {
    const {
      role,
      admissionsInProgress,
      pendingApprovals,
      studentsCount,
      staffCount,
      todayAttendanceTotal,
      absentToday,
      classCount,
      subjectCount,
      pendingLeave,
      staffLateToday,
      trainingCompliance,
      pendingBroadsheets,
      curriculumCoverage
    } = params;

    if (hasRole(role, ["ADMISSIONS_OFFICER"])) {
      return [
        { label: "Applicants in pipeline", value: admissionsInProgress.toLocaleString("en-NG"), change: "Applications not yet enrolled" },
        { label: "Approval-ready files", value: pendingApprovals.toLocaleString("en-NG"), change: "Recommended, approved, or accepted records" },
        { label: "Active students", value: studentsCount.toLocaleString("en-NG"), change: "Enrollment baseline for conversion planning" },
        { label: "Classes available", value: classCount.toLocaleString("en-NG"), change: "Placement options for admitted learners" }
      ];
    }

    if (hasRole(role, ["GUIDANCE_COUNSELOR", "GUIDANCE_COUNSELLOR", "SCHOOL_NURSE", "NURSE"])) {
      return [
        { label: "Active learners", value: studentsCount.toLocaleString("en-NG"), change: "Students in welfare scope" },
        { label: "Absences today", value: absentToday.toLocaleString("en-NG"), change: "Possible welfare or health follow-up" },
        { label: "Attendance records", value: todayAttendanceTotal.toLocaleString("en-NG"), change: "Marked records today" },
        { label: "Classes monitored", value: classCount.toLocaleString("en-NG"), change: "Potential student-support coverage" }
      ];
    }

    if (hasRole(role, ["RECEPTIONIST", "TRANSPORT_COORDINATOR", "TRANSPORT_MANAGER", "HOSTEL_MANAGER", "HOSTEL_MASTER", "HOSTEL_MATRON", "HOSTEL_MISTRESS", "STORE_OFFICER", "SECURITY_OFFICER", "MAINTENANCE_OFFICER"])) {
      return [
        { label: "Active students", value: studentsCount.toLocaleString("en-NG"), change: "Students in operational scope" },
        { label: "Classes", value: classCount.toLocaleString("en-NG"), change: "Class groups for routing and support" },
        { label: "Absences today", value: absentToday.toLocaleString("en-NG"), change: "Operational follow-up signal" },
        { label: "Announcements", value: todayAttendanceTotal ? "Live" : "Quiet", change: "Use communications for parent-facing updates" }
      ];
    }

    if (hasRole(role, ["IT_ADMINISTRATOR", "ICT_CBT_ADMIN"])) {
      return [
        { label: "Students", value: studentsCount.toLocaleString("en-NG"), change: "Portal accounts requiring access support" },
        { label: "Staff", value: staffCount.toLocaleString("en-NG"), change: "Staff accounts and permissions context" },
        { label: "Classes", value: classCount.toLocaleString("en-NG"), change: "Class-based access and CBT group context" },
        { label: "Subjects", value: subjectCount.toLocaleString("en-NG"), change: "Learning and assessment setup context" }
      ];
    }

    if (hasRole(role, ["VICE_PRINCIPAL_ADMINISTRATION", "VICE_PRINCIPAL_SPECIAL_DUTIES", "ADMINISTRATOR", "ADMIN_OFFICER", "HR_OFFICER"])) {
      return [
        { label: "Staff records", value: staffCount.toLocaleString("en-NG"), change: "Administrative staff scope" },
        { label: "Pending leave", value: pendingLeave.toLocaleString("en-NG"), change: "Leave requests awaiting review" },
        { label: "Late staff", value: staffLateToday.toLocaleString("en-NG"), change: "Late staff clock-ins today" },
        { label: "CPD compliance", value: `${trainingCompliance}%`, change: "Mandatory training completion" }
      ];
    }

    if (hasRole(role, ["EXAM_OFFICER", "EXAMINATION_OFFICER", "VICE_PRINCIPAL_ACADEMICS", "HEAD_OF_DEPARTMENT"])) {
      return [
        { label: "Pending broadsheets", value: pendingBroadsheets.toLocaleString("en-NG"), change: "Draft, review, correction, or approval state" },
        { label: "Scheme coverage", value: `${curriculumCoverage}%`, change: "Termly topics taught/completed" },
        { label: "Classes", value: classCount.toLocaleString("en-NG"), change: "Class result and timetable scope" },
        { label: "Subjects", value: subjectCount.toLocaleString("en-NG"), change: "Active curriculum subjects" }
      ];
    }

    return [];
  }

  private async sessionContext(schoolId: string) {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      include: { academicSessions: { where: { isCurrent: true }, include: { terms: { where: { isCurrent: true } } } } }
    });
    return {
      schoolName: school?.name ?? "School",
      currentSession: school?.academicSessions[0]?.name ?? "No active session",
      currentTerm: school?.academicSessions[0]?.terms[0]?.name ?? "No active term"
    };
  }

  private emptyTrends() {
    return {
      attendanceTrend: [],
      feeTrend: [],
      admissionsByStage: [],
      alerts: []
    };
  }

  private async getParentOverview(session: SessionPayload): Promise<DashboardSummary> {
    const context = await this.sessionContext(session.schoolId);
    const guardian = await prisma.guardian.findFirst({
      where: { schoolId: session.schoolId, userId: session.userId },
      include: {
        students: {
          include: {
            student: {
              include: {
                currentClass: true,
                invoices: { where: { status: { not: "VOID" } }, select: { balance: true } },
                resultSheets: { where: { status: "PUBLISHED" }, take: 1, orderBy: { publishedAt: "desc" } },
                attendance: { take: 20, orderBy: { date: "desc" } }
              }
            }
          }
        }
      }
    });
    const children = guardian?.students.map((link) => link.student) ?? [];
    const balance = children.reduce((sum, student) => sum + student.invoices.reduce((inner, invoice) => inner + Number(invoice.balance), 0), 0);
    const publishedResults = children.reduce((sum, student) => sum + student.resultSheets.length, 0);
    const attendanceRecords = children.flatMap((student) => student.attendance);
    const present = attendanceRecords.filter((record) => record.status !== "ABSENT").length;
    const attendanceRate = attendanceRecords.length ? (present / attendanceRecords.length) * 100 : 0;

    return {
      schoolId: session.schoolId,
      ...context,
      metrics: [
        { label: "Linked children", value: String(children.length), change: "Children connected to this parent account" },
        { label: "Fee balance", value: formatCurrency(balance), change: balance > 0 ? "Outstanding across linked children" : "No outstanding balance" },
        { label: "Published results", value: String(publishedResults), change: "Visible report sheets" },
        { label: "Attendance", value: `${attendanceRate.toFixed(1)}%`, change: "Recent attendance across linked children" }
      ],
      roleWidgets: [],
      quickActions: [
        { label: "View Children", href: "/portals/parent/children", description: "Switch children and view attendance, fees, and results." },
        { label: "Pay Fees", href: "/portals/parent/children", description: "Open your child's fee account." },
        { label: "School Announcements", href: "/portals/parent/announcements", description: "Read school notices and family updates." }
      ],
      pendingActions: balance > 0 ? [{ id: "parent-fee-balance", title: "Outstanding fee balance", detail: "Open your child fee account to review invoices and payments.", href: "/portals/parent/children", tone: "warning" }] : [],
      recentActivity: children.slice(0, 5).map((student) => ({ id: student.id, title: studentName(student), detail: className(student.currentClass), time: "Linked child", category: "system" })),
      ...this.emptyTrends()
    };
  }

  private async getStudentOverview(session: SessionPayload): Promise<DashboardSummary> {
    const context = await this.sessionContext(session.schoolId);
    const student = await prisma.student.findFirst({
      where: { schoolId: session.schoolId, userId: session.userId },
      include: {
        currentClass: true,
        invoices: { where: { status: { not: "VOID" } }, select: { balance: true } },
        resultSheets: { where: { status: "PUBLISHED" }, take: 3, orderBy: { publishedAt: "desc" } },
        attendance: { take: 50, orderBy: { date: "desc" } },
        assignmentSubmissions: { take: 5, orderBy: { submittedAt: "desc" }, include: { assignment: true } }
      }
    });
    const balance = student?.invoices.reduce((sum, invoice) => sum + Number(invoice.balance), 0) ?? 0;
    const present = student?.attendance.filter((record) => record.status !== "ABSENT").length ?? 0;
    const attendanceRate = student?.attendance.length ? (present / student.attendance.length) * 100 : 0;

    return {
      schoolId: session.schoolId,
      ...context,
      metrics: [
        { label: "My class", value: student?.currentClass ? className(student.currentClass) : "Unassigned", change: "Current class placement" },
        { label: "Attendance", value: `${attendanceRate.toFixed(1)}%`, change: "Recent school attendance" },
        { label: "Fee balance", value: balance > 0 ? formatCurrency(balance) : "Paid", change: "Current fee account" },
        { label: "Published results", value: String(student?.resultSheets.length ?? 0), change: "Visible report sheets" }
      ],
      roleWidgets: [],
      quickActions: [
        { label: "View Timetable", href: "/portals/student/timetable", description: "See today's class schedule." },
        { label: "Assignments", href: "/portals/student/assignments", description: "Check pending assignments and submissions." },
        { label: "Results", href: "/portals/student/results", description: "View published results and reports." }
      ],
      pendingActions: (student?.assignmentSubmissions ?? []).length
        ? [{ id: "student-assignments", title: "Recent assignment activity", detail: "Open assignments to confirm submissions and deadlines.", href: "/portals/student/assignments", tone: "neutral" }]
        : [],
      recentActivity: (student?.assignmentSubmissions ?? []).map((submission) => ({ id: submission.id, title: submission.assignment.title, detail: submission.submittedAt ? "Submitted" : "Pending submission", time: submission.submittedAt?.toISOString() ?? "Not submitted", category: "academics" })),
      ...this.emptyTrends()
    };
  }

  private async getTeacherOverview(session: SessionPayload): Promise<DashboardSummary> {
    const context = await this.sessionContext(session.schoolId);
    const assignments = await prisma.classSubject.findMany({
      where: { schoolId: session.schoolId, teacherId: session.userId },
      include: { classRoom: { include: { students: true } }, subject: true }
    });
    const classCount = new Set(assignments.map((assignment) => assignment.classId)).size;
    const subjectCount = new Set(assignments.map((assignment) => assignment.subjectId)).size;
    const studentCount = new Set(assignments.flatMap((assignment) => assignment.classRoom.students.map((student) => student.id))).size;
    const pendingResults = await prisma.resultSheet.count({
      where: { schoolId: session.schoolId, createdById: session.userId, status: { in: ["DRAFT", "SUBMITTED", "RETURNED"] } }
    }).catch(() => 0);

    return {
      schoolId: session.schoolId,
      ...context,
      metrics: [
        { label: "Classes I teach", value: String(classCount), change: "Assigned classes" },
        { label: "Subjects I teach", value: String(subjectCount), change: "Assigned subjects" },
        { label: "Students in my classes", value: String(studentCount), change: "Teaching scope only" },
        { label: "Pending score sheets", value: String(pendingResults), change: "Draft/submitted/returned sheets" }
      ],
      roleWidgets: assignments.slice(0, 4).map((assignment) => ({ label: assignment.subject.name, value: className(assignment.classRoom), change: `${assignment.classRoom.students.length} students` })),
      quickActions: getDashboardQuickActions(session.role),
      pendingActions: [
        { id: "teacher-attendance", title: "Mark attendance", detail: "Open your attendance workspace for assigned classes.", href: "/portals/teacher/attendance", tone: "neutral" },
        { id: "teacher-scores", title: "Enter scores", detail: "Review pending score sheets for your assigned subjects.", href: "/portals/teacher/scores", tone: pendingResults > 0 ? "warning" : "neutral" }
      ],
      recentActivity: assignments.slice(0, 6).map((assignment) => ({ id: assignment.id, title: assignment.subject.name, detail: className(assignment.classRoom), time: "Assigned class", category: "academics" })),
      ...this.emptyTrends()
    };
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
