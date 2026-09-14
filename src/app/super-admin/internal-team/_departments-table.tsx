"use client";

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

function DepartmentReview({ department }: { department: SuperAdminDepartmentRow }) {
  const [open, setOpen] = useState(false);
  const ceilingSet = hasCeiling(department.permissionCeiling);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary px-4 text-[12.5px]">
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
              {
                name: "permissionCeiling",
                label: "Permission ceiling (JSON, optional)",
                type: "textarea",
                parse: "json",
                defaultValue: department.permissionCeiling ? JSON.stringify(department.permissionCeiling, null, 2) : "",
                placeholder: '{\n  "M3": "VIEW"\n}',
                note: "Stored, but nothing in this codebase reads it — a Department Lead can set any grid cell to any level for anyone, with no ceiling actually enforced.",
                section: "Ceiling"
              }
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
              { label: "Members assigned", value: "Not tracked — no internal account links back to a department record" }
            ]}
          />

          <DetailFacts
            title="Permission ceiling"
            rows={[
              { label: "Set", value: ceilingSet ? "Yes" : "No" },
              { label: "Raw value", value: ceilingSet ? JSON.stringify(department.permissionCeiling) : "Not set" }
            ]}
          />
          <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)]">
            The schema reserves a permissionCeiling field on every department, meant to cap what its lead can grant within their team. It is stored and editable here, but
            nothing in this codebase reads it back — no request is checked against it, and no permission-grid save is blocked by it today.
          </p>
        </div>
      </DetailSheet>
    </>
  );
}

export function DepartmentsTable({ items, actions }: { items: SuperAdminDepartmentRow[]; actions: ReactNode }) {
  return (
    <TableCard
      title="Departments"
      description="Organise the team into departments, each with a lead — not shown in the mockup's own tab list, but a real, working part of this codebase. Members aren't linked to a department record; Department shown elsewhere in Team & Access is recorded only in the audit log at hire time."
      items={items}
      actions={actions}
      getRowKey={(item) => item.id}
      columns={[
        { key: "name", header: "Department", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.name}</span> },
        { key: "lead", header: "Lead", render: (item) => item.lead },
        {
          key: "ceiling",
          header: "Permission ceiling",
          render: (item) => (
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={hasCeiling(item.permissionCeiling) ? { background: "#E4F1EC", color: "#12796A" } : { background: "var(--color-bg-subtle)", color: "var(--color-text-muted)" }}
            >
              {hasCeiling(item.permissionCeiling) ? "Set" : "Not set"}
            </span>
          )
        },
        { key: "created", header: "Created", render: (item) => formatDate(item.createdAt) },
        { key: "actions", header: "", sortable: false, render: (item) => <DepartmentReview department={item} /> }
      ]}
      emptyState="No departments created yet."
    />
  );
}
