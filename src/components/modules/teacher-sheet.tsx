"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useEffect, useMemo, useRef, useState } from "react";

import { PanelView } from "@/components/modules/panel-renderer";
import type { DrawerSpec, KpiCard, PanelAction, PanelTone, TableCellKind, TableRow } from "@/lib/modules/panels";
import { sendJson } from "@/lib/modules/submit";
import { readDevicePreferences } from "@/lib/preferences";
import { toneOf } from "@/lib/modules/tones";
import { usePhoneKind } from "@/components/layout/phone-shell";

/**
 * A teacher's score sheet, as the teacher mockup draws it: one subject-arm, every child down the page, every component across it.
 * A mark is a number, an A is absent, and an empty cell is a score nobody has entered — never a zero. The total, the grade and the
 * state of each row recompute as you type; the figures above the table are counted from what is typed, not from what was last saved.
 */

const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
const OFF = "M3 3l18 18M8.5 8.5a9 9 0 0 1 11 1.4M5 12.5a9 9 0 0 1 3-2M9 16a4 4 0 0 1 6 0M12 19.5h.01";

type Column = { key: string; id?: string | null; name: string; short: string; max: number; weight?: number };
type Row = { id: string; name: string; adm: string; roll: number; cells: Record<string, number | "ABS" | null> };
type Switcher = { label: string; value: string; options: Array<{ label: string; href: string }> };
type Cells = Record<string, Record<string, string>>;

export type TeacherSheetProps = {
  arm: string;
  subject: string;
  window: string;
  columns: Column[];
  rows: Row[];
  bands: Array<{ label: string; min: number }>;
  /** Null when the sheet can be typed into; otherwise why not. */
  whyNot: string | null;
  returned: { note: string; by: string | null } | null;
  saveEndpoint: string;
  previewHref: string;
  importHref: string | null;
  switchers: Switcher[];
  remove?: DrawerSpec;
  frameworkLabel: string;
  passMark: number;
  openDrawer?: (spec: DrawerSpec) => void;
};

const clean = (raw: string): string => {
  const upper = raw.toUpperCase();
  if (upper.includes("A")) return "ABS";
  return upper.replace(/[^0-9.]/g, "").slice(0, 5);
};
const gradeOf = (bands: Array<{ label: string; min: number }>, total: number) => bands.find((band) => total >= band.min)?.label ?? bands[bands.length - 1]?.label ?? "—";
const gradeTone = (grade: string | null): PanelTone => (!grade ? "neutral" : /^[AB]/.test(grade) ? "positive" : /^C/.test(grade) ? "submitted" : /^D/.test(grade) ? "attention" : "negative");
const initial = (rows: Row[], columns: Column[]): Cells => Object.fromEntries(rows.map((row) => [row.id, Object.fromEntries(columns.map((column) => [column.key, row.cells[column.key] === null || row.cells[column.key] === undefined ? "" : String(row.cells[column.key])]))]));

export function TeacherSheet(props: TeacherSheetProps) {
  const phone = usePhoneKind() !== null;
  const { columns, rows, bands, columns: cols } = props;
  const router = useRouter();
  const [baseline, setBaseline] = useState<Cells>(() => initial(rows, columns));
  const [cells, setCells] = useState<Cells>(() => initial(rows, columns));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [find, setFind] = useState("");
  const [only, setOnly] = useState("All");
  const [offline, setOffline] = useState(false);
  const locked = Boolean(props.whyNot);
  const openDrawer = props.openDrawer ?? (() => undefined);
  const maxTotal = columns.reduce((sum, column) => sum + column.max, 0);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);

  const read = useMemo(
    () =>
      rows.map((row) => {
        let total = 0;
        let blank = 0;
        let abs = 0;
        let bad = 0;
        columns.forEach((column) => {
          const value = cells[row.id]?.[column.key] ?? "";
          if (value === "ABS") { abs += 1; return; }
          if (value === "") { blank += 1; return; }
          const number = Number(value);
          if (Number.isNaN(number) || number > column.max) { bad += 1; return; }
          total += number;
        });
        const complete = blank === 0 && bad === 0;
        const state = bad ? "Out of range" : blank === columns.length ? "Blank" : blank ? "Part entered" : abs ? "Absent" : "Scored";
        return { row, total, blank, abs, bad, complete, ranked: complete && abs === 0, grade: complete ? gradeOf(bands, total) : null, state };
      }),
    [bands, cells, columns, rows],
  );

  const stats = useMemo(() => {
    const ranked = read.filter((entry) => entry.ranked);
    return {
      roll: read.length,
      complete: read.filter((entry) => entry.complete).length,
      ranked: ranked.length,
      blankRows: read.filter((entry) => entry.blank > 0).length,
      abs: read.reduce((sum, entry) => sum + entry.abs, 0),
      bad: read.reduce((sum, entry) => sum + entry.bad, 0),
      avg: ranked.length ? Math.round((ranked.reduce((sum, entry) => sum + entry.total, 0) / ranked.length) * 10) / 10 : null,
    };
  }, [read]);

  const changes = () =>
    rows
      .map((row) => ({ studentId: row.id, cells: Object.fromEntries(columns.filter((column) => (cells[row.id]?.[column.key] ?? "") !== (baseline[row.id]?.[column.key] ?? "")).map((column) => [column.key, cells[row.id]?.[column.key] ?? ""])) }))
      .filter((entry) => Object.keys(entry.cells).length);
  const dirty = changes().length > 0;
  useEffect(() => {
    if (!dirty || locked) return;
    // Whether to ask before leaving is the person's own choice (Preferences).
    const warn = (event: BeforeUnloadEvent) => { if (readDevicePreferences().confirmLeave) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, locked]);

  async function save(quiet = false): Promise<boolean> {
    if (stats.bad) {
      setNote({ tone: "error", text: `${stats.bad} ${stats.bad === 1 ? "mark is" : "marks are"} above the maximum for its column. Correct ${stats.bad === 1 ? "it" : "them"} first.` });
      return false;
    }
    const pending = changes();
    if (!pending.length) {
      if (!quiet) setNote({ tone: "ok", text: "Nothing has changed since the last save." });
      return true;
    }
    setBusy(true);
    try {
      const { queued } = await sendJson(props.saveEndpoint, "POST", { rows: pending });
      setBaseline(cells);
      if (queued) setNote({ tone: "ok", text: "No connection — these marks are held on this device and go to the school by themselves when it is back online. The sheet does not have them yet." });
      else if (!quiet) setNote({ tone: "ok", text: "Draft saved. Nothing has been submitted — the sheet stays with you until you preview and submit it." });
      return true;
    } catch (cause) {
      setNote({ tone: "error", text: cause instanceof Error ? cause.message : "The draft could not be saved." });
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function preview() {
    if (await save(true)) router.push(props.previewHref as Route);
  }
  // Marks typed here exist only in this page until they are saved. A link that would leave without them says so — and the link to
  // the preview saves first, so the header's "Preview, then submit" does what it says.
  // The click guard is bound while there is something unsaved; it reads the latest preview/router from a ref instead of rebinding for them.
  const latest = useRef({ preview, router });
  useEffect(() => { latest.current = { preview, router }; });
  useEffect(() => {
    if (locked) return;
    const onClick = (event: MouseEvent) => {
      if (!dirty || !readDevicePreferences().confirmLeave || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const link = (event.target as HTMLElement | null)?.closest("a");
      const href = link?.getAttribute("href");
      if (!link || !href || href.startsWith("#") || link.target === "_blank") return;
      event.preventDefault();
      event.stopPropagation();
      if (href === props.previewHref) { void latest.current.preview(); return; }
      if (window.confirm("You have marks that are not saved. Leave without saving them?")) latest.current.router.push(href as Route);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty, locked, props.previewHref]);

  function type(studentId: string, key: string, raw: string) {
    setNote(null);
    setCells((existing) => ({ ...existing, [studentId]: { ...existing[studentId], [key]: clean(raw) } }));
  }

  const k = (label: string, value: string, sub: string, tone?: PanelTone, unit?: string): KpiCard => ({ label, value, unit, sub, tone });
  const blankOnly = read.filter((entry) => entry.bad).length;
  const cards: KpiCard[] = [
    k("Entered", String(stats.complete), stats.complete === stats.roll ? "Every child has a mark" : blankOnly && !stats.blankRows ? `${blankOnly} need correcting` : `${stats.roll - stats.complete} still to enter`, stats.complete === stats.roll ? "positive" : "attention", `of ${stats.roll}`),
    k("Class average", stats.avg === null ? "—" : String(stats.avg), "Recomputes as you type", undefined, stats.ranked ? `/ ${maxTotal}` : undefined),
    k("Blank rows", String(stats.blankRows), "Blank is not zero", stats.blankRows ? "attention" : "neutral"),
    k("Absent", String(stats.abs), "Excluded from the average", stats.abs ? "withheld" : "neutral", stats.abs === 1 ? "mark" : "marks"),
    k("Out of range", String(stats.bad), stats.bad ? "Above the column maximum" : "Every mark is within its maximum", stats.bad ? "negative" : "positive"),
  ];

  const tableRows: TableRow[] = read.map((entry) => {
    const { row } = entry;
    const out: TableCellKind[] = [{ kind: "name", name: row.name, sub: `Roll ${String(row.roll).padStart(2, "0")}` }];
    columns.forEach((column) => {
      const value = cells[row.id]?.[column.key] ?? "";
      const absent = value === "ABS";
      const bad = !absent && value !== "" && (Number.isNaN(Number(value)) || Number(value) > column.max);
      out.push({
        kind: "node", plain: value,
        node: (
          <input
            value={value}
            disabled={locked}
            inputMode="decimal"
            placeholder="–"
            aria-label={`${column.name} out of ${column.max} — ${row.name}`}
            onChange={(event) => type(row.id, column.key, event.target.value)}
            className="w-[56px] rounded-[8px] border px-[6px] py-[6px] text-center text-[11.5px] font-semibold tabular-nums outline-hidden focus:border-[#12796A] disabled:bg-[#F4F6F5]"
            style={absent ? { background: "#F5F0FA", borderColor: "#E7DDF2", color: "#6B4E9E", fontSize: 10, letterSpacing: "0.04em" } : bad ? { background: "#FDF3F3", borderColor: "#E8B4B4", color: "#B23B3B" } : { borderColor: "#DEE8E2", color: "#0D2315" }}
          />
        ),
      });
    });
    out.push(entry.complete ? { kind: "text", text: String(entry.total), mono: true, strong: true } : { kind: "text", text: "—", tone: "neutral" });
    out.push(entry.complete && entry.grade ? { kind: "pill", label: entry.grade, tone: gradeTone(entry.grade) } : { kind: "text", text: "—", tone: "neutral" });
    out.push({ kind: "pill", label: entry.state, tone: entry.state === "Out of range" ? "negative" : entry.state === "Scored" ? "positive" : entry.state === "Absent" ? "withheld" : "attention" });
    return { keywords: `${row.name} ${row.adm} roll ${row.roll} state:${entry.state} grade:${entry.grade ?? "none"}|`, cells: out };
  });

  const previewAct: PanelAction = { label: "Preview, then submit", primary: true, run: () => { void preview(); } };
  const saveDraft: PanelAction = { label: busy ? "Saving…" : "Save as a draft", run: () => { void save(); } };
  const gradeOptions = ["All", ...bands.map((band) => band.label)];
  const states = ["All", "Blank", "Part entered", "Scored", "Absent", "Out of range"];

  return (
    <div className="grid min-w-0 gap-[14px]">
      {props.returned ? (
        <PanelView
          openDrawer={openDrawer}
          panel={{
            type: "note", tone: "negative", icon: WARN, title: props.returned.by ? `Returned by ${props.returned.by}` : "Returned for correction",
            body: `“${props.returned.note || "No reason was recorded."}” ${stats.bad ? `${stats.bad} ${stats.bad === 1 ? "mark is" : "marks are"} still out of range — they are red in the grid, and the State filter can show only them.` : "Every mark is now within range. Preview and resubmit."}`,
            acts: [{ label: stats.bad ? "Preview anyway" : "Preview and resubmit", run: () => { void preview(); } }],
          }}
        />
      ) : null}

      <div className="max-md:hidden"><PanelView openDrawer={openDrawer} panel={{ type: "kpi", per: 5, title: "This sheet", cards }} /></div>
      {phone ? <div className="md:hidden"><PanelView openDrawer={openDrawer} panel={{ type: "kpi", bare: true, cards: cards.filter((card) => card.label !== "Blank rows") }} /></div> : null}

      {props.whyNot ? <PanelView openDrawer={openDrawer} panel={{ type: "note", tone: "attention", icon: WARN, title: "This sheet cannot be typed into", body: props.whyNot }} /> : null}
      {offline ? <PanelView openDrawer={openDrawer} panel={{ type: "note", tone: "offline", icon: OFF, title: "Offline — you can enter, but you cannot submit", body: "Entry is written to this device and the totals shown are provisional. Submission needs a connection." }} /> : null}
      {note ? <PanelView openDrawer={openDrawer} panel={{ type: "note", tone: note.tone === "ok" ? "positive" : "negative", icon: WARN, title: note.tone === "ok" ? "Saved" : "That did not save", body: note.text }} /> : null}

      {/* A phone types into a card for each child, as the mockup draws it: the name and total above, every column's box under its own heading. */}
      {phone ? (
      <div className="grid gap-[12px] md:hidden">
        {props.switchers.length ? (
          <div className="flex flex-wrap gap-[8px]">
            {props.switchers.map((switcher) => (
              <select key={switcher.label} aria-label={switcher.label} value={switcher.value} onChange={(event) => { const next = switcher.options.find((option) => option.label === event.target.value); if (next) router.push(next.href as Route); }} className="h-[42px] min-w-0 flex-1 rounded-[14px] border bg-white px-[12px] text-[14px] font-bold" style={{ borderColor: "#E4EDE8", color: "#0D2315" }}>
                {switcher.options.map((option) => <option key={option.label} value={option.label}>{option.label}</option>)}
              </select>
            ))}
          </div>
        ) : null}
        <label className="flex h-[48px] items-center gap-[10px] rounded-[16px] bg-white px-[14px]" style={{ boxShadow: "0 1px 2px rgba(13,35,21,0.05), 0 8px 22px -16px rgba(13,35,21,0.22)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8C9A92" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
          <input value={find} onChange={(event) => setFind(event.target.value)} placeholder="Find a student" aria-label="Find a student" className="min-w-0 flex-1 bg-transparent text-[14px] font-medium outline-none" style={{ color: "#0D2315" }} />
        </label>
        <div className="-mx-4 flex gap-[8px] overflow-x-auto px-4 pb-[2px]" style={{ scrollbarWidth: "none" }} role="tablist" aria-label="Show">
          {states.map((name) => {
            const n = name === "All" ? read.length : read.filter((entry) => entry.state === name).length;
            const on = only === name;
            return (
              <button key={name} type="button" role="tab" aria-selected={on} onClick={() => setOnly(name)} className="flex min-h-[40px] flex-none items-center gap-[7px] rounded-full border px-[15px] text-[14px] font-bold" style={on ? { background: "#E3F1EA", borderColor: "#5FBF9F", color: "#0D2315" } : { background: "#fff", borderColor: "#E4EDE8", color: "#435048" }}>
                {name}<span className="rounded-full px-[7px] text-[11.5px] font-black" style={{ background: on ? "#0D2315" : "#EDF3EF", color: on ? "#fff" : "#435048" }}>{n}</span>
              </button>
            );
          })}
        </div>
        <ul className="overflow-hidden rounded-[20px] bg-white" style={{ boxShadow: "0 1px 2px rgba(13,35,21,0.05), 0 8px 22px -14px rgba(13,35,21,0.22)" }}>
          {read.filter((entry) => (only === "All" || entry.state === only) && (!find.trim() || `${entry.row.name} ${entry.row.roll}`.toLowerCase().includes(find.trim().toLowerCase()))).map((entry, index) => {
            const { row } = entry;
            return (
              <li key={row.id} className="px-[16px] py-[14px]" style={index ? { borderTop: "1px solid #EDF3EF" } : undefined}>
                <div className="flex items-start justify-between gap-[10px]">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold leading-[1.3]" style={{ color: "#0D2315" }}>{row.name}</p>
                    <p className="mt-[1px] text-[12.5px] font-medium" style={{ color: entry.state === "Absent" ? "#6B4E9E" : entry.state === "Out of range" ? "#B23B3B" : "#6E7C74" }}>Roll {String(row.roll).padStart(2, "0")} · {entry.state}</p>
                  </div>
                  <div className="flex flex-none items-center gap-[8px]">
                    <span className="text-[20px] font-black leading-none tabular-nums" style={{ color: entry.complete ? "#0D2315" : "#B8C4BD" }}>{entry.complete ? entry.total : "—"}</span>
                    {entry.complete && entry.grade ? <span className="rounded-full px-[9px] py-[2px] text-[12px] font-extrabold" style={{ background: toneOf(gradeTone(entry.grade)).bg, color: toneOf(gradeTone(entry.grade)).fg }}>{entry.grade}</span> : null}
                  </div>
                </div>
                <div className="mt-[10px] grid gap-[8px]" style={{ gridTemplateColumns: `repeat(${Math.min(columns.length, 4)}, minmax(0, 1fr))` }}>
                  {columns.map((column) => {
                    const value = cells[row.id]?.[column.key] ?? "";
                    const absent = value === "ABS";
                    const bad = !absent && value !== "" && (Number.isNaN(Number(value)) || Number(value) > column.max);
                    return (
                      <label key={column.key} className="grid gap-[4px]">
                        <span className="truncate text-[12px] font-bold" style={{ color: "#6E7C74" }}>{column.short} /{column.max}</span>
                        <input
                          value={value}
                          disabled={locked}
                          inputMode="decimal"
                          placeholder="–"
                          aria-label={`${column.name} out of ${column.max} — ${row.name}`}
                          onChange={(event) => type(row.id, column.key, event.target.value)}
                          className="h-[50px] w-full min-w-0 rounded-[14px] border-0 text-center text-[18px] font-extrabold tabular-nums outline-hidden focus:ring-2 focus:ring-[#12796A] disabled:opacity-60"
                          style={absent ? { background: "#F1EEFA", color: "#6B4E9E", fontSize: 14 } : bad ? { background: "#FDF3F3", color: "#B23B3B" } : { background: "#F1F5F3", color: "#0D2315" }}
                        />
                      </label>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="px-[4px] text-[12.5px] font-medium" style={{ color: "#6E7C74" }}>Type a mark, or A for absent. Blank is not zero.{props.frameworkLabel ? ` ${props.frameworkLabel}.` : ""}</p>
        {!locked ? (
          <div className="sticky bottom-0 z-[30] -mx-4 -mb-4 rounded-t-[22px] bg-white px-[14px] pb-[12px] pt-[10px]" style={{ boxShadow: "0 -12px 30px -22px rgba(13,35,21,0.45)" }}>
            <div className="mb-[8px] flex items-center justify-between px-[4px] text-[12.5px] font-bold">
              <span style={{ color: stats.complete === stats.roll ? "#17714F" : "#8A6410" }}>{stats.complete === stats.roll ? "Every child has a mark" : `${stats.roll - stats.complete} still to enter`}</span>
              <span style={{ color: "#6E7C74" }}>Average {stats.avg ?? "—"}</span>
            </div>
            <div className="flex gap-[10px]">
              <button type="button" disabled={busy} onClick={() => void save()} className="h-[52px] flex-none rounded-[16px] px-[22px] text-[15px] font-extrabold disabled:opacity-60" style={{ background: "#EEF4F0", color: "#0D2315" }}>{busy ? "Saving…" : "Save draft"}</button>
              <button type="button" onClick={() => void preview()} className="h-[52px] min-w-0 flex-1 rounded-[16px] text-[15px] font-extrabold text-white" style={{ background: "#0D2315" }}>Preview &amp; submit</button>
            </div>
          </div>
        ) : null}
      </div>
      ) : null}

      <div className="max-md:hidden">
      <PanelView
        openDrawer={openDrawer}
        panel={{
          type: "table", title: `${props.subject} · ${props.arm}${props.window ? ` · ${props.window}` : ""}`,
          tag: stats.bad ? `${stats.bad} out of range` : stats.complete === stats.roll ? "Every child entered" : `${stats.roll - stats.complete} to enter`,
          tagTone: stats.bad ? "negative" : stats.complete === stats.roll ? "positive" : "attention",
          sub: `Every column head carries its maximum. Type a mark, or A for absent.${props.frameworkLabel ? ` ${props.frameworkLabel}.` : ""}`,
          meta: `${stats.roll} students`, search: "Find a student by name or roll number",
          filters: [
            ...props.switchers.map((switcher) => ({ label: switcher.label, value: switcher.value, options: switcher.options.map((option) => option.label), go: Object.fromEntries(switcher.options.filter((option) => option.label !== switcher.value).map((option) => [option.label, option.href])) })),
            { label: "State", value: "All", options: states, match: Object.fromEntries(states.slice(1).map((state) => [state, `state:${state}`])) },
            { label: "Grade", value: "All", options: gradeOptions, match: Object.fromEntries(bands.map((band) => [band.label, `grade:${band.label}|`])) },
          ],
          acts: [...(props.importHref && !locked ? [{ label: "Import from Excel", href: props.importHref }] : []), ...(locked ? [] : [previewAct])],
          footActs: locked ? [] : [...(props.remove ? [{ label: "Delete the entry", drawer: props.remove }] : []), saveDraft, { ...previewAct, label: "Preview, then submit for approval" }],
          head: ["Student", ...cols.map((column) => `${column.short} /${column.max}`), `Total /${maxTotal}`, "Grade", "State"],
          rows: tableRows, noun: "student", nounPlural: "students", noRowOpen: true, per: 40,
          foot: "A = absent, excluded from the average. Blank is not zero.",
        }}
      />
      </div>
    </div>
  );
}
