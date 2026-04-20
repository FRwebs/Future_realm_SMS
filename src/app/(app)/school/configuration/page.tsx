import { ConfigurationOverviewClient } from "@/components/configuration/configuration-overview-client";
import { AccessDenied } from "@/components/feedback/access-denied";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";

export default async function ConfigurationPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/school/configuration")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }
  return <ConfigurationOverviewClient />;
}
