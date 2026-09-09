"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { TableFilterBar } from "@/components/data-display/table-filter-bar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";

interface School {
  id: string;
  name: string;
  subdomain?: string | null;
  schoolCode?: string | null;
  state?: string;
  createdAt: string;
}

interface RegistryRecord {
  id: string;
  address: string;
  schoolId: string | null;
  state: string;
  countryScope: string;
  reservedReason: string | null;
  changeReason: string | null;
  issuedAt: string;
}

const registryStateTone: Record<string, { bg: string; fg: string; label: string }> = {
  LIVE: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Live" },
  HELD: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Held" },
  RESERVED: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "Reserved" },
  BLOCKED: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Blocked" }
};

function initials(name: string) {
  const letters = name
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return letters || "—";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

interface Dispute {
  claimedAddress: string;
  status: string;
}

interface WebAddressesTableProps {
  schools: School[];
  registryRecords: RegistryRecord[];
  disputes: Dispute[];
}

export function WebAddressesTable({ schools, registryRecords, disputes }: WebAddressesTableProps) {
  const [search, setSearch] = useState("");
  const [registryState, setRegistryState] = useState("Any");
  const [issuedYear, setIssuedYear] = useState("Any");
  const [disputeFilter, setDisputeFilter] = useState("Any");

  const recordBySchoolId = useMemo(() => {
    const map = new Map<string, RegistryRecord>();
    for (const record of registryRecords) {
      if (record.schoolId) map.set(record.schoolId, record);
    }
    return map;
  }, [registryRecords]);

  const openDisputeAddresses = useMemo(
    () => new Set(disputes.filter((dispute) => dispute.status !== "DECIDED").map((dispute) => dispute.claimedAddress)),
    [disputes]
  );

  const registryStateOptions = useMemo(() => {
    const present = new Set(registryRecords.map((record) => record.state));
    const options = ["Any"];
    if (present.has("LIVE")) options.push("LIVE");
    if (present.has("HELD")) options.push("HELD");
    if (present.has("RESERVED")) options.push("RESERVED");
    if (present.has("BLOCKED")) options.push("BLOCKED");
    options.push("NOT_YET_REGISTERED");
    return options;
  }, [registryRecords]);

  const issuedYearOptions = useMemo(() => {
    const years = new Set<string>();
    for (const school of schools) {
      const record = recordBySchoolId.get(school.id);
      years.add(String(new Date(record?.issuedAt ?? school.createdAt).getFullYear()));
    }
    return ["Any", ...Array.from(years).sort().reverse()];
  }, [schools, recordBySchoolId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return schools.filter((school) => {
      const record = recordBySchoolId.get(school.id);
      const matchesSearch = !q || school.name.toLowerCase().includes(q) || (school.subdomain ?? "").toLowerCase().includes(q);
      const matchesRegistry =
        registryState === "Any" ||
        (registryState === "NOT_YET_REGISTERED" ? !record : record?.state === registryState);
      const matchesIssued = issuedYear === "Any" || String(new Date(record?.issuedAt ?? school.createdAt).getFullYear()) === issuedYear;
      const hasDispute = Boolean(school.subdomain && openDisputeAddresses.has(school.subdomain));
      const matchesDispute = disputeFilter === "Any" || (disputeFilter === "Yes" ? hasDispute : !hasDispute);
      return matchesSearch && matchesRegistry && matchesIssued && matchesDispute;
    });
  }, [schools, search, registryState, issuedYear, disputeFilter, recordBySchoolId, openDisputeAddresses]);

  return (
    <TableCard
      title="Web address registry"
      description="Every address ever issued, with its school, issue date, and current registry state."
      items={filtered}
      pageSize={false}
      emptyState="No schools match this filter."
      filterBar={
        <TableFilterBar
          search={{ value: search, onChange: setSearch, placeholder: "Search by school or address" }}
          filters={[
            {
              label: "State",
              value: registryState,
              options: registryStateOptions.map((value) => ({
                label: value === "Any" ? "Any" : value === "NOT_YET_REGISTERED" ? "Not yet in registry" : registryStateTone[value]?.label ?? value,
                value
              })),
              onChange: setRegistryState
            },
            { label: "Country", value: "Nigeria" },
            { label: "Issued", value: issuedYear, options: issuedYearOptions.map((value) => ({ label: value, value })), onChange: setIssuedYear },
            { label: "Dispute", value: disputeFilter, options: [{ label: "Any", value: "Any" }, { label: "Yes", value: "Yes" }, { label: "No", value: "No" }], onChange: setDisputeFilter }
          ]}
          note={`${filtered.length} of ${schools.length} shown`}
        />
      }
      columns={[
        {
          key: "school",
          header: "School",
          render: (school) => (
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-bg-subtle)] font-[var(--font-mono)] text-[13px] font-black text-[var(--color-text-primary)]">
                {initials(school.name)}
              </span>
              <Link href={`/super-admin/schools/${school.id}`} className="font-bold text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]">
                {school.name}
              </Link>
            </div>
          )
        },
        {
          key: "address",
          header: "Address",
          render: (school) =>
            school.subdomain ? (
              <span className="rounded-[6px] bg-[var(--color-bg-subtle)] px-2 py-1 font-[var(--font-mono)] text-[12px] text-[var(--color-text-primary)]">{school.subdomain}</span>
            ) : (
              <span className="text-[12px] font-semibold text-[var(--color-warning)]">Not assigned</span>
            )
        },
        {
          key: "state",
          header: "State",
          render: (school) => {
            const record = recordBySchoolId.get(school.id);
            if (!record) return <span className="text-[11.5px] text-[var(--color-text-muted)]">Not yet in registry</span>;
            const tone = registryStateTone[record.state] ?? registryStateTone.LIVE;
            return (
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
                {tone.label}
              </span>
            );
          }
        },
        {
          key: "issued",
          header: "Issued",
          render: (school) => {
            const record = recordBySchoolId.get(school.id);
            return formatDate(record?.issuedAt ?? school.createdAt);
          }
        },
        {
          key: "note",
          header: "Note",
          render: (school) => {
            const record = recordBySchoolId.get(school.id);
            const note = record?.reservedReason ?? record?.changeReason;
            return note ? <span className="text-[12px] text-[var(--color-text-secondary)]">{note}</span> : <span className="text-[var(--color-text-muted)]">—</span>;
          }
        },
        {
          key: "history",
          header: "",
          render: (school) => (
            <Link href={`/super-admin/audit-logs?schoolId=${school.id}`} className="text-[11.5px] font-semibold text-[var(--color-text-accent)] underline">
              History
            </Link>
          )
        },
        {
          key: "actions",
          header: "Actions",
          render: (school) => (
            <ResourceActionDialog
              triggerLabel="Change address"
              title={`Change web address — ${school.name}`}
              description="Super Admin only. Creates a 90-day redirect from the old address and notifies every user of the school. The bar is deliberately high — every invitation already sent carries the old address."
              endpoint="/api/super-admin/web-address-registry/records/change"
              variant="menu"
              submitLabel="Change address"
              confirmLabel="Confirm change"
              confirmMessage="This immediately updates the school's live web address and starts a 90-day redirect."
              fields={[
                { name: "schoolId", label: "School", type: "select", defaultValue: school.id, options: [{ label: school.name, value: school.id }] },
                { name: "newAddress", label: "New address", placeholder: "lowercase-letters-numbers", required: true },
                { name: "reason", label: "Reason", type: "textarea", required: true }
              ]}
            />
          )
        }
      ]}
    />
  );
}
