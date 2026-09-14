import Link from "next/link";
import { Activity, Cpu, Clock3, DatabaseBackup, Database, FileStack, FlaskConical, Gauge, Layers3, Server, Timer, UploadCloud, Users, WifiOff } from "lucide-react";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatCard } from "@/components/data-display/stat-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import type { SuperAdminComputationMonitoring, SuperAdminFeatureFlagRow, SuperAdminInfraMonitoring } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "HEALTHY") return "success";
  if (status === "WARNING") return "warning";
  if (status === "CRITICAL") return "danger";
  return "neutral";
}

function tabHref(tab: string) {
  return tab === "health" ? "/super-admin/system" : `/super-admin/system?tab=${tab}`;
}

export default async function SuperAdminSystemPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab = "health" } = searchParams ? await searchParams : {};
  const data = await apiGet<SuperAdminInfraMonitoring>("/api/super-admin/system/monitoring");

  const tabs = [
    { label: "Health", href: tabHref("health"), active: tab === "health" },
    { label: "Sync", href: tabHref("sync"), active: tab === "sync" },
    { label: "Computation", href: tabHref("computation"), active: tab === "computation" },
    { label: "Delivery", href: tabHref("delivery"), active: tab === "delivery" },
    { label: "Backups", href: tabHref("backups"), active: tab === "backups" }
  ];

  return (
    <div className="grid gap-5">
      <ModuleHero
        eyebrow="Platform"
        title="Infrastructure"
        description="Health, offline sync queue, result-computation pipeline, delivery & integrations, and backups."
        action={
          <ResourceActionDialog
            triggerLabel="Run manual backup"
            title="Run a manual backup"
            description="Runs a full database backup now. A missed or failed backup raises a critical alert until a successful one completes — see the honest gaps below before you rely on this."
            endpoint="/api/super-admin/system/backups"
            method="POST"
            variant="heroWhite"
            submitLabel="Run backup now"
            confirmLabel="Confirm"
            fields={[
              { name: "scope", label: "What to back up", type: "static", placeholder: "Full platform", note: "Real — every manual run is the whole database; there's no partial or per-school option.", section: "Scope" },
              { name: "region", label: "Storage region", type: "static", placeholder: "Not tracked", note: "No region selection exists — the location is a fixed string, not a real multi-region choice.", section: "Scope" },
              { name: "window", label: "Window", type: "static", placeholder: "Starts now", note: "Real — a manual run has no scheduling option; it always starts immediately.", section: "Scope" },
              { name: "lastRestoreTest", label: "Last successful restore test", type: "static", placeholder: "Not tracked", note: "No restore-test record exists anywhere in this system — a backup has never been proven restorable here.", section: "Scope" },
              {
                name: "verifyArchive",
                label: "Verify the archive afterwards",
                type: "toggle",
                disabled: true,
                note: "Not real — every run is recorded as an immediate SUCCESS with a randomly generated size; nothing is independently verified.",
                section: "Verification"
              },
              { name: "restoreTest", label: "Run a restore test into staging", type: "toggle", disabled: true, section: "Verification" },
              { name: "notifyOnCompletion", label: "Notify Infrastructure on completion", type: "toggle", disabled: true, note: "Not built — no notification is sent when a backup finishes.", section: "Verification" },
              {
                name: "reason",
                label: "Why this run is being made now",
                type: "static",
                placeholder: "Not stored",
                note: "The backup endpoint takes no reason field — anything typed here wouldn't be saved, so it isn't collected.",
                section: "Reason"
              }
            ]}
          />
        }
      />

      <DetailTabs tabs={tabs} />

      {tab === "health" ? <UptimeTab data={data} /> : null}
      {tab === "sync" ? <SyncQueueTab data={data} /> : null}
      {tab === "computation" ? <ComputationTab /> : null}
      {tab === "delivery" ? <DeliveryTab data={data} /> : null}
      {tab === "backups" ? <BackupsTab data={data} /> : null}
      {tab === "flags" ? <FlagStatusTab /> : null}
    </div>
  );
}

function UptimeTab({ data }: { data: SuperAdminInfraMonitoring }) {
  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="API uptime (24h)" value={`${data.uptime.apiUptime}%`} detail={`${data.uptime.requestsLast24h.toLocaleString()} requests · target 99.5%`} tone="dark" icon={Server} />
        <StatCard label="API response (avg)" value={`${data.uptime.avgResponseMs}ms`} detail="Warning above 1.5s" tone={statusTone(data.uptime.responseStatus)} icon={Timer} />
        <StatCard label="Server CPU" value="N/A" detail="Not tracked — no APM agent is wired in" tone="neutral" icon={Cpu} />
        <StatCard label="DB query time" value="N/A" detail="Not tracked — no query profiler is wired in" tone="neutral" icon={Database} />
        <StatCard label="Concurrent users" value="N/A" detail="Not tracked — no live session-concurrency metric exists" tone="neutral" icon={Users} />
        <StatCard label="Page load (3G)" value="N/A" detail="Not tracked — no client-side page-load telemetry exists" tone="neutral" icon={Gauge} />
      </section>

      <TableCard
        title="Uptime and performance thresholds"
        description="Every metric this platform actually measures, with its real warning and critical levels — plus what genuinely happens on a breach, not what a mature system would do."
        items={[
          { metric: "API uptime (24h)", current: `${data.uptime.apiUptime}%`, warning: "< 99.5%", critical: "< 99%", action: "None — the status badge on this page changes; nothing pages or emails anyone.", status: data.uptime.apiUptimeStatus },
          { metric: "API response time (average)", current: `${data.uptime.avgResponseMs}ms`, warning: "> 1.5s", critical: "> 3s", action: "None — same as above, a badge change only.", status: data.uptime.responseStatus }
        ]}
        getRowKey={(row) => row.metric}
        columns={[
          { key: "metric", header: "Metric", render: (row) => row.metric },
          { key: "current", header: "Current", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.current}</span> },
          { key: "warning", header: "Warning", render: (row) => <span className="text-[var(--color-text-muted)]">{row.warning}</span> },
          { key: "critical", header: "Critical", render: (row) => <span className="text-[var(--color-text-muted)]">{row.critical}</span> },
          { key: "action", header: "Action on breach", render: (row) => <span className="text-[12px] text-[var(--color-text-secondary)]">{row.action}</span> },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} tone={statusTone(row.status)} /> }
        ]}
        footnote="All tables and reports need to hold these thresholds at real scale, not just at current traffic — but there is no load-tested ceiling recorded anywhere in this codebase."
      />
    </div>
  );
}

function SyncQueueTab({ data }: { data: SuperAdminInfraMonitoring }) {
  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Records queued" value={String(data.syncQueue.pending)} detail="Across all schools" tone="dark" icon={UploadCloud} />
        <StatCard label="Avg queue age" value={`${data.syncQueue.avgQueueAgeHours}h`} detail="Warning above 2 hours" icon={Clock3} tone="neutral" />
        <StatCard label="Oldest pending" value={`${data.syncQueue.oldestAgeHours}h`} detail={data.syncQueue.oldestSchool ?? "No pending records"} icon={WifiOff} tone="neutral" />
        <StatCard label="Sync failure rate (24h)" value={`${data.syncQueue.failureRate}%`} detail="Warning above 5%" icon={Activity} tone={statusTone(data.syncQueue.status)} />
        <StatCard label="Schools with pending" value={String(data.syncQueue.schoolsWithPending)} detail="Distinct schools queued" icon={Server} tone="neutral" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <TableCard
          title="Per-school sync status"
          description="Unique to the offline-first architecture — the most important technical health indicator on the platform. Oldest queued records first."
          items={data.syncQueue.perSchool}
          emptyState="No school has records pending sync."
          getRowKey={(row) => row.schoolName}
          columns={[
            { key: "school", header: "School", render: (row) => row.schoolName },
            { key: "queued", header: "Queued", render: (row) => row.queued },
            { key: "oldest", header: "Oldest record", render: (row) => `${row.oldestAgeHours}h` },
            { key: "failures", header: "Consecutive failures", render: () => <span className="text-[var(--color-text-muted)]">Not tracked</span> },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} tone={statusTone(row.status)} /> }
          ]}
          footnote={`A queue age above 2 hours means a group of schools has been offline for an extended period — they may need proactive outreach rather than a server fix. There is no per-record retry-attempt count kept, so "consecutive failures" is honestly not tracked — a queued record is simply pending or synced.`}
        />
        <TableCard
          title="Sync failure alert thresholds"
          description="What triggers a warning and what's critical — real thresholds used by the status above."
          items={[
            { metric: "Platform-wide sync failure rate", warning: "> 5%", critical: "> 15%" },
            { metric: "Oldest unsynced record", warning: "> 2 hours", critical: "> 6 hours" },
            { metric: "Average queue age", warning: "> 2 hours", critical: "> 6 hours" },
            { metric: "Single school sync failures", warning: "Not tracked", critical: "Not tracked" }
          ]}
          getRowKey={(row) => row.metric}
          columns={[
            { key: "metric", header: "Metric", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.metric}</span> },
            { key: "warning", header: "Warning", render: (row) => <span className="text-[var(--color-text-muted)]">{row.warning}</span> },
            { key: "critical", header: "Critical", render: (row) => <span className="text-[var(--color-text-muted)]">{row.critical}</span> }
          ]}
        />
      </div>
    </div>
  );
}

function DeliveryTab({ data }: { data: SuperAdminInfraMonitoring }) {
  const thresholds: Record<string, { warning: string; critical: string }> = {
    EMAIL: { warning: "> 3%", critical: "> 10%" },
    SMS: { warning: "> 3%", critical: "> 10%" },
    WHATSAPP: { warning: "> 5%", critical: "> 15%" }
  };

  return (
    <div className="grid gap-5">
      <TableCard
        title="Notification delivery monitoring"
        description="Infrastructure-level, distinct from Communications' campaign tracking — this answers whether the send actually went through, not whether the message resonated. Failure rate over the last 30 days."
        items={data.deliveryHealth}
        columns={[
          { key: "channel", header: "Channel", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.channel}</span> },
          { key: "total", header: "Messages", render: (item) => item.total },
          { key: "failure", header: "Failure rate", render: (item) => `${item.failureRate}%` },
          { key: "warning", header: "Warning", render: (item) => thresholds[item.channel]?.warning ?? "—" },
          { key: "critical", header: "Critical", render: (item) => thresholds[item.channel]?.critical ?? "—" },
          { key: "reason", header: "Top failure reason", render: () => <span className="text-[var(--color-text-muted)]">Not tracked — a send only records success/fail, not why</span> },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} tone={statusTone(item.status)} /> }
        ]}
        emptyState="No notification activity recorded."
      />

      <section className="overflow-hidden rounded-[14px] border border-[#DEE8E2] bg-white">
        <div className="border-b border-[#E6EEE9] px-5 py-4">
          <p className="font-[var(--font-display)] text-[16px] font-bold text-[#0D2315]">Failure volume by reason — not tracked</p>
        </div>
        <div className="p-5">
          <p className="text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
            A notification-log entry stores a channel and a success/fail status only — there is no failure-reason field (bounced mailbox,
            invalid number, carrier block, opt-out) to break down. The table above is the honest ceiling of what this system can report on
            delivery failure today.
          </p>
        </div>
      </section>

      <TableCard
        title="Third-party integration status"
        description="Health of the external providers the delivery pipeline depends on — checked live, on this page load, from environment configuration and the delivery figures above."
        items={data.integrations}
        columns={[
          { key: "name", header: "Integration", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.name}</span> },
          { key: "freq", header: "Check", render: (item) => item.checkFrequency },
          { key: "last", header: "Last checked", render: () => "Just now — this page load" },
          { key: "onfail", header: "On failure", render: (item) => <span className="text-[12.5px] text-[var(--color-text-secondary)]">{item.onFailure}</span> },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} tone={statusTone(item.status)} /> }
        ]}
      />
    </div>
  );
}

async function ComputationTab() {
  const data = await apiGet<SuperAdminComputationMonitoring>("/api/super-admin/infra-extras/computation");

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Trace completeness" value="N/A" detail="Not tracked — no per-computation calculation trace is stored" tone="dark" icon={Activity} />
        <StatCard label="Regression suite" value="N/A" detail="Not tracked at runtime — this is a CI/deployment concern, not data this page can read" tone="neutral" icon={FlaskConical} />
        <StatCard label="Computations today" value="N/A" detail="Not tracked as one aggregate — see the real pending-queue depths below instead" tone="neutral" icon={Cpu} />
        <StatCard
          label="Median duration"
          value={data.broadsheets.avgCompileHours === null ? "N/A" : data.broadsheets.avgCompileHours >= 48 ? `${Math.round((data.broadsheets.avgCompileHours / 24) * 10) / 10}d` : `${data.broadsheets.avgCompileHours}h`}
          detail="Real, but a proxy — broadsheet creation-to-approval time, across schools approved in the last 90 days, not raw compute duration"
          tone="neutral"
          icon={Activity}
        />
        <StatCard label="Frameworks failing validation" value="0" detail="Structurally guaranteed — an assessment framework whose weights don't total 100 is rejected at save, so one can never exist to fail here" tone="success" />
      </section>

      <TableCard
        title="Computation health by school"
        description="Would show per-school record counts, computation duration, trace completeness, and recompute events."
        items={[]}
        columns={[
          { key: "school", header: "School", render: () => null },
          { key: "records", header: "Records", render: () => null },
          { key: "duration", header: "Duration", render: () => null },
          { key: "trace", header: "Trace", render: () => null },
          { key: "recomputes", header: "Recomputes", render: () => null },
          { key: "state", header: "State", render: () => null }
        ]}
        emptyState="Duration, trace, and recompute-event counts aren't tracked per school — see the real pending-queue stats below for what this system actually measures instead."
      />

      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="Assessments awaiting approval" value={String(data.assessments.pendingApproval)} detail={data.assessments.oldestAgeHours === null ? "Nothing pending" : `Oldest: ${data.assessments.oldestAgeHours}h · ${data.assessments.oldestLabel}`} tone="dark" icon={Layers3} />
        <StatCard label="Broadsheets in compilation" value={String(data.broadsheets.pending)} detail={data.broadsheets.oldestAgeHours === null ? "Nothing pending" : `Oldest: ${data.broadsheets.oldestAgeHours}h · ${data.broadsheets.oldestLabel}`} icon={Cpu} tone={statusTone(data.broadsheets.status)} />
        <StatCard label="Report cards pending generation" value={String(data.reportCards.pending)} detail={data.reportCards.oldestAgeHours === null ? "Nothing pending" : `Oldest: ${data.reportCards.oldestAgeHours}h · ${data.reportCards.oldestLabel}`} icon={FileStack} tone={statusTone(data.reportCards.status)} />
      </section>

      <TableCard
        title="What is monitored here — real vs. not tracked"
        items={[
          { label: "Golden-dataset regression on every deployment", state: "Not tracked at runtime — a CI/deployment concern this page has no visibility into.", tone: "bad" },
          { label: "Computation volume and duration by school", state: "Partial — pending-queue depth and age are real; there is no per-school computation-duration metric.", tone: "warn" },
          { label: "Trace completeness", state: "Not built — no calculation-trace concept exists in this codebase.", tone: "bad" },
          { label: "Recomputation events, with reason", state: "Not built — a recompute isn't logged as a distinct event anywhere.", tone: "bad" },
          { label: "Assessment frameworks failing validation", state: "Structurally guaranteed at zero — see the KPI above.", tone: "good" }
        ]}
        getRowKey={(row) => row.label}
        columns={[
          { key: "label", header: "What this covers", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.label}</span> },
          {
            key: "state",
            header: "State",
            render: (row) => {
              const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Real" }, warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Partial" }, bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Not built" } }[row.tone as "good" | "warn" | "bad"];
              return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
            }
          }
        ]}
        footnote={
          <>
            There is no separate background job queue for result computation — broadsheet compilation and report card generation are
            workflow steps schools trigger directly. A stage is flagged Warning once its oldest pending record has sat for more than 14
            days, Critical past 30 days. Data as of {formatDate(data.generatedAt)}.
          </>
        }
      />
    </div>
  );
}

function BackupsTab({ data }: { data: SuperAdminInfraMonitoring }) {
  return (
    <div className="grid gap-5">
      <StatCard label="Last successful backup" value={data.backups.lastSuccessfulAt ? formatDate(data.backups.lastSuccessfulAt) : "None logged"} icon={DatabaseBackup} tone="dark" />

      <TableCard
        title="Backup and disaster recovery schedule"
        description="Would show, per backup type, how often it runs, how long it's retained, and how it's verified."
        items={[]}
        columns={[
          { key: "type", header: "Backup type", render: () => null },
          { key: "frequency", header: "Frequency", render: () => null },
          { key: "retention", header: "Retention", render: () => null },
          { key: "verification", header: "Verification", render: () => null },
          { key: "last", header: "Last run", render: () => null }
        ]}
        emptyState="No stored policy record exists for backup frequency, retention period, or verification cadence — a backup happens when triggered manually (above) or by whatever runs outside this codebase."
      />

      <TableCard
        title="Backup log"
        description="The last 30 backup events — every real one this platform knows about, not evidence of a fixed schedule. A missed or failed backup raises a critical alert until a successful backup completes."
        items={data.backups.recent}
        columns={[
          { key: "started", header: "Completed", render: (item) => formatDate(item.startedAt) },
          { key: "scope", header: "Type", render: (item) => item.scope.replaceAll("_", " ") },
          { key: "school", header: "Target", render: (item) => item.school },
          { key: "size", header: "Size", render: (item) => (item.sizeMb ? `${item.sizeMb} MB` : "-") },
          { key: "verified", header: "Verified", render: () => <span className="text-[var(--color-text-muted)]">Not tracked</span> },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} tone={item.status.toUpperCase().includes("SUCCESS") || item.status.toUpperCase().includes("COMPLETED") ? "success" : "danger"} /> }
        ]}
        emptyState="No backups have been logged yet."
      />
    </div>
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
