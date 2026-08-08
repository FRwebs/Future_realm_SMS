import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import type { SuperAdminInfraMonitoring } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "HEALTHY") return "success";
  if (status === "WARNING") return "warning";
  if (status === "CRITICAL") return "danger";
  return "neutral";
}

export default async function SuperAdminSystemPage() {
  const data = await apiGet<SuperAdminInfraMonitoring>("/api/super-admin/system/monitoring");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Technical operations</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">System & Infrastructure</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
              Uptime, offline sync queue, notification delivery, third-party integrations, and backups.
            </p>
          </div>
          <ResourceActionDialog
            triggerLabel="Trigger backup"
            title="Trigger a manual backup"
            description="Runs a full database backup now. A critical alert fires automatically if a backup ever fails."
            endpoint="/api/super-admin/system/backups"
            method="POST"
            submitLabel="Run backup now"
            confirmLabel="Confirm"
            fields={[]}
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">API uptime (24h)</p><StatusBadge status={data.uptime.apiUptimeStatus} tone={statusTone(data.uptime.apiUptimeStatus)} /></div>
          <p className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-ink">{data.uptime.apiUptime}%</p>
          <p className="mt-1 text-xs text-ink/50">{data.uptime.requestsLast24h} requests</p>
        </article>
        <article className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Avg response</p><StatusBadge status={data.uptime.responseStatus} tone={statusTone(data.uptime.responseStatus)} /></div>
          <p className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-ink">{data.uptime.avgResponseMs}ms</p>
          <p className="mt-1 text-xs text-ink/50">Warning &gt;1.5s · Critical &gt;3s</p>
        </article>
        <article className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Sync queue</p><StatusBadge status={data.syncQueue.status} tone={statusTone(data.syncQueue.status)} /></div>
          <p className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-ink">{data.syncQueue.pending}</p>
          <p className="mt-1 text-xs text-ink/50">Oldest {data.syncQueue.oldestAgeHours}h{data.syncQueue.oldestSchool ? ` · ${data.syncQueue.oldestSchool}` : ""}</p>
        </article>
        <article className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Last successful backup</p>
          <p className="mt-2 font-[var(--font-heading)] text-xl font-bold text-ink">{data.backups.lastSuccessfulAt ? formatDate(data.backups.lastSuccessfulAt) : "None logged"}</p>
        </article>
      </section>

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
