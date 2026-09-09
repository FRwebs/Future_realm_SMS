"use client";

import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { TableFilterBar } from "@/components/data-display/table-filter-bar";
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
      title="All migration jobs"
      description="Every school migration tracked on the platform, most recent first."
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
        { key: "createdAt", header: "Created", render: (job) => formatDate(job.createdAt) },
        { key: "filesReceivedAt", header: "Files received", render: (job) => (job.filesReceivedAt ? formatDate(job.filesReceivedAt) : "Awaiting") },
        { key: "signedOffAt", header: "Signed off", render: (job) => (job.signedOffAt ? formatDate(job.signedOffAt) : "—") }
      ]}
    />
  );
}
