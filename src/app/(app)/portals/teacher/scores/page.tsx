// No "use client" — this is a Server Component
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { TeacherClassPortalView, TeacherClassStudentView, TeacherScoreEntryView } from "@/lib/domain/types";
import { TeacherScoresClient } from "./_client";

export default async function TeacherScoresPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/teacher/scores")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [portal, scores] = await Promise.all([
    apiGet<{ assignedClasses: TeacherClassPortalView[]; students?: TeacherClassStudentView[] }>(
      "/api/v1/teacher-portal/dashboard"
    ),
    apiGet<TeacherScoreEntryView[]>("/api/v1/teacher-portal/scores"),
  ]);

  return <TeacherScoresClient portal={portal} scores={scores} />;
}
