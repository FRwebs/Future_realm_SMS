import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { TeacherAssignmentTaskView, TeacherClassPortalView } from "@/lib/domain/types";

import { TeacherAssignmentsClient } from "./_client";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function normalizeSearchValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function TeacherAssignmentsPage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/teacher/assignments")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const resolvedSearch = searchParams ? await searchParams : {};
  const classId = normalizeSearchValue(resolvedSearch.classId) ?? "";

  const [portal, tasks] = await Promise.all([
    apiGet<{ assignedClasses: TeacherClassPortalView[] }>("/api/v1/teacher-portal/dashboard"),
    apiGet<TeacherAssignmentTaskView[]>("/api/v1/teacher-portal/tasks"),
  ]);

  return <TeacherAssignmentsClient portal={portal} tasks={tasks} initialClassId={classId} />;
}
