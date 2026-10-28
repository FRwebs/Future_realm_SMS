"use client";

import { useMemo, useState } from "react";
import type { z } from "zod";

import { ReadOnlyTable, type ReadOnlyColumn } from "@/components/data-display/read-only-table";
import { Modal } from "@/components/ui/modal";
import { apiJson, getUrl } from "@/lib/api/client";
import { reportRunContract } from "@/lib/api/contracts";

type RunResult = z.infer<typeof reportRunContract>;

const DIMENSIONS = [{ label: "Tier", value: "tier" }, { label: "State", value: "state" }, { label: "Status", value: "status" }];
const METRICS = [{ label: "School count", value: "schoolCount" }, { label: "Student count", value: "studentCount" }, { label: "MRR", value: "mrr" }];

/** Runs a saved report in place. Unless its filters are locked, the reader can regroup it without changing the saved template. */
export function ReportRun({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dimension, setDimension] = useState("");
  const [metric, setMetric] = useState("");
  const [openRow, setOpenRow] = useState<string | null>(null);

  async function run(nextDimension = dimension, nextMetric = metric) {
    setError(null);
    try {
      const data = await apiJson(getUrl("/api/super-admin/analytics-bi/reports/{id}/run", { id }, { dimension: nextDimension || null, metric: nextMetric || null }), undefined, reportRunContract);
      setResult(data);
      setDimension(data.dimension);
      setMetric(data.metric);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The report could not be run.");
    }
  }

  // One column for what the report is grouped by, then the figure, and the extra columns only when this report asks for them.
  const columns = useMemo((): Array<ReadOnlyColumn<RunResult["rows"][number]>> => {
    if (!result) return [];
    return [
      {
        id: "label",
        header: result.dimension,
        sortValue: (row) => row.label,
        className: "font-semibold",
        cell: (row) => (result.showDropoff && row.schoolNames.length > 0 ? <button type="button" onClick={() => setOpenRow(openRow === row.label ? null : row.label)} className="text-left font-semibold text-(--color-text-accent) hover:underline">{row.label}</button> : row.label),
      },
      { id: "value", header: result.metric, sortValue: (row) => (row.suppressed ? -1 : (row.value ?? -1)), cell: (row) => (row.suppressed ? <span className="text-(--color-text-muted)">under {result.suppressUnder} schools — withheld</span> : row.value?.toLocaleString()) },
      ...(result.compare ? [{ id: "previous", header: "Previous period", sortValue: (row: RunResult["rows"][number]) => row.previous ?? -1, cell: (row: RunResult["rows"][number]) => (row.previous === null ? "—" : row.previous.toLocaleString()) }] : []),
      ...(result.showDropoff ? [{ id: "dropoff", header: "Drop-off", sortValue: (row: RunResult["rows"][number]) => row.dropoff ?? -1, cell: (row: RunResult["rows"][number]) => (row.dropoff === null ? "—" : `−${row.dropoff}%`) }] : []),
      ...(result.weightChurned ? [{ id: "churned", header: "Churned (separate)", sortValue: (row: RunResult["rows"][number]) => row.churned ?? -1, cell: (row: RunResult["rows"][number]) => (row.churned === null ? "—" : `${row.churned.toLocaleString()}${row.churnedSchools ? ` · ${row.churnedSchools} school${row.churnedSchools === 1 ? "" : "s"}` : ""}`) }] : []),
    ];
  }, [result, openRow]);

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); void run("", ""); }} className="text-[11.5px] font-semibold text-(--color-text-accent) hover:underline">Run</button>
      <Modal open={open} onClose={() => setOpen(false)} title={name} subtitle={result?.question ?? "Run live against the platform's current records."} size="report">
        {error ? <p className="text-[12.5px] text-danger">{error}</p> : null}
        {result ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-3 text-[12px]">
              <label className="flex items-center gap-2">Segment by
                <select disabled={result.locked} value={dimension} onChange={(event) => { setDimension(event.target.value); void run(event.target.value, metric); }} className="rounded-[8px] border border-(--color-border-default) bg-white px-2 py-1">
                  {DIMENSIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2">Metric
                <select disabled={result.locked} value={metric} onChange={(event) => { setMetric(event.target.value); void run(dimension, event.target.value); }} className="rounded-[8px] border border-(--color-border-default) bg-white px-2 py-1">
                  {METRICS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              {result.locked ? <span className="text-(--color-text-muted)">Filters are locked on this template.</span> : null}
              {result.periodDays ? <span className="text-(--color-text-muted)">Schools that joined in the last {result.periodDays} days{result.compare ? ", against the period before" : ""}.</span> : <span className="text-(--color-text-muted)">All schools on record.</span>}
            </div>
            <ReadOnlyTable
              columns={columns}
              rows={result.rows}
              getRowId={(row) => row.label}
              caption={`${result.name}, by ${result.dimension}`}
              empty={<p className="py-4 text-[12.5px] text-(--color-text-muted)">Nothing matches.</p>}
              headClassName="py-2 text-left text-[11px] font-normal uppercase text-(--color-text-muted)"
              cellClassName="py-2 text-[12.5px]"
              rowClassName="border-b border-(--color-border-muted)"
              after={(row) => (openRow === row.label ? <tr className="border-b border-(--color-border-muted) bg-(--color-bg-subtle)"><td colSpan={columns.length} className="px-2 py-2 text-[11.5px] text-(--color-text-secondary)">{row.schoolNames.join(" · ")}</td></tr> : null)}
            />
            <a href={`/api/super-admin/analytics-bi/reports/${id}/export`} className="text-[12px] font-semibold text-(--color-text-accent) underline">Download as CSV</a>
          </div>
        ) : !error ? <p className="text-[12.5px] text-(--color-text-muted)">Running…</p> : null}
      </Modal>
    </>
  );
}
