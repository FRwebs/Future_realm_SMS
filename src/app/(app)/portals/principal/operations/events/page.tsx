import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PrincipalMetricCard, PrincipalPageHeader, PrincipalQuickLink } from "@/components/portals/principal-portal-ui";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadPrincipalOperationsBundle } from "@/lib/principal/portal";
import { formatDate } from "@/lib/utils/formatters";

export default async function PrincipalEventsPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/principal/operations/events"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { events } = await loadPrincipalOperationsBundle();

  return (
    <div className="grid gap-6">
      <PrincipalPageHeader
        eyebrow="Events & calendar"
        title="School event and calendar oversight"
        description="A principal-level read of the school calendar so major academic and community events stay visible without opening generic configuration tables."
        actions={<PrincipalQuickLink href="/school/configuration/school-calendar" label="Open calendar resource" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <PrincipalMetricCard label="Events" value={events.records.length} helper="Calendar items currently listed in school configuration." />
        <PrincipalMetricCard label="Next Event" value={events.records[0] ? formatDate(events.records[0].startsAt) : "--"} helper="Earliest currently scheduled date." tone="gold" />
        <PrincipalMetricCard label="Multi-day" value={events.records.filter((item) => item.startsAt !== item.endsAt).length} helper="Events spanning more than one day." tone="amber" />
      </section>

      <TableCard
        title="Calendar register"
        description="The full event feed currently available from school configuration."
        items={events.records}
        emptyState="No calendar events are available yet."
        columns={[
          { key: "title", header: "Event", render: (item) => item.title },
          { key: "type", header: "Type", render: (item) => item.eventType ?? "General" },
          { key: "start", header: "Starts", render: (item) => formatDate(item.startsAt) },
          { key: "end", header: "Ends", render: (item) => formatDate(item.endsAt) },
          { key: "location", header: "Location", render: (item) => item.location ?? "Not set" },
        ]}
      />
    </div>
  );
}
