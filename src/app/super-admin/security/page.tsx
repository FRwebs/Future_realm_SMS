import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type { SuperAdminSchoolRow } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

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
};

const incidentStatusOptions = [
  { label: "Detected", value: "DETECTED" },
  { label: "Investigating", value: "INVESTIGATING" },
  { label: "Contained", value: "CONTAINED" },
  { label: "Resolved", value: "RESOLVED" }
];

function StatusPill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <article className="surface-card p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{value}</p>
    </article>
  );
}

function tabHref(tab: string) {
  return tab === "overview" ? "/super-admin/security" : `/super-admin/security?tab=${tab}`;
}

export default async function SuperAdminSecurityPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab = "overview" } = searchParams ? await searchParams : {};
  const data = await apiGet<SecurityView>("/api/super-admin/security");
  const failedAttempts = (data.attempts ?? []).filter((attempt) => attempt.status === "FAILED").length;
  const openPrivacy = (data.privacy ?? []).filter((request) => request.status !== "COMPLETED").length;
  const openIncidents = (data.incidents ?? []).filter((incident) => incident.status !== "RESOLVED").length;
  const criticalIncidents = (data.incidents ?? []).filter((incident) => incident.severity === "CRITICAL" && incident.status !== "RESOLVED").length;

  const tabs = [
    { label: "Overview", href: tabHref("overview"), active: tab === "overview" },
    { label: "Admin Login Security", href: tabHref("login"), active: tab === "login" },
    { label: "Security Incidents", href: tabHref("incidents"), active: tab === "incidents" },
    { label: "NDPC Compliance", href: tabHref("ndpc"), active: tab === "ndpc" }
  ];

  return (
    <div className="grid gap-5">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">Security & compliance</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">Security, Audit & Compliance</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          The accountability layer — active sessions, login activity, security incidents tracked from detection to
          resolution, and NDPC-compliant data deletion evidence. For the full immutable platform action log, see{" "}
          <a href="/super-admin/audit-logs" className="font-semibold text-[var(--color-text-accent)] underline">
            Audit Logs
          </a>
          .
        </p>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "overview" ? (
        <section className="grid gap-3 md:grid-cols-4">
          <KpiTile label="Active sessions" value={String(data.sessions?.length ?? 0)} />
          <KpiTile label="Failed logins (recent)" value={String(failedAttempts)} />
          <KpiTile label="Open incidents" value={String(openIncidents)} />
          <KpiTile label="Critical incidents" value={String(criticalIncidents)} />
        </section>
      ) : null}

      {tab === "login" ? <LoginSecurityTab sessions={data.sessions ?? []} attempts={data.attempts ?? []} /> : null}
      {tab === "incidents" ? <IncidentsTab incidents={data.incidents ?? []} /> : null}
      {tab === "ndpc" ? <NdpcTab privacy={data.privacy ?? []} /> : null}
    </div>
  );
}

function LoginSecurityTab({ sessions, attempts }: { sessions: PlatformSession[]; attempts: LoginAttempt[] }) {
  return (
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Lockout policy</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Brute-force protection</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Accounts are automatically locked after 5 failed login attempts within a 10-minute window. Force-logout a
          session below to immediately end a suspicious admin session.
        </p>
      </section>

      <TableCard
        title="Active sessions"
        description="Live sessions across the platform (revoked and expired sessions are excluded)."
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
        description="Recent successful and failed login attempts, most recent first."
        items={attempts}
        emptyState="No login attempts have been recorded."
        columns={[
          { key: "email", header: "Email", render: (item) => item.email },
          {
            key: "status",
            header: "Status",
            render: (item) =>
              item.status === "SUCCESS" ? (
                <StatusPill bg="var(--color-success-dim)" fg="var(--color-success)" label="Success" />
              ) : (
                <StatusPill bg="var(--color-danger-dim)" fg="var(--color-danger)" label="Failed" />
              )
          },
          { key: "ip", header: "IP", render: (item) => item.ipAddress ?? "-" },
          { key: "reason", header: "Reason", render: (item) => item.failureReason ?? "-" },
          { key: "created", header: "Date", render: (item) => formatDate(item.createdAt) }
        ]}
      />
    </div>
  );
}

function IncidentsTab({ incidents }: { incidents: SecurityIncident[] }) {
  return (
    <TableCard
      title="Security incidents"
      description="Every incident is tracked from detection to resolution with a documented root cause and prevention measure."
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
        { key: "type", header: "Type", render: (item) => item.type.replaceAll("_", " ") },
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
        { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
        { key: "detected", header: "Detected", render: (item) => formatDate(item.detectedAt) },
        { key: "reported", header: "Reported by", render: (item) => item.reportedBy },
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
  );
}

async function NdpcTab({ privacy }: { privacy: PrivacyRequest[] }) {
  const [report, schoolsEnvelope] = await Promise.all([
    apiGet<ComplianceReport>("/api/super-admin/security/compliance-report"),
    apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100")
  ]);
  const schoolOptions = [
    { label: "Platform-wide (no specific school)", value: "" },
    ...(schoolsEnvelope.data ?? []).map((school) => ({ label: school.name, value: school.id }))
  ];

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-4">
        <KpiTile label="Deletion requests" value={String(report.totalDeletionRequests)} />
        <KpiTile label="Completed" value={String(report.byStatus.COMPLETED ?? 0)} />
        <KpiTile label="In review" value={String(report.byStatus.IN_REVIEW ?? 0)} />
        <KpiTile label="Open" value={String(report.byStatus.OPEN ?? 0)} />
      </section>

      <TableCard
        title="Data privacy requests"
        description="Access, export, erasure, and rectification requests. Erasure completion requires export delivery, purge, and a logged confirmation hash — this cannot be bypassed."
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
              { name: "type", label: "Type", type: "select", options: ["ACCESS", "EXPORT", "ERASURE", "RECTIFICATION"].map((v) => ({ label: v, value: v })) },
              { name: "subject", label: "Subject", required: true },
              { name: "details", label: "Details", type: "textarea" }
            ]}
          />
        }
        columns={[
          { key: "subject", header: "Subject", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.subject}</span> },
          { key: "type", header: "Type", render: (item) => item.type },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "school", header: "School", render: (item) => item.school?.name ?? "Platform" },
          { key: "hash", header: "Confirmation hash", render: (item) => item.confirmationHash ? <span className="font-[var(--font-mono)] text-[11px]">{item.confirmationHash.slice(0, 16)}…</span> : "-" },
          {
            key: "actions",
            header: "Actions",
            render: (item) =>
              item.type === "ERASURE" && item.status !== "COMPLETED" ? (
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
              ) : item.status === "COMPLETED" ? (
                <span className="text-xs" style={{ color: "var(--color-success)" }}>Completed {item.completedAt ? formatDate(item.completedAt) : ""}</span>
              ) : (
                <span className="text-xs text-[var(--color-text-muted)]">-</span>
              )
          }
        ]}
        emptyState="No data privacy requests recorded."
      />

      <TableCard
        title="Completed deletions — NDPC evidence"
        description="Every completed deletion records who deleted it, when, and a confirmation hash for audit."
        items={report.completed}
        columns={[
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "subject", header: "Subject", render: (item) => item.subject },
          { key: "by", header: "Completed by", render: (item) => item.completedBy },
          { key: "at", header: "Completed at", render: (item) => (item.completedAt ? formatDate(item.completedAt) : "-") },
          { key: "hash", header: "Confirmation hash", render: (item) => <span className="font-[var(--font-mono)] text-[11px]">{item.confirmationHash ?? "-"}</span> }
        ]}
        emptyState="No completed deletions yet."
      />
    </div>
  );
}
