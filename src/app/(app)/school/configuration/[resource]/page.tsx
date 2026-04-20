import { ConfigurationResourceClient } from "@/components/configuration/configuration-resource-client";
import { AccessDenied } from "@/components/feedback/access-denied";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";

export default async function ConfigurationResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/school/configuration")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }
  const { resource } = await params;
  return <ConfigurationResourceClient resource={resource} />;
}
