"use client";

import { useMemo, useState } from "react";

import { TableFilterBar } from "@/components/data-display/table-filter-bar";

import { HeatCell, moduleLabel } from "./_shared";

interface ModuleAdoptionTableProps {
  trends?: Array<{ module: string; points: Array<number | null> }>;
  heatmapByTier: Array<{ module: string; cells: Array<number | null> }>;
  tierColumns: Array<{ plan: string; schoolCount: number }>;
  schoolsInScope: number;
}

function Spark({ points }: { points: Array<number | null> }) {
  const values = points.filter((p): p is number => p !== null);
  if (values.length < 2) return <span className="text-[10px] text-[#9FB8A7]">{values.length === 1 ? `${values[0]}% · first reading` : "No readings yet"}</span>;
  const max = Math.max(...values, 1);
  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${(i / (values.length - 1)) * 60} ${18 - (v / max) * 16}`).join(" ");
  return <svg width="60" height="20" viewBox="0 0 60 20" aria-label={`${values.length}-week trend`}><path d={path} fill="none" stroke="#12796A" strokeWidth="1.5" /></svg>;
}

const MIN_SCHOOL_OPTIONS = ["0", "5", "10", "25", "50"];

export function ModuleAdoptionTable({ trends = [], heatmapByTier, tierColumns, schoolsInScope }: ModuleAdoptionTableProps) {
  const [minSchools, setMinSchools] = useState("0");

  const visibleTierIndexes = useMemo(() => {
    const threshold = Number(minSchools);
    return tierColumns.map((_, index) => index).filter((index) => tierColumns[index].schoolCount >= threshold);
  }, [tierColumns, minSchools]);

  const cols = `2.1fr repeat(${visibleTierIndexes.length},1fr) 1.25fr`;

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-[var(--color-border-default)] px-5 py-4">
        <p className="text-[12.5px] font-bold text-[var(--color-text-primary)]">Module adoption by tier</p>
        <p className="mt-1 text-[10.5px] text-[var(--color-text-muted)]">
          Share of schools on each tier that did something in the module in the last 60 days — counted from their records, not from a switch. The last column is the weekly reading over the past twelve weeks; it fills in as weeks pass.
        </p>
      </div>

      <TableFilterBar
        filters={[
          { label: "Period", value: "Last 60 days" },
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
          <div className="min-w-0 text-[9.5px] font-semibold uppercase tracking-[0.05em] text-[#5f6e65]">Module</div>
          {visibleTierIndexes.map((index) => (
            <div key={tierColumns[index].plan} className="min-w-0 text-center text-[9.5px] font-semibold uppercase tracking-[0.04em] text-[#5f6e65]">
              <div>{tierColumns[index].plan}</div>
              <div className="mt-[2.5px] overflow-hidden text-ellipsis whitespace-nowrap text-[9px] font-medium normal-case tracking-normal text-[#B4C4BB]">
                {tierColumns[index].schoolCount} school{tierColumns[index].schoolCount === 1 ? "" : "s"}
              </div>
            </div>
          ))}
          <div className="text-right text-[9.5px] font-semibold uppercase tracking-[0.04em] text-[#5f6e65]">12-week trend</div>
        </div>

        {heatmapByTier.length === 0 ? (
          <p className="py-6 text-center text-[11.5px] text-[var(--color-text-muted)]">No module usage recorded yet.</p>
        ) : (
          heatmapByTier.map((row) => (
            <div key={row.module} className="grid items-center gap-1.5 py-[2.5px]" style={{ gridTemplateColumns: cols }}>
              <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[#0D2315]">{moduleLabel(row.module)}</div>
              {visibleTierIndexes.map((index) => (
                <div key={index} className="flex justify-center">
                  <HeatCell value={row.cells[index] ?? null} />
                </div>
              ))}
              <div className="flex justify-end"><Spark points={trends.find((t) => t.module === row.module)?.points ?? []} /></div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
