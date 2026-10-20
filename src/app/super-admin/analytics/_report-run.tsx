"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/modal";

type RunResult = {
  name: string;
  dimension: string;
  metric: string;
  question: string | null;
  locked: boolean;
  periodDays: number | null;
  compare: boolean;
  suppressUnder: number | null;
  rows: Array<{ label: string; value: number | null; suppressed: boolean; schools: number | null; previous: number | null }>;
};

const DIMENSIONS = [{ label: "Tier", value: "tier" }, { label: "State", value: "state" }, { label: "Status", value: "status" }];
const METRICS = [{ label: "School count", value: "schoolCount" }, { label: "Student count", value: "studentCount" }, { label: "MRR", value: "mrr" }];

/** Runs a saved report in place. Unless its filters are locked, the reader can regroup it without changing the saved template. */
export function ReportRun({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dimension, setDimension] = useState("");
  const [metric, setMetric] = useState("");

  async function run(nextDimension = dimension, nextMetric = metric) {
    setError(null);
    const query = new URLSearchParams();
    if (nextDimension) query.set("dimension", nextDimension);
    if (nextMetric) query.set("metric", nextMetric);
    try {
      const response = await fetch(`/api/super-admin/analytics-bi/reports/${id}/run?${query.toString()}`, { credentials: "include" });
      const body = (await response.json()) as { data?: RunResult; error?: string; message?: string };
      if (!response.ok || !body.data) throw new Error(body.error ?? body.message ?? "The report could not be run.");
      setResult(body.data);
      setDimension(body.data.dimension);
      setMetric(body.data.metric);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The report could not be run.");
    }
  }

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); void run("", ""); }} className="text-[11.5px] font-semibold text-[var(--color-text-accent)] hover:underline">Run</button>
      <Modal open={open} onClose={() => setOpen(false)} title={name} subtitle={result?.question ?? "Run live against the platform's current records."} size="report">
        {error ? <p className="text-[12.5px] text-[var(--color-danger)]">{error}</p> : null}
        {result ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-3 text-[12px]">
              <label className="flex items-center gap-2">Segment by
                <select disabled={result.locked} value={dimension} onChange={(event) => { setDimension(event.target.value); void run(event.target.value, metric); }} className="rounded-[8px] border border-[var(--color-border-default)] bg-white px-2 py-1">
                  {DIMENSIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2">Metric
                <select disabled={result.locked} value={metric} onChange={(event) => { setMetric(event.target.value); void run(dimension, event.target.value); }} className="rounded-[8px] border border-[var(--color-border-default)] bg-white px-2 py-1">
                  {METRICS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              {result.locked ? <span className="text-[var(--color-text-muted)]">Filters are locked on this template.</span> : null}
              {result.periodDays ? <span className="text-[var(--color-text-muted)]">Schools that joined in the last {result.periodDays} days{result.compare ? ", against the period before" : ""}.</span> : <span className="text-[var(--color-text-muted)]">All schools on record.</span>}
            </div>
            <table className="w-full text-left text-[12.5px]">
              <thead><tr className="border-b border-[var(--color-border-default)] text-[11px] uppercase text-[var(--color-text-muted)]"><th className="py-2">{result.dimension}</th><th>{result.metric}</th>{result.compare ? <th>Previous period</th> : null}</tr></thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.label} className="border-b border-[var(--color-border-muted)]">
                    <td className="py-2 font-semibold">{row.label}</td>
                    <td>{row.suppressed ? <span className="text-[var(--color-text-muted)]">under {result.suppressUnder} schools — withheld</span> : row.value?.toLocaleString()}</td>
                    {result.compare ? <td>{row.previous === null ? "—" : row.previous.toLocaleString()}</td> : null}
                  </tr>
                ))}
                {result.rows.length === 0 ? <tr><td className="py-4 text-[var(--color-text-muted)]" colSpan={3}>Nothing matches.</td></tr> : null}
              </tbody>
            </table>
            <a href={`/api/super-admin/analytics-bi/reports/${id}/export`} className="text-[12px] font-semibold text-[var(--color-text-accent)] underline">Download as CSV</a>
          </div>
        ) : !error ? <p className="text-[12.5px] text-[var(--color-text-muted)]">Running…</p> : null}
      </Modal>
    </>
  );
}
