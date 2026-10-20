"use client";

import { useEffect, useState, type ReactNode } from "react";

import { DetailFacts, DetailSheet } from "@/components/data-display/detail-sheet";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import type { SuperAdminInternalMember, SuperAdminPermissionGridMatrix } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

const accessLevels = ["NONE", "VIEW", "EDIT", "FULL"].map((v) => ({ label: v, value: v }));

export type PersonProfile = { departmentId: string | null; department: string | null; level: string | null; scopeStates: string[]; managerId: string | null; manager: string | null; staffNumber: string | null; isExternal: boolean; mfaEnabled: boolean };
type Option = { label: string; value: string };
type DeviceRow = { device: string; first: string; last: string; count: number; ip: string | null };
type Owns = { openTickets: number; schools: number; openFlags: number };

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function MemberReview({ member, matrix, profile, departmentOptions, memberOptions, moduleOptions }: { member: SuperAdminInternalMember; matrix: SuperAdminPermissionGridMatrix; profile?: PersonProfile; departmentOptions: Option[]; memberOptions: Option[]; moduleOptions: Option[] }) {
  const [open, setOpen] = useState(false);
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [owns, setOwns] = useState<Owns | null>(null);

  useEffect(() => {
    if (!open || devices) return;
    void (async () => {
      try {
        const [d, o] = await Promise.all([
          fetch(`/api/super-admin/internal-team/devices/${member.id}`, { credentials: "include" }).then((r) => r.json()),
          fetch(`/api/super-admin/internal-team/owns/${member.id}`, { credentials: "include" }).then((r) => r.json())
        ]);
        setDevices(d.data ?? []);
        setOwns(o.data ?? null);
      } catch {
        setDevices([]);
      }
    })();
  }, [open, devices, member.id]);
  const gridRow = matrix.members.find((m) => m.id === member.id);
  const modules = matrix.modules ?? [];
  const grantedCount = modules.filter((moduleId) => (gridRow?.access[moduleId] ?? "NONE") !== "NONE").length;
  const suspended = member.status === "SUSPENDED";
  const revoked = member.status === "REVOKED";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary px-4 text-[11.5px]">
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
              description="Set what this person can do in one Back Office module. None hides it and blocks its API; View is read only; Edit can change; Full can also delete. A department lead can lower access within their department's ceiling."
              endpoint="/api/super-admin/internal-team/module-access"
              method="POST"
              variant="secondary"
              submitLabel="Save permission"
              fields={[
                { name: "userId", label: "User ID", defaultValue: member.id },
                { name: "moduleId", label: "Module", type: "select", required: true, options: moduleOptions },
                { name: "accessLevel", label: "Access level", type: "select", options: accessLevels }
              ]}
            />
            <ResourceActionDialog
              triggerLabel="Edit profile"
              title={`Profile — ${member.name}`}
              description="Where this person sits, who they answer to, and which schools they may see. A data scope limits School Accounts to those states; blank means the whole platform."
              endpoint={`/api/super-admin/internal-team/profiles/${member.id}`}
              method="PATCH"
              variant="secondary"
              submitLabel="Save profile"
              fields={[
                { name: "departmentId", label: "Department", type: "select", defaultValue: profile?.departmentId ?? "", options: [{ label: "None", value: "" }, ...departmentOptions] },
                { name: "managerId", label: "Reports to", type: "select", defaultValue: profile?.managerId ?? "", options: [{ label: "Nobody", value: "" }, ...memberOptions.filter((option) => option.value !== member.id)] },
                { name: "level", label: "Level", defaultValue: profile?.level ?? "", placeholder: "e.g. Lead, Senior, Associate" },
                { name: "staffNumber", label: "Staff identifier", defaultValue: profile?.staffNumber ?? "" },
                { name: "scopeStates", label: "Data scope — states (comma-separated)", type: "textarea", defaultValue: profile?.scopeStates.join(", ") ?? "", placeholder: "Blank for every school" },
                { name: "isExternal", label: "Person is external", type: "select", defaultValue: String(profile?.isExternal ?? false), options: [{ label: "No — an employee", value: "false" }, { label: "Yes — contractor or partner staff", value: "true" }] }
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
                { name: "moduleId", label: "Module", type: "select", required: true, options: moduleOptions },
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
            {!revoked ? (
              suspended ? (
                <ResourceActionDialog
                  triggerLabel="Reinstate the account"
                  title={`Reinstate ${member.name}`}
                  description="Restores sign-in access for this internal account."
                  endpoint={`/api/super-admin/users/${member.id}/reinstate`}
                  method="PATCH"
                  variant="secondary"
                  submitLabel="Reinstate account"
                  confirmLabel="Confirm reinstate"
                  fields={[]}
                />
              ) : (
                <ResourceActionDialog
                  triggerLabel="Suspend the account"
                  title={`Suspend ${member.name}`}
                  description="Immediately blocks sign-in for this internal account. Unlike Offboard, this can be reversed with Reinstate."
                  endpoint={`/api/super-admin/users/${member.id}/suspend`}
                  method="PATCH"
                  variant="danger"
                  submitLabel="Suspend account"
                  confirmLabel="Confirm suspend"
                  fields={[]}
                />
              )
            ) : null}
          </div>
        }
      >
        <div className="grid gap-4">
          <DetailFacts
            title="Who they are"
            rows={[
              { label: "Full name", value: member.name, bold: true },
              { label: "Staff identifier", value: profile?.staffNumber ?? "Not set" },
              { label: "Email", value: member.email, bold: true },
              { label: "Phone", value: member.phone ?? "Not on file", bold: Boolean(member.phone) },
              { label: "Role", value: member.role.replaceAll("_", " ") },
              { label: "Department", value: profile?.department ?? "Not set" },
              { label: "Reports to", value: profile?.manager ?? "Nobody" },
              { label: "Level", value: profile?.level ?? "Not set" },
              { label: "Data scope", value: profile?.scopeStates.length ? `${profile.scopeStates.join(", ")} — School Accounts shows only these states` : "The whole platform" },
              { label: "Employment", value: profile?.isExternal ? "External" : "Employee" },
              { label: "Joined Nooria", value: formatDate(member.createdAt) },
              { label: "Last sign-in", value: member.lastLoginAt ? formatDate(member.lastLoginAt) : "Never" }
            ]}
          />

          <DetailFacts
            title="Security and sessions"
            rows={[
              { label: "Two-factor", value: profile?.mfaEnabled ? "Authenticator app on" : "Email code at every sign-in (app not set up)" },
              { label: "Sessions", value: "See the Security Settings tab for this account's active sessions" },
              { label: "What they currently own", value: owns ? `${owns.openTickets} open ticket${owns.openTickets === 1 ? "" : "s"} · ${owns.schools} school${owns.schools === 1 ? "" : "s"} managed · ${owns.openFlags} open flag${owns.openFlags === 1 ? "" : "s"}` : "Loading…" },
              { label: "Known devices", value: devices ? (devices.length ? devices.map((d) => `${d.device.slice(0, 60)} — ${d.count} sign-in${d.count === 1 ? "" : "s"}, last ${formatDate(d.last)}`).join(" · ") : "None on record") : "Loading…" },
              { label: "Password", value: "Set by them — nobody at Nooria can read it", bold: true }
            ]}
          />

          {suspended ? (
            <div className="rounded-[11px] border p-4" style={{ background: "var(--color-danger-dim)", borderColor: "#F3E0E0" }}>
              <p className="mb-1.5 text-[11.5px] font-bold text-[var(--color-danger)]">Account suspended</p>
              <p className="text-[11px] leading-relaxed text-[var(--color-danger)]">
                Sign-in is blocked. Use “Reinstate the account” to restore it; offboarding is the permanent route.
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
          <p className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">
            Whole-module levels only (None/View/Edit/Full) — there is no per-action grant inside a module. These are enforced: a module reading None
            is hidden from their sidebar and its API refuses them; View blocks every change; Delete needs Full. A module with nothing set falls back to
            their role&apos;s template, then to what their role could always do.
          </p>
        </div>
      </DetailSheet>
    </>
  );
}

export function PeopleTable({
  members,
  matrix,
  profiles = {},
  departmentOptions = [],
  memberOptions = [],
  moduleOptions = [],
  title,
  description,
  actions,
  filterBar,
  emptyState
}: {
  members: SuperAdminInternalMember[];
  matrix: SuperAdminPermissionGridMatrix;
  profiles?: Record<string, PersonProfile>;
  departmentOptions?: Option[];
  memberOptions?: Option[];
  moduleOptions?: Option[];
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
        { key: "department", header: "Department", render: (item) => profiles[item.id]?.department ?? <span className="text-[var(--color-text-muted)]">None</span> },
        { key: "level", header: "Level", render: (item) => profiles[item.id]?.level ?? <span className="text-[var(--color-text-muted)]">—</span> },
        { key: "scope", header: "Data scope", render: (item) => (profiles[item.id]?.scopeStates.length ? profiles[item.id].scopeStates.join(", ") : <span className="text-[var(--color-text-muted)]">Whole platform</span>) },
        { key: "lastLogin", header: "Last sign-in", render: (item) => (item.lastLoginAt ? formatDate(item.lastLoginAt) : "Never") },
        { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} tone={item.status === "ACTIVE" ? "success" : item.status === "REVOKED" ? "danger" : "warning"} /> },
        {
          key: "actions",
          header: "",
          sortable: false,
          render: (item) => <MemberReview member={item} matrix={matrix} profile={profiles[item.id]} departmentOptions={departmentOptions} memberOptions={memberOptions} moduleOptions={moduleOptions} />
        }
      ]}
      emptyState={emptyState}
    />
  );
}
