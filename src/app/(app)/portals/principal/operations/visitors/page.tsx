import { TableCard } from "@/components/data-display/table-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PrincipalMetricCard, PrincipalPageHeader, PrincipalQuickLink } from "@/components/portals/principal-portal-ui";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadPrincipalOperationsBundle, personName } from "@/lib/principal/portal";
import { formatDate } from "@/lib/utils/formatters";

export default async function PrincipalVisitorsPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/principal/operations/visitors"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { visitors } = await loadPrincipalOperationsBundle();
  const active = visitors.filter((item) => !item.timeOut).length;
  const signedOut = visitors.filter((item) => Boolean(item.timeOut)).length;

  return (
    <div className="grid gap-6">
      <PrincipalPageHeader
        eyebrow="Visitor log"
        title="Campus visitor movement and front-desk visibility"
        description="Monitor who is on campus, who they came to see, and how the front desk is handling physical access through the day."
        actions={<PrincipalQuickLink href="/operations/front-desk" label="Open front desk desk" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <PrincipalMetricCard label="Visitor Records" value={visitors.length} helper="Recent log records pulled from front-desk operations." />
        <PrincipalMetricCard label="Currently In" value={active} helper="Visitors still signed in with no recorded sign-out yet." tone="amber" />
        <PrincipalMetricCard label="Signed Out" value={signedOut} helper="Visitors already closed out in the active sample window." />
      </section>

      <TableCard
        title="Visitor register"
        description="The principal’s read-only view of who visited, why they came, and who hosted them."
        items={visitors}
        emptyState="No visitor logs are available yet."
        columns={[
          {
            key: "visitor",
            header: "Visitor",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.visitorName}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{item.phone ?? "No phone"} · {item.passNumber ?? "No pass no."}</p>
              </div>
            ),
          },
          { key: "purpose", header: "Purpose", render: (item) => item.purpose },
          { key: "host", header: "Host", render: (item) => item.hostName ?? personName(item.hostUser) },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "in", header: "Signed in", render: (item) => formatDate(item.timeIn) },
        ]}
      />
    </div>
  );
}
