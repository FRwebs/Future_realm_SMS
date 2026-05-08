import { ClassDetailClient } from "@/components/classes/class-detail-client";
import type { ClassDetail, ClassMembersResponse } from "@/components/classes/class-detail-client";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";

type PageProps = { params: Promise<{ classId: string }> };

export default async function ClassDetailPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/classes"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { classId } = await params;
  const [initialDetail, initialMembers] = await Promise.all([
    apiGet<ClassDetail>(`/api/v1/classes/${classId}`),
    apiGet<ClassMembersResponse>(`/api/v1/classes/${classId}/members?page=1&pageSize=25`),
  ]);
  return <ClassDetailClient classId={classId} initialDetail={initialDetail} initialMembers={initialMembers} />;
}
