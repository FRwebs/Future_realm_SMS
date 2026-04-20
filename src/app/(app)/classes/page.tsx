import { ClassesListClient } from "@/components/classes/classes-list-client";
import { AccessDenied } from "@/components/feedback/access-denied";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";

export default async function ClassesPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/classes")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  return <ClassesListClient />;
}
