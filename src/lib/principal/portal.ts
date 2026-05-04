import type { Route } from "next";

import { apiGet } from "@/lib/api/server";
import type {
  AdmissionApplicationView,
  AdmissionMetricsView,
  AnnouncementView,
  DashboardSummary,
  FinanceDashboardView,
  ResultAnalyticsView,
  ResultApprovalView,
  StudentRecordView,
  TeacherActivityView,
  TeacherRecordView,
} from "@/lib/domain/types";

export type PrincipalPortalTab = {
  href: Route;
  label: string;
};

export type PrincipalBroadsheetRowView = {
  studentId: string;
  studentName: string;
  average: number;
  position?: number | null;
  principalRemark?: string | null;
};

export type PrincipalBroadsheetView = {
  id: string;
  broadsheetId: string;
  className: string;
  term: string;
  session?: string;
  status: string;
  approvalStage: string;
  completeStudents?: number;
  metrics?: {
    classAverage?: number;
  };
  rows: PrincipalBroadsheetRowView[];
};

export type PrincipalDisciplineRecordView = {
  id: string;
  category: string;
  severity: string;
  status: string;
  description: string;
  occurredAt: string;
  sanction?: string | null;
  outcome?: string | null;
  parentNotifiedAt?: string | null;
  student?: {
    firstName: string;
    lastName: string;
    admissionNumber?: string | null;
  } | null;
  reporter?: {
    firstName: string;
    lastName: string;
    email?: string | null;
  } | null;
  classRoom?: {
    name: string;
    arm?: string | null;
  } | null;
};

export type PrincipalVisitorLogView = {
  id: string;
  visitorName: string;
  phone?: string | null;
  purpose: string;
  hostName?: string | null;
  passNumber?: string | null;
  status: string;
  timeIn: string;
  timeOut?: string | null;
  createdBy?: {
    firstName: string;
    lastName: string;
    email?: string | null;
  } | null;
  hostUser?: {
    firstName: string;
    lastName: string;
    email?: string | null;
  } | null;
};

export type PrincipalStaffLeaveView = {
  id: string;
  type: string;
  reason: string;
  status: string;
  startDate: string;
  endDate: string;
  reviewedAt?: string | null;
  staff?: {
    employeeNo?: string | null;
    department?: { name: string } | null;
    user?: {
      firstName: string;
      lastName: string;
      email?: string | null;
    } | null;
  } | null;
};

export type PrincipalCalendarResourceView = {
  mode: "table";
  records: Array<{
    id: string;
    title: string;
    description?: string | null;
    eventType?: string | null;
    startsAt: string;
    endsAt: string;
    location?: string | null;
  }>;
};

export const principalAcademicTabs: PrincipalPortalTab[] = [
  { href: "/portals/principal/academics/performance", label: "Performance" },
  { href: "/portals/principal/academics/promotions", label: "Promotions" },
  { href: "/portals/principal/academics/report-comments", label: "Comments" },
];

export const principalPeopleTabs: PrincipalPortalTab[] = [
  { href: "/portals/principal/people/staff", label: "Staff" },
  { href: "/portals/principal/people/students", label: "Students" },
  { href: "/portals/principal/people/discipline", label: "Discipline" },
  { href: "/portals/principal/people/leaves", label: "Leave Requests" },
];

export const principalCommunicationTabs: PrincipalPortalTab[] = [
  { href: "/portals/principal/communication/announcements", label: "Announcements" },
  { href: "/portals/principal/communication/broadcast", label: "Broadcast" },
];

export const principalOperationsTabs: PrincipalPortalTab[] = [
  { href: "/portals/principal/operations/events", label: "Events" },
  { href: "/portals/principal/operations/visitors", label: "Visitors" },
];

export const principalReportTabs: PrincipalPortalTab[] = [
  { href: "/portals/principal/reports/analytics", label: "School Analytics" },
  { href: "/portals/principal/reports/finance", label: "Financial Summary" },
];

export async function safeApiGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiGet<T>(path);
  } catch {
    return fallback;
  }
}

export function personName(person?: { firstName: string; lastName: string } | null) {
  return person ? `${person.firstName} ${person.lastName}` : "Not assigned";
}

export function principalLabel(value?: string | null) {
  if (!value) return "Not set";
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function principalRecommendationForStudent(student: StudentRecordView) {
  if (student.averageScore >= 70 && student.attendanceRate >= 85) {
    return {
      decision: "PROMOTE",
      detail: "Strong academic and attendance signals this cycle.",
      tone: "success" as const,
    };
  }

  if (student.averageScore >= 50 && student.attendanceRate >= 75) {
    return {
      decision: "REVIEW",
      detail: "Meets minimum progression threshold but should be reviewed.",
      tone: "warning" as const,
    };
  }

  return {
    decision: "SUPPORT",
    detail: "Needs intervention before any final promotion decision.",
    tone: "danger" as const,
  };
}

export function summarizeAdmissionsStatus(applications: AdmissionApplicationView[]) {
  const offered = applications.filter((item) => item.status.includes("OFFER") || item.status === "APPROVED").length;
  const accepted = applications.filter((item) => item.status === "ACCEPTED" || item.status === "ENROLLED").length;
  const review = applications.filter((item) => ["REVIEWING", "RECOMMENDED", "SCREENING_COMPLETED"].includes(item.status)).length;
  return { offered, accepted, review };
}

export function bucketAnnouncements(announcements: AnnouncementView[]) {
  return announcements.slice().sort((left, right) => {
    return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
  });
}

export async function loadPrincipalDashboardBundle() {
  const [overview, finance, admissions, announcements, approvalQueue, teachers, teacherActivities] =
    await Promise.all([
      safeApiGet<DashboardSummary>("/api/v1/dashboard/overview", {
        schoolName: "School",
        schoolId: "",
        currentSession: "Current session",
        currentTerm: "Current term",
        metrics: [],
        attendanceTrend: [],
        feeTrend: [],
        admissionsByStage: [],
        alerts: [],
      }),
      safeApiGet<FinanceDashboardView | null>("/api/v1/finance/dashboard", null),
      safeApiGet<AdmissionMetricsView | null>("/api/v1/admissions/metrics", null),
      safeApiGet<AnnouncementView[]>("/api/v1/communications/announcements", []),
      safeApiGet<ResultApprovalView[]>("/api/v1/academics/approval-queue", []),
      safeApiGet<TeacherRecordView[]>("/api/v1/teachers", []),
      safeApiGet<TeacherActivityView[]>("/api/v1/teachers/activities", []),
    ]);

  return {
    overview,
    finance,
    admissions,
    announcements: bucketAnnouncements(announcements),
    approvalQueue,
    teachers,
    teacherActivities,
  };
}

export async function loadPrincipalAcademicBundle() {
  const [analytics, broadsheets] = await Promise.all([
    safeApiGet<ResultAnalyticsView>("/api/v1/academics/analytics", {
      metrics: [],
      classSummaries: [],
      subjectSummaries: [],
      statusBreakdown: [],
      missingScores: [],
    }),
    safeApiGet<PrincipalBroadsheetView[]>("/api/v1/academics/broadsheets", []),
  ]);

  return { analytics, broadsheets };
}

export async function loadPrincipalPeopleBundle() {
  const [teachers, teacherActivities, students, discipline, leaveRequests] =
    await Promise.all([
      safeApiGet<TeacherRecordView[]>("/api/v1/teachers", []),
      safeApiGet<TeacherActivityView[]>("/api/v1/teachers/activities", []),
      safeApiGet<StudentRecordView[]>("/api/v1/students", []),
      safeApiGet<PrincipalDisciplineRecordView[]>("/api/v1/operations/discipline", []),
      safeApiGet<PrincipalStaffLeaveView[]>("/api/v1/operations/staff-leave", []),
    ]);

  return { teachers, teacherActivities, students, discipline, leaveRequests };
}

export async function loadPrincipalOperationsBundle() {
  const [events, visitors] = await Promise.all([
    safeApiGet<PrincipalCalendarResourceView>("/api/v1/configuration/school-calendar", {
      mode: "table",
      records: [],
    }),
    safeApiGet<PrincipalVisitorLogView[]>("/api/v1/operations/visitors", []),
  ]);

  return { events, visitors };
}
