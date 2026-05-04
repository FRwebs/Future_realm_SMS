import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canManagePath, getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { AcademicAssessmentView } from "@/lib/domain/types";

import AssessmentWorkspaceClient from "./workspace-client";

export default async function AssessmentFormatWorkspacePage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/academics/results/assessment-format"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { assessmentId } = await params;
  const [assessment, permissions] = await Promise.all([
    apiGet<AcademicAssessmentView>(`/api/v1/academics/academic-assessments/${assessmentId}`),
    getServerPermissions(session),
  ]);

  const canManageScores =
    canManagePath(session.role, "/academics/results") ||
    permissions.some((permission) => ["results.create", "results.edit"].includes(permission));

  return (
    <AssessmentWorkspaceClient
      assessment={assessment}
      canManageScores={canManageScores}
      sessionRole={session.role}
    />
  );
}
