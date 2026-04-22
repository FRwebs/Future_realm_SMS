import { ClassDetailClient } from "@/components/classes/class-detail-client";
import { AccessDenied } from "@/components/feedback/access-denied";
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
  return <ClassDetailClient classId={classId} />;
}
