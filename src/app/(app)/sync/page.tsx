import { DetailTabs } from "@/components/data-display/detail-tabs";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { SyncStatusPanel } from "./_sync-status-panel";

type SyncPageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

function tabHref(tab: string) {
  return tab === "status" ? "/sync" : `/sync?tab=${tab}`;
}

export default async function SyncPage({ searchParams }: SyncPageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/sync"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const configResponse = await apiGet<{ mode: string; record: { lowBandwidthMode: boolean } }>(
    "/api/v1/configuration/school-information"
  );
  const lowBandwidthMode = configResponse.record.lowBandwidthMode;

  const params = searchParams ? await searchParams : {};
  const tab = params.tab ?? "status";

  const tabs = [
    { label: "Status", href: tabHref("status"), active: tab === "status" },
    { label: "Support", href: tabHref("support"), active: tab === "support" },
    { label: "Offline", href: tabHref("offline"), active: tab === "offline" }
  ];

  return (
    <div className="grid gap-5">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">Sync</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">Sync, Offline Status & Support Center</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Connectivity and offline-draft status for this device, and the low-bandwidth setting configured for your
          school.
        </p>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "status" ? (
        <div className="grid gap-5">
          <SyncStatusPanel variant="status" />
          <section className="surface-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Low-bandwidth mode</p>
            <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{lowBandwidthMode ? "Enabled" : "Disabled"}</p>
            <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
              Configured for your school in School → Configuration. When enabled, the app favours lighter, faster
              views for slower connections.
            </p>
          </section>
        </div>
      ) : null}

      {tab === "support" ? (
        <section className="surface-card p-6">
          <p className="section-eyebrow">No support-ticket system yet</p>
          <h2 className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">There is no in-app support center in this build</h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
            Raising and tracking support tickets from inside the school workspace isn&apos;t wired up yet — there is no
            genuine data to show here rather than a placeholder.
          </p>
        </section>
      ) : null}

      {tab === "offline" ? <SyncStatusPanel variant="offline" /> : null}
    </div>
  );
}
