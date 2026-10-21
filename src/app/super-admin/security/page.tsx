import { AlertTriangle, FileWarning, MonitorCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatCard } from "@/components/data-display/stat-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
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
  location?: string | null;
  newDevice?: boolean;
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
  containedAt?: string | null;
  containment?: string | null;
  assessment?: string | null;
  affectedSchoolIds?: string[];
  regulatorNotifiedAt?: string | null;
  regulatorReference?: string | null;
  schoolsNotifiedAt?: string | null;
  schoolsNotifiedCount?: number | null;
  reportedBy: string;
  resolvedBy?: string | null;
};

type ComplianceOverview = {
  obligations: Array<{ id: string; code: string; title: string; cadence: string; ownerRole: string; status: string; state: string; dueAt: string | null; lastDoneAt: string | null; reference: string | null; notes: string | null; evidence: string | null; daysToDue: number | null }>;
  nextFiling: { title: string; dueAt: string | null; days: number | null } | null;
  dpa: { current: string | null; versions: Array<{ id: string; version: string; effectiveFrom: string; summary: string | null; isCurrent: boolean }>; coverage: Array<{ version: string; label: string; schools: string[] }>; onCurrent: number; totalSchools: number };
  consent: Array<{ school: string; guardians: number; consented: number; pct: number; state: string }>;
  subjects: { students: number; guardians: number; accounts: number };
  grievances: { open: number; total: number };
  retention: Array<{ id: string; dataClass: string; retentionDays: number; basis: string; trigger: string; enforcement: string; enforced: boolean; waiting: number | null; oldest: string | null; nextDue: string | null }>;
  deletionSchedule: Array<{ id: string; subject: string; dataClass: string; started: string; due: string; state: string; evidence: string | null }>;
  signIn: { lockouts7d: number; ipAllow: number; ipDeny: number; idleMinutes: number };
  generatedAt: string;
};

type AuditExportRow = { id: string; by: string; reason: string; format: string; rowCount: number; truncated: boolean; filters: Record<string, string | null>; createdAt: string };

const retentionLabel = (days: number) => (days === 0 ? "While the account is open" : days % 365 === 0 ? `${days / 365} year${days === 365 ? "" : "s"}` : days % 30 === 0 && days >= 90 ? `${days / 30} months` : `${days} days`);

type SecurityView = {
  sessions: PlatformSession[];
  attempts: LoginAttempt[];
  privacy: PrivacyRequest[];
  incidents: SecurityIncident[];
  mfaCoverage: { enabled: number; total: number };
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

const privacyRequestTypeOptions = ["ACCESS", "EXPORT", "ERASURE", "RECTIFICATION", "GRIEVANCE"].map((v) => ({ label: v, value: v }));

const privacyStatusOptions = [
  { label: "Open", value: "OPEN" },
  { label: "In review", value: "IN_REVIEW" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Rejected", value: "REJECTED" }
];

function StatusPill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: bg, color: fg }}>
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
  return <span className="line-clamp-2 max-w-xs font-[var(--font-mono)] text-[10px] text-[var(--color-text-secondary)]">{text}</span>;
}

function tabHref(tab: string) {
  return tab === "audit" ? "/super-admin/security" : `/super-admin/security?tab=${tab}`;
}

export default async function SuperAdminSecurityPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab = "audit" } = searchParams ? await searchParams : {};
  const [data, overview, schoolsEnvelope, actors] = await Promise.all([
    apiGet<SecurityView>("/api/super-admin/security"),
    apiGet<ComplianceOverview>("/api/super-admin/compliance"),
    apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100"),
    apiGet<Array<{ id: string; name: string; role: string }>>("/api/super-admin/compliance/audit-actors").catch(() => [])
  ]);
  const schools = schoolsEnvelope.data ?? [];
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
          <ResourceActionDialog
            triggerLabel="Export the audit log"
            title="Export the audit log"
            description="The record of who did what. Taking a copy of it is itself an act — the reason you give, the filters, and the row count are written back to the audit log and kept with the copy."
            endpoint="/api/super-admin/compliance/audit-exports"
            method="POST"
            variant="heroWhite"
            submitLabel="Create export"
            fields={[
              { name: "dateFrom", label: "From", type: "date", section: "Filters" },
              { name: "dateTo", label: "To", type: "date", section: "Filters" },
              { name: "actorId", label: "Actor", type: "select", defaultValue: "", options: [{ label: "Anyone", value: "" }, ...actors.map((actor) => ({ label: `${actor.name} · ${actor.role.replaceAll("_", " ").toLowerCase()}`, value: actor.id }))], section: "Filters" },
              { name: "schoolId", label: "School", type: "select", defaultValue: "", options: [{ label: "Any school", value: "" }, ...schools.map((school) => ({ label: school.name, value: school.id }))], section: "Filters" },
              { name: "action", label: "Action type", type: "select", defaultValue: "", options: [{ label: "Any action", value: "" }, ...["CREATE", "UPDATE", "DELETE", "LOGIN", "EXPORT", "APPROVE", "REJECT", "PAYMENT", "SUSPEND", "ACTIVATE", "RESET_PASSWORD", "IMPERSONATE", "SETTINGS_UPDATE", "BILLING_UPDATE"].map((value) => ({ label: value.replaceAll("_", " "), value }))], section: "Filters" },
              { name: "entityType", label: "Entity", type: "text", placeholder: "e.g. School, Invoice, User — blank for all", section: "Filters" },
              { name: "origin", label: "Origin", type: "select", defaultValue: "", options: [{ label: "Anywhere", value: "" }, { label: "Back Office (platform staff)", value: "BACK_OFFICE" }, { label: "School app (school staff)", value: "SCHOOL" }, { label: "System (no person — schedulers, signup)", value: "SYSTEM" }], note: "Worked out from who acted — a row with no actor is the system itself.", section: "Filters" },
              { name: "format", label: "Format", type: "select", defaultValue: "CSV", options: [{ label: "CSV", value: "CSV" }, { label: "JSON", value: "JSON" }], section: "Output" },
              { name: "rows", label: "Rows", type: "static", placeholder: "Every match, up to 20,000", note: "If more than that match, the file says so and the export register marks it truncated — narrow the dates.", section: "Output" },
              { name: "reason", label: "Why this export is needed", type: "textarea", required: true, placeholder: "e.g. NDPC information request ref …", section: "Reason (required)" }
            ]}
          />
        }
      />

      <DetailTabs tabs={tabs} />

      {tab === "incidents" ? <IncidentsTab incidents={data.incidents ?? []} schools={schools} /> : null}
      {tab === "compliance" ? (
        <ComplianceTab incidents={data.incidents ?? []} privacy={data.privacy ?? []} overview={overview} />
      ) : null}
      {tab === "requests" ? <RequestsTab privacy={data.privacy ?? []} schools={schools} /> : null}
      {tab === "audit" || !["incidents", "compliance", "requests"].includes(tab) ? (
        <AuditLogTab sessions={data.sessions ?? []} attempts={data.attempts ?? []} mfaCoverage={data.mfaCoverage} signIn={overview.signIn} />
      ) : null}
    </div>
  );
}

async function AuditLogTab({ sessions, attempts, mfaCoverage, signIn }: { sessions: PlatformSession[]; attempts: LoginAttempt[]; mfaCoverage: { enabled: number; total: number }; signIn: ComplianceOverview["signIn"] }) {
  const [envelope, exportsList] = await Promise.all([
    apiGetEnvelope<SuperAdminAuditLogRow[]>("/api/super-admin/audit-logs?limit=30"),
    apiGet<AuditExportRow[]>("/api/super-admin/compliance/audit-exports").catch(() => [] as AuditExportRow[])
  ]);
  const logs = envelope.data ?? [];
  const adminSessions = sessions.filter((s) => s.user && platformRoles.has(s.user.role));
  const failedAttempts = attempts.filter((a) => a.status === "FAILED" && Date.now() - new Date(a.createdAt).getTime() < 86_400_000).length;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Active admin sessions" value={adminSessions.length} detail="Platform-role accounts only" icon={MonitorCheck} tone="dark" />
        <StatCard label="Failed logins (24h)" value={failedAttempts} detail="Across all account types, not admin-only" icon={FileWarning} tone={failedAttempts ? "warning" : "neutral"} />
        <StatCard label="Auto-lockouts (7d)" value={signIn.lockouts7d} detail="Accounts locked for 15 minutes after 5 failed sign-ins in 10 — each one raises a High incident" icon={AlertTriangle} tone={signIn.lockouts7d ? "warning" : "neutral"} />
        <StatCard
          label="MFA coverage"
          value={`${mfaCoverage.enabled}/${mfaCoverage.total}`}
          detail="Back Office accounts with an authenticator app on, out of all active ones — separate from the email code every sign-in asks for"
          icon={AlertTriangle}
          tone={mfaCoverage.enabled === 0 ? "warning" : "neutral"}
        />
        <StatCard label="IP whitelist" value={signIn.ipAllow ? `${signIn.ipAllow} allowed` : "Off"} detail={signIn.ipAllow || signIn.ipDeny ? `${signIn.ipAllow} allow · ${signIn.ipDeny} deny rule${signIn.ipDeny === 1 ? "" : "s"}, exact address, Back Office accounts only` : "No rules set — any address may sign in to the Back Office"} icon={ShieldCheck} tone={signIn.ipAllow ? "success" : "neutral"} />
      </section>

      <TableCard
        title="Admin login policy"
        description="Verified against the real session and login code, not stated as intent."
        items={[
          { control: "Multi-factor authentication", spec: "Every Back Office sign-in asks for a one-time code sent to the account's email (when a mail server is configured). An authenticator app can be turned on top of it from Profile → Sessions & security; with the app on, its code is asked for instead.", state: "enforced" as const },
          { control: "Session expiry", spec: `An 8-hour session from sign-in, and a Back Office session ends after ${signIn.idleMinutes} minutes without a request (PLATFORM_IDLE_MINUTES). School accounts keep the full session.`, state: "enforced" as const },
          { control: "Failed-login handling", spec: "5 failed attempts for one account in 10 minutes lock it for 15 minutes, counted by account so switching between email and User ID does not reset it. Each lockout opens a High incident automatically.", state: "enforced" as const },
          { control: "IP whitelist", spec: "Enforced at sign-in for Back Office accounts, exact address only — any allow rule switches it to allow-list mode. See Internal Team → Security for the rules.", state: "enforced" as const },
          { control: "Unrecognised device/location challenge", spec: "A sign-in from a device the account has not used before is flagged on the login record and the account's owner is emailed. It does not block the sign-in — the email code already gates it. Location shows only where a network edge (Cloudflare, Vercel, CloudFront) reports it.", state: "partial" as const }
        ]}
        getRowKey={(row) => row.control}
        columns={[
          { key: "control", header: "Control", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.control}</span> },
          { key: "spec", header: "What actually happens", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.spec}</span> },
          {
            key: "state",
            header: "State",
            render: (row) => {
              const tone = row.state === "enforced" ? { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Enforced" } : row.state === "partial" ? { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Alerts, does not block" } : { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Not built" };
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
        title="Recent admin logins"
        description="Every account type — Back Office and school sign-ins share one log. A device the account has never used is marked."
        items={attempts}
        emptyState="No login attempts have been recorded."
        columns={[
          { key: "email", header: "Email", render: (item) => item.email },
          { key: "ip", header: "IP address", render: (item) => (item.ipAddress ? <span className="font-[var(--font-mono)]">{item.ipAddress}</span> : "-") },
          { key: "location", header: "Location", render: (item) => (item.location ? item.location : <span className="text-[var(--color-text-muted)]">Not reported by the network</span>) },
          { key: "device", header: "Device", render: (item) => <div><p className="max-w-[16rem] truncate">{item.device ?? <span className="text-[var(--color-text-muted)]">Not recorded</span>}</p>{item.newDevice ? <StatusPill bg="var(--color-warning-dim)" fg="var(--color-warning)" label="New device" /> : null}</div> },
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
        title="Audit exports"
        description="Every copy of the audit trail taken out of the system — who, why, which filters, how many rows. The file is kept so a second download is identical to the first."
        items={exportsList}
        emptyState="No audit export has been taken yet."
        columns={[
          { key: "when", header: "Taken", render: (item) => formatDate(item.createdAt) },
          { key: "by", header: "By", render: (item) => item.by },
          { key: "reason", header: "Reason", render: (item) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{item.reason}</span> },
          { key: "filters", header: "Filters", render: (item) => <span className="text-[10.5px] text-[var(--color-text-muted)]">{Object.entries(item.filters).filter(([, value]) => value).map(([key, value]) => `${key}: ${String(value).slice(0, 10)}`).join(" · ") || "None"}</span> },
          { key: "rows", header: "Rows", render: (item) => <span>{item.rowCount.toLocaleString()} {item.format}{item.truncated ? <span className="ml-1 text-[var(--color-warning)]">truncated</span> : null}</span> },
          { key: "dl", header: "File", render: (item) => <a href={`/api/super-admin/compliance/audit-exports/${item.id}/download`} className="font-semibold text-[var(--color-text-accent)] underline">Download</a> }
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
          { key: "target", header: "Target", render: (item) => <span className="font-[var(--font-mono)] text-[11px]">{item.target}</span> },
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
    <section className="rounded-[12.5px] border border-[#DEE8E2] bg-white p-6">
      <p className="text-[12.5px] font-semibold text-[#0D2315]">{title}</p>
      <p className="mt-1.5 max-w-3xl text-[11px] leading-5 text-[var(--color-text-muted)]">{sub}</p>
      <div className="mt-4 flex flex-wrap items-stretch gap-2.5">
        {steps.map((step, index) => {
          const tone = flowToneStyle[step.tone ?? "plain"];
          return (
            <div key={step.label} className="flex items-center gap-2.5">
              <div className="min-w-[9.5rem] max-w-[190px] rounded-[10px] border px-3.5 py-2.5" style={{ background: tone.bg, borderColor: tone.bd }}>
                <p className="text-[11px] font-bold" style={{ color: tone.fg }}>{step.label}</p>
                <p className="mt-1 text-[9.5px] leading-snug" style={{ color: step.tone === "ink" ? "rgba(255,255,255,0.75)" : "var(--color-text-secondary)" }}>{step.note}</p>
              </div>
              {index < steps.length - 1 ? <span className="shrink-0 text-[var(--color-text-muted)]">→</span> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const REGULATOR_WINDOW_HOURS = 72;

function BreachSteps({ incident }: { incident: SecurityIncident }) {
  const step = (label: string, done: boolean, detail?: string | null) => (
    <span key={label} className="inline-flex items-center gap-1 text-[10px]" title={detail ?? undefined}>
      <span className={done ? "text-[var(--color-success)]" : "text-[var(--color-text-muted)]"}>{done ? "●" : "○"}</span>
      <span className={done ? "font-semibold text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"}>{label}</span>
    </span>
  );
  const open = incident.status !== "RESOLVED";
  const hoursOpen = (Date.now() - new Date(incident.detectedAt).getTime()) / 3_600_000;
  const clock = open && !incident.regulatorNotifiedAt && (incident.severity === "CRITICAL" || incident.severity === "HIGH") ? REGULATOR_WINDOW_HOURS - hoursOpen : null;
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {step("Assessed", Boolean(incident.assessment), incident.assessment)}
        {step("Contained", Boolean(incident.containedAt), incident.containment)}
        {step("Regulator", Boolean(incident.regulatorNotifiedAt), incident.regulatorReference ? `Reference ${incident.regulatorReference}` : null)}
        {step(incident.schoolsNotifiedCount ? `Schools (${incident.schoolsNotifiedCount})` : "Schools", Boolean(incident.schoolsNotifiedAt))}
      </div>
      {clock !== null ? (
        <span className={clock < 0 ? "text-[10px] font-semibold text-[var(--color-danger)]" : clock < 24 ? "text-[10px] font-semibold text-[var(--color-warning)]" : "text-[10px] text-[var(--color-text-muted)]"}>
          {clock < 0 ? `Regulator window passed ${Math.round(-clock)}h ago` : `Regulator window: ${Math.round(clock)}h left of ${REGULATOR_WINDOW_HOURS}h`}
        </span>
      ) : null}
    </div>
  );
}

function IncidentsTab({ incidents, schools }: { incidents: SecurityIncident[]; schools: SuperAdminSchoolRow[] }) {
  const schoolOptions = schools.map((school) => ({ label: school.name, value: school.id }));
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
        title="Incident register"
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
          { key: "description", header: "Description", render: (item) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{item.description}</span> },
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
          { key: "workflow", header: "Breach handling", render: (item) => <BreachSteps incident={item} /> },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          {
            key: "actions",
            header: "Actions",
            render: (item) =>
              item.status !== "RESOLVED" ? (
                <div className="flex max-w-[15rem] flex-wrap items-center gap-x-3 gap-y-1">
                  <ResourceActionDialog
                    triggerLabel="Update"
                    title={`Update incident — ${item.type}`}
                    description="Advance the incident lifecycle. Resolving requires a post-incident note."
                    endpoint={`/api/super-admin/security/incidents/${item.id}`}
                    method="PATCH"
                    variant="textAction"
                    submitLabel="Update"
                    fields={[
                      { name: "status", label: "Status", type: "select", defaultValue: item.status, options: incidentStatusOptions },
                      { name: "postIncidentNotes", label: "Post-incident note (root cause, actions, prevention)", type: "textarea" }
                    ]}
                  />
                  <ResourceActionDialog
                    triggerLabel={item.assessment ? "Re-assess" : "Assess"}
                    title={`Assess — ${item.type}`}
                    description="What was affected, and which schools. The schools named here are the ones containment and notices reach."
                    endpoint={`/api/super-admin/compliance/incidents/${item.id}/assess`}
                    method="POST"
                    variant="textAction"
                    submitLabel="Record assessment"
                    fields={[
                      { name: "assessment", label: "What data and people were affected", type: "textarea", required: true, defaultValue: item.assessment ?? "" },
                      { name: "affectedSchoolIds", label: "Affected schools", type: "multiselect", options: schoolOptions, defaultValue: item.affectedSchoolIds ?? [], note: "Hold Cmd/Ctrl to pick several. Leave empty if no school's data was touched." }
                    ]}
                  />
                  <ResourceActionDialog
                    triggerLabel="Contain"
                    title={`Contain — ${item.type}`}
                    description="Stops the incident spreading. Ending sign-ins makes everyone in scope sign in again (and pass the email code); it never touches Back Office staff."
                    endpoint={`/api/super-admin/compliance/incidents/${item.id}/contain`}
                    method="POST"
                    variant="textAction"
                    submitLabel="Record containment"
                    confirmLabel="Confirm"
                    confirmMessage="This signs people out immediately if you chose a scope."
                    fields={[
                      { name: "scope", label: "End sign-ins for", type: "select", defaultValue: item.affectedSchoolIds?.length ? "AFFECTED_SCHOOLS" : "NONE", options: [{ label: "Affected schools' people", value: "AFFECTED_SCHOOLS" }, { label: "Every school account", value: "ALL_SCHOOL_USERS" }, { label: "Nobody — record the step only", value: "NONE" }] },
                      { name: "note", label: "What was done to contain it", type: "textarea", required: true }
                    ]}
                  />
                  <ResourceActionDialog
                    triggerLabel="Regulator"
                    title={`Notify the regulator — ${item.type}`}
                    description="The filing is made with the regulator itself; this records that it was made, when, and the reference they gave. The 72-hour window is measured from detection."
                    endpoint={`/api/super-admin/compliance/incidents/${item.id}/regulator`}
                    method="POST"
                    variant="textAction"
                    submitLabel="Record notice"
                    fields={[
                      { name: "reference", label: "Regulator's reference or filing receipt", type: "text", required: true, defaultValue: item.regulatorReference ?? "" },
                      { name: "notifiedAt", label: "Notified on", type: "date", note: "Blank means now." },
                      { name: "notes", label: "Notes", type: "textarea" }
                    ]}
                  />
                  <ResourceActionDialog
                    triggerLabel="Tell schools"
                    title={`Tell the affected schools — ${item.type}`}
                    description={`Sends this message to every affected school's owner, proprietor and principal — in the app and by email.${item.affectedSchoolIds?.length ? ` ${item.affectedSchoolIds.length} school${item.affectedSchoolIds.length === 1 ? "" : "s"} recorded.` : " No school is recorded yet — assess first."}`}
                    endpoint={`/api/super-admin/compliance/incidents/${item.id}/schools`}
                    method="POST"
                    variant="textActionDanger"
                    submitLabel="Send notice"
                    confirmLabel="Send"
                    confirmMessage="This sends real email to school leadership and cannot be recalled."
                    fields={[{ name: "message", label: "What happened, what it means for them, what to do", type: "textarea", required: true }]}
                  />
                </div>
              ) : (
                <span className="text-xs text-[var(--color-text-muted)]">Resolved {item.resolvedAt ? formatDate(item.resolvedAt) : ""}</span>
              )
          }
        ]}
        emptyState="No security incidents logged."
      />

      <TableCard
        title="Severity reference"
        description="Sets the response path — this is guidance for whoever logs the incident, not an enforced classifier. A Critical or High incident shows the regulator's 72-hour window until a notice is recorded."
        items={[
          { severity: "Critical", examples: "Data breach, unauthorised access to student records, database compromise" },
          { severity: "High", examples: "Brute-force attack on admin panel, mass account lockout, a failed backup" },
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

function ObligationState({ state }: { state: string }) {
  const tone = state === "COMPLIANT" ? { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Compliant" } : state === "IN_PROGRESS" ? { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "In progress" } : state === "OVERDUE" ? { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Overdue" } : { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "Not started" };
  return <StatusPill bg={tone.bg} fg={tone.fg} label={tone.label} />;
}

async function ComplianceTab({ incidents, privacy, overview }: { incidents: SecurityIncident[]; privacy: PrivacyRequest[]; overview: ComplianceOverview }) {
  const report = await apiGet<ComplianceReport>("/api/super-admin/security/compliance-report");
  const openRequests = privacy.filter((request) => request.status === "OPEN" || request.status === "IN_REVIEW").length;
  const shortestClockDays = privacy
    .filter((request) => request.status === "OPEN" || request.status === "IN_REVIEW")
    .map((request) => NDPA_RESPONSE_WINDOW_DAYS - Math.floor((Date.now() - new Date(request.createdAt).getTime()) / (24 * 60 * 60 * 1000)))
    .sort((a, b) => a - b)[0];
  const unresolvedBreaches = incidents.filter((incident) => (incident.severity === "CRITICAL" || incident.severity === "HIGH") && incident.status !== "RESOLVED" && !incident.regulatorNotifiedAt).length;
  const { dpa, nextFiling, subjects } = overview;
  const total = subjects.students + subjects.guardians + subjects.accounts;
  const tier = total >= 5000 ? "Ultra-High Level" : total >= 1000 ? "Extra-High Level" : total >= 200 ? "Ordinary High Level" : "Below the registration thresholds";
  const platformAttrs = ["Data protection impact assessment", "Record of processing activities", "Grievance mechanism", "Cross-border transfer record"];
  const artefacts = overview.obligations.filter((row) => platformAttrs.includes(row.title));

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-5">
        <StatCard
          label="Days to next filing"
          value={nextFiling?.days === null || nextFiling === null ? "None set" : nextFiling.days! < 0 ? `${Math.abs(nextFiling.days!)}d over` : `${nextFiling.days}d`}
          detail={nextFiling ? nextFiling.title : "No obligation has a due date yet — set one in the register below"}
          tone={nextFiling && (nextFiling.days ?? 1) < 0 ? "danger" : "dark"}
          icon={AlertTriangle}
        />
        <StatCard
          label="Open data subject requests"
          value={openRequests}
          detail={shortestClockDays === undefined ? "None open" : shortestClockDays < 0 ? `Oldest is ${Math.abs(shortestClockDays)}d over the NDPA 30-day window` : `Shortest clock (NDPA 30-day window): ${shortestClockDays}d left`}
          icon={FileWarning}
          tone={openRequests ? "warning" : "success"}
        />
        <StatCard label="Open grievances" value={overview.grievances.open} detail={`${overview.grievances.total} logged in all — raise one from Requests with the type “Grievance”`} icon={AlertTriangle} tone={overview.grievances.open ? "warning" : "neutral"} />
        <StatCard label={`DPA coverage — v${dpa.current ?? "—"}`} value={`${dpa.onCurrent}/${dpa.totalSchools}`} detail="Schools that have accepted the version now in force" icon={FileWarning} tone={dpa.totalSchools && dpa.onCurrent === dpa.totalSchools ? "success" : "warning"} />
        <StatCard label="Unresolved breach obligations" value={unresolvedBreaches} detail="Open Critical or High incidents with no regulator notice recorded yet" icon={AlertTriangle} tone={unresolvedBreaches ? "danger" : "success"} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <TableCard
          title="Data processing agreement coverage"
          description="What each school accepted, set against the version in force. Publishing a new version tells every school that is behind."
          items={dpa.coverage}
          getRowKey={(row) => row.version}
          actions={
            <ResourceActionDialog
              triggerLabel="Publish a version"
              title="Publish a new agreement version"
              description="The new version becomes the one every school is asked to accept. Schools on an earlier version show as outdated until they accept."
              endpoint="/api/super-admin/compliance/dpa-versions"
              method="POST"
              submitLabel="Publish"
              confirmLabel="Publish"
              confirmMessage="Every school that has not accepted this version is told in the app."
              fields={[
                { name: "version", label: "Version", required: true, placeholder: dpa.current ? `Now ${dpa.current} — e.g. ${(Number(dpa.current) + 0.1).toFixed(1)}` : "e.g. 4.0" },
                { name: "effectiveFrom", label: "Effective from", type: "date", note: "Blank means today." },
                { name: "summary", label: "What changed", type: "textarea" },
                { name: "notifySchools", label: "Tell schools that are behind", type: "select", defaultValue: "true", options: [{ label: "Yes — notify their owners in the app", value: "true" }, { label: "No — publish quietly", value: "false" }] }
              ]}
            />
          }
          columns={[
            { key: "version", header: "Version", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.version}</span> },
            { key: "schools", header: "Schools", render: (row) => <div><p>{row.schools.length}</p><p className="max-w-[18rem] truncate text-[10px] text-[var(--color-text-muted)]" title={row.schools.join(", ")}>{row.schools.slice(0, 3).join(", ")}{row.schools.length > 3 ? ` +${row.schools.length - 3}` : ""}</p></div> },
            { key: "state", header: "State", render: (row) => <StatusPill bg={row.label === "Current" ? "var(--color-success-dim)" : "var(--color-warning-dim)"} fg={row.label === "Current" ? "var(--color-success)" : "var(--color-warning)"} label={row.label} /> }
          ]}
          emptyState="No school is on the platform yet."
          footnote={`Versions published: ${dpa.versions.map((v) => `${v.version}${v.isCurrent ? " (current)" : ""}`).join(", ") || "none"}.`}
        />
        <TableCard
          title="Consent coverage by school"
          description="Share of each school's guardians who have the core record-processing consent given — the consent every other one depends on."
          items={overview.consent}
          getRowKey={(row) => row.school}
          columns={[
            { key: "school", header: "School", render: (row) => row.school },
            { key: "coverage", header: "Coverage", render: (row) => <div><p className="font-semibold text-[var(--color-text-primary)]">{row.pct}%</p><p className="text-[10px] text-[var(--color-text-muted)]">{row.consented} of {row.guardians} guardians</p></div> },
            { key: "state", header: "State", render: (row) => <StatusPill bg={row.state === "COMPLIANT" ? "var(--color-success-dim)" : row.state === "PARTIAL" ? "var(--color-warning-dim)" : "var(--color-danger-dim)"} fg={row.state === "COMPLIANT" ? "var(--color-success)" : row.state === "PARTIAL" ? "var(--color-warning)" : "var(--color-danger)"} label={row.state === "COMPLIANT" ? "Covered" : row.state === "PARTIAL" ? "Partial" : "Gap"} /> }
          ]}
          emptyState="No school has guardians on record yet."
          footnote="Read from the consents each school records against its families (Guardians → Consent). Nothing here is estimated."
        />
      </div>

      <TableCard
        title="Regulatory obligations register"
        description="Each obligation the platform owes a regulator, with who owns it, when it is next due and what proves it was met. Marking one compliant needs a reference."
        items={overview.obligations}
        getRowKey={(row) => row.id}
        columns={[
          { key: "obligation", header: "Obligation", render: (row) => <div><p className="font-semibold text-[var(--color-text-primary)]">{row.title}</p>{row.evidence ? <p className="text-[10px] text-[var(--color-text-muted)]">{row.evidence}</p> : null}</div> },
          { key: "cadence", header: "Cadence", render: (row) => row.cadence },
          { key: "owner", header: "Owner", render: (row) => row.ownerRole },
          { key: "due", header: "Due", render: (row) => (row.dueAt ? <span className={row.state === "OVERDUE" ? "font-semibold text-[var(--color-danger)]" : ""}>{formatDate(row.dueAt)}</span> : <span className="text-[var(--color-text-muted)]">Not set</span>) },
          { key: "proof", header: "Proof", render: (row) => (row.reference ? <span className="font-[var(--font-mono)] text-[10.5px]">{row.reference}</span> : <span className="text-[var(--color-text-muted)]">None</span>) },
          { key: "state", header: "State", render: (row) => <ObligationState state={row.state} /> },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <ResourceActionDialog
                triggerLabel="Update"
                title={row.title}
                description="Record where this obligation stands. Compliant needs a reference — a filing receipt, document name or link."
                endpoint={`/api/super-admin/compliance/obligations/${row.id}`}
                method="PATCH"
                variant="textAction"
                submitLabel="Save"
                fields={[
                  { name: "status", label: "Status", type: "select", defaultValue: row.status, options: [{ label: "Not started", value: "NOT_STARTED" }, { label: "In progress", value: "IN_PROGRESS" }, { label: "Compliant", value: "COMPLIANT" }] },
                  { name: "dueAt", label: "Next due", type: "date", defaultValue: row.dueAt?.slice(0, 10) },
                  { name: "lastDoneAt", label: "Last done", type: "date", defaultValue: row.lastDoneAt?.slice(0, 10) },
                  { name: "reference", label: "Reference / proof", defaultValue: row.reference ?? "", placeholder: "Filing receipt, document name or link" },
                  { name: "notes", label: "Notes", type: "textarea", defaultValue: row.notes ?? "" }
                ]}
              />
            )
          }
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <TableCard
          title="Registration tiers"
          description={`NDPA reference thresholds, set against what this platform holds: ${subjects.students.toLocaleString()} students, ${subjects.guardians.toLocaleString()} guardians and ${subjects.accounts.toLocaleString()} staff accounts — ${total.toLocaleString()} people. That puts the platform in: ${tier}.`}
          items={[
            { tier: "Ordinary High Level", threshold: "200 – 999", who: "An individual client school" },
            { tier: "Extra-High Level", threshold: "1,000 +", who: "A larger school group" },
            { tier: "Ultra-High Level", threshold: "5,000 +", who: "A platform aggregating subjects across every school" }
          ]}
          getRowKey={(row) => row.tier}
          columns={[
            { key: "tier", header: "Tier", render: (row) => <span className={row.tier === tier ? "font-bold text-[var(--color-text-accent)]" : "font-semibold text-[var(--color-text-primary)]"}>{row.tier}{row.tier === tier ? " ← you are here" : ""}</span> },
            { key: "threshold", header: "Threshold", render: (row) => row.threshold },
            { key: "who", header: "Who sits here", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.who}</span> }
          ]}
          footnote="Counts exclude the sample students every new school starts with. Which tier you must register in is a legal call — this shows the numbers behind it."
        />
        <TableCard
          title="Live compliance artefacts"
          description="Read from the register above — the state is whatever the owner last recorded, with the proof beside it."
          items={artefacts}
          getRowKey={(row) => row.id}
          columns={[
            { key: "label", header: "Artefact", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.title}</span> },
            { key: "proof", header: "Proof", render: (row) => (row.evidence ?? row.reference ?? <span className="text-[var(--color-text-muted)]">None recorded</span>) },
            { key: "state", header: "State", render: (row) => <ObligationState state={row.state} /> }
          ]}
        />
      </div>

      <FlowSteps
        title="Breach handling"
        sub="Each step is something this page does, and each is stamped on the incident with who did it and when. Filing with the regulator happens outside the platform — the platform keeps the clock and the proof."
        steps={[
          { label: "Potential breach detected", note: "Monitoring, staff, school or provider" },
          { label: "Incident opened at Critical", note: "Log it from the Incidents tab", tone: "bad" },
          { label: "Assess", note: "Record what was affected and which schools", tone: "good" },
          { label: "Contain", note: "End sign-ins for the affected schools or everyone", tone: "good" },
          { label: "Notify the regulator", note: "Record the filing and its reference; 72-hour clock shown", tone: "warn" },
          { label: "Notify each affected school", note: "Real email and in-app notice to their leadership", tone: "good" },
          { label: "Post-incident review", note: "The incident's post-incident note", tone: "ink" }
        ]}
      />

      <TableCard
        title="NDPC compliance — data deletion requests"
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
          { key: "hash", header: "Confirmation hash", render: (item) => <span className="font-[var(--font-mono)] text-[10px]">{item.confirmationHash ?? "—"}</span> }
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
              return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
            }
          }
        ]}
      />

      <TableCard
        title="Retention schedule"
        description="How long each class of data is kept, why, and what starts the clock. Classes marked automatic are deleted by the platform once past their time; the rest are policy a person acts on."
        items={overview.retention}
        getRowKey={(row) => row.id}
        actions={
          <ResourceActionDialog
            triggerLabel="Run retention now"
            title="Run retention now"
            description="Deletes every record in an automatic class that is past its keep-period. It runs by itself every six hours; this runs it immediately and writes the result to the audit log."
            endpoint="/api/super-admin/compliance/retention/run"
            method="POST"
            variant="secondary"
            submitLabel="Run now"
            confirmLabel="Run"
            confirmMessage="Expired sign-in records, API logs and page-load samples are deleted permanently."
            fields={[]}
          />
        }
        columns={[
          { key: "class", header: "Data class", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.dataClass}</span> },
          { key: "retention", header: "Retention", render: (row) => retentionLabel(row.retentionDays) },
          { key: "basis", header: "Basis", render: (row) => <span className="text-[11px] text-[var(--color-text-secondary)]">{row.basis}</span> },
          { key: "trigger", header: "Clock starts", render: (row) => <span className="text-[11px]">{row.trigger}</span> },
          { key: "how", header: "Enforcement", render: (row) => <StatusPill bg={row.enforced ? "var(--color-success-dim)" : "var(--color-bg-subtle)"} fg={row.enforced ? "var(--color-success)" : "var(--color-text-muted)"} label={row.enforcement} /> },
          { key: "due", header: "Due", render: (row) => (!row.enforced ? <span className="text-[var(--color-text-muted)]">Reviewed by a person</span> : row.waiting ? <span className="font-semibold text-[var(--color-warning)]">{row.waiting.toLocaleString()} past due</span> : row.nextDue ? `Oldest record expires ${formatDate(row.nextDue)}` : <span className="text-[var(--color-text-muted)]">Nothing waiting</span>) },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <ResourceActionDialog
                triggerLabel="Edit"
                title={`Retention — ${row.dataClass}`}
                description={row.enforced ? "Changing this changes what the next automatic run deletes. Data deleted on a schedule must be kept at least 30 days." : "Policy only: nothing is deleted automatically for this class."}
                endpoint={`/api/super-admin/compliance/retention/${row.id}`}
                method="PATCH"
                variant="textAction"
                submitLabel="Save"
                fields={[
                  { name: "retentionDays", label: "Keep for (days, 0 = while the account is open)", type: "number", required: true, defaultValue: row.retentionDays, min: 0 },
                  { name: "basis", label: "Basis", defaultValue: row.basis },
                  { name: "trigger", label: "Clock starts", defaultValue: row.trigger }
                ]}
              />
            )
          }
        ]}
      />
      <TableCard
        title="Deletion schedule — executed and evidenced"
        description="Every deletion clock that is running — a school's closure request, and each erasure request. A clock that has run out stays marked Due until someone executes it and the evidence is recorded."
        items={overview.deletionSchedule}
        getRowKey={(row) => row.id}
        columns={[
          { key: "subject", header: "Subject", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.subject}</span> },
          { key: "class", header: "Class", render: (row) => row.dataClass },
          { key: "started", header: "Clock started", render: (row) => formatDate(row.started) },
          { key: "due", header: "Deletion due", render: (row) => formatDate(row.due) },
          { key: "state", header: "State", render: (row) => <StatusPill bg={row.state === "EXECUTED" ? "var(--color-success-dim)" : row.state === "DUE" ? "var(--color-danger-dim)" : "var(--color-bg-subtle)"} fg={row.state === "EXECUTED" ? "var(--color-success)" : row.state === "DUE" ? "var(--color-danger)" : "var(--color-text-muted)"} label={row.state === "EXECUTED" ? "Executed" : row.state === "DUE" ? "Due now" : row.state === "REJECTED" ? "Rejected" : "Scheduled"} /> },
          { key: "evidence", header: "Evidence", render: (row) => (row.evidence ? <span className="font-[var(--font-mono)] text-[10px]">{row.evidence}</span> : "—") }
        ]}
        emptyState="Nothing is scheduled — no school has asked to close and no erasure request is open."
      />
    </div>
  );
}

function RequestsTab({ privacy, schools }: { privacy: PrivacyRequest[]; schools: SuperAdminSchoolRow[] }) {
  const schoolOptions = [
    { label: "Platform-wide (no specific school)", value: "" },
    ...schools.map((school) => ({ label: school.name, value: school.id }))
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
          { type: "Grievance", route: "Directly to us", role: "A complaint about how Future Realm or a school handled someone's data. Log it here with the type “Grievance” — it gets the same 30-day clock and shows in the compliance counts." },
          { type: "Portability", route: "Through the school", role: "Would be satisfied by the school's own full export — a Super Admin-only export exists (Security & Compliance); a school cannot self-serve one." }
        ]}
        getRowKey={(row) => row.type}
        columns={[
          { key: "type", header: "Request type", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.type}</span> },
          { key: "route", header: "Route", render: (row) => row.route },
          { key: "role", header: "Our role", render: (row) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{row.role}</span> }
        ]}
      />

      <TableCard
        title="Open requests and grievances"
        description="Every request is logged with the real NDPA 30-day response window — shown as days left, not just a status."
        items={privacy}
        actions={
          <ResourceActionDialog
            triggerLabel="New request"
            title="Create data privacy request"
            description="Track access, export, erasure, rectification requests and grievances."
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
          { key: "hash", header: "Confirmation hash", render: (item) => item.confirmationHash ? <span className="font-[var(--font-mono)] text-[10px]">{item.confirmationHash.slice(0, 16)}…</span> : "-" },
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
