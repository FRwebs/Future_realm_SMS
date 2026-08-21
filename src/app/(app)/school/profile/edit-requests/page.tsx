import { CheckCircle2, Clock3, FilePenLine, XCircle } from "lucide-react";

import { StatCard } from "@/components/data-display/stat-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ActionMenu } from "@/components/ui/action-menu";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { formatDate } from "@/lib/utils/formatters";

type ProfileEditRequestRow = {
  id: string;
  targetName: string;
  requestedBy: string;
  reviewedBy?: string | null;
  fields: unknown;
  reason?: string | null;
  status: string;
  reviewComment?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
};

function requestedChanges(fields: unknown) {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return [];
  return Object.entries(fields as Record<string, unknown>).map(([key, value]) => ({
    key,
    label: key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    value: typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : JSON.stringify(value)
  }));
}

function ChangesPreview({ fields }: { fields: unknown }) {
  const changes = requestedChanges(fields);
  if (changes.length === 0) {
    return <span className="text-[12px] text-[var(--color-text-muted)]">No field payload recorded</span>;
  }
  return (
    <div className="grid max-w-md gap-1.5">
      {changes.slice(0, 3).map((change) => (
        <div key={change.key} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{change.label}</p>
          <p className="mt-1 line-clamp-2 text-[12.5px] font-semibold text-[var(--color-text-primary)]">{change.value}</p>
        </div>
      ))}
      {changes.length > 3 ? <p className="text-[11.5px] font-semibold text-[var(--color-text-accent)]">+{changes.length - 3} more change{changes.length - 3 === 1 ? "" : "s"}</p> : null}
    </div>
  );
}

export default async function ProfileEditRequestsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/school/profile/edit-requests"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const requests = await apiGet<ProfileEditRequestRow[]>("/api/v1/profiles/edit-requests");
  const pendingCount = requests.filter((item) => item.status === "PENDING").length;
  const approvedCount = requests.filter((item) => item.status === "APPROVED").length;
  const rejectedCount = requests.filter((item) => item.status === "REJECTED").length;

  return (
    <div className="portal-page">
      <section className="relative overflow-hidden rounded-[var(--radius-hero)] border border-[var(--color-border-strong)] bg-[#0d2315] p-6 text-white md:p-7">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 800 200" preserveAspectRatio="xMidYMid slice">
          <path d="M-50 180 Q 200 120 400 170 T 850 140" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" fill="none" />
          <path d="M-50 20 Q 240 -20 460 20 T 850 0" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
          <circle cx="700" cy="20" r="140" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
          <circle cx="700" cy="20" r="90" stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
        </svg>
        <div className="relative z-[1]">
        <p className="section-eyebrow">Profile governance</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-white">Review Queue</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[rgba(255,255,255,0.74)]">
          Review name, contact, identity, and HR data corrections before they become official school records.
        </p>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending review" value={pendingCount} detail="Requests waiting for an approval decision." icon={Clock3} tone="warning" />
        <StatCard label="Approved" value={approvedCount} detail="Changes applied to official records." icon={CheckCircle2} tone="success" />
        <StatCard label="Rejected" value={rejectedCount} detail="Requests closed without changing records." icon={XCircle} tone="danger" />
        <StatCard label="Total requests" value={requests.length} detail="All profile correction requests in this queue." icon={FilePenLine} tone="accent" />
      </section>

      <TableCard
        title="Requests"
        items={requests}
        emptyState="No profile edit requests have been submitted."
        columns={[
          { key: "target", header: "Profile", render: (item) => <div><p className="font-semibold text-[var(--color-text-primary)]">{item.targetName}</p><p className="text-xs text-[var(--color-text-muted)]">Requested by {item.requestedBy}</p></div> },
          { key: "fields", header: "Requested changes", render: (item) => <ChangesPreview fields={item.fields} /> },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} tone={item.status === "APPROVED" ? "success" : item.status === "REJECTED" ? "danger" : "warning"} /> },
          { key: "submitted", header: "Submitted", render: (item) => formatDate(item.createdAt) },
          {
            key: "actions",
            header: "Action",
            render: (item) =>
              item.status === "PENDING" ? (
                <ActionMenu triggerLabel={`Review actions for ${item.targetName}`}>
                  <ResourceActionDialog
                    triggerLabel="Approve"
                    title="Approve profile edit"
                    description="Approve this request and apply the requested profile changes."
                    endpoint={`/api/v1/profiles/edit-requests/${item.id}/review`}
                    method="PATCH"
                    submitLabel="Approve request"
                    variant="menu"
                    confirmLabel="Confirm approval"
                    confirmMessage="This will update the official profile record."
                    fields={[
                      { name: "status", label: "Decision", type: "select", defaultValue: "APPROVED", options: [{ label: "Approve", value: "APPROVED" }] },
                      { name: "reviewComment", label: "Review comment", type: "textarea" },
                    ]}
                  />
                  <ResourceActionDialog
                    triggerLabel="Reject"
                    title="Reject profile edit"
                    description="Reject this request and keep the current profile record unchanged."
                    endpoint={`/api/v1/profiles/edit-requests/${item.id}/review`}
                    method="PATCH"
                    submitLabel="Reject request"
                    variant="menuDanger"
                    confirmLabel="Confirm rejection"
                    confirmMessage="This will reject the request without changing the profile."
                    fields={[
                      { name: "status", label: "Decision", type: "select", defaultValue: "REJECTED", options: [{ label: "Reject", value: "REJECTED" }] },
                      { name: "reviewComment", label: "Review comment", type: "textarea", required: true },
                    ]}
                  />
                </ActionMenu>
              ) : (
                item.reviewedBy ?? "Reviewed"
              ),
          },
        ]}
      />
    </div>
  );
}
