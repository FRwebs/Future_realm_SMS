"use client";

import { useMemo, useState } from "react";

import { TableCard } from "@/components/data-display/table-card";
import { TableFilterBar } from "@/components/data-display/table-filter-bar";

interface FeatureRequestTableProps {
  items: Array<{ keyword: string; requestCount: number; schoolsRequesting: number; tiersRequesting: number; priorityScore: number }>;
}

export function FeatureRequestTable({ items }: FeatureRequestTableProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((item) => item.keyword.toLowerCase().includes(q)) : items;
  }, [items, search]);

  return (
    <TableCard
      title="Feature request intelligence"
      description="Ranked by keyword frequency across support tickets tagged as feature requests."
      items={filtered}
      pageSize={false}
      getRowKey={(item) => item.keyword}
      emptyState="No feature-request tickets match this search."
      filterBar={
        <TableFilterBar
          search={{ value: search, onChange: setSearch, placeholder: "Search a request, module or school" }}
          filters={[
            { label: "Source", value: "Support tickets" },
            { label: "Status", value: "Open" }
          ]}
          note={`${filtered.length} of ${items.length} shown`}
        />
      }
      columns={[
        { key: "rank", header: "#", render: (item) => <span className="font-[var(--font-mono)] text-[var(--color-text-muted)]">{String(items.indexOf(item) + 1).padStart(2, "0")}</span> },
        { key: "keyword", header: "Feature request", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.keyword}</span>, sortValue: (item) => item.keyword },
        { key: "schools", header: "Schools", render: (item) => <span className="font-[var(--font-mono)] font-bold text-[var(--color-text-primary)]">{item.schoolsRequesting}</span>, sortValue: (item) => item.schoolsRequesting },
        { key: "tiers", header: "Tier weight", render: (item) => <span className="font-[var(--font-mono)] text-[var(--color-text-secondary)]">{item.tiersRequesting} tier{item.tiersRequesting === 1 ? "" : "s"}</span>, sortValue: (item) => item.tiersRequesting },
        { key: "severity", header: "Severity", render: () => <span className="text-[12px] text-[var(--color-text-muted)]">Not scored</span> },
        { key: "source", header: "Source", render: () => <span className="text-[12px] text-[var(--color-text-muted)]">Support tickets</span> },
        { key: "priority", header: "Priority score", render: (item) => <span className="font-[var(--font-mono)] font-black text-[var(--color-text-primary)]">{item.priorityScore}</span>, sortValue: (item) => item.priorityScore }
      ]}
    />
  );
}
