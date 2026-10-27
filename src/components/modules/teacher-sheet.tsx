"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useEffect, useMemo, useRef, useState } from "react";

import { PanelView } from "@/components/modules/panel-renderer";
import type { DrawerSpec, KpiCard, PanelAction, PanelTone, TableCellKind, TableRow } from "@/lib/modules/panels";
import { sendJson } from "@/lib/modules/submit";

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
  const { columns, rows, bands, columns: cols } = props;
  const router = useRouter();
  const [baseline, setBaseline] = useState<Cells>(() => initial(rows, columns));
  const [cells, setCells] = useState<Cells>(() => initial(rows, columns));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
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
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
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
      if (!dirty || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
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

      <PanelView openDrawer={openDrawer} panel={{ type: "kpi", per: 5, title: "This sheet", cards }} />

      {props.whyNot ? <PanelView openDrawer={openDrawer} panel={{ type: "note", tone: "attention", icon: WARN, title: "This sheet cannot be typed into", body: props.whyNot }} /> : null}
      {offline ? <PanelView openDrawer={openDrawer} panel={{ type: "note", tone: "offline", icon: OFF, title: "Offline — you can enter, but you cannot submit", body: "Entry is written to this device and the totals shown are provisional. Submission needs a connection." }} /> : null}
      {note ? <PanelView openDrawer={openDrawer} panel={{ type: "note", tone: note.tone === "ok" ? "positive" : "negative", icon: WARN, title: note.tone === "ok" ? "Saved" : "That did not save", body: note.text }} /> : null}

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
  );
}
