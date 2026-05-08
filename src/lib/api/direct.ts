import "server-only";

import { DashboardService } from "../../../backend/src/modules/dashboard/dashboard.service";
import { StudentsService } from "../../../backend/src/modules/students/students.service";
import { FinanceService } from "../../../backend/src/modules/finance/finance.service";
import { TeacherPortalService } from "../../../backend/src/modules/teacher-portal/teacher-portal.service";
import { TeachersService } from "../../../backend/src/modules/teachers/teachers.service";
import { TimetableService } from "../../../backend/src/modules/timetable/timetable.service";
import { ClassesService } from "../../../backend/src/modules/classes/classes.service";

import { getServerSession } from "@/lib/auth/session";
import {
  DashboardSummary,
  FinanceDashboardView,
  StudentRecordView,
  TeacherActivityView,
  TeacherPortalView,
  TeacherRecordView,
} from "@/lib/domain/types";
import type { ClassListItem, PaginatedResponse } from "@/components/classes/classes-list-client";

type DirectApiResultMap = {
  "/api/v1/dashboard/overview": DashboardSummary;
  "/api/v1/bursary/dashboard": FinanceDashboardView;
  "/api/v1/finance/dashboard": FinanceDashboardView;
  "/api/v1/students": StudentRecordView[];
  "/api/v1/teachers": TeacherRecordView[];
  "/api/v1/teachers/activities": TeacherActivityView[];
  "/api/v1/teacher-portal/dashboard": TeacherPortalView;
  "/api/v1/timetable/classes": unknown;
  "/api/v1/classes": PaginatedResponse<ClassListItem>;
};

type DirectApiPath = keyof DirectApiResultMap;

const dashboardService = new DashboardService();
const studentsService = new StudentsService();
const financeService = new FinanceService();
const teachersService = new TeachersService();
const teacherPortalService = new TeacherPortalService();
const timetableService = new TimetableService();
const classesService = new ClassesService();

function isDirectApiPath(path: string): path is DirectApiPath {
  return path === "/api/v1/dashboard/overview"
    || path === "/api/v1/bursary/dashboard"
    || path === "/api/v1/finance/dashboard"
    || path === "/api/v1/students"
    || path === "/api/v1/teachers"
    || path === "/api/v1/teachers/activities"
    || path === "/api/v1/teacher-portal/dashboard"
    || path === "/api/v1/timetable/classes"
    || path === "/api/v1/classes";
}

export async function resolveDirectApiGet<T>(path: string): Promise<T | null> {
  const [pathname, queryString] = path.split("?");
  const classDetailMatch = pathname.match(/^\/api\/v1\/classes\/([^/]+)$/);
  const classMembersMatch = pathname.match(/^\/api\/v1\/classes\/([^/]+)\/members$/);
  const classResultsMatch = pathname.match(/^\/api\/v1\/classes\/([^/]+)\/results$/);
  const classAttendanceMatch = pathname.match(/^\/api\/v1\/classes\/([^/]+)\/attendance$/);
  const classSkillsMatch = pathname.match(/^\/api\/v1\/classes\/([^/]+)\/skills$/);

  const session = await getServerSession();
  if (!session) {
    return null;
  }

  if (classDetailMatch) {
    return (await classesService.getClassDetail(session, classDetailMatch[1])) as T;
  }

  if (classMembersMatch) {
    const params = new URLSearchParams(queryString ?? "");
    return (await classesService.listClassMembers(session, classMembersMatch[1], {
      page: params.get("page") ?? undefined,
      pageSize: params.get("pageSize") ?? undefined,
      search: params.get("search") ?? undefined,
      status: params.get("status") ?? undefined,
      gender: params.get("gender") ?? undefined,
    })) as T;
  }

  if (classResultsMatch) {
    const params = new URLSearchParams(queryString ?? "");
    return (await classesService.getClassResults(session, classResultsMatch[1], {
      termId: params.get("termId") ?? undefined,
      term_id: params.get("term_id") ?? undefined,
    })) as T;
  }

  if (classAttendanceMatch) {
    const params = new URLSearchParams(queryString ?? "");
    return (await classesService.getClassAttendance(session, classAttendanceMatch[1], {
      termId: params.get("termId") ?? undefined,
      term_id: params.get("term_id") ?? undefined,
      month: params.get("month") ?? undefined,
    })) as T;
  }

  if (classSkillsMatch) {
    const params = new URLSearchParams(queryString ?? "");
    return (await classesService.getClassSkills(session, classSkillsMatch[1], {
      termId: params.get("termId") ?? undefined,
      term_id: params.get("term_id") ?? undefined,
    })) as T;
  }

  if (!isDirectApiPath(pathname)) {
    return null;
  }

  if (pathname === "/api/v1/dashboard/overview") {
    return (await dashboardService.getOverview(session)) as T;
  }

  if (pathname === "/api/v1/bursary/dashboard" || pathname === "/api/v1/finance/dashboard") {
    return (await financeService.getFinanceDashboard(session.schoolId)) as T;
  }

  if (pathname === "/api/v1/students") {
    const params = new URLSearchParams(queryString ?? "");
    return (await studentsService.listStudents(session.schoolId, {
      className: params.get("className") ?? undefined,
      status: params.get("status") ?? undefined,
      search: params.get("search") ?? undefined,
    })) as T;
  }

  if (pathname === "/api/v1/teachers") {
    const params = new URLSearchParams(queryString ?? "");
    return (await teachersService.listTeachers(session.schoolId, {
      className: params.get("className") ?? undefined,
      subject: params.get("subject") ?? undefined,
      search: params.get("search") ?? undefined,
    })) as T;
  }

  if (pathname === "/api/v1/teachers/activities") {
    return (await teachersService.listTeacherActivities(session.schoolId)) as T;
  }

  if (pathname === "/api/v1/teacher-portal/dashboard") {
    return (await teacherPortalService.getTeacherDashboard(session)) as T;
  }

  if (pathname === "/api/v1/timetable/classes") {
    return (await timetableService.listClasses(session, {})) as T;
  }

  if (pathname === "/api/v1/classes") {
    const params = new URLSearchParams(queryString ?? "");
    return (await classesService.listClasses(session, {
      page: params.get("page") ?? undefined,
      pageSize: params.get("pageSize") ?? undefined,
      search: params.get("search") ?? undefined,
      category: params.get("category") ?? undefined,
      has_teacher: params.get("has_teacher") ?? undefined,
      hasTeacher: params.get("hasTeacher") ?? undefined,
      is_active: params.get("is_active") ?? undefined,
      isActive: params.get("isActive") ?? undefined,
      level: params.get("level") ?? undefined,
    })) as T;
  }

  return null;
}
