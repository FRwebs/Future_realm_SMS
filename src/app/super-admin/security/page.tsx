import { AlertTriangle, FileWarning, MonitorCheck } from "lucide-react";
import Link from "next/link";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatCard } from "@/components/data-display/stat-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { StructurePreviewDialog } from "@/components/forms/structure-preview-dialog";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type { SuperAdminAuditLogRow, SuperAdminSchoolRow } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

// Matches the real NDPA_RESPONSE_WINDOW_DAYS constant used for privacy-request deadlines
// on the Command Center dashboard (src/app/super-admin/page.tsx) — kept in sync with it.
const NDPA_RESPONSE_WINDOW_DAYS = 30;

type PlatformSession = {
  id: string;
  user?: { firstName: string; lastName: string; email: string; role: string } | null;
  school?: { name: string } | null;
  ipAddress?: string | null;
  device?: string | null;
  lastActivityAt: string;
};

type LoginAttempt = {
  id: string;
  email: string;
  status: string;
  ipAddress?: string | null;
  device?: string | null;
  failureReason?: string | null;
  createdAt: string;
  school?: { name: string } | null;
};

type PrivacyRequest = {
  id: string;
  type: string;
  status: string;
  subject: string;
  confirmationHash?: string | null;
  completedAt?: string;
  school?: { name: string } | null;
  createdAt: string;
};

type SecurityIncident = {
  id: string;
  type: string;
  severity: string;
  status: string;
  description: string;
  detectedAt: string;
  resolvedAt?: string;
  postIncidentNotes?: string | null;
  reportedBy: string;
  resolvedBy?: string | null;
};

type SecurityView = {
  sessions: PlatformSession[];
  attempts: LoginAttempt[];
  privacy: PrivacyRequest[];
  incidents: SecurityIncident[];
};

type ComplianceReport = {
  totalDeletionRequests: number;
  byStatus: Record<string, number>;
  completed: Array<{ id: string; schoolName: string; subject: string; completedBy: string; completedAt?: string; confirmationHash?: string | null }>;
  all: Array<{ id: string; schoolName: string; subject: string; status: string; createdAt: string; completedBy: string | null; completedAt: string | null; confirmationHash: string | null }>;
};

const platformRoles = new Set(["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN"]);

const incidentStatusOptions = [
  { label: "Detected", value: "DETECTED" },
  { label: "Investigating", value: "INVESTIGATING" },
  { label: "Contained", value: "CONTAINED" },
  { label: "Resolved", value: "RESOLVED" }
];

const privacyRequestTypeOptions = ["ACCESS", "EXPORT", "ERASURE", "RECTIFICATION"].map((v) => ({ label: v, value: v }));

const privacyStatusOptions = [
  { label: "Open", value: "OPEN" },
  { label: "In review", value: "IN_REVIEW" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Rejected", value: "REJECTED" }
];

function StatusPill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

function auditActionTone(action: string) {
  if (["SUSPEND", "DELETE", "REJECT"].includes(action)) return { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" };
  if (["ACTIVATE", "APPROVE", "PAYMENT"].includes(action)) return { bg: "var(--color-success-dim)", fg: "var(--color-success)" };
  if (["RESET_PASSWORD", "IMPERSONATE", "SETTINGS_UPDATE", "BILLING_UPDATE"].includes(action)) return { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" };
  return { bg: "var(--color-accent-primary-dim)", fg: "var(--color-text-accent)" };
}

function AuditDetailsPreview({ details }: { details: unknown }) {
  if (details === null || details === undefined) return <span className="text-[var(--color-text-muted)]">—</span>;
  if (typeof details === "object" && Object.keys(details as object).length === 0) return <span className="text-[var(--color-text-muted)]">—</span>;
  const text = typeof details === "string" ? details : JSON.stringify(details);
  return <span className="line-clamp-2 max-w-xs font-[var(--font-mono)] text-[11px] text-[var(--color-text-secondary)]">{text}</span>;
}

function tabHref(tab: string) {
  return tab === "audit" ? "/super-admin/security" : `/super-admin/security?tab=${tab}`;
}

export default async function SuperAdminSecurityPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab = "audit" } = searchParams ? await searchParams : {};
  const data = await apiGet<SecurityView>("/api/super-admin/security");
  const openIncidents = (data.incidents ?? []).filter((incident) => incident.status !== "RESOLVED").length;
  const pendingRequests = (data.privacy ?? []).filter((request) => request.status === "OPEN" || request.status === "IN_REVIEW").length;

  const tabs = [
    { label: "Audit Log", href: tabHref("audit"), active: tab === "audit" },
    { label: "Incidents", href: tabHref("incidents"), active: tab === "incidents", badge: openIncidents || undefined },
    { label: "Compliance", href: tabHref("compliance"), active: tab === "compliance" },
    { label: "Requests", href: tabHref("requests"), active: tab === "requests", badge: pendingRequests || undefined }
  ];

  return (
    <div className="grid gap-5">
      <ModuleHero
        eyebrow="Trust & Control"
        title="Security & Compliance"
        description="The accountability layer — active sessions, login activity and the platform audit trail, security incidents tracked from detection to resolution, NDPC-compliant data deletion evidence, and data subject requests."
        action={
          <StructurePreviewDialog
            triggerLabel="Export the audit log"
            title="Export the audit log"
            description="The record of who did what. Taking a copy of it is itself an act — checked against what this export can actually do today."
            fields={[
              { label: "Date range", value: "Real — filters the real export", note: "Maps to dateFrom/dateTo on the real export link.", section: "Filters" },
              { label: "Actor", value: "Not filterable", note: "No actor filter exists on the export — only on-screen table search filters by actor.", section: "Filters" },
              { label: "School", value: "Real — filters the real export", section: "Filters" },
              { label: "Action type", value: "Real — filters the real export", section: "Filters" },
              { label: "Entity", value: "Not filterable", note: "No entity-type filter exists.", section: "Filters" },
              { label: "Origin", value: "Not tracked", note: "Panel vs. API origin isn't recorded on any audit log row.", section: "Filters" },
              { label: "Format", value: "CSV only", note: "Real, but fixed — there is no format choice.", section: "Output" },
              { label: "Rows matched", value: "Capped at 100", note: "The export always reads page 1 at a 100-row limit, even when far more rows match your filters.", section: "Output" },
              { label: "Why this export is needed", value: "Not captured", note: "There's no reason field, and the export itself isn't written back to the audit log the way this note describes.", section: "Reason (required)" }
            ]}
            cta={{ label: "Open the real export", href: "/super-admin/audit-logs" }}
          />
        }
      />

      <DetailTabs tabs={tabs} />

      {tab === "incidents" ? <IncidentsTab incidents={data.incidents ?? []} /> : null}
      {tab === "compliance" ? (
        <ComplianceTab incidents={data.incidents ?? []} privacy={data.privacy ?? []} />
      ) : null}
      {tab === "requests" ? <RequestsTab privacy={data.privacy ?? []} /> : null}
      {tab === "audit" || !["incidents", "compliance", "requests"].includes(tab) ? (
        <AuditLogTab sessions={data.sessions ?? []} attempts={data.attempts ?? []} />
      ) : null}
    </div>
  );
}

async function AuditLogTab({ sessions, attempts }: { sessions: PlatformSession[]; attempts: LoginAttempt[] }) {
  const envelope = await apiGetEnvelope<SuperAdminAuditLogRow[]>("/api/super-admin/audit-logs?limit=30");
  const logs = envelope.data ?? [];
  const adminSessions = sessions.filter((s) => s.user && platformRoles.has(s.user.role));
  const failedAttempts = attempts.filter((a) => a.status === "FAILED").length;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Active admin sessions" value={adminSessions.length} detail="Platform-role accounts only" icon={MonitorCheck} tone="dark" />
        <StatCard label="Failed logins (recent)" value={failedAttempts} detail="Across all account types, not admin-only" icon={FileWarning} tone={failedAttempts ? "warning" : "neutral"} />
        <StatCard label="Auto-lockouts" value="N/A" detail="Not built — excessive failures are flagged for review, never auto-blocked" icon={AlertTriangle} tone="neutral" />
        <StatCard label="MFA coverage" value="N/A" detail="Not built — MFA is promised in onboarding copy but no verification step exists" icon={AlertTriangle} tone="neutral" />
        <StatCard label="IP whitelist" value="N/A" detail="Not built — no IP allow-list exists anywhere in this codebase" icon={AlertTriangle} tone="neutral" />
      </section>

      <TableCard
        title="Admin login policy — what's actually enforced"
        description="Verified against the real session and login code, not stated as intent."
        items={[
          { control: "Multi-factor authentication", spec: "Every admin login requires MFA, no exceptions.", state: "not-built" as const },
          { control: "Session expiry", spec: "A fixed 8-hour session from login. Not a 30-minute idle timeout — activity does not reset the clock, and the session is equally valid whether idle or active.", state: "partial" as const },
          { control: "Failed-login handling", spec: "10+ failed attempts for one email in an hour creates a review flag on the Users → Reviews & Cases queue. Nothing is automatically locked or blocked.", state: "partial" as const },
          { control: "IP whitelist", spec: "Restrict the admin panel to approved IP ranges.", state: "not-built" as const },
          { control: "Unrecognised device/location challenge", spec: "Extra verification when a login looks unusual.", state: "not-built" as const }
        ]}
        getRowKey={(row) => row.control}
        columns={[
          { key: "control", header: "Control", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.control}</span> },
          { key: "spec", header: "What actually happens", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.spec}</span> },
          {
            key: "state",
            header: "State",
            render: (row) => {
              const tone = row.state === "partial" ? { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Partially enforced" } : { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Not built" };
              return <StatusPill bg={tone.bg} fg={tone.fg} label={tone.label} />;
            }
          }
        ]}
      />

      <TableCard
        title="Active sessions"
        items={sessions}
        emptyState="No active sessions are currently tracked."
        columns={[
          { key: "user", header: "User", render: (item) => item.user ? `${item.user.firstName} ${item.user.lastName}` : "Unknown" },
          { key: "role", header: "Role", render: (item) => item.user?.role ?? "-" },
          { key: "device", header: "Device", render: (item) => item.device ?? "Unknown" },
          { key: "ip", header: "IP", render: (item) => item.ipAddress ?? "-" },
          { key: "last", header: "Last activity", render: (item) => formatDate(item.lastActivityAt) },
          {
            key: "actions",
            header: "Actions",
            render: (item) => (
              <ResourceActionDialog
                triggerLabel="Force logout"
                title={`Force logout — ${item.user ? `${item.user.firstName} ${item.user.lastName}` : "this session"}`}
                description="Immediately ends this session. The user is signed out on their next request and must log in again."
                endpoint={`/api/super-admin/security/sessions/${item.id}/revoke`}
                method="PATCH"
                variant="menuDanger"
                submitLabel="Force logout"
                confirmLabel="Confirm logout"
                confirmMessage="This immediately signs the user out."
                fields={[]}
              />
            )
          }
        ]}
      />

      <TableCard
        title="Login activity"
        description="Every account type, not admin-only — this system has no separate admin-login log."
        items={attempts}
        emptyState="No login attempts have been recorded."
        columns={[
          { key: "email", header: "Email", render: (item) => item.email },
          { key: "ip", header: "IP address", render: (item) => (item.ipAddress ? <span className="font-[var(--font-mono)]">{item.ipAddress}</span> : "-") },
          { key: "location", header: "Location", render: () => <span className="text-[var(--color-text-muted)]">Not tracked</span> },
          { key: "device", header: "Device", render: (item) => item.device ?? <span className="text-[var(--color-text-muted)]">Not recorded</span> },
          {
            key: "status",
            header: "Result",
            render: (item) =>
              item.status === "SUCCESS" ? (
                <StatusPill bg="var(--color-success-dim)" fg="var(--color-success)" label="Success" />
              ) : (
                <StatusPill bg="var(--color-danger-dim)" fg="var(--color-danger)" label={item.failureReason ?? "Failed"} />
              )
          },
          { key: "created", header: "Date", render: (item) => formatDate(item.createdAt) }
        ]}
      />

      <TableCard
        title="Platform audit trail"
        description={
          <>
            Most recent 30 events. For search, action-type and date-range filters plus CSV export, use the{" "}
            <Link href="/super-admin/audit-logs" className="font-semibold text-[var(--color-text-accent)] underline">
              full audit log
            </Link>
            .
          </>
        }
        items={logs}
        emptyState="No audit events recorded yet."
        columns={[
          { key: "timestamp", header: "Timestamp", render: (item) => formatDate(item.timestamp) },
          { key: "admin", header: "Super Admin", render: (item) => item.superAdmin },
          {
            key: "action",
            header: "Action",
            render: (item) => {
              const tone = auditActionTone(item.action);
              return <StatusPill bg={tone.bg} fg={tone.fg} label={item.action.replaceAll("_", " ")} />;
            }
          },
          { key: "target", header: "Target", render: (item) => <span className="font-[var(--font-mono)] text-[12px]">{item.target}</span> },
          { key: "school", header: "School", render: (item) => item.schoolName ?? "Platform" },
          { key: "details", header: "Details", render: (item) => <AuditDetailsPreview details={item.details} /> }
        ]}
      />
    </div>
  );
}

const flowToneStyle: Record<"good" | "warn" | "bad" | "ink" | "plain", { bg: string; fg: string; bd: string }> = {
  good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", bd: "#CFE4DB" },
  warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", bd: "#F2E4C6" },
  bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", bd: "#F3E0E0" },
  ink: { bg: "#0D2315", fg: "#fff", bd: "#0D2315" },
  plain: { bg: "#fff", fg: "var(--color-text-primary)", bd: "var(--color-border-default)" }
};

function FlowSteps({ title, sub, steps }: { title: string; sub: string; steps: Array<{ label: string; note: string; tone?: "good" | "warn" | "bad" | "ink" }> }) {
  return (
    <section className="rounded-[14px] border border-[#DEE8E2] bg-white p-6">
      <p className="text-[14px] font-semibold text-[#0D2315]">{title}</p>
      <p className="mt-1.5 max-w-3xl text-[12px] leading-5 text-[var(--color-text-muted)]">{sub}</p>
      <div className="mt-4 flex flex-wrap items-stretch gap-2.5">
        {steps.map((step, index) => {
          const tone = flowToneStyle[step.tone ?? "plain"];
          return (
            <div key={step.label} className="flex items-center gap-2.5">
              <div className="min-w-[9.5rem] max-w-[190px] rounded-[11px] border px-3.5 py-2.5" style={{ background: tone.bg, borderColor: tone.bd }}>
                <p className="text-[12px] font-bold" style={{ color: tone.fg }}>{step.label}</p>
                <p className="mt-1 text-[10.5px] leading-snug" style={{ color: step.tone === "ink" ? "rgba(255,255,255,0.75)" : "var(--color-text-secondary)" }}>{step.note}</p>
              </div>
              {index < steps.length - 1 ? <span className="shrink-0 text-[var(--color-text-muted)]">→</span> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function IncidentsTab({ incidents }: { incidents: SecurityIncident[] }) {
  return (
    <div className="grid gap-5">
      <FlowSteps
        title="Security incident lifecycle"
        sub="Every incident closes with a documented root cause and a prevention measure — the post-incident note is required before Resolved can be set."
        steps={[
          { label: "Detected or reported", note: "Automated or human" },
          { label: "Logged, severity set", note: "Critical / High / Medium / Low", tone: "warn" },
          { label: "Investigating", note: "Owner works the case", tone: "warn" },
          { label: "Contained", note: "Blast radius stopped", tone: "warn" },
          { label: "Resolved", note: "Service restored", tone: "good" },
          { label: "Post-incident note", note: "Root cause + prevention", tone: "ink" }
        ]}
      />
    <TableCard
      title="Security incidents"
      items={incidents}
      actions={
        <ResourceActionDialog
          triggerLabel="Log incident"
          title="Log a security incident"
          description="Record a detected or reported security incident."
          endpoint="/api/super-admin/security/incidents"
          method="POST"
          submitLabel="Log incident"
          fields={[
            { name: "type", label: "Type", required: true, placeholder: "e.g. UNAUTHORIZED_ACCESS" },
            { name: "severity", label: "Severity", type: "select", options: [{ label: "Critical", value: "CRITICAL" }, { label: "High", value: "HIGH" }, { label: "Medium", value: "MEDIUM" }, { label: "Low", value: "LOW" }] },
            { name: "description", label: "Description", type: "textarea", required: true }
          ]}
        />
      }
      columns={[
        { key: "type", header: "Incident", render: (item) => <span className="font-[var(--font-mono)] font-semibold text-[var(--color-text-primary)]">{item.type.replaceAll("_", " ")}</span> },
        { key: "description", header: "Description", render: (item) => <span className="text-[12.5px] text-[var(--color-text-secondary)]">{item.description}</span> },
        {
          key: "severity",
          header: "Severity",
          render: (item) => {
            const tone =
              item.severity === "CRITICAL" || item.severity === "HIGH"
                ? { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" }
                : item.severity === "MEDIUM"
                  ? { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" }
                  : { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" };
            return <StatusPill bg={tone.bg} fg={tone.fg} label={item.severity} />;
          }
        },
        { key: "detected", header: "Detected", render: (item) => formatDate(item.detectedAt) },
        { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
        {
          key: "actions",
          header: "Actions",
          render: (item) =>
            item.status !== "RESOLVED" ? (
              <ResourceActionDialog
                triggerLabel="Update"
                title={`Update incident — ${item.type}`}
                description="Advance the incident lifecycle. Resolving requires a post-incident note."
                endpoint={`/api/super-admin/security/incidents/${item.id}`}
                method="PATCH"
                variant="secondary"
                submitLabel="Update"
                fields={[
                  { name: "status", label: "Status", type: "select", defaultValue: item.status, options: incidentStatusOptions },
                  { name: "postIncidentNotes", label: "Post-incident note (root cause, actions, prevention)", type: "textarea" }
                ]}
              />
            ) : (
              <span className="text-xs text-[var(--color-text-muted)]">Resolved {item.resolvedAt ? formatDate(item.resolvedAt) : ""}</span>
            )
        }
      ]}
      emptyState="No security incidents logged."
    />

    <TableCard
      title="Severity reference"
      description="Sets the response path — this is guidance for whoever logs the incident, not an enforced classifier."
      items={[
        { severity: "Critical", examples: "Data breach, unauthorised access to student records, database compromise" },
        { severity: "High", examples: "Brute-force attack on admin panel, mass account lockout" },
        { severity: "Medium", examples: "Suspicious admin login from unrecognised location, API credential exposure" },
        { severity: "Low", examples: "Single failed login alert, minor configuration anomaly" }
      ]}
      getRowKey={(row) => row.severity}
      columns={[
        { key: "severity", header: "Severity", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.severity}</span> },
        { key: "examples", header: "Examples", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.examples}</span> }
      ]}
    />
    </div>
  );
}

async function ComplianceTab({ incidents, privacy }: { incidents: SecurityIncident[]; privacy: PrivacyRequest[] }) {
  const report = await apiGet<ComplianceReport>("/api/super-admin/security/compliance-report");
  const unresolvedCritical = incidents.filter((incident) => incident.severity === "CRITICAL" && incident.status !== "RESOLVED").length;
  const openRequests = privacy.filter((request) => request.status === "OPEN" || request.status === "IN_REVIEW").length;
  const shortestClockDays = privacy
    .filter((request) => request.status === "OPEN" || request.status === "IN_REVIEW")
    .map((request) => NDPA_RESPONSE_WINDOW_DAYS - Math.floor((Date.now() - new Date(request.createdAt).getTime()) / (24 * 60 * 60 * 1000)))
    .sort((a, b) => a - b)[0];

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-5">
        <StatCard label="Days to next filing" value="N/A" detail="Not tracked — no regulatory registration or filing deadline exists in this system." tone="dark" icon={AlertTriangle} />
        <StatCard
          label="Open data subject requests"
          value={openRequests}
          detail={shortestClockDays === undefined ? "None open" : shortestClockDays < 0 ? `Oldest is ${Math.abs(shortestClockDays)}d over the NDPA 30-day window` : `Shortest clock (NDPA 30-day window): ${shortestClockDays}d left`}
          icon={FileWarning}
          tone={openRequests ? "warning" : "success"}
        />
        <StatCard label="Open grievances" value="N/A" detail="Not tracked — this system has no request type distinct from Access/Export/Erasure/Rectification." icon={AlertTriangle} tone="neutral" />
        <StatCard label="DPA coverage — current version" value="N/A" detail="Not tracked — no data-processing-agreement version is recorded per school." icon={FileWarning} tone="neutral" />
        <StatCard label="Unresolved breach obligations" value={unresolvedCritical} detail="Real, but a proxy — this is unresolved Critical-severity incidents, not a formal breach-obligation tracker (none exists)." icon={AlertTriangle} tone={unresolvedCritical ? "danger" : "success"} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <TableCard
          title="Data processing agreement coverage"
          description="Would show schools on the current DPA version, on an outdated one, and not yet accepted."
          items={[]}
          columns={[
            { key: "version", header: "Version", render: () => null },
            { key: "schools", header: "Schools", render: () => null },
            { key: "state", header: "State", render: () => null }
          ]}
          emptyState="No DPA-version field exists on a school record — every school is simply on whatever terms it agreed to at signup, untracked afterward."
        />
        <TableCard
          title="Consent coverage by school"
          description="Would show what share of each school's guardians have recorded consent on file."
          items={[]}
          columns={[
            { key: "school", header: "School", render: () => null },
            { key: "coverage", header: "Coverage", render: () => null },
            { key: "state", header: "State", render: () => null }
          ]}
          emptyState="No guardian-consent field exists anywhere in this schema — consent coverage cannot be computed because it was never recorded."
        />
      </div>

      <TableCard
        title="Regulatory obligations register"
        description="Each real-world obligation a mature compliance program would operate, checked against what this system actually tracks — not a claim about the business's real compliance status."
        items={[
          { obligation: "Registration as controller and processor of major importance", cadence: "At launch, then per cycle", owner: "Data Protection Officer" },
          { obligation: "Annual compliance audit filing", cadence: "Annual", owner: "DPO with Finance" },
          { obligation: "DPO appointed, details published and registered", cadence: "At launch; on change", owner: "Super Admin" },
          { obligation: "Data protection impact assessment", cadence: "Before launch; on new processing", owner: "DPO with CTO" },
          { obligation: "Record of processing activities", cadence: "Continuous", owner: "Data Protection Officer" },
          { obligation: "Breach notification", cadence: "Within the applicable window", owner: "CTO and DPO" },
          { obligation: "Grievance mechanism", cadence: "Continuous", owner: "Support Lead with DPO" },
          { obligation: "Cross-border transfer record", cadence: "On any provider or region change", owner: "CTO with DPO" },
          { obligation: "Data processing agreement with every school", cadence: "At onboarding; on version change", owner: "Legal with Onboarding" }
        ]}
        getRowKey={(row) => row.obligation}
        columns={[
          { key: "obligation", header: "Obligation", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.obligation}</span> },
          { key: "cadence", header: "Cadence", render: (row) => row.cadence },
          { key: "owner", header: "Owner", render: (row) => row.owner },
          { key: "state", header: "State", render: () => <StatusPill bg="var(--color-bg-subtle)" fg="var(--color-text-muted)" label="Not tracked in this system" /> }
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <TableCard
          title="Registration tiers"
          description="NDPA reference thresholds — informational, not a claim about which tier this business currently sits in."
          items={[
            { tier: "Ordinary High Level", threshold: "200 – 999", who: "An individual client school" },
            { tier: "Extra-High Level", threshold: "1,000 +", who: "A larger school group" },
            { tier: "Ultra-High Level", threshold: "5,000 +", who: "A platform aggregating subjects across every school" }
          ]}
          getRowKey={(row) => row.tier}
          columns={[
            { key: "tier", header: "Tier", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.tier}</span> },
            { key: "threshold", header: "Threshold", render: (row) => row.threshold },
            { key: "who", header: "Who sits here", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.who}</span> }
          ]}
        />
        <TableCard
          title="Live compliance artefacts — real vs. not tracked"
          items={[
            { label: "Data protection impact assessment", state: "Not tracked in this system", tone: "bad" },
            { label: "Record of processing activities", state: "Not tracked in this system", tone: "bad" },
            { label: "Grievance mechanism", state: "Not tracked as a distinct request type", tone: "bad" },
            { label: "Cross-border transfer record", state: "Not tracked — this codebase has no data-residency configuration to record", tone: "bad" }
          ]}
          getRowKey={(row) => row.label}
          columns={[
            { key: "label", header: "Artefact", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.label}</span> },
            { key: "state", header: "State", render: (row) => <StatusPill bg="var(--color-bg-subtle)" fg="var(--color-text-muted)" label={row.state} /> }
          ]}
        />
      </div>

      <FlowSteps
        title="Breach handling — the aspiration, checked against real code"
        sub="No automated breach-notification workflow exists in this codebase — a Super Admin would run every one of these steps manually today."
        steps={[
          { label: "Potential breach detected", note: "Monitoring, staff, school or provider" },
          { label: "Incident opened at Critical", note: "Real — log it as a Critical incident above", tone: "bad" },
          { label: "Contain", note: "Manual — no automated session-kill or flag-rollback exists", tone: "warn" },
          { label: "Assess", note: "Manual — no data-scope assessment tooling exists", tone: "warn" },
          { label: "Notify the regulator", note: "Not built — no notification workflow exists", tone: "warn" },
          { label: "Notify each affected school", note: "Not built — no notification workflow exists", tone: "warn" },
          { label: "Post-incident review", note: "Real — the incident's post-incident note field", tone: "ink" }
        ]}
      />

      <TableCard
        title="NDPC data deletion requests"
        description="Every erasure request end-to-end, not only the completed ones — a school closure isn't evidenced until this row shows a confirmation hash."
        items={report.all}
        getRowKey={(item) => item.id}
        columns={[
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "subject", header: "Subject", render: (item) => item.subject },
          { key: "requested", header: "Requested", render: (item) => formatDate(item.createdAt) },
          {
            key: "status",
            header: "Status",
            render: (item) => {
              const tone =
                item.status === "COMPLETED"
                  ? { bg: "var(--color-success-dim)", fg: "var(--color-success)" }
                  : item.status === "REJECTED"
                    ? { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" }
                    : { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" };
              return <StatusPill bg={tone.bg} fg={tone.fg} label={item.status.replaceAll("_", " ")} />;
            }
          },
          { key: "by", header: "Completed by", render: (item) => item.completedBy ?? "—" },
          { key: "hash", header: "Confirmation hash", render: (item) => <span className="font-[var(--font-mono)] text-[11px]">{item.confirmationHash ?? "—"}</span> }
        ]}
        emptyState="No deletion requests recorded yet."
        footnote="All three below must be satisfied before a request can be marked complete."
      />

      <TableCard
        title="Completion requirements"
        items={[
          { label: "Full data export delivered to the school", state: "Manual step — a Super Admin confirms this before completing; not itself verified by the system.", tone: "warn" },
          { label: "Data purge completed", state: "Real — completion sets the school's data-deletion state and writes an immutable audit entry.", tone: "good" },
          { label: "Confirmation logged with hash", state: "Real — a confirmation hash is generated and stored on the request at completion.", tone: "good" },
          { label: "Compliance report available on demand", state: "Real — every request and its hash is queryable here at any time.", tone: "good" }
        ]}
        getRowKey={(row) => row.label}
        columns={[
          { key: "label", header: "Requirement", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.label}</span> },
          {
            key: "state",
            header: "State",
            render: (row) => {
              const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Real" }, warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Partial" } }[row.tone as "good" | "warn"];
              return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
            }
          }
        ]}
      />

      <TableCard
        title="Retention schedule"
        description="Would show, per data class, how long it's kept and what triggers deletion."
        items={[]}
        columns={[
          { key: "class", header: "Data class", render: () => null },
          { key: "retention", header: "Retention", render: () => null },
          { key: "basis", header: "Basis", render: () => null },
          { key: "due", header: "Due", render: () => null }
        ]}
        emptyState="No retention-schedule model exists in this system — nothing here has a defined keep-period or an automatic deletion clock, active-school data and closed-school data alike."
      />
      <TableCard
        title="Deletion schedule"
        description="Would show every pending deletion clock, executed and evidenced."
        items={[]}
        columns={[
          { key: "subject", header: "Subject", render: () => null },
          { key: "class", header: "Class", render: () => null },
          { key: "started", header: "Clock started", render: () => null },
          { key: "due", header: "Deletion due", render: () => null },
          { key: "state", header: "State", render: () => null }
        ]}
        emptyState="Nothing is scheduled — since no retention schedule exists (above), there is no clock to start or evidence to show."
      />
    </div>
  );
}

async function RequestsTab({ privacy }: { privacy: PrivacyRequest[] }) {
  const schoolsEnvelope = await apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100");
  const schoolOptions = [
    { label: "Platform-wide (no specific school)", value: "" },
    ...(schoolsEnvelope.data ?? []).map((school) => ({ label: school.name, value: school.id }))
  ];

  return (
    <div className="grid gap-5">
      <TableCard
        title="Data subject request routes"
        description="The school is the controller for its own students and guardians; Nooria is the processor. Erasure is never executed unilaterally, without the controller's instruction."
        items={[
          { type: "Access", route: "Through the school", role: "We assist the school in producing it; the school responds." },
          { type: "Correction", route: "Through the school", role: "Handled through the school's own record-correction tools, with its own authorisation." },
          { type: "Erasure", route: "Through the school", role: "Assessed case by case; never executed by us without the controller's instruction." },
          { type: "Objection / withdrawal of consent", route: "Through the school for school data; directly to us for our own marketing", role: "Real for our own marketing consent; assisted for school data — there is no separate withdrawal flow for a school's own guardians." },
          { type: "Portability", route: "Through the school", role: "Would be satisfied by the school's own full export — a Super Admin-only export exists (Security & Compliance); a school cannot self-serve one." }
        ]}
        getRowKey={(row) => row.type}
        columns={[
          { key: "type", header: "Request type", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.type}</span> },
          { key: "route", header: "Route", render: (row) => row.route },
          { key: "role", header: "Our role", render: (row) => <span className="text-[12.5px] text-[var(--color-text-secondary)]">{row.role}</span> }
        ]}
      />

      <TableCard
        title="Data privacy requests"
        description="Every request is logged with the real NDPA 30-day response window — shown as days left, not just a status."
        items={privacy}
        actions={
          <ResourceActionDialog
            triggerLabel="New request"
            title="Create data privacy request"
            description="Track access, export, erasure, and rectification requests."
            endpoint="/api/super-admin/security/privacy-requests"
            method="POST"
            submitLabel="Create request"
            fields={[
              { name: "schoolId", label: "School", type: "select", defaultValue: "", options: schoolOptions },
              { name: "type", label: "Type", type: "select", options: privacyRequestTypeOptions },
              { name: "subject", label: "Subject", required: true },
              { name: "details", label: "Details", type: "textarea" }
            ]}
          />
        }
        columns={[
          { key: "subject", header: "Subject", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.subject}</span> },
          { key: "type", header: "Type", render: (item) => item.type },
          { key: "school", header: "School", render: (item) => item.school?.name ?? "Platform" },
          {
            key: "daysLeft",
            header: "Days left",
            render: (item) => {
              if (item.status !== "OPEN" && item.status !== "IN_REVIEW") return <span className="text-[var(--color-text-muted)]">—</span>;
              const daysLeft = NDPA_RESPONSE_WINDOW_DAYS - Math.floor((Date.now() - new Date(item.createdAt).getTime()) / (24 * 60 * 60 * 1000));
              return <span className={daysLeft < 0 ? "font-semibold text-[var(--color-danger)]" : daysLeft <= 7 ? "font-semibold text-[var(--color-warning)]" : "text-[var(--color-text-secondary)]"}>{daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d`}</span>;
            }
          },
          { key: "status", header: "State", render: (item) => <StatusBadge status={item.status} /> },
          { key: "hash", header: "Confirmation hash", render: (item) => item.confirmationHash ? <span className="font-[var(--font-mono)] text-[11px]">{item.confirmationHash.slice(0, 16)}…</span> : "-" },
          {
            key: "actions",
            header: "Actions",
            render: (item) => {
              if (item.status === "COMPLETED") {
                return <span className="text-xs" style={{ color: "var(--color-success)" }}>Completed {item.completedAt ? formatDate(item.completedAt) : ""}</span>;
              }
              if (item.status === "REJECTED") {
                return <span className="text-xs text-[var(--color-text-muted)]">Rejected</span>;
              }
              return (
                <div className="flex flex-wrap items-center gap-2">
                  <ResourceActionDialog
                    triggerLabel="Update status"
                    title={`Update request — ${item.subject}`}
                    description="Move this request through the review workflow (approve, keep in review, or reject)."
                    endpoint={`/api/super-admin/security/privacy-requests/${item.id}/status`}
                    method="PATCH"
                    variant="secondary"
                    submitLabel="Update"
                    fields={[
                      {
                        name: "status",
                        label: "Status",
                        type: "select",
                        defaultValue: item.status,
                        options: item.type === "ERASURE" ? privacyStatusOptions.filter((option) => option.value !== "COMPLETED") : privacyStatusOptions
                      }
                    ]}
                  />
                  {item.type === "ERASURE" ? (
                    <ResourceActionDialog
                      triggerLabel="Complete deletion"
                      title="Complete data deletion"
                      description="Confirms the export was delivered and data purged. Generates a confirmation hash and logs it immutably for NDPC compliance."
                      endpoint={`/api/super-admin/security/privacy-requests/${item.id}/complete`}
                      method="PATCH"
                      variant="danger"
                      submitLabel="Confirm deletion"
                      confirmLabel="Confirm"
                      confirmMessage="This is a Super Admin-only, audited, irreversible compliance action."
                      fields={[]}
                    />
                  ) : null}
                </div>
              );
            }
          }
        ]}
        emptyState="No data privacy requests recorded."
        footnote="A request created here is tracked to completion with a real day-count — but nothing automatically acknowledges or routes a request that arrives directly at Nooria; a Super Admin has to create the record by hand."
      />
    </div>
  );
}
