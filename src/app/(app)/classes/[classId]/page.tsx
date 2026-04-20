import { ClassDetailClient } from "@/components/classes/class-detail-client";
import { AccessDenied } from "@/components/feedback/access-denied";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";

type PageProps = { params: Promise<{ classId: string }> };

export default async function ClassDetailPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/classes")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { classId } = await params;
  return <ClassDetailClient classId={classId} />;
}
