"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { TableCard } from "@/components/data-display/table-card";
import { TableFilterBar } from "@/components/data-display/table-filter-bar";
import type { SuperAdminTierFeatureRow } from "@/lib/domain/types";

function check(on: boolean) {
  return on ? <span className="font-bold text-[var(--color-success)]">✓</span> : <span className="text-[var(--color-danger)]">✕</span>;
}

export function FeatureMatrixTable({ items, actions }: { items: SuperAdminTierFeatureRow[]; actions: ReactNode }) {
  const [search, setSearch] = useState("");
  const [module, setModule] = useState("All modules");

  const moduleOptions = useMemo(() => ["All modules", ...Array.from(new Set(items.map((item) => item.module))).sort()], [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !q || item.name.toLowerCase().includes(q);
      const matchesModule = module === "All modules" || item.module === module;
      return matchesSearch && matchesModule;
    });
  }, [items, search, module]);

  return (
    <TableCard
      title="Feature matrix"
      description="Which features are available on each subscription tier. Changes apply to new subscriptions and upgrades."
      items={filtered}
      actions={actions}
      emptyState="No matrix features match this filter."
      getRowKey={(item) => item.id}
      filterBar={
        <TableFilterBar
          search={{ value: search, onChange: setSearch, placeholder: "Search a feature" }}
          filters={[{ label: "Module", value: module, options: moduleOptions.map((value) => ({ label: value, value })), onChange: setModule }]}
          note={`${filtered.length} of ${items.length} shown`}
        />
      }
      columns={[
        { key: "module", header: "Module", render: (item) => item.module },
        { key: "name", header: "Feature", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.name}</span> },
        { key: "starter", header: "Starter", render: (item) => check(item.starterAccess) },
        { key: "standard", header: "Standard", render: (item) => check(item.standardAccess) },
        { key: "elite", header: "Elite", render: (item) => check(item.eliteAccess) }
      ]}
    />
  );
}
