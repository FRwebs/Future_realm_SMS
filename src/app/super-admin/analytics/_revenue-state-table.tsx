"use client";

import { useMemo, useState } from "react";

import { TableCard } from "@/components/data-display/table-card";
import { TableFilterBar } from "@/components/data-display/table-filter-bar";
import { formatCurrency } from "@/lib/utils/formatters";

interface RevenueStateTableProps {
  items: Array<{
    state: string;
    revenue: number;
    schoolCount: number;
    arpu: number;
    topCity: string | null;
    newSchools90d: number;
  }>;
}

export function RevenueStateTable({ items }: RevenueStateTableProps) {
  const [search, setSearch] = useState("");
  const [state, setState] = useState("All states");

  const stateOptions = useMemo(() => ["All states", ...Array.from(new Set(items.map((item) => item.state))).sort()], [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesState = state === "All states" || item.state === state;
      const matchesSearch = !q || item.state.toLowerCase().includes(q) || (item.topCity ?? "").toLowerCase().includes(q);
      return matchesState && matchesSearch;
    });
  }, [items, search, state]);

  return (
    <TableCard
      title="Revenue by state and city"
      description="Where the platform's schools and revenue are concentrated, and where growth is coming from. A state figure that cannot be traced to named schools is not a figure anyone should act on — open any row to see them."
      items={filtered}
      pageSize={false}
      emptyState="No state matches this filter."
      filterBar={
        <TableFilterBar
          search={{ value: search, onChange: setSearch, placeholder: "Search by state or city" }}
          filters={[
            { label: "Region", value: state, options: stateOptions.map((value) => ({ label: value, value })), onChange: setState },
            { label: "Period", value: "This term" }
          ]}
          note={`${filtered.length} of ${items.length} shown`}
        />
      }
      columns={[
          { key: "state", header: "State", render: (item) => item.state },
          { key: "topCity", header: "Top city", render: (item) => item.topCity ?? "—" },
          { key: "schools", header: "Schools", render: (item) => item.schoolCount },
          { key: "revenue", header: "MRR", render: (item) => formatCurrency(item.revenue) },
          { key: "arpu", header: "ARPU", render: (item) => formatCurrency(item.arpu) },
          {
            key: "trend",
            header: "Trend",
            render: (item) =>
              item.newSchools90d > 0 ? (
                <span className="font-semibold" style={{ color: "var(--color-success)" }}>
                  +{item.newSchools90d} school{item.newSchools90d === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="text-[var(--color-text-muted)]">Steady</span>
              )
          },
          {
            key: "open",
            header: "",
            render: (item) => (
              <a href={`/super-admin/schools?state=${encodeURIComponent(item.state)}`} className="font-semibold text-[var(--color-text-accent)] underline">
                View schools
              </a>
            )
          }
        ]}
    />
  );
}
