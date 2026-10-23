"use client";

import { useState } from "react";

import { DetailFacts, DetailSheet } from "@/components/data-display/detail-sheet";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { useToast } from "@/components/ui/toast-provider";

export interface RoleBreakdownRow {
  role: string;
  roleValue: string;
  holders: number;
  modulesWithAccess: number;
  modulesAtFull: number;
  totalModules: number;
  purpose: string;
  breadth: "Full" | "Scoped";
  holderNames: string[];
}

export interface CustomRoleRow {
  id: string;
  name: string;
  description: string | null;
  baseRole: string;
  grid: Record<string, string>;
  retired: boolean;
  holders: string[];
}

function InertAction({ label, note }: { label: string; note: string }) {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast({ variant: "info", title: "Not built", description: note })} className="btn-secondary px-4 text-[11.5px]">
      {label}
    </button>
  );
}

/** Copying a built-in role is how a narrower version of it gets made: the new role starts from the same grid and is then trimmed. */
function DuplicateRole({ copyFrom, label }: { copyFrom: string; label: string }) {
  return (
    <ResourceActionDialog
      triggerLabel="Duplicate as a new role"
      title={`Duplicate ${label}`}
      description="The new role starts with the same module access and can then be trimmed. Nobody is moved onto it."
      endpoint="/api/super-admin/team-access/roles"
      variant="secondary"
      submitLabel="Create the role"
      fields={[
        { name: "name", label: "Name", required: true, placeholder: `e.g. ${label} (read-only)`, section: "The new role" },
        { name: "description", label: "What it is for", placeholder: "One line, shown beside the role", section: "The new role", full: true },
        { name: "copyFromDisplay", label: "Copied from", type: "static", placeholder: label, section: "The new role" },
        { name: "copyFrom", label: "Copied from", type: "hidden", defaultValue: copyFrom },
        { name: "baseRole", label: "Signs in as", type: "select", defaultValue: "PLATFORM_ADMIN", section: "The new role", options: [{ label: "Platform Admin", value: "PLATFORM_ADMIN" }, { label: "Developer", value: "DEVELOPER" }], note: "The platform role it authenticates as. Module access comes from the grid, not from this." }
      ]}
      impact={{
        label: "Once created",
        rows: [
          ["Starts as a copy", `Every module ${label} can enter, at the same level. Trim it from the role's own row.`],
          ["Nobody is on it yet", "Assign it to a person from their Manage panel on the People tab."],
          ["Retirable later", "A role nobody holds can be retired; one with holders cannot, until they are moved."]
        ]
      }}
      note="A duplicate is for narrowing a role, not widening one — a grid can never grant more than the person editing it holds."
    />
  );
}

function RetireRole({ id, name, holders }: { id: string; name: string; holders: string[] }) {
  return (
    <ResourceActionDialog
      triggerLabel="Retire this role"
      title={`Retire ${name}`}
      description={holders.length ? "This role still has people on it, so it cannot be retired yet." : "The role stops being available to assign. Nothing already recorded against it changes."}
      endpoint={`/api/super-admin/team-access/roles/${id}/retire`}
      variant="danger"
      submitLabel="Retire the role"
      confirmLabel="Retire it"
      confirmMessage="A retired role can no longer be assigned to anyone."
      fields={[
        { name: "_name", label: "Role", type: "static", placeholder: name, section: "What you are retiring" },
        { name: "_holders", label: "People on it", type: "static", placeholder: holders.length ? holders.join(", ") : "Nobody", section: "What you are retiring", note: holders.length ? "Move them to another role first — the request is refused while anyone holds it." : undefined, full: true },
        { name: "reason", label: "Why it is being retired", required: true, type: "textarea", placeholder: "Recorded in the audit log beside the role", section: "Reason" }
      ]}
      impact={{
        label: "On retiring",
        rows: [
          ["Cannot be assigned again", "It disappears from the list of roles a person can be put on."],
          ["Refused while anyone holds it", "Nobody is left on a role that no longer exists."],
          ["Logged with your reason", "The role, who retired it and why."]
        ]
      }}
      note="Retiring is not deleting: the role stays on record so past audit entries still name something real."
    />
  );
}

function RoleReview({ row }: { row: RoleBreakdownRow }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary px-4 text-[11.5px]">
        Open
      </button>

      <DetailSheet
        open={open}
        onClose={() => setOpen(false)}
        avatarLabel={row.role.slice(0, 2).toUpperCase()}
        eyebrow="Role"
        title={row.role}
        subtitle={row.purpose}
        chips={[
          { label: `${row.breadth} access`, tone: row.breadth === "Full" ? "bad" : "good" },
          { label: `${row.holders} ${row.holders === 1 ? "person holds it" : "people hold it"}`, tone: "mute" }
        ]}
        footer={
          <div className="flex flex-wrap gap-2">
            <InertAction label="Assign privileges to this role" note="Not a single action here — set access module by module from a person's Manage panel on the People tab, or edit the role's Role Template below." />
            <DuplicateRole copyFrom={row.roleValue} label={row.role} />
          </div>
        }
      >
        <div className="grid gap-4">
          <DetailFacts
            title="This role"
            rows={[
              { label: "Breadth", value: row.breadth === "Full" ? "Full — bypasses the permission grid entirely by role check" : "Scoped — gated by the module permission grid", bold: true },
              { label: "People holding it", value: String(row.holders) },
              { label: "Modules with any access", value: `${row.modulesWithAccess} of ${row.totalModules}` },
              { label: "Modules at Full access", value: `${row.modulesAtFull} of ${row.totalModules}` },
              { label: "What it is for", value: row.purpose }
            ]}
          />

          {row.holderNames.length > 0 ? (
            <DetailFacts title="People holding this role" rows={row.holderNames.map((name) => ({ label: name, value: "" }))} />
          ) : null}

          <div className="rounded-[11px] border p-4" style={{ background: "var(--color-warning-dim)", borderColor: "#F2E4C6" }}>
            <p className="mb-1.5 text-[11.5px] font-bold text-[var(--color-warning)]">Two rules this module enforces</p>
            <p className="text-[11px] leading-relaxed text-[var(--color-warning)]">
              &quot;A Department Lead can lower but never raise&quot; is enforced: a lead can change access only for members of their own department, only up to the
              ceiling the department carries, and never above what they hold themselves. A Super Admin is not limited by a ceiling. Also real: nobody, including Super Admin, holds an action that lets them read a child&apos;s record — that function was
              never built, so it cannot be granted here or anywhere.
            </p>
          </div>
        </div>
      </DetailSheet>
    </>
  );
}

export function PrivilegesByRoleTable({ items }: { items: RoleBreakdownRow[] }) {
  return (
    <TableCard
      title="Privileges by role"
      description="Two things are controlled here, and they are not the same: whether a role can enter a module at all, and what it may do once inside. This system grants module-level access only — there is no separate per-action grant within a module."
      items={items}
      getRowKey={(row) => row.role}
      columns={[
        { key: "role", header: "Role", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.role}</span> },
        {
          key: "breadth",
          header: "Breadth",
          render: (row) => (
            <span
              className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold"
              style={row.breadth === "Full" ? { background: "var(--color-danger-dim)", color: "var(--color-danger)" } : { background: "var(--color-success-dim)", color: "var(--color-success)" }}
            >
              {row.breadth}
            </span>
          )
        },
        { key: "holders", header: "People", render: (row) => row.holders },
        { key: "modulesOpen", header: "Modules open", render: (row) => `${row.modulesWithAccess} of ${row.totalModules}` },
        { key: "modulesFull", header: "Modules at Full", render: (row) => `${row.modulesAtFull} of ${row.totalModules}` },
        { key: "purpose", header: "What it is for", render: (row) => <span className="text-[11px] text-[var(--color-text-secondary)]">{row.purpose}</span> },
        { key: "actions", header: "", sortable: false, render: (row) => <RoleReview row={row} /> }
      ]}
    />
  );
}

/**
 * Roles the team made, as opposed to the platform's built-in ones.
 *
 * A built-in role is an enum the code checks by name, so it cannot be copied or
 * removed. A role made here is a record: a name, a base role to sign in as, and
 * a grid of module access. That is what makes "duplicate" and "retire" possible
 * at all, and why the two tables are separate rather than one list pretending
 * both kinds behave the same.
 */
export function CustomRolesTable({ items, moduleLabels }: { items: CustomRoleRow[]; moduleLabels: Record<string, string> }) {
  return (
    <TableCard
      title="Roles your team made"
      description="A role here is a record, not a platform enum: it can be copied, edited and retired. Module access comes from its own grid; the base role only decides what it signs in as."
      items={items}
      pageSize={false}
      getRowKey={(row) => row.id}
      emptyState="No role has been made yet. Duplicate a built-in role from its row above to start one."
      columns={[
        { key: "name", header: "Role", render: (row) => (
          <div className="min-w-0">
            <p className="font-bold text-[var(--color-text-primary)]">{row.name}</p>
            {row.description ? <p className="text-[10px] text-[var(--color-text-muted)]">{row.description}</p> : null}
          </div>
        ) },
        { key: "base", header: "Signs in as", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.baseRole.replace(/_/g, " ").toLowerCase()}</span> },
        {
          key: "modules",
          header: "Modules open",
          render: (row) => {
            const open = Object.values(row.grid).filter((level) => level && level !== "NONE").length;
            return <span className="font-[var(--font-mono)] font-bold text-[var(--color-text-primary)]">{open}</span>;
          },
          sortValue: (row) => Object.values(row.grid).filter((level) => level && level !== "NONE").length
        },
        {
          key: "at-full",
          header: "At full",
          render: (row) => <span className="font-[var(--font-mono)] text-[var(--color-text-secondary)]">{Object.values(row.grid).filter((level) => level === "FULL").length}</span>
        },
        {
          key: "holders",
          header: "People on it",
          render: (row) => (row.holders.length ? <span className="text-[11px] text-[var(--color-text-secondary)]">{row.holders.join(", ")}</span> : <span className="text-[11px] text-[var(--color-text-muted)]">Nobody yet</span>),
          sortValue: (row) => row.holders.length
        },
        {
          key: "state",
          header: "State",
          render: (row) => (
            <span
              className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold"
              style={row.retired ? { background: "var(--color-bg-subtle)", color: "var(--color-text-muted)" } : { background: "var(--color-success-dim)", color: "var(--color-success)" }}
            >
              {row.retired ? "Retired" : "In use"}
            </span>
          )
        },
        {
          key: "actions",
          header: "",
          sortable: false,
          render: (row) =>
            row.retired ? (
              <span className="text-[11px] text-[var(--color-text-muted)]">—</span>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <EditRoleGrid row={row} moduleLabels={moduleLabels} />
                <RetireRole id={row.id} name={row.name} holders={row.holders} />
              </div>
            )
        }
      ]}
    />
  );
}

const ACCESS_LEVELS = [
  { label: "None — cannot enter the module", value: "NONE" },
  { label: "View — read only", value: "VIEW" },
  { label: "Edit — read and change", value: "EDIT" },
  { label: "Full — everything the module offers", value: "FULL" }
];

/** Editing a role's grid is editing one record, so it reaches everybody on that role at once. */
function EditRoleGrid({ row, moduleLabels }: { row: CustomRoleRow; moduleLabels: Record<string, string> }) {
  const modules = Object.keys(moduleLabels).length ? Object.keys(moduleLabels) : Object.keys(row.grid);
  return (
    <ResourceActionDialog
      triggerLabel="Edit access"
      title={`Access for ${row.name}`}
      description="What this role can enter, and what it may do inside. It applies to everyone on the role the moment it is saved."
      endpoint={`/api/super-admin/team-access/roles/${row.id}/grid`}
      variant="secondary"
      submitLabel="Save access"
      fields={[
        { name: "description", label: "What it is for", defaultValue: row.description ?? "", placeholder: "One line, shown beside the role", section: "The role", full: true },
        ...modules.map((moduleId) => ({
          name: `grid.${moduleId}`,
          label: moduleLabels[moduleId] ?? moduleId,
          type: "select" as const,
          defaultValue: row.grid[moduleId] ?? "NONE",
          section: "Module access",
          options: ACCESS_LEVELS
        }))
      ]}
      impact={{
        label: "On saving",
        rows: [
          ["Everyone on the role moves together", row.holders.length ? `${row.holders.length} ${row.holders.length === 1 ? "person" : "people"}: ${row.holders.join(", ")}.` : "Nobody holds it yet, so nothing changes today."],
          ["Takes effect on their next request", "Open sessions are re-checked; nobody has to sign out."],
          ["Never grants more than you hold", "A level above your own is refused when it is saved."]
        ]
      }}
      note="This is module-level access. There is no separate per-action grant inside a module."
    />
  );
}
