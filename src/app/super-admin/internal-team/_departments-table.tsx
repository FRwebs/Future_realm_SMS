"use client";

import { gridFields } from "./_grid-fields";
import { useState, type ReactNode } from "react";

import { DetailFacts, DetailSheet } from "@/components/data-display/detail-sheet";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import type { SuperAdminDepartmentRow } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function hasCeiling(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function DepartmentReview({ department, members, moduleOptions }: { department: SuperAdminDepartmentRow; members?: string[]; moduleOptions: Array<{ label: string; value: string }> }) {
  const [open, setOpen] = useState(false);
  const ceilingSet = hasCeiling(department.permissionCeiling);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary px-4 text-[11.5px]">
        Manage
      </button>

      <DetailSheet
        open={open}
        onClose={() => setOpen(false)}
        avatarLabel={initialsOf(department.name)}
        eyebrow="Internal department"
        title={department.name}
        subtitle={`Lead: ${department.lead}`}
        chips={[{ label: ceilingSet ? "Permission ceiling set" : "No permission ceiling set", tone: ceilingSet ? "teal" : "mute" }]}
        footer={
          <ResourceActionDialog
            triggerLabel="Edit this department"
            title={`Edit — ${department.name}`}
            description="Re-using an existing department name updates it instead of creating a new one."
            endpoint="/api/super-admin/internal-team/departments"
            variant="secondary"
            submitLabel="Save department"
            fields={[
              { name: "name", label: "Department name", required: true, defaultValue: department.name, section: "Identity" },
              { name: "leadEmail", label: "Lead email (optional)", type: "email", defaultValue: department.leadEmail ?? "", section: "Identity" },
              ...gridFields(moduleOptions, "permissionCeiling", department.permissionCeiling as Record<string, unknown> | null, "Permission ceiling", "Enforced — the lead can set access for members of this department up to these levels, and never raise it past them. A module left Not set cannot be granted by the lead at all.")
            ]}
          />
        }
      >
        <div className="grid gap-4">
          <DetailFacts
            title="This department"
            rows={[
              { label: "Lead", value: department.lead, bold: true },
              { label: "Lead email", value: department.leadEmail ?? "Not set" },
              { label: "Created", value: formatDate(department.createdAt) },
              { label: "Members assigned", value: members?.length ? members.join(", ") : "Nobody yet — assign from a person's Edit profile" }
            ]}
          />

          <DetailFacts
            title="Permission ceiling"
            rows={[
              { label: "Set", value: ceilingSet ? "Yes" : "No" },
              { label: "Raw value", value: ceilingSet ? JSON.stringify(department.permissionCeiling) : "Not set" }
            ]}
          />
          <p className="text-[10px] leading-relaxed text-(--color-text-muted)">
            The ceiling caps what the department&apos;s lead can grant within their team. When the lead sets a member&apos;s module access it is checked against this: a module
            with no ceiling cannot be granted by the lead, and no level above the ceiling can be given. A Super Admin is not limited by it.
          </p>
        </div>
      </DetailSheet>
    </>
  );
}

export function DepartmentsTable({ items, actions, members = {}, moduleOptions }: { items: SuperAdminDepartmentRow[]; actions: ReactNode; members?: Record<string, string[]>; moduleOptions: Array<{ label: string; value: string }> }) {
  return (
    <TableCard
      title="Departments"
      description="Organise the team into departments, each with a lead. A person joins a department from their Edit profile; the lead can then set their module access within the department's ceiling."
      items={items}
      actions={actions}
      getRowKey={(item) => item.id}
      columns={[
        { key: "name", header: "Department", render: (item) => <span className="font-semibold text-(--color-text-primary)">{item.name}</span> },
        { key: "lead", header: "Lead", render: (item) => item.lead },
        {
          key: "ceiling",
          header: "Permission ceiling",
          render: (item) => (
            <span
              className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold"
              style={hasCeiling(item.permissionCeiling) ? { background: "#E4F1EC", color: "#12796A" } : { background: "var(--color-bg-subtle)", color: "var(--color-text-muted)" }}
            >
              {hasCeiling(item.permissionCeiling) ? "Set" : "Not set"}
            </span>
          )
        },
        { key: "members", header: "Members", render: (item) => members[item.id]?.length ?? 0 },
        { key: "created", header: "Created", render: (item) => formatDate(item.createdAt) },
        { key: "actions", header: "", sortable: false, render: (item) => <DepartmentReview department={item} members={members[item.id]} moduleOptions={moduleOptions} /> }
      ]}
      emptyState="No departments created yet."
    />
  );
}
