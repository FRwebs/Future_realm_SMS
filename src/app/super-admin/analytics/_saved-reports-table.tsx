"use client";

import { ReactNode, useMemo, useState } from "react";

import { TableCard } from "@/components/data-display/table-card";
import { TableFilterBar } from "@/components/data-display/table-filter-bar";
import { formatDate } from "@/lib/utils/formatters";

interface SavedReportsTableProps {
  items: Array<{ id: string; name: string; dimension: string; metric: string; generatedAt?: string; createdAt: string }>;
  actions: ReactNode;
}

export function SavedReportsTable({ items, actions }: SavedReportsTableProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((item) => item.name.toLowerCase().includes(q)) : items;
  }, [items, search]);

  return (
    <TableCard
      title="Saved report templates"
      items={filtered}
      pageSize={false}
      getRowKey={(item) => item.id}
      emptyState="No saved reports yet. Build one to start tracking a metric over time."
      actions={actions}
      filterBar={
        <TableFilterBar
          search={{ value: search, onChange: setSearch, placeholder: "Search a saved template" }}
          filters={[
            { label: "Group", value: "All groups" },
            { label: "Format", value: "Any" },
            { label: "Schedule", value: "Any" }
          ]}
          note={`${filtered.length} of ${items.length} shown`}
        />
      }
      columns={[
        { key: "name", header: "Template", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.name}</span>, sortValue: (item) => item.name },
        { key: "filters", header: "Filters", render: (item) => <span className="text-[12px] text-[var(--color-text-secondary)]">{item.metric} · grouped by {item.dimension}</span> },
        { key: "format", header: "Format", render: () => <span className="text-[12px] text-[var(--color-text-muted)]">Not built — no export pipeline exists yet</span> },
        { key: "created", header: "Last generated", render: (item) => (item.generatedAt ? formatDate(item.generatedAt) : formatDate(item.createdAt)), sortValue: (item) => item.generatedAt ?? item.createdAt },
        { key: "run", header: "", render: () => <span className="text-[11.5px] font-semibold text-[var(--color-text-muted)]">Runs live — no separate action</span> }
      ]}
    />
  );
}
