import { ConfigurationResourceClient } from "@/components/configuration/configuration-resource-client";
import { AccessDenied } from "@/components/feedback/access-denied";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";

export default async function ConfigurationResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/school/configuration"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }
  const { resource } = await params;
  return <ConfigurationResourceClient resource={resource} />;
}
