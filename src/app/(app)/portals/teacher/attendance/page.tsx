import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import type {
  TeacherAttendanceWorkspaceView,
  TeacherPortalView,
} from "@/lib/domain/types";

import { TeacherAttendanceClient } from "./_client";

export default async function TeacherAttendancePage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/teacher/attendance")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [portal, attendance] = await Promise.all([
    apiGet<TeacherPortalView>(
      "/api/v1/teacher-portal/dashboard",
    ),
    apiGet<TeacherAttendanceWorkspaceView>("/api/v1/teacher-portal/attendance"),
  ]);

  return <TeacherAttendanceClient portal={portal} attendance={attendance} />;
}
