import { safeApiGet } from "@/lib/principal/portal";
import type {
  AnnouncementView,
  AttendanceRecordView,
  DashboardSummary,
  FinanceDashboardView,
  ResultAnalyticsView,
  ResultApprovalView,
  StudentRecordView,
  TeacherRecordView
} from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

type ConfigTerm = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  order: number;
};

type ConfigSession = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  terms: ConfigTerm[];
};

type ConfigCalendarEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
};

type ReportCardSummary = { id: string; status: "DRAFT" | "GENERATED" | "PUBLISHED" | "LOCKED" };

export type SnapshotTone = "good" | "warn" | "danger" | "neutral";
export type SnapshotItem = { label: string; value: string; tone: SnapshotTone };
export type PulseCell = { label: string; value: string; change: string };
export type TermMilestone = { label: string; pct: number; state: "done" | "current" | "upcoming" };
export type TermProgress = { label: string; resumptionLabel: string; pct: number; dots: TermMilestone[] };
export type FinancialSnapshot = { collected: number; expected: number; items: SnapshotItem[] };

export type CommandCenterSnapshot = {
  pulse: PulseCell[];
  termProgress: TermProgress | null;
  academicSnapshot: SnapshotItem[];
  financialSnapshot: FinancialSnapshot;
  staffActivity: SnapshotItem[];
  commsSnapshot: SnapshotItem[];
};

function formatCurrencyCompact(value: number) {
  if (Math.abs(value) >= 1_000_000) return `₦${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `₦${(value / 1_000).toFixed(0)}k`;
  return `₦${value.toFixed(0)}`;
}

export async function loadCommandCenterSnapshot(overview: DashboardSummary): Promise<CommandCenterSnapshot> {
  const today = new Date().toISOString().slice(0, 10);

  const [
    students,
    todayAttendance,
    resultApprovals,
    academicAnalytics,
    reportCards,
    finance,
    teachers,
    sessionsTermsResponse,
    calendarResponse,
    announcements
  ] = await Promise.all([
    safeApiGet<StudentRecordView[]>("/api/v1/students", []),
    safeApiGet<AttendanceRecordView[]>(`/api/v1/attendance?date=${today}`, []),
    safeApiGet<ResultApprovalView[]>("/api/v1/academics/approval-queue", []),
    safeApiGet<ResultAnalyticsView>("/api/v1/academics/analytics", {
      metrics: [],
      classSummaries: [],
      subjectSummaries: [],
      statusBreakdown: [],
      missingScores: []
    }),
    safeApiGet<ReportCardSummary[]>("/api/v1/academics/report-cards", []),
    safeApiGet<FinanceDashboardView | null>("/api/v1/finance/dashboard", null),
    safeApiGet<TeacherRecordView[]>("/api/v1/teachers", []),
    safeApiGet<{ mode: string; records: ConfigSession[] }>("/api/v1/configuration/sessions-terms", {
      mode: "sessions_terms",
      records: []
    }),
    safeApiGet<{ mode: string; records: ConfigCalendarEvent[] }>("/api/v1/configuration/school-calendar", {
      mode: "table",
      records: []
    }),
    safeApiGet<AnnouncementView[]>("/api/v1/communications/announcements", [])
  ]);

  // Term progress
  const allSessions = sessionsTermsResponse.records;
  const currentSession = allSessions.find((s) => s.isCurrent) ?? allSessions[0] ?? null;
  const currentTermRecord = currentSession?.terms.find((t) => t.isCurrent) ?? null;

  let termProgress: TermProgress | null = null;

  if (currentTermRecord) {
    const termStart = new Date(currentTermRecord.startDate).getTime();
    const termEnd = new Date(currentTermRecord.endDate).getTime();
    const now = Date.now();
    const totalDays = Math.max(1, (termEnd - termStart) / 86_400_000);
    const elapsedDays = Math.min(totalDays, Math.max(0, (now - termStart) / 86_400_000));
    const pct = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
    const totalWeeks = Math.max(1, Math.round(totalDays / 7));
    const currentWeek = Math.min(totalWeeks, Math.max(1, Math.ceil((elapsedDays + 1) / 7)));

    const termsInSession = currentSession?.terms.slice().sort((a, b) => a.order - b.order) ?? [];
    const nextInSession = termsInSession.find((t) => t.order > currentTermRecord.order);
    const nextSession = allSessions
      .filter((s) => new Date(s.startDate).getTime() > new Date(currentSession?.endDate ?? 0).getTime())
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];
    const nextTerm = nextInSession ?? nextSession?.terms.slice().sort((a, b) => a.order - b.order)[0];

    const calendarDots = (calendarResponse.records ?? [])
      .filter((event) => {
        const start = new Date(event.startsAt).getTime();
        return start >= termStart && start <= termEnd;
      })
      .map((event) => ({
        label: event.title,
        pct: Math.min(100, Math.max(0, ((new Date(event.startsAt).getTime() - termStart) / (termEnd - termStart)) * 100)),
        state: new Date(event.startsAt).getTime() < now ? ("done" as const) : ("upcoming" as const)
      }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 4);

    termProgress = {
      label: `${currentTermRecord.name} · Week ${currentWeek} of ${totalWeeks}`,
      resumptionLabel: nextTerm ? `Resumption for ${nextTerm.name}: ${formatDate(nextTerm.startDate)}` : "No upcoming term configured yet",
      pct,
      dots: [
        { label: "Term start", pct: 0, state: "done" },
        ...calendarDots,
        { label: "Now", pct, state: "current" },
        { label: "Term end", pct: 100, state: pct >= 100 ? "done" : "upcoming" }
      ]
    };
  }

  // Pulse strip signals
  const classIds = new Set(students.filter((s) => s.classId).map((s) => s.classId));
  const markedClassIds = new Set(todayAttendance.filter((r) => r.classId).map((r) => r.classId));
  const unmarkedClasses = Math.max(0, classIds.size - markedClassIds.size);
  const presentToday = todayAttendance.filter((r) => r.status === "PRESENT").length;
  const attendanceRateToday = students.length ? (presentToday / students.length) * 100 : 0;

  const totalCollected = finance?.payments.reduce((sum, p) => sum + p.amount, 0) ?? 0;
  const totalExpected = finance?.invoices.reduce((sum, inv) => sum + inv.total, 0) ?? 0;
  const collectionRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

  const pendingResults = resultApprovals.filter((r) => !["APPROVED", "RETURNED"].includes(r.status));
  const pendingSubmitted = pendingResults.filter((r) => r.status === "SUBMITTED").length;
  const pendingReview = pendingResults.filter((r) => r.status === "UNDER_REVIEW").length;

  const staffPresentToday = teachers.filter((t) => t.attendanceStatusToday === "PRESENT").length;

  const pulse: PulseCell[] = [
    { label: "Enrolled", value: students.length.toLocaleString(), change: `across ${classIds.size} classes` },
    { label: "Attendance today", value: `${attendanceRateToday.toFixed(1)}%`, change: `${presentToday} of ${students.length} marked present` },
    { label: "Collection rate", value: `${collectionRate.toFixed(0)}%`, change: `${formatCurrencyCompact(totalCollected)} of ${formatCurrencyCompact(totalExpected)}` },
    { label: "Awaiting my approval", value: String(pendingResults.length), change: `${pendingSubmitted} submitted, ${pendingReview} under review` },
    { label: "Current term", value: currentTermRecord?.name ?? overview.currentTerm, change: termProgress ? termProgress.label.split("·")[1]?.trim() ?? "" : "Not configured" },
    { label: "Staff logged in", value: `${staffPresentToday} / ${teachers.length}`, change: teachers.length ? `${Math.round((staffPresentToday / teachers.length) * 100)}% today` : "No staff on record" }
  ];

  // Academic snapshot
  const pendingScoreSheets = academicAnalytics.classSummaries.reduce((sum, c) => sum + c.pending, 0);
  const reportCardsGenerated = reportCards.length;
  const reportCardsPublished = reportCards.filter((c) => c.status === "PUBLISHED").length;
  const chronicallyAbsent = students.filter((s) => s.attendanceRate < 75).length;

  const academicSnapshot: SnapshotItem[] = [
    { label: "Classes with attendance unmarked today", value: String(unmarkedClasses), tone: unmarkedClasses > 0 ? "warn" : "good" },
    { label: "Class-subjects with scores not yet submitted", value: String(pendingScoreSheets), tone: pendingScoreSheets > 0 ? "warn" : "good" },
    { label: "Results pending approval", value: String(pendingResults.length), tone: pendingResults.length > 0 ? "danger" : "good" },
    { label: "Report cards generated / published", value: `${reportCardsGenerated} / ${reportCardsPublished}`, tone: "neutral" },
    { label: "Students flagged chronically absent", value: String(chronicallyAbsent), tone: chronicallyAbsent > 0 ? "danger" : "good" }
  ];

  // Financial snapshot
  const totalOutstanding = finance?.invoices.reduce((sum, inv) => sum + inv.balance, 0) ?? 0;
  const studentPaymentTotals = new Map<string, number>();
  for (const invoice of finance?.invoices ?? []) {
    if (!invoice.studentId) continue;
    studentPaymentTotals.set(invoice.studentId, (studentPaymentTotals.get(invoice.studentId) ?? 0) + (invoice.paid ?? 0));
  }
  const studentsWithZeroPayment = Array.from(studentPaymentTotals.values()).filter((paid) => paid === 0).length;
  const feeTrendSorted = overview.feeTrend;
  const latestMonth = feeTrendSorted[feeTrendSorted.length - 1];
  const priorMonth = feeTrendSorted[feeTrendSorted.length - 2];
  const collectionDelta =
    latestMonth && priorMonth && priorMonth.collected > 0
      ? ((latestMonth.collected - priorMonth.collected) / priorMonth.collected) * 100
      : null;
  const paymentsToday = (finance?.payments ?? []).filter((p) => (p.paidAt ?? p.createdAt ?? "").slice(0, 10) === today).length;

  const financialSnapshot: FinancialSnapshot = {
    collected: totalCollected,
    expected: totalExpected,
    items: [
      { label: "Total outstanding", value: formatCurrencyCompact(totalOutstanding), tone: totalOutstanding > 0 ? "danger" : "good" },
      { label: "Students with zero payment", value: String(studentsWithZeroPayment), tone: studentsWithZeroPayment > 0 ? "warn" : "good" },
      {
        label: "Collection rate vs last month",
        value: collectionDelta === null ? "No prior data" : `${collectionDelta >= 0 ? "+" : ""}${collectionDelta.toFixed(0)}%`,
        tone: collectionDelta === null ? "neutral" : collectionDelta >= 0 ? "good" : "danger"
      },
      { label: "Payments recorded today", value: String(paymentsToday), tone: "neutral" }
    ]
  };

  // Staff activity
  const staffOnLeave = teachers.filter((t) => t.leaveStatus.toLowerCase().includes("approved")).length;
  const staffPendingResults = teachers.filter((t) => t.pendingResults > 0).length;
  const staffAbsentToday = teachers.filter((t) => t.attendanceStatusToday === "ABSENT").length;

  const staffActivity: SnapshotItem[] = [
    { label: "Staff present today", value: String(staffPresentToday), tone: "good" },
    { label: "On leave today", value: String(staffOnLeave), tone: "neutral" },
    { label: "Staff with pending results", value: String(staffPendingResults), tone: staffPendingResults > 0 ? "warn" : "good" },
    { label: "Absent today", value: String(staffAbsentToday), tone: staffAbsentToday > 0 ? "danger" : "good" }
  ];

  // Communication snapshot
  const smsCount = announcements.filter((a) => a.channel === "SMS").length;
  const emailCount = announcements.filter((a) => a.channel === "EMAIL").length;
  const inAppCount = announcements.filter((a) => a.channel === "IN_APP").length;

  const commsSnapshot: SnapshotItem[] = [
    { label: "Announcements sent", value: String(announcements.length), tone: "neutral" },
    { label: "Sent via SMS", value: String(smsCount), tone: "neutral" },
    { label: "Sent via Email", value: String(emailCount), tone: "neutral" },
    { label: "Sent via in-app", value: String(inAppCount), tone: "neutral" }
  ];

  return { pulse, termProgress, academicSnapshot, financialSnapshot, staffActivity, commsSnapshot };
}
