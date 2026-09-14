"use client";

import { useState, type ReactNode } from "react";

import { DetailFacts, DetailSheet } from "@/components/data-display/detail-sheet";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { useToast } from "@/components/ui/toast-provider";
import type { SuperAdminInternalMember, SuperAdminPermissionGridMatrix } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

const accessLevels = ["NONE", "VIEW", "EDIT", "FULL"].map((v) => ({ label: v, value: v }));

function InertAction({ label, note }: { label: string; note: string }) {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast({ variant: "info", title: "Not built", description: note })} className="btn-secondary px-4 text-[12.5px]">
      {label}
    </button>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function MemberReview({ member, matrix }: { member: SuperAdminInternalMember; matrix: SuperAdminPermissionGridMatrix }) {
  const [open, setOpen] = useState(false);
  const gridRow = matrix.members.find((m) => m.id === member.id);
  const modules = matrix.modules ?? [];
  const grantedCount = modules.filter((moduleId) => (gridRow?.access[moduleId] ?? "NONE") !== "NONE").length;
  const suspended = member.status === "SUSPENDED";
  const revoked = member.status === "REVOKED";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary px-4 text-[12.5px]">
        Manage
      </button>

      <DetailSheet
        open={open}
        onClose={() => setOpen(false)}
        avatarLabel={initialsOf(member.name)}
        eyebrow="Internal account"
        title={member.name}
        subtitle={`${member.role.replaceAll("_", " ")} · joined ${formatDate(member.createdAt)}`}
        chips={[
          { label: member.status, tone: member.status === "ACTIVE" ? "good" : member.status === "REVOKED" ? "bad" : "warn" },
          { label: `${grantedCount} of ${modules.length} modules`, tone: "teal" }
        ]}
        footer={
          <div className="flex flex-wrap gap-2">
            <ResourceActionDialog
              triggerLabel="Set module permission"
              title={`Set permission — ${member.name}`}
              description="Set this member's access level for a specific admin-panel module (M1-M12)."
              endpoint="/api/super-admin/internal-team/permission-grid"
              method="POST"
              variant="secondary"
              submitLabel="Save permission"
              fields={[
                { name: "userId", label: "User ID", defaultValue: member.id },
                { name: "moduleId", label: "Module (e.g. M3, billing)", required: true },
                { name: "accessLevel", label: "Access level", type: "select", options: accessLevels }
              ]}
            />
            <ResourceActionDialog
              triggerLabel="Grant time-bound access"
              title={`Grant temporary access — ${member.name}`}
              description="Grant access to a module that auto-revokes on the expiry date."
              endpoint="/api/super-admin/internal-team/access-grants"
              method="POST"
              variant="secondary"
              submitLabel="Grant access"
              fields={[
                { name: "userId", label: "User ID", defaultValue: member.id },
                { name: "moduleId", label: "Module", required: true },
                { name: "functionId", label: "Function (optional)" },
                { name: "expiresAt", label: "Expires on", type: "date", required: true }
              ]}
            />
            {!revoked ? (
              <ResourceActionDialog
                triggerLabel="Offboard"
                title={`Offboard ${member.name}`}
                description="Deactivates the account and marks every session and access grant revoked in the database. This cannot be undone from here."
                endpoint={`/api/super-admin/internal-team/${member.id}`}
                method="DELETE"
                variant="danger"
                submitLabel="Offboard now"
                confirmLabel="Confirm offboard"
                confirmMessage="This marks all access revoked immediately in the database, though an existing session token can remain valid until it expires."
                fields={[]}
              />
            ) : null}
            <InertAction label="Send the message" note="Not built — there is no internal messaging feature; reach a colleague outside this platform." />
            {suspended ? (
              <InertAction label="Reinstate the account" note="Not built — there is no reinstate endpoint. Suspended is a status this system can show but no action sets or clears it." />
            ) : (
              <InertAction label="Suspend the account" note="Not built — there is no suspend endpoint distinct from Offboard for internal accounts." />
            )}
          </div>
        }
      >
        <div className="grid gap-4">
          <DetailFacts
            title="Who they are"
            rows={[
              { label: "Full name", value: member.name, bold: true },
              { label: "Staff identifier", value: "Not tracked" },
              { label: "Email", value: member.email, bold: true },
              { label: "Phone", value: member.phone ?? "Not on file", bold: Boolean(member.phone) },
              { label: "Role", value: member.role.replaceAll("_", " ") },
              { label: "Department", value: "Not tracked on the account — recorded only in the audit log entry created at hire time, if one was given" },
              { label: "Access level", value: "Not tracked — no per-person seniority level exists beyond role" },
              { label: "Data scope", value: "Not tracked — no per-person regional/portfolio scope field exists" },
              { label: "Joined Nooria", value: formatDate(member.createdAt) },
              { label: "Last sign-in", value: member.lastLoginAt ? formatDate(member.lastLoginAt) : "Never" }
            ]}
          />

          <DetailFacts
            title="Security and sessions"
            rows={[
              { label: "Two-factor", value: "Not built — no verification step exists" },
              { label: "Sessions", value: "See the Security Settings tab for this account's active sessions" },
              { label: "What they currently own", value: "Not tracked — nothing aggregates a person's assigned tickets, jobs or schools into one figure here" },
              { label: "Password", value: "Set by them — nobody at Nooria can read or reset it", bold: true }
            ]}
          />

          {suspended ? (
            <div className="rounded-[12px] border p-4" style={{ background: "var(--color-danger-dim)", borderColor: "#F3E0E0" }}>
              <p className="mb-1.5 text-[12.5px] font-bold text-[var(--color-danger)]">Account suspended</p>
              <p className="text-[12px] leading-relaxed text-[var(--color-danger)]">
                Shown here as a real status this system can hold — but nothing in this codebase sets or clears it for an internal account, so how it got here (and how to reverse it) isn&apos;t tracked.
              </p>
            </div>
          ) : null}

          <DetailFacts
            title={`Module access — ${grantedCount} of ${modules.length} granted`}
            rows={modules.map((moduleId) => ({
              label: moduleId,
              value: gridRow?.access[moduleId] ?? "NONE",
              bold: (gridRow?.access[moduleId] ?? "NONE") !== "NONE"
            }))}
          />
          <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)]">
            Whole-module levels only (None/View/Edit/Full) — this system has no per-action grant within a module, unlike the mockup&apos;s per-action toggle list.
            A module reading None is not enterable at all — it does not appear in their sidebar. Note this grid is recorded but not enforced (see &quot;How access is
            actually enforced&quot; on the Roles &amp; Scopes tab).
          </p>
        </div>
      </DetailSheet>
    </>
  );
}

export function PeopleTable({
  members,
  matrix,
  title,
  description,
  actions,
  filterBar,
  emptyState
}: {
  members: SuperAdminInternalMember[];
  matrix: SuperAdminPermissionGridMatrix;
  title: string;
  description: string;
  actions: ReactNode;
  filterBar?: ReactNode;
  emptyState: string;
}) {
  return (
    <TableCard
      title={title}
      description={description}
      items={members}
      actions={actions}
      filterBar={filterBar}
      getRowKey={(item) => item.id}
      columns={[
        {
          key: "name",
          header: "Team member",
          render: (item) => (
            <div>
              <p className="font-semibold text-[var(--color-text-primary)]">{item.name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{item.email}</p>
            </div>
          )
        },
        { key: "role", header: "Role", render: (item) => item.role.replaceAll("_", " ") },
        { key: "department", header: "Department", render: () => <span className="text-[var(--color-text-muted)]">Not tracked</span> },
        { key: "level", header: "Level", render: () => <span className="text-[var(--color-text-muted)]">Not tracked</span> },
        { key: "scope", header: "Data scope", render: () => <span className="text-[var(--color-text-muted)]">Not tracked</span> },
        { key: "lastLogin", header: "Last sign-in", render: (item) => (item.lastLoginAt ? formatDate(item.lastLoginAt) : "Never") },
        { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} tone={item.status === "ACTIVE" ? "success" : item.status === "REVOKED" ? "danger" : "warning"} /> },
        {
          key: "actions",
          header: "",
          sortable: false,
          render: (item) => <MemberReview member={item} matrix={matrix} />
        }
      ]}
      emptyState={emptyState}
    />
  );
}
