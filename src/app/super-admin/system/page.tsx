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
  if (status === "WARNING" || status === "SLOW" || status === "INVESTIGATE" || status === "PARTIAL") return "warning";
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
    <div className="grid gap-[14px]">
      <ModuleHero
        eyebrow="MODULE 12"
        title="Infrastructure"
        description="Know about a problem before any school does."
        action={
          <ResourceActionDialog
            triggerLabel="Run manual backup"
            title="Run a manual backup"
            description="Takes a real pg_dump of the whole database now, fingerprints it, and can read it back and restore it into a scratch database to prove it works. A failed run is logged as a high-severity incident and the platform team is emailed."
            endpoint="/api/super-admin/system/backups"
            method="POST"
            variant="heroWhite"
            submitLabel="Run backup now"
            confirmLabel="Confirm"
            note="A missed backup is critical and cannot be cleared until a successful one completes."
            fields={[
              { name: "scope", label: "What to back up", type: "static", placeholder: "Full platform", note: "Every manual run is the whole database — there is no partial or per-school option.", section: "Scope" },
              { name: "region", label: "Storage region", type: "static", placeholder: data.backups.region ?? "This server", note: "Where the archive is written — set by BACKUP_REGION on the server, not chosen per run.", section: "Scope" },
              { name: "window", label: "Window", type: "static", placeholder: "Starts now", note: "A manual run always starts immediately.", section: "Scope" },
              {
                name: "lastRestoreTest",
                label: "Last successful restore test",
                type: "static",
                placeholder: data.backups.lastRestoreTestAt ? formatDate(data.backups.lastRestoreTestAt) : "Never",
                note: data.backups.lastRestoreTestAt ? (data.backups.lastRestoreResult ?? "Restored into a scratch database and checked.") : "No backup has been restored yet — until one is, none is proven restorable.",
                section: "Scope"
              },
              { name: "verifyArchive", label: "Verify the archive afterwards", type: "switch", on: true, note: "Reads the dump back with pg_restore and compares its SHA-256 fingerprint", section: "Verification" },
              { name: "restoreTest", label: "Run a restore test into staging", type: "switch", on: false, note: "Restores into a scratch database, then drops it. Slower on a large database; never touches the live one", section: "Verification" },
              {
                name: "notifyOnCompletion",
                label: "Notify Infrastructure on completion",
                type: "static",
                placeholder: "Sent automatically",
                note: "Every platform owner, developer, and platform/super admin is told when this run finishes. It isn't optional.",
                section: "Verification"
              },
              { name: "reason", label: "Why this run is being made now", type: "textarea", placeholder: "e.g. Before the term-3 fee migration", note: "Stored on the backup record and in the audit log.", section: "Reason" }
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

function formatUptime(minutes: number) {
  return minutes >= 1440 ? `${Math.floor(minutes / 1440)}d` : minutes >= 60 ? `${Math.floor(minutes / 60)}h` : `${minutes}m`;
}

function UptimeTab({ data }: { data: SuperAdminInfraMonitoring }) {
  const rt = data.runtime;
  return (
    <div className="grid gap-[14px]">
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="API uptime (30d)" value={`${data.uptime.apiUptime}%`} detail={`${data.uptime.requestsLast24h.toLocaleString()} requests · target 99.5%`} tone="dark" icon={Server} />
        <StatCard label="API response (avg)" value={`${data.uptime.avgResponseMs}ms`} detail="Warning above 1.5s" tone={statusTone(data.uptime.responseStatus)} icon={Timer} />
        <StatCard label="Server CPU" value={rt ? `${rt.cpuPercent}%` : "N/A"} detail={rt ? `Load ${rt.loadAverage} on ${rt.cpuCores} cores · API uses ${rt.memoryMb} MB · up ${formatUptime(rt.processUptimeMinutes)}` : "Runtime figures unavailable"} tone={rt && rt.cpuPercent > 85 ? "danger" : rt && rt.cpuPercent > 70 ? "warning" : "neutral"} icon={Cpu} />
        <StatCard label="DB query time" value={rt ? `${rt.dbPingMs}ms` : "N/A"} detail="A round-trip to the database, measured when this page loaded" tone={rt && rt.dbPingMs > 250 ? "warning" : "neutral"} icon={Database} />
        <StatCard label="Concurrent users" value={rt ? String(rt.concurrentUsers) : "N/A"} detail="Distinct people with a live sign-in active in the last 5 minutes" tone="neutral" icon={Users} />
        <StatCard
          label="Page load (3G)"
          value={rt?.pageLoad.slowP75Ms != null ? `${(rt.pageLoad.slowP75Ms / 1000).toFixed(1)}s` : rt?.pageLoad.p75Ms != null ? `${(rt.pageLoad.p75Ms / 1000).toFixed(1)}s` : "No data"}
          detail={
            rt?.pageLoad.slowSamples
              ? `75th percentile over ${rt.pageLoad.slowSamples} slow-connection loads · target under 3s`
              : rt?.pageLoad.samples
                ? `No slow-connection loads yet — showing all ${rt.pageLoad.samples} loads (75th percentile)`
                : "Measured in users' browsers — fills in as pages are opened"
          }
          tone={(rt?.pageLoad.slowP75Ms ?? rt?.pageLoad.p75Ms ?? 0) > 3000 ? "warning" : "neutral"}
          icon={Gauge}
        />
      </section>

      <TableCard
        title="Uptime and performance thresholds"
        description="Every metric this platform actually measures, with its real warning and critical levels — plus what genuinely happens on a breach, not what a mature system would do."
        items={[
          { metric: "API uptime (30d)", current: `${data.uptime.apiUptime}%`, warning: "< 99.5%", critical: "< 99%", action: "None — the status badge on this page changes; nothing pages or emails anyone.", status: data.uptime.apiUptimeStatus },
          { metric: "API response time (average)", current: `${data.uptime.avgResponseMs}ms`, warning: "> 1.5s", critical: "> 3s", action: "None — same as above, a badge change only.", status: data.uptime.responseStatus }
        ]}
        getRowKey={(row) => row.metric}
        columns={[
          { key: "metric", header: "Metric", render: (row) => row.metric },
          { key: "current", header: "Current", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.current}</span> },
          { key: "warning", header: "Warning", render: (row) => <span className="text-[var(--color-text-muted)]">{row.warning}</span> },
          { key: "critical", header: "Critical", render: (row) => <span className="text-[var(--color-text-muted)]">{row.critical}</span> },
          { key: "action", header: "Action on breach", render: (row) => <span className="text-[11px] text-[var(--color-text-secondary)]">{row.action}</span> },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} tone={statusTone(row.status)} /> }
        ]}
        footnote="CPU is the one-minute load average over core count; DB time is a live round-trip; page load comes from a beacon each browser sends after a page finishes loading. None of it is a load-test ceiling — it is what the platform is doing now."
      />
    </div>
  );
}

function SyncQueueTab({ data }: { data: SuperAdminInfraMonitoring }) {
  return (
    <div className="grid gap-[14px]">
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Records queued" value={String(data.syncQueue.pending)} detail="Across all schools" tone="dark" icon={UploadCloud} />
        <StatCard label="Avg queue age" value={`${data.syncQueue.avgQueueAgeHours}h`} detail="Warning above 2 hours" icon={Clock3} tone="neutral" />
        <StatCard label="Oldest pending" value={`${data.syncQueue.oldestAgeHours}h`} detail={data.syncQueue.oldestSchool ?? "No pending records"} icon={WifiOff} tone="neutral" />
        <StatCard label="Sync failure rate (24h)" value={`${data.syncQueue.failureRate}%`} detail="Warning above 5%" icon={Activity} tone={statusTone(data.syncQueue.status)} />
        <StatCard label="Schools with pending" value={String(data.syncQueue.schoolsWithPending)} detail="Distinct schools queued" icon={Server} tone="neutral" />
      </section>

      <div className="grid items-start gap-[14px] xl:grid-cols-[1.4fr_1fr]">
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
            { key: "refused", header: "Refused", render: (row) => (row.refused ? <span className="font-semibold text-[var(--color-danger)]">{row.refused}</span> : 0) },
            { key: "conflicts", header: "Conflicts", render: (row) => (row.conflicts ? <span className="font-semibold text-[var(--color-warning)]">{row.conflicts}</span> : 0) },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} tone={statusTone(row.status)} /> }
          ]}
          footnote="A queue age above 2 hours means a group of schools has been offline for an extended period — they may need proactive outreach rather than a server fix. Refused means the server turned an entry down (for example a closed register); a conflict means the school already holds a different value and someone must choose."
        />
        <TableCard
          title="Sync failure alert thresholds"
          description="What triggers a warning and what's critical — real thresholds used by the status above."
          items={[
            { metric: "Platform-wide sync failure rate", warning: "> 5%", critical: "> 15%" },
            { metric: "Oldest unsynced record", warning: "> 2 hours", critical: "> 6 hours" },
            { metric: "Average queue age", warning: "> 2 hours", critical: "> 6 hours" },
            { metric: "Single school refused entries", warning: "Any", critical: "5 or more" }
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

type DeliveryFailures = { sent: number; failed: number; held: number; reasons: Array<{ reason: string; channel: string; count: number }> };

async function DeliveryTab({ data }: { data: SuperAdminInfraMonitoring }) {
  const failures = await apiGet<DeliveryFailures>("/api/super-admin/communications/delivery-failures").catch(() => null);
  const topReason = (channel: string) => failures?.reasons.find((row) => row.channel === channel);
  const thresholds: Record<string, { warning: string; critical: string }> = {
    EMAIL: { warning: "> 3%", critical: "> 10%" },
    SMS: { warning: "> 3%", critical: "> 10%" },
    WHATSAPP: { warning: "> 5%", critical: "> 15%" }
  };

  return (
    <div className="grid gap-[14px]">
      <TableCard
        title="Notification delivery monitoring"
        description="Infrastructure-level, distinct from Communications' campaign tracking — this answers whether the send actually went through, not whether the message resonated. Failure rate is failed ÷ attempted over the last 30 days; messages still waiting, or simulated before delivery was real, are not counted as either."
        items={data.deliveryHealth}
        columns={[
          { key: "channel", header: "Channel", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.channel}</span> },
          { key: "total", header: "Messages", render: (item) => <div><p>{item.total}</p><p className="text-[10px] text-[var(--color-text-muted)]">{item.sent ?? 0} sent · {item.failed ?? 0} failed · {item.queued ?? 0} waiting{item.simulated ? ` · ${item.simulated} simulated` : ""}</p></div> },
          { key: "failure", header: "Failure rate", render: (item) => `${item.failureRate}%` },
          { key: "warning", header: "Warning", render: (item) => thresholds[item.channel]?.warning ?? "—" },
          { key: "critical", header: "Critical", render: (item) => thresholds[item.channel]?.critical ?? "—" },
          {
            key: "reason",
            header: "Top failure reason",
            render: (item) => {
              const top = topReason(item.channel);
              return top ? <span className="text-[11.5px] text-[var(--color-text-secondary)]">{top.reason} <span className="text-[var(--color-text-muted)]">({top.count})</span></span> : <span className="text-[var(--color-text-muted)]">None recorded</span>;
            }
          },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} tone={statusTone(item.status)} /> }
        ]}
        emptyState="No notification activity recorded."
      />

      <TableCard
        title="Failure volume by reason"
        description={`Last 30 days — ${failures?.sent ?? 0} delivered, ${failures?.failed ?? 0} failed, ${failures?.held ?? 0} held back (quiet hours, daily cap or no wallet credit). The reason is the carrier's or mail server's own words, stored on the failed row.`}
        items={failures?.reasons ?? []}
        getRowKey={(row) => `${row.channel}:${row.reason}`}
        columns={[
          { key: "reason", header: "Reason", render: (row) => <span className="text-[var(--color-text-primary)]">{row.reason}</span> },
          { key: "channel", header: "Channel", render: (row) => row.channel },
          { key: "count", header: "Messages", render: (row) => row.count },
          { key: "share", header: "Share of failures", render: (row) => (failures?.failed ? `${Math.round((row.count / failures.failed) * 100)}%` : "-") }
        ]}
        emptyState="No failed sends in the last 30 days."
        footnote="Rows sent before delivery was switched on carry no reason, so they show as “No reason recorded”. Email and SMS are real; WhatsApp has no provider and is never sent."
      />

      <TableCard
        title="Third-party integration status"
        description="Health of the external providers the delivery pipeline depends on — checked live, on this page load, from environment configuration and the delivery figures above."
        items={data.integrations}
        columns={[
          { key: "name", header: "Integration", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.name}</span> },
          { key: "freq", header: "Check", render: (item) => item.checkFrequency },
          { key: "last", header: "Last checked", render: () => "Just now — this page load" },
          { key: "onfail", header: "On failure", render: (item) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{item.onFailure}</span> },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} tone={statusTone(item.status)} /> }
        ]}
      />
    </div>
  );
}

async function ComputationTab() {
  const data = await apiGet<SuperAdminComputationMonitoring>("/api/super-admin/infra-extras/computation");
  const comp = data.computation;

  return (
    <div className="grid gap-[14px]">
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Trace completeness" value={comp?.trace?.pct != null ? `${comp.trace.pct}%` : "No runs yet"} detail={comp?.trace?.checked ? `${comp.trace.matched} of ${comp.trace.checked} results traced back to the recorded scores (30 days)` : "Each run checks that what it wrote is what the recorded component scores add up to"} tone={comp?.trace?.pct != null && comp.trace.pct < 100 ? "warning" : "success"} icon={Activity} />
        <StatCard label="Regression suite" value={comp?.regression ? `${comp.regression.passed}/${comp.regression.total}` : "Not run yet"} detail={comp?.regression ? `${comp.regression.failures.length ? `${comp.regression.failures.length} golden case${comp.regression.failures.length === 1 ? "" : "s"} failing — ` : "Every golden case gives its known answer — "}last run ${formatDate(comp.regression.ranAt)} (${comp.regression.trigger.toLowerCase()})` : "Fixed inputs with known answers, run through the real calculation code at start-up and daily"} tone={comp?.regression?.failures.length ? "danger" : "success"} icon={FlaskConical} />
        <StatCard label="Computations today" value={comp ? String(comp.runsToday) : "N/A"} detail={comp ? `Across ${comp.schoolsToday} school${comp.schoolsToday === 1 ? "" : "s"} — every broadsheet, ranking and report-card run` : "Unavailable"} tone="dark" icon={Cpu} />
        <StatCard
          label="Median duration"
          value={comp?.medianMs != null ? (comp.medianMs >= 1000 ? `${(comp.medianMs / 1000).toFixed(1)}s` : `${comp.medianMs}ms`) : "No runs yet"}
          detail={comp?.p95Ms != null ? `Measured compute time · 95th percentile ${comp.p95Ms >= 1000 ? `${(comp.p95Ms / 1000).toFixed(1)}s` : `${comp.p95Ms}ms`} (30 days)` : "Measured compute time, from the runs recorded in the last 30 days"}
          tone="neutral"
          icon={Activity}
        />
        <StatCard
          label="Frameworks failing validation"
          value={String(comp?.failingFrameworks.length ?? 0)}
          detail={comp?.failingFrameworks.length ? "Active assessment sections whose weights do not total 100 — listed below" : "Every active assessment framework's weights total 100"}
          tone={comp?.failingFrameworks.length ? "danger" : "success"}
        />
      </section>

      <TableCard
        title="Computation health by school"
        description="What each school's recorded runs processed in the last 30 days — records computed, measured median duration, and how often results were recomputed."
        items={comp?.bySchool ?? []}
        getRowKey={(row) => row.school}
        columns={[
          { key: "school", header: "School", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.school}</span> },
          { key: "runs", header: "Runs", render: (row) => row.runs },
          { key: "records", header: "Records", render: (row) => row.records.toLocaleString() },
          { key: "duration", header: "Duration (median)", render: (row) => (row.medianMs == null ? "-" : row.medianMs >= 1000 ? `${(row.medianMs / 1000).toFixed(1)}s` : `${row.medianMs}ms`) },
          { key: "recomputes", header: "Recomputes", render: (row) => row.recomputes },
          { key: "state", header: "State", render: (row) => <StatusBadge status={row.state} tone={statusTone(row.state)} /> }
        ]}
        emptyState="No computation has been run in the last 30 days."
        footnote="A recompute is a run over a class and term that already had a run; its reason is listed below."
      />

      {comp?.failingFrameworks.length ? (
        <TableCard
          title="Frameworks failing validation"
          items={comp.failingFrameworks}
          getRowKey={(row) => `${row.school}:${row.section}`}
          columns={[
            { key: "school", header: "School", render: (row) => row.school },
            { key: "section", header: "Assessment section", render: (row) => row.section },
            { key: "total", header: "Weights total", render: (row) => <span className="font-bold text-[var(--color-danger)]">{row.total}</span> }
          ]}
          footnote="Results for these sections cannot be trusted until the weights are corrected to total 100."
        />
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="Assessments awaiting approval" value={String(data.assessments.pendingApproval)} detail={data.assessments.oldestAgeHours === null ? "Nothing pending" : `Oldest: ${data.assessments.oldestAgeHours}h · ${data.assessments.oldestLabel}`} tone="dark" icon={Layers3} />
        <StatCard label="Broadsheets in compilation" value={String(data.broadsheets.pending)} detail={data.broadsheets.oldestAgeHours === null ? "Nothing pending" : `Oldest: ${data.broadsheets.oldestAgeHours}h · ${data.broadsheets.oldestLabel}`} icon={Cpu} tone={statusTone(data.broadsheets.status)} />
        <StatCard label="Report cards pending generation" value={String(data.reportCards.pending)} detail={data.reportCards.oldestAgeHours === null ? "Nothing pending" : `Oldest: ${data.reportCards.oldestAgeHours}h · ${data.reportCards.oldestLabel}`} icon={FileStack} tone={statusTone(data.reportCards.status)} />
      </section>

      <TableCard
        title="Recomputation events"
        description="Every time results were run again over a class and term that already had a run, and the reason given."
        items={comp?.recomputes ?? []}
        getRowKey={(row) => `${row.school}:${row.at}`}
        emptyState="No result has been recomputed in the last 30 days."
        actions={
          <ResourceActionDialog
            triggerLabel="Run the regression suite"
            title="Run the golden-dataset checks"
            description="Fixed inputs with known answers go through the real calculation code — totals, blanks and absences, grade boundaries, ranking ties. The result is kept."
            endpoint="/api/super-admin/infra-extras/regression/run"
            method="POST"
            variant="secondary"
            submitLabel="Run now"
            keepOpen
            fields={[]}
          />
        }
        columns={[
          { key: "school", header: "School", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.school}</span> },
          { key: "reason", header: "Reason", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.reason}</span> },
          { key: "at", header: "When", render: (row) => formatDate(row.at) }
        ]}
        footnote={comp?.regression?.failures.length ? `Failing now: ${comp.regression.failures.map((failure) => failure.name).join("; ")}. A failure also opens a High security incident.` : undefined}
      />
    </div>
  );
}

function BackupsTab({ data }: { data: SuperAdminInfraMonitoring }) {
  const backups = data.backups;
  const ok = (status: string) => ["SUCCESS", "COMPLETED", "COMPLETED_SUCCESSFULLY"].includes(status.toUpperCase());
  const lastOk = backups.recent.find((item) => ok(item.status));
  const hoursSince = (iso: string | null | undefined) => (iso ? Math.round((Date.now() - new Date(iso).getTime()) / 36e5) : null);
  const age = hoursSince(backups.lastSuccessfulAt);

  return (
    <div className="grid gap-[14px]">
      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="Last successful backup" value={backups.lastSuccessfulAt ? formatDate(backups.lastSuccessfulAt) : "None logged"} detail={age === null ? "Run one from the button above" : age < 1 ? "Less than an hour ago" : `${age}h ago`} icon={DatabaseBackup} tone={age === null || age > 48 ? "danger" : age > 26 ? "warning" : "dark"} />
        <StatCard label="Last verified" value={backups.lastVerifiedAt ? formatDate(backups.lastVerifiedAt) : "Never"} detail="Archive read back and its fingerprint matched" icon={Activity} tone={backups.lastVerifiedAt ? "neutral" : "warning"} />
        <StatCard label="Last restore test" value={backups.lastRestoreTestAt ? formatDate(backups.lastRestoreTestAt) : "Never"} detail={backups.lastRestoreResult ?? "No backup has been restored into a scratch database yet"} icon={FlaskConical} tone={backups.lastRestoreTestAt ? "success" : "warning"} />
      </section>

      <TableCard
        title="Backup and disaster recovery schedule"
        description="How backups are made, where they go, and how they are proven."
        items={[
          { type: "Full database (pg_dump)", frequency: backups.scheduled ? "Daily, automatic (if the last good one is over 23 hours old)" : "Manual only — set BACKUP_SCHEDULER=on for a daily run", retention: `${backups.retentionDays ?? 14} days of archives kept, then deleted`, verification: "Read back with pg_restore --list and SHA-256 fingerprinted; a restore into a scratch database on request", last: lastOk ? formatDate(lastOk.startedAt) : "-" }
        ]}
        getRowKey={(row) => row.type}
        columns={[
          { key: "type", header: "Backup type", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.type}</span> },
          { key: "frequency", header: "Frequency", render: (row) => row.frequency },
          { key: "retention", header: "Retention", render: (row) => row.retention },
          { key: "verification", header: "Verification", render: (row) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{row.verification}</span> },
          { key: "last", header: "Last run", render: (row) => row.last }
        ]}
        footnote={`Archives are written to ${backups.region ?? "this server"}. Keeping them on the same machine as the database does not protect against losing that machine — point BACKUP_DIR at separate storage for that.`}
      />

      <TableCard
        title="Backup log"
        description="The last 30 backup events. A failed backup is logged as a high-severity incident and the platform team is emailed."
        items={backups.recent}
        columns={[
          { key: "started", header: "Completed", render: (item) => formatDate(item.endedAt ?? item.startedAt) },
          { key: "scope", header: "Type", render: (item) => item.scope.replaceAll("_", " ") },
          { key: "school", header: "Target", render: (item) => item.school },
          { key: "size", header: "Size", render: (item) => (item.sizeMb ? `${item.sizeMb} MB` : "-") },
          { key: "verified", header: "Verified", render: (item) => (item.verified ? <span className="font-semibold text-[var(--color-success)]">{item.restoreTested ? "Restored" : "Read back"}</span> : <span className="text-[var(--color-text-muted)]">No</span>) },
          { key: "note", header: "Detail", render: (item) => <span className="text-[11px] text-[var(--color-text-secondary)]">{item.note ?? item.reason ?? "-"}</span> },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} tone={ok(item.status) ? "success" : "danger"} /> }
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
