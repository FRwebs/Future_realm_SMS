import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
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
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Profile governance</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Profile Edit Requests</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
          Review name, contact, identity, and HR data corrections before they become official school records.
        </p>
      </section>

      <TableCard
        title="Pending and reviewed requests"
        description="Approvals are audited and approved requests apply the requested field changes immediately."
        items={requests}
        emptyState="No profile edit requests have been submitted."
        columns={[
          { key: "target", header: "Profile", render: (item) => <div><p className="font-semibold text-ink">{item.targetName}</p><p className="text-xs text-ink/55">Requested by {item.requestedBy}</p></div> },
          { key: "fields", header: "Requested changes", render: (item) => <pre className="max-w-sm whitespace-pre-wrap rounded-2xl bg-sand/70 p-3 text-xs text-ink/70">{JSON.stringify(item.fields, null, 2)}</pre> },
          { key: "status", header: "Status", render: (item) => <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">{item.status}</span> },
          { key: "submitted", header: "Submitted", render: (item) => formatDate(item.createdAt) },
          {
            key: "actions",
            header: "Action",
            render: (item) =>
              item.status === "PENDING" ? (
                <div className="flex flex-wrap gap-2">
                  <ResourceActionDialog
                    triggerLabel="Approve"
                    title="Approve profile edit"
                    description="Approve this request and apply the requested profile changes."
                    endpoint={`/api/v1/profiles/edit-requests/${item.id}/review`}
                    method="PATCH"
                    submitLabel="Approve request"
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
                    variant="danger"
                    confirmLabel="Confirm rejection"
                    confirmMessage="This will reject the request without changing the profile."
                    fields={[
                      { name: "status", label: "Decision", type: "select", defaultValue: "REJECTED", options: [{ label: "Reject", value: "REJECTED" }] },
                      { name: "reviewComment", label: "Review comment", type: "textarea", required: true },
                    ]}
                  />
                </div>
              ) : (
                item.reviewedBy ?? "Reviewed"
              ),
          },
        ]}
      />
    </div>
  );
}
