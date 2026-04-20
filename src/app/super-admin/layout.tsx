import { AccessDenied } from "@/components/feedback/access-denied";
import { SuperAdminShell } from "@/components/super-admin/super-admin-shell";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { platformRoles } from "@/lib/navigation/registry";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) return null;
  if (!platformRoles.includes(session.role)) {
    return (
      <div className="min-h-screen bg-dashboard-grid p-6">
        <AccessDenied backHref={getDefaultPathForRole(session.role)} />
      </div>
    );
  }

  return <SuperAdminShell session={session}>{children}</SuperAdminShell>;
}
