"use client";

import { useState } from "react";

import { DetailFacts, DetailSheet } from "@/components/data-display/detail-sheet";
import { TableCard } from "@/components/data-display/table-card";
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

function InertAction({ label, note }: { label: string; note: string }) {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast({ variant: "info", title: "Not built", description: note })} className="btn-secondary px-4 text-[12.5px]">
      {label}
    </button>
  );
}

function RoleReview({ row }: { row: RoleBreakdownRow }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary px-4 text-[12.5px]">
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
            <InertAction label="Duplicate as a new role" note="Not built — roles are a fixed platform enum, not records that can be copied." />
            <InertAction label="Retire this role" note="Not built — roles are a fixed platform enum; none can be removed or retired from this screen." />
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

          <div className="rounded-[12px] border p-4" style={{ background: "var(--color-warning-dim)", borderColor: "#F2E4C6" }}>
            <p className="mb-1.5 text-[12.5px] font-bold text-[var(--color-warning)]">Two rules the mockup describes — checked against this codebase</p>
            <p className="text-[12px] leading-relaxed text-[var(--color-warning)]">
              &quot;A Department Lead can lower but never raise&quot; is not enforced here — there is no department-lead ceiling logic; any Super Admin can set any grid
              cell to any level for anyone. What is real: nobody, including Super Admin, holds an action that lets them read a child&apos;s record — that function was
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
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={row.breadth === "Full" ? { background: "var(--color-danger-dim)", color: "var(--color-danger)" } : { background: "var(--color-success-dim)", color: "var(--color-success)" }}
            >
              {row.breadth}
            </span>
          )
        },
        { key: "holders", header: "People", render: (row) => row.holders },
        { key: "modulesOpen", header: "Modules open", render: (row) => `${row.modulesWithAccess} of ${row.totalModules}` },
        { key: "modulesFull", header: "Modules at Full", render: (row) => `${row.modulesAtFull} of ${row.totalModules}` },
        { key: "purpose", header: "What it is for", render: (row) => <span className="text-[12px] text-[var(--color-text-secondary)]">{row.purpose}</span> },
        { key: "actions", header: "", sortable: false, render: (row) => <RoleReview row={row} /> }
      ]}
    />
  );
}
