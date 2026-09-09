"use client";

import { useMemo, useState } from "react";

import { TableFilterBar } from "@/components/data-display/table-filter-bar";

import { HeatCell, moduleLabel } from "./_shared";

interface ModuleAdoptionTableProps {
  heatmapByTier: Array<{ module: string; cells: Array<number | null> }>;
  tierColumns: Array<{ plan: string; schoolCount: number }>;
  schoolsInScope: number;
}

const MIN_SCHOOL_OPTIONS = ["0", "5", "10", "25", "50"];

export function ModuleAdoptionTable({ heatmapByTier, tierColumns, schoolsInScope }: ModuleAdoptionTableProps) {
  const [minSchools, setMinSchools] = useState("0");

  const visibleTierIndexes = useMemo(() => {
    const threshold = Number(minSchools);
    return tierColumns.map((_, index) => index).filter((index) => tierColumns[index].schoolCount >= threshold);
  }, [tierColumns, minSchools]);

  const cols = `2.1fr repeat(${visibleTierIndexes.length},1fr) 1.25fr`;

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-[var(--color-border-default)] px-5 py-4">
        <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Module adoption by tier</p>
        <p className="mt-1 text-[11.5px] text-[var(--color-text-muted)]">
          Share of schools on each tier with the module switched on — a real usage signal, not an entitlement gate. Every school gets every module at signup and enables or disables it from its own configuration.
        </p>
      </div>

      <TableFilterBar
        filters={[
          { label: "Period", value: "Last 7 days" },
          { label: "Cohort", value: "All cohorts" },
          { label: "Region", value: "All states" },
          {
            label: "Minimum schools",
            value: minSchools,
            options: MIN_SCHOOL_OPTIONS.map((value) => ({ label: value, value })),
            onChange: setMinSchools
          }
        ]}
        note={`${schoolsInScope} active school${schoolsInScope === 1 ? "" : "s"} in scope`}
      />

      <div className="px-5 py-3.5">
        <div className="grid items-end gap-1.5 border-b border-[#EDF3EF] pb-2.5" style={{ gridTemplateColumns: cols }}>
          <div className="min-w-0 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[#8C9A92]">Module</div>
          {visibleTierIndexes.map((index) => (
            <div key={tierColumns[index].plan} className="min-w-0 text-center text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[#8C9A92]">
              <div>{tierColumns[index].plan}</div>
              <div className="mt-[3px] overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-medium normal-case tracking-normal text-[#B4C4BB]">
                {tierColumns[index].schoolCount} school{tierColumns[index].schoolCount === 1 ? "" : "s"}
              </div>
            </div>
          ))}
          <div className="text-right text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[#8C9A92]">12-week trend</div>
        </div>

        {heatmapByTier.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] text-[var(--color-text-muted)]">No module usage recorded yet.</p>
        ) : (
          heatmapByTier.map((row) => (
            <div key={row.module} className="grid items-center gap-1.5 py-[3px]" style={{ gridTemplateColumns: cols }}>
              <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-[#0D2315]">{moduleLabel(row.module)}</div>
              {visibleTierIndexes.map((index) => (
                <div key={index} className="flex justify-center">
                  <HeatCell value={row.cells[index] ?? null} />
                </div>
              ))}
              <div className="text-right text-[11px] text-[#9FB8A7]">Not tracked</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
