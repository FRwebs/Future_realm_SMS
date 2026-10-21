"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { TableCard } from "@/components/data-display/table-card";
import { TableFilterBar } from "@/components/data-display/table-filter-bar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";

type Feature = { id: string; name: string; module: string; featureKey: string | null; enforcedAt: string | null; version: number; access: Record<string, boolean> };
type View = { tiers: Array<{ tier: string; schools: number }>; features: Feature[] };

const LABEL: Record<string, string> = { BASIC: "Basic", STANDARD: "Standard", PROFESSIONAL: "Professional", ENTERPRISE: "Enterprise", CUSTOM: "Custom" };

function check(on: boolean) {
  return on ? <span className="font-bold text-[var(--color-success)]">✓</span> : <span className="text-[var(--color-danger)]">✕</span>;
}

export function FeatureMatrixTable({ view, actions }: { view: View; actions: ReactNode }) {
  const [search, setSearch] = useState("");
  const [module, setModule] = useState("All modules");
  const items = view.features;

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
      description="Which features are on each of the five tiers a school is billed on. Changes apply to every school on the tier at once."
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
        {
          key: "name",
          header: "Feature",
          render: (item) => (
            <div>
              <p className="font-semibold text-[var(--color-text-primary)]">{item.name} <span className="text-[10px] font-normal text-[var(--color-text-muted)]">v{item.version}</span></p>
              <p className="text-[10px] text-[var(--color-text-muted)]">{item.enforcedAt ? `Enforced: ${item.enforcedAt}` : "Catalogue only — nothing in the product reads this yet"}</p>
            </div>
          )
        },
        ...view.tiers.map((tier) => ({
          key: tier.tier,
          header: `${LABEL[tier.tier] ?? tier.tier} · ${tier.schools}`,
          render: (item: Feature) => check(Boolean(item.access[tier.tier]))
        })),
        {
          key: "actions",
          header: "Actions",
          render: (item: Feature) =>
            item.featureKey ? (
              <ResourceActionDialog
                triggerLabel="Edit access"
                title={`Manage features · ${item.name}`}
                description="Which tiers have this feature. Taking it away from a tier that has schools on it needs a written migration plan, and those schools are told."
                note="Access changes apply at once to every school on the tier. Nothing a school built is deleted."
                impact={{ label: "On saving", rows: [["A new version is recorded", "With the before and after, your reason, and the schools affected"], ["Schools losing access", "Told in the app, with the migration plan you write"], ["Schools gaining access", "Have it the next time the product checks"]] }}
                endpoint="/api/super-admin/plans-features/matrix"
                method="POST"
                variant="textAction"
                submitLabel="Save access"
                fields={[
                  { name: "featureKey", label: "Feature", type: "select" as const, defaultValue: item.featureKey, options: [{ label: item.name, value: item.featureKey }], section: "Feature" },
                  ...view.tiers.map((tier) => ({ name: tier.tier, label: LABEL[tier.tier] ?? tier.tier, type: "switch" as const, on: Boolean(item.access[tier.tier]), note: `${tier.schools} school${tier.schools === 1 ? "" : "s"} on this tier`, section: "Which tiers have it" })),
                  { name: "reason", label: "Why this is changing", type: "textarea" as const, required: true, section: "Reason" },
                  { name: "migrationPlan", label: "Migration plan (needed when taking access away from schools)", type: "textarea" as const, section: "Reason" }
                ]}
              />
            ) : null
        }
      ]}
    />
  );
}
