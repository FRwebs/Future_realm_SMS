import Link from "next/link";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import type { SuperAdminFeatureFlagRow, SuperAdminInfraMonitoring } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "HEALTHY") return "success";
  if (status === "WARNING") return "warning";
  if (status === "CRITICAL") return "danger";
  return "neutral";
}

function StatCard({ label, value, detail, status }: { label: string; value: string; detail?: string; status?: string }) {
  return (
    <article className="surface-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
        {status ? <StatusBadge status={status} tone={statusTone(status)} /> : null}
      </div>
      <p className="mt-3 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{value}</p>
      {detail ? <p className="mt-1 text-[11px] font-medium text-[var(--color-text-muted)]">{detail}</p> : null}
    </article>
  );
}

function tabHref(tab: string) {
  return tab === "health" ? "/super-admin/system" : `/super-admin/system?tab=${tab}`;
}

export default async function SuperAdminSystemPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab = "health" } = searchParams ? await searchParams : {};
  const data = await apiGet<SuperAdminInfraMonitoring>("/api/super-admin/system/monitoring");

  const tabs = [
    { label: "Uptime & Performance", href: tabHref("health"), active: tab === "health" },
    { label: "Offline Sync Queue", href: tabHref("sync"), active: tab === "sync" },
    { label: "Notification Delivery", href: tabHref("delivery"), active: tab === "delivery" },
    { label: "Backups", href: tabHref("backups"), active: tab === "backups" },
    { label: "Integrations", href: tabHref("integrations"), active: tab === "integrations" },
    { label: "Flag Status", href: tabHref("flags"), active: tab === "flags" }
  ];

  return (
    <div className="grid gap-5">
      <section className="relative overflow-hidden rounded-[var(--radius-hero)] border border-[var(--color-border-strong)] bg-[#0d2315] p-6 text-white md:p-7">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 800 200" preserveAspectRatio="xMidYMid slice">
          <path d="M-50 180 Q 200 120 400 170 T 850 140" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" fill="none" />
          <path d="M-50 20 Q 240 -20 460 20 T 850 0" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
          <circle cx="700" cy="20" r="140" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
          <circle cx="700" cy="20" r="90" stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
        </svg>
        <div className="relative z-[1] flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/60">Technical operations</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-white">System & Infrastructure</h1>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[rgba(255,255,255,0.74)]">
              Uptime, offline sync queue, notification delivery, third-party integrations, and backups.
            </p>
          </div>
          <ResourceActionDialog
            triggerLabel="Trigger backup"
            title="Trigger a manual backup"
            description="Runs a full database backup now. A critical alert fires automatically if a backup ever fails."
            endpoint="/api/super-admin/system/backups"
            method="POST"
            variant="secondary"
            submitLabel="Run backup now"
            confirmLabel="Confirm"
            fields={[]}
          />
        </div>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "health" ? <UptimeTab data={data} /> : null}
      {tab === "sync" ? <SyncQueueTab data={data} /> : null}
      {tab === "delivery" ? <DeliveryTab data={data} /> : null}
      {tab === "backups" ? <BackupsTab data={data} /> : null}
      {tab === "integrations" ? <IntegrationsTab data={data} /> : null}
      {tab === "flags" ? <FlagStatusTab /> : null}
    </div>
  );
}

function UptimeTab({ data }: { data: SuperAdminInfraMonitoring }) {
  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3">
        <StatCard
          label="API uptime (24h)"
          value={`${data.uptime.apiUptime}%`}
          detail={`${data.uptime.requestsLast24h.toLocaleString()} requests`}
          status={data.uptime.apiUptimeStatus}
        />
        <StatCard
          label="Avg response"
          value={`${data.uptime.avgResponseMs}ms`}
          detail="Warning >1.5s · Critical >3s"
          status={data.uptime.responseStatus}
        />
        <StatCard label="Data as of" value={formatDate(data.generatedAt)} detail="Last refreshed" />
      </section>
      <section className="surface-card p-6">
        <p className="section-eyebrow">Reliability</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">What these numbers mean</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          API uptime and average response time are measured across every request the platform served in the last 24
          hours. A drop below the healthy threshold raises an infrastructure alert visible from the Command Center.
        </p>
      </section>
    </div>
  );
}

function SyncQueueTab({ data }: { data: SuperAdminInfraMonitoring }) {
  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending records" value={String(data.syncQueue.pending)} status={data.syncQueue.status} />
        <StatCard label="Failed (24h)" value={String(data.syncQueue.failedOver24h)} />
        <StatCard label="Failure rate" value={`${data.syncQueue.failureRate}%`} />
        <StatCard
          label="Oldest pending"
          value={`${data.syncQueue.oldestAgeHours}h`}
          detail={data.syncQueue.oldestSchool ?? "No pending records"}
        />
      </section>
      <section className="surface-card p-6">
        <p className="section-eyebrow">Offline sync</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">How offline sync works</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          School devices queue attendance, results, and fee records locally when offline, then sync automatically once
          connectivity returns. Records still pending after 24 hours are flagged for follow-up with the school&apos;s ICT
          contact.
        </p>
      </section>
    </div>
  );
}

function DeliveryTab({ data }: { data: SuperAdminInfraMonitoring }) {
  return (
    <TableCard
      title="Notification delivery health"
      description="Delivery failure rate by channel over the last 30 days."
      items={data.deliveryHealth}
      columns={[
        { key: "channel", header: "Channel", render: (item) => item.channel },
        { key: "total", header: "Messages", render: (item) => item.total },
        { key: "failure", header: "Failure rate", render: (item) => `${item.failureRate}%` },
        { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} tone={statusTone(item.status)} /> }
      ]}
      emptyState="No notification activity recorded."
    />
  );
}

function BackupsTab({ data }: { data: SuperAdminInfraMonitoring }) {
  return (
    <div className="grid gap-5">
      <StatCard
        label="Last successful backup"
        value={data.backups.lastSuccessfulAt ? formatDate(data.backups.lastSuccessfulAt) : "None logged"}
      />
      <TableCard
        title="Backup log"
        description="The last 30 backup events. A missed or failed backup raises a critical alert until a successful backup completes."
        items={data.backups.recent}
        columns={[
          { key: "scope", header: "Scope", render: (item) => item.scope.replaceAll("_", " ") },
          { key: "school", header: "Target", render: (item) => item.school },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} tone={item.status.toUpperCase().includes("SUCCESS") || item.status.toUpperCase().includes("COMPLETED") ? "success" : "danger"} /> },
          { key: "size", header: "Size", render: (item) => (item.sizeMb ? `${item.sizeMb} MB` : "-") },
          { key: "started", header: "Started", render: (item) => formatDate(item.startedAt) }
        ]}
        emptyState="No backups have been logged yet."
      />
    </div>
  );
}

function IntegrationsTab({ data }: { data: SuperAdminInfraMonitoring }) {
  return (
    <TableCard
      title="Third-party integration status"
      description="Health of the external providers the platform depends on."
      items={data.integrations}
      columns={[
        { key: "name", header: "Integration", render: (item) => item.name },
        { key: "freq", header: "Check frequency", render: (item) => item.checkFrequency },
        { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} tone={statusTone(item.status)} /> },
        { key: "onfail", header: "On failure", render: (item) => item.onFailure }
      ]}
    />
  );
}

async function FlagStatusTab() {
  const flags = await apiGet<SuperAdminFeatureFlagRow[]>("/api/super-admin/feature-flags");

  return (
    <TableCard
      title="Feature flag rollout status"
      description={
        <>
          Read-only infrastructure view of every flag&apos;s current rollout stage. Manage rollouts from{" "}
          <Link href="/super-admin/feature-flags?tab=flags" className="font-semibold text-[var(--color-text-accent)] underline">
            Feature & Tier Management
          </Link>
          .
        </>
      }
      items={flags ?? []}
      emptyState="No feature flags have been configured."
      columns={[
        { key: "name", header: "Flag", render: (item) => <div><p className="font-semibold text-[var(--color-text-primary)]">{item.name}</p><p className="text-xs text-[var(--color-text-muted)]">{item.key}</p></div> },
        { key: "rollout", header: "Rollout", render: (item) => <StatusBadge status={item.rolloutStatus} tone={item.rolloutStatus === "FULL" ? "success" : item.rolloutStatus === "OFF" ? "neutral" : "warning"} /> },
        { key: "pct", header: "Percent", render: (item) => `${item.rolloutPercent}%` },
        { key: "pilot", header: "Pilot schools", render: (item) => item.pilotSchoolCount },
        { key: "overrides", header: "Overrides", render: (item) => item.overrides }
      ]}
    />
  );
}
