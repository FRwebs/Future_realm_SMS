import { MetricCard } from "@/components/dashboard/metric-card";
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
  school?: { name: string } | null;
  createdAt: string;
};

type BackupRecord = {
  id: string;
  scope: string;
  status: string;
  sizeGb?: number | null;
  startedAt: string;
  school?: { name: string } | null;
};

type SystemLog = {
  id: string;
  level: string;
  source: string;
  message: string;
  createdAt: string;
};

type SecurityView = {
  sessions: PlatformSession[];
  attempts: LoginAttempt[];
  privacy: PrivacyRequest[];
  backups: BackupRecord[];
  systemLogs: SystemLog[];
};

export default async function SuperAdminSecurityPage() {
  const data = await apiGet<SecurityView>("/api/super-admin/security");
  const failedAttempts = (data.attempts ?? []).filter((attempt) => attempt.status === "FAILED").length;
  const openPrivacy = (data.privacy ?? []).filter((request) => request.status !== "COMPLETED").length;

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Security & compliance</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-[var(--font-heading)] text-4xl font-bold text-ink">Security</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
              Monitor sessions, login attempts, privacy requests, backups, and operational system logs.
            </p>
          </div>
          <ResourceActionDialog
            triggerLabel="New Privacy Request"
            title="Create privacy request"
            description="Track access, export, erasure, and rectification requests with audit visibility."
            endpoint="/api/super-admin/security/privacy-requests"
            fields={[
              { name: "schoolId", label: "School ID" },
              { name: "userId", label: "User ID" },
              { name: "type", label: "Request Type", type: "select", required: true, options: ["ACCESS", "EXPORT", "ERASURE", "RECTIFICATION"].map((value) => ({ label: value, value })) },
              { name: "subject", label: "Subject", required: true },
              { name: "details", label: "Details", type: "textarea" }
            ]}
            submitLabel="Create Request"
            confirmLabel="Confirm Request"
            confirmMessage="Privacy requests are compliance-sensitive and will be audit logged."
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard metric={{ label: "Active Sessions", value: String(data.sessions?.length ?? 0), change: "Currently tracked" }} />
        <MetricCard metric={{ label: "Failed Logins", value: String(failedAttempts), change: "Recent attempts" }} />
        <MetricCard metric={{ label: "Open Privacy", value: String(openPrivacy), change: "Requests pending" }} />
        <MetricCard metric={{ label: "Backups", value: String(data.backups?.length ?? 0), change: "Recent records" }} />
      </section>

      <TableCard
        title="Active Sessions"
        description="Recent active sessions across the platform."
        items={data.sessions ?? []}
        emptyState="No active sessions are currently tracked."
        columns={[
          { key: "user", header: "User", render: (item) => item.user ? `${item.user.firstName} ${item.user.lastName}` : "Unknown" },
          { key: "role", header: "Role", render: (item) => item.user?.role ?? "-" },
          { key: "school", header: "School", render: (item) => item.school?.name ?? "Platform" },
          { key: "device", header: "Device", render: (item) => item.device ?? "Unknown" },
          { key: "last", header: "Last Activity", render: (item) => formatDate(item.lastActivityAt) }
        ]}
      />

      <TableCard
        title="Login Activity"
        description="Recent successful and failed login attempts."
        items={data.attempts ?? []}
        emptyState="No login attempts have been recorded."
        columns={[
          { key: "email", header: "Email", render: (item) => item.email },
          { key: "status", header: "Status", render: (item) => item.status },
          { key: "school", header: "School", render: (item) => item.school?.name ?? "Unknown" },
          { key: "reason", header: "Reason", render: (item) => item.failureReason ?? "-" },
          { key: "created", header: "Date", render: (item) => formatDate(item.createdAt) }
        ]}
      />

      <TableCard
        title="Privacy Requests"
        description="GDPR/data privacy access, export, rectification, and erasure queue."
        items={data.privacy ?? []}
        emptyState="No privacy requests are open."
        columns={[
          { key: "subject", header: "Subject", render: (item) => <span className="font-semibold text-ink">{item.subject}</span> },
          { key: "type", header: "Type", render: (item) => item.type },
          { key: "status", header: "Status", render: (item) => item.status },
          { key: "school", header: "School", render: (item) => item.school?.name ?? "Platform" },
          { key: "created", header: "Created", render: (item) => formatDate(item.createdAt) }
        ]}
      />

      <TableCard
        title="System Logs"
        description="Operational platform logs for technical administrators."
        items={data.systemLogs ?? []}
        emptyState="No system logs have been recorded."
        columns={[
          { key: "level", header: "Level", render: (item) => item.level },
          { key: "source", header: "Source", render: (item) => item.source },
          { key: "message", header: "Message", render: (item) => item.message },
          { key: "created", header: "Created", render: (item) => formatDate(item.createdAt) }
        ]}
      />
    </div>
  );
}
