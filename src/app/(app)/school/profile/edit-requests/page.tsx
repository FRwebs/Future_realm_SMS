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

export default async function ProfileEditRequestsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/school/profile/edit-requests"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const requests = await apiGet<ProfileEditRequestRow[]>("/api/v1/profiles/edit-requests");

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">Profile governance</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Profile Edit Requests</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Review name, contact, identity, and HR data corrections before they become official school records.
        </p>
      </section>

      <TableCard
        title="Pending and reviewed requests"
        description="Approvals are audited and approved requests apply the requested field changes immediately."
        items={requests}
        emptyState="No profile edit requests have been submitted."
        columns={[
          { key: "target", header: "Profile", render: (item) => <div><p className="font-semibold text-[var(--color-text-primary)]">{item.targetName}</p><p className="text-xs text-[var(--color-text-muted)]">Requested by {item.requestedBy}</p></div> },
          { key: "fields", header: "Requested changes", render: (item) => <pre className="max-w-sm whitespace-pre-wrap rounded-[10px] bg-[var(--color-bg-subtle)] p-3 text-xs text-[var(--color-text-secondary)]">{JSON.stringify(item.fields, null, 2)}</pre> },
          { key: "status", header: "Status", render: (item) => <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "var(--color-accent-primary-dim)", color: "var(--color-text-accent)" }}>{item.status}</span> },
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
