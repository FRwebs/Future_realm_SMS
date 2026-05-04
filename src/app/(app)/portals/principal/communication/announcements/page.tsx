import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PrincipalDataList, PrincipalInfoCard, PrincipalMetricCard, PrincipalPageHeader, PrincipalQuickLink } from "@/components/portals/principal-portal-ui";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { bucketAnnouncements, loadPrincipalDashboardBundle } from "@/lib/principal/portal";
import { formatDate } from "@/lib/utils/formatters";

export default async function PrincipalAnnouncementsPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/principal/communication/announcements"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { announcements } = await loadPrincipalDashboardBundle();
  const sorted = bucketAnnouncements(announcements);
  const channelMix = Object.entries(
    sorted.reduce<Record<string, number>>((accumulator, item) => {
      accumulator[item.channel] = (accumulator[item.channel] ?? 0) + 1;
      return accumulator;
    }, {}),
  ).sort((left, right) => right[1] - left[1]);

  return (
    <div className="grid gap-6">
      <PrincipalPageHeader
        eyebrow="Announcements desk"
        title="School-wide announcement visibility"
        description="Leadership can scan recent announcements, see target audiences, and jump into the underlying communication workspace when it’s time to publish."
        actions={<PrincipalQuickLink href="/communications" label="Open communications module" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <PrincipalMetricCard label="Announcements" value={sorted.length} helper="Recent school notices visible through the communications feed." />
        <PrincipalMetricCard label="Latest Publish" value={sorted[0] ? formatDate(sorted[0].publishedAt) : "--"} helper="Most recent publish date in the current feed." tone="gold" />
        <PrincipalMetricCard label="Audience Types" value={new Set(sorted.map((item) => item.audience)).size} helper="Distinct audiences currently being targeted." tone="amber" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <PrincipalInfoCard
          title="Channel mix"
          description="Where school communication has been flowing recently."
        >
          <PrincipalDataList
            items={channelMix.slice(0, 4).map(([label, value]) => ({
              label,
              value,
              detail: "Announcements routed through this channel.",
            }))}
          />
        </PrincipalInfoCard>

        <PrincipalInfoCard
          title="Recent notices"
          description="The latest broadcasted messages leadership may want to reference before the next send."
        >
          <div className="grid gap-3">
            {sorted.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="rounded-[1.25rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3"
              >
                <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">{item.audience} · {item.channel}</p>
              </div>
            ))}
          </div>
        </PrincipalInfoCard>
      </section>

      <TableCard
        title="Announcement register"
        description="Recent notices and their audience/channel footprint."
        items={sorted}
        emptyState="No announcements are available yet."
        columns={[
          {
            key: "title",
            header: "Announcement",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{item.body}</p>
              </div>
            ),
          },
          { key: "audience", header: "Audience", render: (item) => item.audience },
          { key: "channel", header: "Channel", render: (item) => item.channel },
          { key: "date", header: "Published", render: (item) => formatDate(item.publishedAt) },
        ]}
      />
    </div>
  );
}
