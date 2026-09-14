"use client";

import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { TableFilterBar } from "@/components/data-display/table-filter-bar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ActionMenu } from "@/components/ui/action-menu";
import { formatDate } from "@/lib/utils/formatters";
import type { MigrationJobRow, MigrationJobStatus } from "@/lib/domain/types";

function statusTone(status: string): Parameters<typeof StatusBadge>[0]["tone"] {
  if (status === "SIGNED_OFF" || status === "COMPLETED") return "success";
  if (status === "ROLLED_BACK") return "danger";
  if (status === "INVITED" || status === "FILES_AWAITED") return "warning";
  return "brand";
}

interface JobsTableProps {
  jobs: MigrationJobRow[];
}

export function JobsTable({ jobs }: JobsTableProps) {
  const [search, setSearch] = useState("");
  const [sourceSystem, setSourceSystem] = useState("All");
  const [status, setStatus] = useState<"All" | MigrationJobStatus>("All");
  const [specialist, setSpecialist] = useState("All");

  const sourceSystemOptions = useMemo(() => ["All", ...Array.from(new Set(jobs.map((job) => job.sourceSystem))).sort()], [jobs]);
  const specialistOptions = useMemo(() => ["All", ...Array.from(new Set(jobs.map((job) => job.specialistName ?? "Unassigned"))).sort()], [jobs]);
  const statusOptions: Array<{ label: string; value: string }> = [
    { label: "All", value: "All" },
    { label: "Invited", value: "INVITED" },
    { label: "Files awaited", value: "FILES_AWAITED" },
    { label: "In progress", value: "IN_PROGRESS" },
    { label: "Preview ready", value: "PREVIEW_READY" },
    { label: "Signed off", value: "SIGNED_OFF" },
    { label: "Completed", value: "COMPLETED" },
    { label: "Rolled back", value: "ROLLED_BACK" }
  ];
  const advanceStatusOptions: Array<{ label: string; value: string }> = [
    { label: "Files awaited", value: "FILES_AWAITED" },
    { label: "In progress", value: "IN_PROGRESS" },
    { label: "Preview ready", value: "PREVIEW_READY" },
    { label: "Signed off", value: "SIGNED_OFF" },
    { label: "Completed", value: "COMPLETED" }
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesSearch = !q || job.schoolName.toLowerCase().includes(q) || job.sourceSystem.toLowerCase().includes(q);
      const matchesSource = sourceSystem === "All" || job.sourceSystem === sourceSystem;
      const matchesStatus = status === "All" || job.status === status;
      const matchesSpecialist = specialist === "All" || (job.specialistName ?? "Unassigned") === specialist;
      return matchesSearch && matchesSource && matchesStatus && matchesSpecialist;
    });
  }, [jobs, search, sourceSystem, status, specialist]);

  return (
    <TableCard
      title="Migration job registry"
      items={filtered}
      pageSize={false}
      emptyState="No migration jobs match this filter."
      filterBar={
        <TableFilterBar
          search={{ value: search, onChange: setSearch, placeholder: "Search a school or source system" }}
          filters={[
            { label: "Source system", value: sourceSystem, options: sourceSystemOptions.map((value) => ({ label: value, value })), onChange: setSourceSystem },
            { label: "Status", value: status, options: statusOptions, onChange: (value) => setStatus(value as "All" | MigrationJobStatus) },
            { label: "Specialist", value: specialist, options: specialistOptions.map((value) => ({ label: value, value })), onChange: setSpecialist }
          ]}
          note={`${filtered.length} of ${jobs.length} shown`}
        />
      }
      columns={[
        {
          key: "schoolName",
          header: "School",
          render: (job) => (
            <div>
              <p className="font-semibold text-[var(--color-text-primary)]">{job.schoolName}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{job.sourceSystem}</p>
            </div>
          )
        },
        { key: "status", header: "Status", render: (job) => <StatusBadge status={job.status} tone={statusTone(job.status)} /> },
        { key: "specialist", header: "Specialist", render: (job) => job.specialistName ?? "Unassigned" },
        {
          key: "scope",
          header: "Scope",
          render: (job) => {
            const enabled = [
              job.includeStudentsGuardians ? "Students" : null,
              job.includeStaffAccounts ? "Staff" : null,
              job.includeHistoricalResults ? "Results" : null,
              job.includeFeesBalances ? "Fees" : null,
              job.includeAttendanceHistory ? "Attendance" : null,
              job.includeBehaviouralRecords ? "Behaviour" : null
            ].filter(Boolean);
            return (
              <div className="flex max-w-[280px] flex-wrap gap-1.5">
                {enabled.length === 0 ? <span className="text-[12px] text-[var(--color-text-muted)]">No scope selected</span> : null}
                {enabled.slice(0, 4).map((label) => (
                  <span key={label} className="rounded-full bg-[#F0F5F2] px-2 py-0.5 text-[10.5px] font-bold text-[#5D6B63]">
                    {label}
                  </span>
                ))}
                {enabled.length > 4 ? (
                  <span className="rounded-full bg-[#E4F1EC] px-2 py-0.5 text-[10.5px] font-bold text-[#17604F]">
                    +{enabled.length - 4}
                  </span>
                ) : null}
              </div>
            );
          },
          sortable: false
        },
        { key: "createdAt", header: "Created", render: (job) => formatDate(job.createdAt) },
        { key: "filesReceivedAt", header: "Files received", render: (job) => (job.filesReceivedAt ? formatDate(job.filesReceivedAt) : "Awaiting") },
        { key: "signedOffAt", header: "Signed off", render: (job) => (job.signedOffAt ? formatDate(job.signedOffAt) : "—") },
        {
          key: "actions",
          header: "Actions",
          sortable: false,
          render: (job) => (
            <ActionMenu triggerLabel={`Actions for ${job.schoolName}`}>
              {job.status === "INVITED" || job.status === "FILES_AWAITED" ? (
                <ResourceActionDialog
                  triggerLabel="Mark files received"
                  title={`Mark files received — ${job.schoolName}`}
                  description="Moves the migration into active work and records the receipt timestamp."
                  endpoint={`/api/super-admin/migration/jobs/${job.id}/files-received`}
                  method="POST"
                  variant="menu"
                  submitLabel="Confirm receipt"
                  fields={[]}
                />
              ) : null}
              {job.status !== "COMPLETED" && job.status !== "ROLLED_BACK" ? (
                <ResourceActionDialog
                  triggerLabel="Advance status"
                  title={`Advance migration — ${job.schoolName}`}
                  description="Move this migration forward. Backward moves are blocked by the API."
                  endpoint={`/api/super-admin/migration/jobs/${job.id}`}
                  method="PATCH"
                  variant="menu"
                  submitLabel="Update status"
                  fields={[
                    {
                      name: "status",
                      label: "Next status",
                      type: "select",
                      defaultValue: job.status,
                      options: advanceStatusOptions
                    }
                  ]}
                />
              ) : null}
              <ResourceActionDialog
                triggerLabel="Update scope"
                title={`Update migration scope — ${job.schoolName}`}
                description="Adjust expected record counts and included data areas."
                endpoint={`/api/super-admin/migration/jobs/${job.id}`}
                method="PATCH"
                variant="menu"
                submitLabel="Save scope"
                fields={[
                  { name: "studentsExpected", label: "Students expected", type: "number", defaultValue: job.studentsExpected ?? "", min: 0 },
                  { name: "resultsExpected", label: "Result records expected", type: "number", defaultValue: job.resultsExpected ?? "", min: 0 },
                  { name: "includeStudentsGuardians", label: "Students & guardians", type: "select", defaultValue: String(job.includeStudentsGuardians), options: [{ label: "Yes", value: "true" }, { label: "No", value: "false" }] },
                  { name: "includeStaffAccounts", label: "Staff accounts", type: "select", defaultValue: String(job.includeStaffAccounts), options: [{ label: "Yes", value: "true" }, { label: "No", value: "false" }] },
                  { name: "includeHistoricalResults", label: "Historical results", type: "select", defaultValue: String(job.includeHistoricalResults), options: [{ label: "Yes", value: "true" }, { label: "No", value: "false" }] },
                  { name: "includeFeesBalances", label: "Fees & balances", type: "select", defaultValue: String(job.includeFeesBalances), options: [{ label: "Yes", value: "true" }, { label: "No", value: "false" }] },
                  { name: "includeAttendanceHistory", label: "Attendance history", type: "select", defaultValue: String(job.includeAttendanceHistory), options: [{ label: "Yes", value: "true" }, { label: "No", value: "false" }] },
                  { name: "includeBehaviouralRecords", label: "Behavioural records", type: "select", defaultValue: String(job.includeBehaviouralRecords), options: [{ label: "Yes", value: "true" }, { label: "No", value: "false" }] },
                  { name: "notes", label: "Notes", type: "textarea", defaultValue: job.notes ?? "" }
                ]}
              />
              {job.status !== "ROLLED_BACK" && job.status !== "COMPLETED" ? (
                <ResourceActionDialog
                  triggerLabel="Roll back"
                  title={`Roll back migration — ${job.schoolName}`}
                  description="Rollback requires a reason and moves the job to the exception path."
                  endpoint={`/api/super-admin/migration/jobs/${job.id}`}
                  method="PATCH"
                  variant="menuDanger"
                  submitLabel="Roll back"
                  confirmLabel="Confirm rollback"
                  confirmMessage="This moves the migration to ROLLED_BACK and records the reason."
                  fields={[
                    { name: "status", label: "Status", type: "select", defaultValue: "ROLLED_BACK", options: [{ label: "Rolled back", value: "ROLLED_BACK" }] },
                    { name: "rollbackReason", label: "Rollback reason", type: "textarea", required: true }
                  ]}
                />
              ) : null}
            </ActionMenu>
          )
        }
      ]}
    />
  );
}
