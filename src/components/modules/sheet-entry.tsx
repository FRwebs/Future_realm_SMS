"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { DrawerSpec, SheetEntryPanel } from "@/lib/modules/panels";
import { sendJson } from "@/lib/modules/submit";
import { INK, MUTED, toneOf } from "@/lib/modules/tones";

/**
 * Entering a score sheet: every child against every component of one subject. Every column head carries
 * its maximum; a mark is a number, an A is absent, and an empty cell is a score nobody has entered —
 * never a zero. The total, grade and state of each row recompute as you type, and nothing leaves this
 * page until it has been previewed.
 */

const PER = 15;
const SHELL = "min-w-0 overflow-hidden rounded-[14px] border bg-[var(--color-bg-surface)] px-[18px] pb-[12px]";

type Cells = Record<string, Record<string, string>>;

const clean = (raw: string): string => {
  const upper = raw.toUpperCase();
  if (upper.includes("A")) return "ABS";
  const digits = upper.replace(/[^0-9.]/g, "");
  return digits.slice(0, 5);
};

const initial = (panel: SheetEntryPanel): Cells =>
  Object.fromEntries(panel.rows.map((row) => [row.id, Object.fromEntries(panel.columns.map((column) => [column.key, row.cells[column.key] === null || row.cells[column.key] === undefined ? "" : String(row.cells[column.key])]))]));

function gradeOf(bands: Array<{ label: string; min: number }>, total: number): string {
  return bands.find((band) => total >= band.min)?.label ?? bands[bands.length - 1]?.label ?? "—";
}

export function SheetEntry({ panel, openDrawer }: { panel: SheetEntryPanel; openDrawer: (spec: DrawerSpec) => void }) {
  const router = useRouter();
  const [baseline, setBaseline] = useState<Cells>(() => initial(panel));
  const [cells, setCells] = useState<Cells>(() => initial(panel));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(0);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = Boolean(panel.whyNot);
  const maxTotal = panel.columns.reduce((sum, column) => sum + column.max, 0);

  const read = useMemo(
    () =>
      panel.rows.map((row) => {
        let total = 0;
        let blank = 0;
        let absent = 0;
        let bad = 0;
        let entered = 0;
        for (const column of panel.columns) {
          const value = cells[row.id]?.[column.key] ?? "";
          if (value === "") blank += 1;
          else if (value === "ABS") absent += 1;
          else {
            const number = Number(value);
            if (Number.isNaN(number) || number > column.max) bad += 1;
            else {
              total += number;
              entered += 1;
            }
          }
        }
        const done = blank === 0 && bad === 0;
        return { row, total: entered ? total : null, blank, absent, bad, done, grade: done && entered ? gradeOf(panel.bands, total) : null, state: bad ? "Out of range" : blank ? "Blank" : "Scored" };
      }),
    [cells, panel.bands, panel.columns, panel.rows],
  );

  const stats = useMemo(() => {
    const scored = read.filter((entry) => entry.done);
    const totals = scored.map((entry) => entry.total).filter((value): value is number => value !== null);
    return {
      entered: scored.length,
      total: read.length,
      blankRows: read.filter((entry) => entry.blank > 0).length,
      absent: read.reduce((sum, entry) => sum + entry.absent, 0),
      bad: read.reduce((sum, entry) => sum + entry.bad, 0),
      average: totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : null,
    };
  }, [read]);

  const dirty = useMemo(() => panel.rows.some((row) => panel.columns.some((column) => (cells[row.id]?.[column.key] ?? "") !== (baseline[row.id]?.[column.key] ?? ""))), [baseline, cells, panel.columns, panel.rows]);
  useEffect(() => {
    if (!dirty || locked) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, locked]);

  const visible = read.filter((entry) => {
    const needle = query.trim().toLowerCase();
    if (needle && !entry.row.name.toLowerCase().includes(needle) && !entry.row.adm.toLowerCase().includes(needle)) return false;
    return filter === "All" || entry.state === filter;
  });
  const pages = Math.max(1, Math.ceil(visible.length / PER));
  const current = Math.min(page, pages - 1);
  const shown = visible.slice(current * PER, current * PER + PER);

  const changes = () =>
    panel.rows
      .map((row) => ({ studentId: row.id, cells: Object.fromEntries(panel.columns.filter((column) => (cells[row.id]?.[column.key] ?? "") !== (baseline[row.id]?.[column.key] ?? "")).map((column) => [column.key, cells[row.id]?.[column.key] ?? ""])) }))
      .filter((entry) => Object.keys(entry.cells).length);

  async function save(quiet = false): Promise<boolean> {
    if (stats.bad) {
      setNote({ tone: "error", text: `${stats.bad} ${stats.bad === 1 ? "mark is" : "marks are"} above the maximum for its column. Correct ${stats.bad === 1 ? "it" : "them"} first.` });
      return false;
    }
    const rows = changes();
    if (!rows.length) {
      if (!quiet) setNote({ tone: "ok", text: "Nothing has changed since the last save." });
      return true;
    }
    setBusy(true);
    try {
      const { queued } = await sendJson(panel.saveEndpoint, "POST", { rows });
      setBaseline(cells);
      if (queued) setNote({ tone: "ok", text: "No connection — these marks are held on this device and go to the school by themselves when it is back online. The sheet does not have them yet." });
      else if (!quiet) setNote({ tone: "ok", text: `Draft saved. Nothing has been submitted — the sheet stays with you until you preview and submit it.` });
      return true;
    } catch (cause) {
      setNote({ tone: "error", text: cause instanceof Error ? cause.message : "The draft could not be saved." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function preview() {
    if (await save(true)) router.push(panel.previewHref as Route);
  }

  function type(studentId: string, key: string, raw: string) {
    setNote(null);
    setCells((existing) => ({ ...existing, [studentId]: { ...existing[studentId], [key]: clean(raw) } }));
  }

  const kpi = (label: string, value: string, sub: string, tone?: "positive" | "attention" | "negative" | "withheld" | "neutral") => (
    <div className="min-w-0 rounded-[12px] border bg-white px-[14px] py-[12px]" style={{ borderColor: "#E4EDE8" }}>
      <p className="text-[9.5px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>{label}</p>
      <p className="mt-[5px] text-[22px] font-bold leading-none tabular-nums" style={{ color: tone && tone !== "neutral" ? toneOf(tone).fg : INK }}>{value}</p>
      <p className="mt-[5px] text-[10.5px] leading-[1.4]" style={{ color: MUTED }}>{sub}</p>
    </div>
  );

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {kpi("Entered", `${stats.entered} of ${stats.total}`, "A fraction, never a percentage", stats.blankRows ? "attention" : "positive")}
        {kpi("Class average", stats.average === null ? "—" : String(stats.average), "Recomputes as you type")}
        {kpi("Blank", String(stats.blankRows), "Blank is not zero", stats.blankRows ? "attention" : "neutral")}
        {kpi("Absent", String(stats.absent), "Excluded from the average, not scored zero", "withheld")}
        {kpi("Out of range", String(stats.bad), stats.bad ? "Above the column maximum" : "Every entry is within its maximum", stats.bad ? "negative" : "positive")}
      </div>

      {panel.whyNot ? (
        <div className="rounded-[12px] border px-[14px] py-[11px]" style={{ background: "#FDF6E7", borderColor: "#F2E4C6" }}>
          <p className="text-[12px] font-bold" style={{ color: "#8A6410" }}>This sheet cannot be typed into</p>
          <p className="mt-[4px] text-[11px] leading-[1.55]" style={{ color: "#8A6410" }}>{panel.whyNot}</p>
        </div>
      ) : (
        <div className="rounded-[12px] border px-[14px] py-[11px]" style={{ background: "#EBF1FA", borderColor: "#DCE7F5" }}>
          <p className="text-[12px] font-bold" style={{ color: "#2A5A96" }}>{panel.frameworkLabel}</p>
          <p className="mt-[4px] text-[11px] leading-[1.55]" style={{ color: "#2A5A96" }}>The rules in force when a score was entered cannot change beneath you — a framework published tomorrow does not restate this sheet.</p>
        </div>
      )}

      {note ? (
        <div className="rounded-[12px] border px-[14px] py-[10px]" style={note.tone === "ok" ? { background: "#EAF6F0", borderColor: "#CFE4DB" } : { background: "#FDF2F2", borderColor: "#F3D2D2" }}>
          <p className="text-[11.5px] font-semibold" style={{ color: note.tone === "ok" ? "#17714F" : "#A32B2B" }}>{note.text}</p>
        </div>
      ) : null}

      <section className={SHELL} style={{ borderColor: "#DEE8E2" }} aria-label={`Score grid · ${panel.subject}, ${panel.arm}`}>
        <div className="-mx-[18px] flex flex-wrap items-start justify-between gap-[14px] border-b px-[18px] pb-[12px] pt-[14px]" style={{ borderColor: "#EDF3EF" }}>
          <div className="min-w-0 flex-[1_1_260px]">
            <h3 className="text-[12.5px] font-semibold" style={{ color: INK }}>Score grid · {panel.subject}, {panel.arm}</h3>
            <p className="mt-[3.5px] text-[10.5px] leading-[1.5]" style={{ color: MUTED }}>Every column head carries its maximum. Type a mark, or A for absent.</p>
          </div>
          <p className="text-right text-[10.5px] leading-[1.45]" style={{ color: MUTED }}>{panel.rows.length} children · {panel.status}</p>
        </div>
        <div className="-mx-[18px] flex flex-wrap items-center gap-[8px] border-b px-[18px] py-[10px]" style={{ borderColor: "#EDF3EF", background: "#FAFCFB" }}>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Find a child by name or admission number" aria-label="Find a child" className="min-w-[200px] flex-1 rounded-[9px] border bg-white px-[11px] py-[7px] text-[11.5px]" style={{ borderColor: "#DEE8E2" }} />
          <select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(0); }} aria-label="State" className="rounded-[9px] border bg-white px-[10px] py-[7px] text-[11.5px]" style={{ borderColor: "#DEE8E2" }}>
            {["All", "Scored", "Blank", "Out of range"].map((option) => <option key={option} value={option}>{option === "All" ? "State · All" : option}</option>)}
          </select>
          <button type="button" disabled={locked || busy} onClick={() => save()} className="rounded-[8px] border bg-white px-[10px] py-[6px] text-[10.5px] font-semibold disabled:opacity-50" style={{ borderColor: "#DEE8E2", color: "#435048" }}>{busy ? "Saving…" : "Save as a draft"}</button>
          <button type="button" disabled={locked || busy} onClick={preview} className="rounded-[8px] px-[11px] py-[6.5px] text-[10.5px] font-semibold text-white disabled:opacity-50" style={{ background: INK }}>Preview the whole sheet</button>
        </div>

        <div className="-mx-[18px] overflow-x-auto">
          <table className="w-full border-collapse text-left" style={{ minWidth: 520 + panel.columns.length * 74 }}>
            <thead>
              <tr style={{ background: "#F7FAF8" }}>
                <th className="px-[18px] py-[8px] text-[9.5px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>Child</th>
                {panel.columns.map((column) => (
                  <th key={column.key} title={`${column.name} · out of ${column.max} · weight ${column.weight}`} className="px-[6px] py-[8px] text-center text-[9.5px] font-bold uppercase tracking-[0.04em]" style={{ color: MUTED }}>{column.short} /{column.max}</th>
                ))}
                <th className="px-[8px] py-[8px] text-center text-[9.5px] font-bold uppercase tracking-[0.04em]" style={{ color: MUTED }}>Total /{maxTotal}</th>
                <th className="px-[8px] py-[8px] text-center text-[9.5px] font-bold uppercase tracking-[0.04em]" style={{ color: MUTED }}>Grade</th>
                <th className="px-[8px] py-[8px] text-[9.5px] font-bold uppercase tracking-[0.04em]" style={{ color: MUTED }}>State</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((entry) => {
                const stateTone = entry.state === "Out of range" ? "negative" : entry.state === "Blank" ? "attention" : "positive";
                const swatch = toneOf(stateTone);
                const gradeColour = entry.grade === null ? "#C2D2C8" : /^[AB]/.test(entry.grade) ? "#17714F" : /^[C]/.test(entry.grade) ? "#4A44A0" : /^[DE]/.test(entry.grade) ? "#8A6410" : "#B23B3B";
                return (
                  <tr key={entry.row.id} className="border-t" style={{ borderColor: "#F0F5F2" }}>
                    <td className="px-[18px] py-[7px]">
                      <p className="text-[11.5px] font-semibold" style={{ color: INK }}>{entry.row.name}</p>
                      <p className="font-mono text-[10px]" style={{ color: MUTED }}>{entry.row.adm}</p>
                    </td>
                    {panel.columns.map((column) => {
                      const value = cells[entry.row.id]?.[column.key] ?? "";
                      const absent = value === "ABS";
                      const bad = !absent && value !== "" && (Number.isNaN(Number(value)) || Number(value) > column.max);
                      return (
                        <td key={column.key} className="px-[4px] py-[5px] text-center">
                          <input
                            value={value}
                            disabled={locked}
                            inputMode="decimal"
                            placeholder="–"
                            aria-label={`${column.name} out of ${column.max} — ${entry.row.name}`}
                            onChange={(event) => type(entry.row.id, column.key, event.target.value)}
                            className="w-[60px] rounded-[8px] border px-[6px] py-[6px] text-center text-[11.5px] font-semibold tabular-nums disabled:bg-[#F4F6F5]"
                            style={absent ? { background: "#F5F0FA", borderColor: "#E7DDF2", color: "#6B4E9E", fontSize: 10, letterSpacing: "0.04em" } : bad ? { background: "#FDF3F3", borderColor: "#E8B4B4", color: "#B23B3B" } : { borderColor: "#DEE8E2", color: INK }}
                          />
                        </td>
                      );
                    })}
                    <td className="px-[8px] py-[7px] text-center font-mono text-[11.5px] font-bold" style={{ color: entry.done ? INK : "#C2D2C8" }}>{entry.done && entry.total !== null ? entry.total : "—"}</td>
                    <td className="px-[8px] py-[7px] text-center text-[11.5px] font-bold" style={{ color: gradeColour }}>{entry.grade ?? "—"}</td>
                    <td className="px-[8px] py-[7px]">
                      <span className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border px-[8px] py-[2px] text-[10px] font-semibold" style={{ background: swatch.bg, color: swatch.fg, borderColor: swatch.bd }}>
                        <span className="h-[5px] w-[5px] rounded-full" style={{ background: swatch.dot }} />
                        {entry.state}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!shown.length ? <tr><td colSpan={panel.columns.length + 4} className="px-[18px] py-[24px] text-center text-[11.5px]" style={{ color: MUTED }}>{panel.rows.length ? "Nobody matches that." : "Nobody is on this arm's roll."}</td></tr> : null}
            </tbody>
          </table>
        </div>

        <div className="-mx-[18px] -mb-[12px] flex flex-wrap items-center justify-between gap-[10px] border-t px-[18px] py-[10px]" style={{ borderColor: "#EDF3EF", background: "#F7FAF8" }}>
          <p className="max-w-[560px] text-[10.5px] leading-[1.5]" style={{ color: MUTED }}>A = absent, excluded from the average. A blank cell is not a zero — it is a score that has not been entered.</p>
          <div className="flex flex-wrap items-center gap-[6px]">
            {pages > 1 ? (
              <>
                <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="rounded-[7px] border bg-white px-[9px] py-[4px] text-[10.5px] font-semibold disabled:opacity-40" style={{ borderColor: "#DEE8E2" }}>Previous</button>
                <span className="text-[10.5px]" style={{ color: MUTED }}>Page {current + 1} of {pages}</span>
                <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="rounded-[7px] border bg-white px-[9px] py-[4px] text-[10.5px] font-semibold disabled:opacity-40" style={{ borderColor: "#DEE8E2" }}>Next</button>
              </>
            ) : null}
            <button type="button" disabled={locked || busy} onClick={() => save()} className="rounded-[8px] border bg-white px-[10px] py-[6px] text-[10.5px] font-semibold disabled:opacity-50" style={{ borderColor: "#DEE8E2", color: "#435048" }}>Save as a draft</button>
            {panel.remove && panel.status !== "Not started" ? (
              <button type="button" disabled={locked} onClick={() => openDrawer(panel.remove as DrawerSpec)} className="rounded-[8px] border bg-white px-[10px] py-[6px] text-[10.5px] font-semibold disabled:opacity-50" style={{ borderColor: "#E8B4B4", color: "#B23B3B" }}>Delete this entry</button>
            ) : null}
            <button type="button" disabled={locked || busy} onClick={preview} className="rounded-[8px] px-[11px] py-[6.5px] text-[10.5px] font-semibold text-white disabled:opacity-50" style={{ background: INK }}>Preview, then submit for approval</button>
          </div>
        </div>
      </section>
      <p className="text-[10.5px]" style={{ color: MUTED }}>
        <Link href={panel.backHref as Route} className="font-semibold underline">Back to choosing a sheet</Link>
      </p>
    </div>
  );
}
