import { MetricCard } from "@/components/dashboard/metric-card";
import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
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

function tabHref(tab: string) {
  return tab === "overview" ? "/super-admin/security" : `/super-admin/security?tab=${tab}`;
}

export default async function SuperAdminSecurityPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab = "overview" } = searchParams ? await searchParams : {};
  const data = await apiGet<SecurityView>("/api/super-admin/security");
  const failedAttempts = (data.attempts ?? []).filter((attempt) => attempt.status === "FAILED").length;
  const openPrivacy = (data.privacy ?? []).filter((request) => request.status !== "COMPLETED").length;
  const openIncidents = (data.incidents ?? []).filter((incident) => incident.status !== "RESOLVED").length;

  const tabs = [
    { label: "Overview", href: tabHref("overview"), active: tab === "overview" },
    { label: "Security Incidents", href: tabHref("incidents"), active: tab === "incidents" },
    { label: "Data Deletion (NDPC)", href: tabHref("ndpc"), active: tab === "ndpc" },
    { label: "Compliance Report", href: tabHref("compliance"), active: tab === "compliance" }
  ];

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Security & compliance</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-[var(--font-heading)] text-4xl font-bold text-ink">Security</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
              Sessions, login activity, security incidents, and NDPC-compliant data deletion tracking.
            </p>
          </div>
        </div>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "overview" ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <MetricCard metric={{ label: "Active Sessions", value: String(data.sessions?.length ?? 0), change: "Currently tracked" }} />
            <MetricCard metric={{ label: "Failed Logins", value: String(failedAttempts), change: "Recent attempts" }} />
            <MetricCard metric={{ label: "Open Incidents", value: String(openIncidents), change: "Unresolved" }} />
            <MetricCard metric={{ label: "Open Privacy", value: String(openPrivacy), change: "Requests pending" }} />
          </section>

          <TableCard
            title="Active Sessions"
            description="Live sessions across the platform (revoked and expired sessions are excluded)."
            items={data.sessions ?? []}
            emptyState="No active sessions are currently tracked."
            columns={[
              { key: "user", header: "User", render: (item) => item.user ? `${item.user.firstName} ${item.user.lastName}` : "Unknown" },
              { key: "role", header: "Role", render: (item) => item.user?.role ?? "-" },
              { key: "device", header: "Device", render: (item) => item.device ?? "Unknown" },
              { key: "ip", header: "IP", render: (item) => item.ipAddress ?? "-" },
              { key: "last", header: "Last Activity", render: (item) => formatDate(item.lastActivityAt) }
            ]}
          />

          <TableCard
            title="Login Activity"
            description="Recent successful and failed login attempts, with brute-force lockout after 5 failures in 10 minutes."
            items={data.attempts ?? []}
            emptyState="No login attempts have been recorded."
            columns={[
              { key: "email", header: "Email", render: (item) => item.email },
              { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
              { key: "ip", header: "IP", render: (item) => item.ipAddress ?? "-" },
              { key: "reason", header: "Reason", render: (item) => item.failureReason ?? "-" },
              { key: "created", header: "Date", render: (item) => formatDate(item.createdAt) }
            ]}
          />
        </>
      ) : null}

      {tab === "incidents" ? <IncidentsTab incidents={data.incidents ?? []} /> : null}
      {tab === "ndpc" ? <NdpcTab privacy={data.privacy ?? []} /> : null}
      {tab === "compliance" ? <ComplianceTab /> : null}
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
        { key: "severity", header: "Severity", render: (item) => <StatusBadge status={item.severity} tone={item.severity === "CRITICAL" || item.severity === "HIGH" ? "danger" : item.severity === "MEDIUM" ? "warning" : "neutral"} /> },
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
              <span className="text-xs text-ink/50">Resolved {item.resolvedAt ? formatDate(item.resolvedAt) : ""}</span>
            )
        }
      ]}
      emptyState="No security incidents logged."
    />
  );
}

function NdpcTab({ privacy }: { privacy: PrivacyRequest[] }) {
  return (
    <TableCard
      title="Data deletion requests (NDPC)"
      description="Data deletion requests from schools leaving the platform. Completion requires export delivery, purge, and a logged confirmation hash."
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
            { name: "schoolId", label: "School ID" },
            { name: "type", label: "Type", type: "select", options: ["ACCESS", "EXPORT", "ERASURE", "RECTIFICATION"].map((v) => ({ label: v, value: v })) },
            { name: "subject", label: "Subject", required: true },
            { name: "details", label: "Details", type: "textarea" }
          ]}
        />
      }
      columns={[
        { key: "subject", header: "Subject", render: (item) => <span className="font-semibold text-ink">{item.subject}</span> },
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
              <span className="text-xs text-emerald-700">Completed {item.completedAt ? formatDate(item.completedAt) : ""}</span>
            ) : (
              <span className="text-xs text-ink/50">-</span>
            )
        }
      ]}
      emptyState="No data privacy requests recorded."
    />
  );
}

async function ComplianceTab() {
  const report = await apiGet<ComplianceReport>("/api/super-admin/security/compliance-report");

  return (
    <section className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard metric={{ label: "Deletion requests", value: String(report.totalDeletionRequests), change: "All time" }} />
        <MetricCard metric={{ label: "Completed", value: String(report.byStatus.COMPLETED ?? 0), change: "Purged & confirmed" }} />
        <MetricCard metric={{ label: "In review", value: String(report.byStatus.IN_REVIEW ?? 0), change: "Being processed" }} />
        <MetricCard metric={{ label: "Open", value: String(report.byStatus.OPEN ?? 0), change: "Not started" }} />
      </section>

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
    </section>
  );
}
