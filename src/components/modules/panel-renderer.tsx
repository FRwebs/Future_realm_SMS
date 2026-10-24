"use client";

import dynamic from "next/dynamic";

import { EmbeddedPanel } from "@/components/modules/embed-registry";
import { DevicePanel } from "@/components/modules/device-panel";
import { FlowPanelView, GridPanelView, QuotesPanelView } from "@/components/modules/panel-extras";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Minus,
  Search,
  X,
} from "lucide-react";

import { Field, initialValue } from "@/components/modules/field";
import { ModuleDrawer } from "@/components/modules/lazy-drawer";
import type {
  DrawerSpec,
  KpiCard,
  Panel,
  PanelAction,
  PanelChip,
  PanelFact,
  PanelRow,
  PanelTone,
  TableCellKind,
  TableRow,
  Trigger,
} from "@/lib/modules/panels";
import { readCookie, readableError } from "@/lib/modules/submit";
import { narrowRows, tableCsv, csvFileName } from "@/lib/modules/table-query";
import { cardIcon } from "@/lib/modules/card-icons";
import { CARD_BORDER, INK, MUTED, toneOf } from "@/lib/modules/tones";
import { cn } from "@/lib/utils/cn";

/*
 * The large interactive panels only some tabs draw are fetched when a tab draws one, not with every page: a register marker or a score grid is not part of
 * what a guardians list waits for. Each still renders on the server, so the page arrives whole.
 */
const AttendanceGrid = dynamic(() => import("@/components/modules/attendance-grid").then((loaded) => loaded.AttendanceGrid));
const DayStrip = dynamic(() => import("@/components/modules/day-strip").then((loaded) => loaded.DayStrip));
const SheetEntry = dynamic(() => import("@/components/modules/sheet-entry").then((loaded) => loaded.SheetEntry));
const RegisterMarker = dynamic(() => import("@/components/modules/register-marker").then((loaded) => loaded.RegisterMarker));
const ScoreGrid = dynamic(() => import("@/components/modules/score-grid").then((loaded) => loaded.ScoreGrid));

const TierChange = dynamic(() => import("@/components/modules/tier-change").then((loaded) => loaded.TierChange));

/** Opens whatever a trigger points at: a route, or a drawer over this page. */
type OpenDrawer = (spec: DrawerSpec) => void;

/** The mockup's default note icon: the warning triangle. */
const NOTE_ICON = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";

/**
 * The supporting line under a figure earns its place by adding something the
 * label and the number do not already say. Anything longer than a glance is cut
 * back to the clauses that do — the rest belongs on the list the card links to.
 */
function slimSub(value: string, label?: string): string {
  const text = value.replace(/\s+/g, " ").trim().replace(/\.$/, "");
  // A line that only says what the label already says is not carried at all.
  if (!text || (label && text.toLowerCase() === label.toLowerCase())) return "";
  if (text.length <= 40) return text;

  for (const separator of [" · ", " — ", "; ", ", "]) {
    const parts = text.split(separator);
    if (parts.length > 1 && parts[0]!.length <= 40) {
      let out = parts[0]!;
      for (const part of parts.slice(1)) {
        if (`${out}${separator}${part}`.length > 40) break;
        out += `${separator}${part}`;
      }
      return out;
    }
  }
  return text;
}

/** Two letters, as the mockup's avatars carry. */
function initialsOf(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/** Status colours come from the mockup's own palette — see tones.ts. */
function toneTextStyle(tone: PanelTone | undefined): React.CSSProperties {
  return { color: tone ? toneOf(tone).fg : MUTED };
}

function tonePillStyle(tone: PanelTone = "neutral"): React.CSSProperties {
  const swatch = toneOf(tone);
  return { background: swatch.bg, color: swatch.fg, borderColor: swatch.bd };
}

/** The plain text of a cell, for a row's detail and for search. */
function cellPlain(cell: TableCellKind | undefined): string {
  if (!cell) return "";
  if (cell.kind === "name") return cell.name;
  if (cell.kind === "pill") return cell.label;
  if (cell.kind === "bar") return cell.label;
  if (cell.kind === "mark") return cell.ok ? "Yes" : "No";
  if (cell.kind === "node") return cell.plain ?? "";
  if (cell.kind === "action") return "";
  return cell.text;
}

/**
 * What a row opens when nobody authored anything for it: the row itself, read back
 * heading by heading. A read, never a write — so it can be offered everywhere.
 */
function rowDetailDrawer(panel: Extract<Panel, { type: "table" }>, row: TableRow): DrawerSpec | null {
  const facts: PanelFact[] = panel.head
    .map((heading, index): PanelFact | null => {
      if (!heading.trim()) return null;
      const cell = row.cells[index];
      const value = cellPlain(cell);
      if (!value) return null;
      return [heading, value, cell?.kind === "name" ? cell.sub : undefined].filter((part) => part !== undefined) as PanelFact;
    })
    .filter((fact): fact is PanelFact => fact !== null);
  if (!facts.length) return null;
  return { mode: "view", kicker: panel.title, title: facts[0][1], facts, readOnly: true, readOnlyNote: "This is the row as it stands. Use the actions on the row to change it." };
}

/** A tucked panel, read back as the reference drawer the mockup opens from the line at the foot of a page. */
export function tuckDrawer(panel: Panel): DrawerSpec {
  const facts: PanelFact[] = [];
  const push = (label: string | undefined, value: string | undefined, note?: string) => {
    if (label) facts.push([label, value && value !== "" ? value : "—", note ?? ""].filter((part, index) => index < 2 || part) as PanelFact);
  };
  if (panel.type === "facts") panel.facts.forEach((fact) => push(fact[0], fact[1], fact[2]));
  else if (panel.type === "list") panel.items.forEach((item) => push(item.label, item.pill ?? "—", item.sub));
  else if (panel.type === "note") push(panel.title, panel.body);
  else if (panel.type === "table") panel.rows.forEach((row) => push(cellPlain(row.cells[0]), cellPlain(row.cells[1]), [cellPlain(row.cells[2]), cellPlain(row.cells[3])].filter(Boolean).join(" · ")));
  const title = "title" in panel && panel.title ? panel.title : "For reference";
  const kicker = "tuckKicker" in panel && panel.tuckKicker ? panel.tuckKicker : "Reference";
  const note = "tuckNote" in panel && panel.tuckNote ? panel.tuckNote : "Nothing here needs doing now — it is the rule behind the page.";
  return { mode: "info", kicker, title, sub: "sub" in panel ? panel.sub : undefined, facts, readOnly: true, readOnlyNote: note };
}

const TUCK_ICON = "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17M12 8h.02M11.4 11.5h1.2v5h-1.2z";

function isTucked(panel: Panel): panel is Panel & { tuck: string } {
  return "tuck" in panel && Boolean((panel as { tuck?: string }).tuck);
}

/**
 * A control that does what its trigger says: follows a route, opens a drawer,
 * or — when the mockup gives it neither — stays inert rather than pretending.
 */
function TriggerControl({
  trigger,
  label,
  className,
  style,
  openDrawer,
  children,
}: {
  trigger: Trigger;
  label: string;
  className: string;
  style?: React.CSSProperties;
  openDrawer: OpenDrawer;
  children?: React.ReactNode;
}) {
  const body = children ?? label;

  if (trigger.run) {
    return (
      <button type="button" onClick={trigger.run} className={className} style={style}>
        {body}
      </button>
    );
  }

  if (trigger.href) {
    return (
      <Link href={trigger.href as Route} className={className} style={style}>
        {body}
      </Link>
    );
  }

  if (trigger.drawer) {
    const spec = trigger.drawer;
    return (
      <button
        type="button"
        onClick={() => openDrawer(spec)}
        className={className}
        style={style}
      >
        {body}
      </button>
    );
  }

  return (
    <span
      className={cn(className, "cursor-default opacity-70")}
      style={style}
      title="Not wired up yet"
    >
      {body}
    </span>
  );
}

/**
 * Every panel in the mockup is the same box: white, a 1px hairline, 14px
 * corners, and its heading in a band ruled off from the body. The band and the
 * foot bleed to the box edge; the body keeps an 18px gutter.
 */
export const PANEL_SHELL =
  "min-w-0 overflow-hidden rounded-[14px] border bg-[var(--color-bg-surface)] px-[18px] pb-[12px]";

/** The mockup's two panel-action faces: ink for the primary, outlined otherwise. */
function panelActClass(primary?: boolean) {
  return cn(
    "inline-flex items-center whitespace-nowrap rounded-[8px] text-[10.5px] font-semibold transition-[background,border-color] duration-150",
    primary
      ? "bg-[#0D2315] px-[11px] py-[6.5px] text-white hover:bg-[#1B3A28]"
      : "border border-[#DEE8E2] bg-white px-[10px] py-[5.5px] text-[#435048] hover:border-[#BFDCD1] hover:bg-[#F1F8F4]",
  );
}

export function PanelHeader({
  title,
  sub,
  meta,
  tag,
  tagTone = "neutral",
  acts,
  openDrawer,
  onExport,
  flush,
  joined,
}: {
  title: string;
  sub?: string;
  meta?: string;
  tag?: string;
  tagTone?: PanelTone;
  acts?: PanelAction[];
  openDrawer: OpenDrawer;
  /** Runs an act marked `export`, which only a table knows how to do. */
  onExport?: () => void;
  /** Card rows and tile grids carry no rule under their heading. */
  flush?: boolean;
  /** Ruled, but the next band (filters, table head) sits right against it. */
  joined?: boolean;
}) {
  const swatch = toneOf(tagTone);

  return (
    <div
      className={cn(
        "-mx-[18px] flex flex-wrap items-start justify-between gap-[14px] px-[18px] pb-[12px] pt-[14px]",
        flush ? "mb-0" : joined ? "mb-0 border-b" : "mb-[12px] border-b",
      )}
      style={flush ? undefined : { borderColor: "#EDF3EF" }}
    >
      <div className="min-w-0 flex-[1_1_260px]">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            className="text-pretty text-[12.5px] font-semibold leading-[1.3]"
            style={{ color: INK }}
          >
            {title}
          </h3>
          {tag ? (
            <span
              className="inline-flex items-center gap-[5px] rounded-full border px-[8px] py-[2px] text-[10px] font-semibold"
              style={tonePillStyle(tagTone)}
            >
              <span
                className="h-[5px] w-[5px] rounded-full"
                style={{ background: swatch.dot }}
              />
              {tag}
            </span>
          ) : null}
        </div>
        {sub ? (
          <p
            className="mt-[3.5px] text-pretty text-[10.5px] leading-[1.5]"
            style={{ color: MUTED }}
          >
            {sub}
          </p>
        ) : null}
      </div>
      {meta || acts?.length ? (
        <div className="flex min-w-0 flex-[0_1_auto] items-center justify-end gap-[12px]">
          {meta ? (
            <p
              className="text-pretty text-right text-[10.5px] leading-[1.45]"
              style={{ color: MUTED }}
            >
              {meta}
            </p>
          ) : null}
          {acts?.length ? (
            <div className="flex flex-none items-center gap-[7px]">
              {acts.map((act) =>
                act.export ? (
                  <button
                    key={act.label}
                    type="button"
                    onClick={onExport}
                    className={panelActClass(act.primary)}
                  >
                    {act.label}
                  </button>
                ) : (
                  <TriggerControl
                    key={act.label}
                    trigger={act}
                    label={act.label}
                    openDrawer={openDrawer}
                    className={panelActClass(act.primary)}
                  />
                ),
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PanelFoot({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "-mx-[18px] -mb-[12px] mt-[12px] border-t bg-[#F7FAF8] px-[18px] py-[10px] text-pretty text-[10.5px] leading-[1.5]",
        className,
      )}
      style={{ borderColor: "#EDF3EF", color: MUTED }}
    >
      {children}
    </p>
  );
}

/**
 * The mockup lays facts out as an auto-fit grid rather than a label column, so
 * a six-fact block reads as a record card and not as a settings form. `per: 1`
 * only widens the minimum column, for facts whose value is a sentence.
 */
function FactList({ facts, per }: { facts: PanelFact[]; per?: number }) {
  return (
    <dl
      className="grid gap-x-4 gap-y-3.5"
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(${per === 1 ? 260 : 186}px, 1fr))`,
      }}
    >
      {facts.map(([label, value, hint, tone], index) => (
        <div key={`${label}-${index}`} className="min-w-0">
          <dt className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.05em] text-[#67766D]">
            {label}
          </dt>
          <dd className="min-w-0">
            {/* A fact that is its own state is coloured like one. */}
            <span
              className="block text-[12.5px] font-semibold leading-[1.35]"
              style={{ color: tone ? toneOf(tone).fg : "#0D2315" }}
            >
              {value}
            </span>
            {hint ? (
              <span className="mt-[3px] block text-[10px] leading-[1.45] text-[#6B7A71]">
                {hint}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Cell({
  cell,
  openDrawer,
  dense,
}: {
  cell: TableCellKind;
  openDrawer: OpenDrawer;
  dense?: boolean;
}) {
  if (cell.kind === "node") return <>{cell.node}</>;

  if (cell.kind === "mark") {
    return (
      <span
        className="block text-center text-[12px] font-extrabold"
        style={{ color: cell.ok ? "#17714F" : "#C2D2C8" }}
        aria-label={cell.ok ? "Included" : "Not included"}
      >
        {cell.ok ? "\u2713" : "\u2014"}
      </span>
    );
  }

  if (cell.kind === "name") {
    const swatch = toneOf(cell.avatarTone);

    return (
      <div className={cn("flex min-w-0 items-center gap-[9px]", dense && "max-w-[190px]")}>
        {cell.avatar === false || dense ? null : (
          <span
            aria-hidden="true"
            className="flex h-[24px] w-[24px] flex-none items-center justify-center rounded-full border text-[9.5px] font-bold"
            style={{
              background: swatch.bg,
              color: swatch.fg,
              borderColor: swatch.bd,
            }}
          >
            {initialsOf(cell.name)}
          </span>
        )}
        <span className="min-w-0">
          <span
            className="block truncate text-[11.5px] font-semibold"
            style={{ color: INK }}
          >
            {cell.name}
          </span>
          {cell.sub ? (
            <span
              className="mt-[1.5px] block truncate text-[10px]"
              style={{ color: MUTED }}
            >
              {cell.sub}
            </span>
          ) : null}
        </span>
      </div>
    );
  }

  if (cell.kind === "pill") {
    const body = (
      <>
        <span
          className="h-[5px] w-[5px] flex-none rounded-full"
          style={{ background: toneOf(cell.tone ?? "neutral").dot }}
        />
        {cell.label}
      </>
    );
    const base = cn("inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border px-[9px] py-[3px] text-[10.5px] font-semibold", dense && "gap-[4px] px-[7px] text-[10px]");
    // A pill that is also the control — the payment status you click to change.
    if (cell.href || cell.drawer) {
      return (
        <TriggerControl
          trigger={cell}
          label={cell.label}
          openDrawer={openDrawer}
          className={cn(base, "cursor-pointer hover:brightness-95")}
          style={tonePillStyle(cell.tone ?? "neutral")}
        >
          {body}
        </TriggerControl>
      );
    }
    return (
      <span className={base} style={tonePillStyle(cell.tone ?? "neutral")}>
        {body}
      </span>
    );
  }

  if (cell.kind === "bar") {
    const swatch = toneOf(cell.tone ?? "positive");
    return (
      <div className="min-w-[96px]">
        <span
          className="block text-[10.5px] font-semibold tabular-nums"
          style={{ color: cell.tone === "negative" ? swatch.fg : "#435048" }}
        >
          {cell.label}
        </span>
        <span
          className="mt-[4px] block h-[4px] overflow-hidden rounded-full"
          style={{ background: "#EDF3EF" }}
          aria-hidden="true"
        >
          <span
            className="block h-full rounded-full"
            style={{ width: `${Math.max(0, Math.min(100, cell.pct))}%`, background: swatch.dot }}
          />
        </span>
      </div>
    );
  }

  if (cell.kind === "action") {
    // The mockup's action cell is plain right-aligned text, not a chip — the
    // chip treatment belongs to list rows.
    return (
      <TriggerControl
        trigger={cell}
        label={cell.label}
        openDrawer={openDrawer}
        className="whitespace-nowrap text-right text-[11px] font-semibold hover:underline"
        style={{ color: "#12796A" }}
      />
    );
  }

  return (
    <span
      className={cn(
        "text-[11.5px]",
        // A short value is a figure or a label, never a sentence: keep it on one line.
        cell.text.length <= 24 && "whitespace-nowrap",
        cell.strong && "font-semibold",
        cell.mono && "font-semibold tabular-nums",
      )}
      style={
        cell.tone
          ? toneTextStyle(cell.tone)
          : { color: cell.mono ? INK : "#435048" }
      }
    >
      {cell.text}
    </span>
  );
}

/** Which page buttons to draw: all of them while there are few, otherwise the ends and the neighbours of the current one, with gaps. */
function pageNumbers(count: number, current: number): Array<number | null> {
  if (count <= 9) return Array.from({ length: count }, (_, index) => index);
  const wanted = new Set([0, 1, count - 2, count - 1, current - 1, current, current + 1]);
  const sorted = [...wanted].filter((index) => index >= 0 && index < count).sort((a, b) => a - b);
  const out: Array<number | null> = [];
  sorted.forEach((index, position) => {
    if (position > 0 && index - sorted[position - 1]! > 1) out.push(null);
    out.push(index);
  });
  return out;
}

/**
 * A table with the controls the mockup gives it: a search box, column filters,
 * row selection with bulk actions, and paging. Everything narrows the rows in
 * place, and the count under the table always describes what you are looking at.
 */
function TablePanel({
  panel,
  openDrawer,
}: {
  panel: Extract<Panel, { type: "table" }>;
  openDrawer: OpenDrawer;
}) {
  // A long table arrives as one page of a longer list (`panel.window`): its search, filters and page live in the address, and the server
  // does the narrowing. A short table narrows its own rows here, as it always has.
  const served = panel.window;
  const [query, setQuery] = useState(served?.q ?? "");
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() =>
    served?.filters ?? Object.fromEntries(
      (panel.filters ?? []).map((filter) => [filter.label, filter.value]),
    ),
  );
  const [selected, setSelected] = useState<Set<TableRow>>(new Set());
  const [page, setPage] = useState(0);
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Ask the server for a different page, search or filter: the address changes, the page is drawn again. */
  function ask(patch: Record<string, string | null>) {
    if (!served) return;
    // Read from the address bar at the moment of asking: it is what the person is looking at, and it keeps every other control's choice.
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(`${served.key}_${key}`);
      else next.set(`${served.key}_${key}`, value);
    }
    setSelected(new Set());
    startNavigation(() => router.replace(`${window.location.pathname}${next.toString() ? `?${next.toString()}` : ""}` as Route, { scroll: false }));
  }
  useEffect(() => () => { if (typing.current) clearTimeout(typing.current); }, []);

  const noun = panel.noun ?? "row";
  const nounPlural = panel.nounPlural ?? `${noun}s`;

  const filtered = useMemo(() => (served ? panel.rows : narrowRows(panel.rows, panel.filters, query, filterValues)), [served, panel.rows, panel.filters, query, filterValues]);

  // Any list long enough to need it is paged, without each page asking for it.
  const perPage = served ? served.size : panel.per ?? (filtered.length > 12 ? 12 : filtered.length);
  const pageCount = served
    ? Math.max(1, Math.ceil(served.matched / served.size))
    : perPage > 0 ? Math.max(1, Math.ceil(filtered.length / perPage)) : 1;
  const safePage = served ? served.page - 1 : Math.min(page, pageCount - 1);
  const visible = served || perPage <= 0 ? filtered : filtered.slice(safePage * perPage, safePage * perPage + perPage);
  const shownTotal = served ? served.matched : filtered.length;
  const turnTo = (index: number) => (served ? ask({ p: index === 0 ? null : String(index + 1) }) : setPage(index));

  const hasControls = Boolean(panel.search || panel.filters?.length);
  const allVisibleSelected = visible.length > 0 && visible.every((row) => selected.has(row));

  // A row is ticked by what it is, not where it sits, so a filter or a page turn
  // never moves a tick onto a different record.
  function toggleRow(row: TableRow) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current);
      visible.forEach((row) => {
        if (allVisibleSelected) next.delete(row);
        else next.add(row);
      });
      return next;
    });
  }

  /** The ticked rows, or every row that passes the filters when none is ticked. On a long table "every row" is the server's to say. */
  function exportRows(onlySelected: boolean) {
    if (served && !onlySelected) {
      window.location.assign(served.exportUrl);
      return;
    }
    const rows = onlySelected ? panel.rows.filter((row) => selected.has(row)) : filtered;
    const blob = new Blob([`\uFEFF${tableCsv(panel.head, rows)}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = csvFileName(panel.title);
    link.click();
    URL.revokeObjectURL(url);
  }

  /** A bulk drawer, told which rows it is about. */
  function forSelection(act: PanelAction): DrawerSpec | null {
    if (!act.drawer || !act.selection) return act.drawer ?? null;
    const rows = panel.rows.filter((row) => selected.has(row));
    const ids = rows.map((row) => row.id).filter((id): id is string => Boolean(id));
    const names = rows.map((row) => {
      const first = row.cells[0];
      return first?.kind === "name" ? first.name : first?.kind === "text" ? first.text : "";
    });
    const summary = `${rows.length} ${rows.length === 1 ? act.selection.noun : `${act.selection.noun}s`}`;
    const listed = names.filter(Boolean).slice(0, 4).join(", ") + (names.length > 4 ? ` and ${names.length - 4} more` : "");
    const spec = act.drawer;
    return {
      ...spec,
      sub: spec.sub ?? `${summary} selected`,
      fields: spec.fields
        ? [{ label: "Applies to", kind: "static" as const, value: summary, hint: listed, span: 2 as const }, ...spec.fields]
        : spec.fields,
      steps: spec.steps?.map((step, index) =>
        index === 0
          ? { ...step, fields: [{ label: "Applies to", kind: "static" as const, value: summary, hint: listed, span: 2 as const }, ...step.fields] }
          : step,
      ),
      submit: spec.submit
        ? { ...spec.submit, body: { ...(spec.submit.body ?? {}), [act.selection.key]: ids } }
        : spec.submit,
    };
  }

  // A column reads one way from its heading to its last row: figures and row
  // actions sit on the right, everything else on the left.
  const aligns = panel.head.map((heading, index) => {
    const sample = panel.rows[0]?.cells[index];
    if (sample?.kind === "action") return "right";
    // A cell the client draws (a mark being typed) sits under its heading, centred.
    if (sample?.kind === "node") return "center";
    if (
      sample?.kind === "text" &&
      (sample.mono || /^[-+₦$]?[\d.,]+%?$/.test(sample.text.trim()))
    )
      return "right";
    return "left";
  });
  const lastIndex = panel.head.length - 1;
  // A dense table fits its panel: cells sit closer, headings wrap, and nothing asks for a slider.
  const dense = Boolean(panel.dense);
  // A dense table is one asked to fit its panel, so it gives the outer edges back some of
  // their padding on a narrow screen — 18px on each end of a four-column table is a tenth
  // of a phone's width, and spending it on margin is what pushes the table into a slider.
  const edge = (index: number) =>
    cn(
      index === 0 && !panel.selectable ? (dense ? "pl-[10px] sm:pl-[18px]" : "pl-[18px]") : dense ? "pl-[5px]" : "pl-[9px]",
      index === lastIndex ? (dense ? "pr-[10px] sm:pr-[18px]" : "pr-[18px]") : dense ? "pr-[5px]" : "pr-[9px]",
    );
  // The meta line asserts a count; the pager states the truth below it. Where the two disagree the
  // line says which it is, appended — so an authored figure can never contradict the rows.
  const claimed = panel.meta?.match(/^([\d,]+)\s+(\S+)/);
  const everyRow = served ? served.total : panel.rows.length;
  const metaLine =
    panel.meta && claimed && claimed[2].toLowerCase().replace(/[^a-z]/g, "") === nounPlural.toLowerCase().replace(/[^a-z]/g, "") && Number(claimed[1].replace(/,/g, "")) !== shownTotal
      ? `${panel.meta} · showing ${shownTotal.toLocaleString("en-NG")}`
      : panel.meta;
  const filterNote =
    shownTotal === everyRow
      ? `${everyRow.toLocaleString("en-NG")} ${everyRow === 1 ? noun : nounPlural}`
      : `${shownTotal.toLocaleString("en-NG")} of ${everyRow.toLocaleString("en-NG")} ${nounPlural}`;

  return (
    <section
      className={cn(PANEL_SHELL, "pb-0", navigating && "opacity-60 transition-opacity")}
      aria-busy={navigating}
      style={{ borderColor: CARD_BORDER }}
    >
      <PanelHeader
        title={panel.title}
        sub={panel.sub}
        meta={metaLine}
        tag={panel.tag}
        tagTone={panel.tagTone}
        acts={panel.acts}
        openDrawer={openDrawer}
        onExport={() => exportRows(false)}
        joined
      />

      {hasControls ? (
        <div
          className="-mx-[18px] flex flex-wrap items-center gap-[7px] border-b px-[18px] py-[12px]"
          style={{ background: "#FCFDFC", borderColor: "#EDF3EF" }}
        >
          {panel.search ? (
            <label
              className="flex min-w-[232px] items-center gap-2 rounded-[9px] border bg-white px-[11px] py-[7px]"
              style={{ borderColor: "#DEE8E2" }}
            >
              <Search
                className="h-[12.5px] w-[12.5px] flex-none"
                style={{ color: "#6B7A71" }}
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  const text = event.target.value;
                  setQuery(text);
                  setPage(0);
                  if (served) {
                    if (typing.current) clearTimeout(typing.current);
                    typing.current = setTimeout(() => ask({ q: text.trim() || null, p: null }), 350);
                  }
                }}
                placeholder={panel.search}
                aria-label={panel.search}
                className="min-w-0 flex-1 border-none bg-transparent text-[11.5px] outline-none"
                style={{ color: INK }}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setPage(0);
                    if (typing.current) clearTimeout(typing.current);
                    ask({ q: null, p: null });
                  }}
                  aria-label="Clear search"
                  className="flex flex-none"
                >
                  <X
                    className="h-[11.5px] w-[11.5px]"
                    style={{ color: "#6B7A71" }}
                    strokeWidth={2.2}
                  />
                </button>
              ) : null}
            </label>
          ) : null}

          {(panel.filters ?? []).map((filter) => (
            <label
              key={filter.label}
              className="relative flex cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[9px] border bg-white py-[7px] pl-[10px] pr-[26px] text-[11px] transition hover:border-[#BFDCD1] hover:bg-[#F7FAF8]"
              style={{ borderColor: "#DEE8E2", color: INK }}
            >
              <span style={{ color: MUTED }}>{filter.label}</span>
              <select
                value={filterValues[filter.label] ?? filter.value}
                onChange={(event) => {
                  const target = filter.go?.[event.target.value];
                  if (target) {
                    router.push(target as Route);
                    return;
                  }
                  setFilterValues((current) => ({
                    ...current,
                    [filter.label]: event.target.value,
                  }));
                  setPage(0);
                  if (served) ask({ [`f${(panel.filters ?? []).indexOf(filter)}`]: event.target.value === filter.options[0] ? null : event.target.value, p: null });
                }}
                className="cursor-pointer appearance-none border-none bg-transparent font-semibold outline-none"
              >
                {filter.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-[10px] top-1/2 h-[11px] w-[11px] -translate-y-1/2"
                style={{ color: "#6B7A71" }}
                strokeWidth={2.4}
              />
            </label>
          ))}

          <span className="ml-auto text-[10.5px]" style={{ color: MUTED }}>
            {filterNote}
          </span>
        </div>
      ) : null}

      {panel.selectable && selected.size > 0 ? (
        <div className="-mx-[18px] px-[11px] pt-[11px]">
          <div className="flex flex-wrap items-center justify-between gap-[11px] rounded-[12px] bg-[#0D2315] px-[14px] py-[10px]">
            <div className="flex items-center gap-[10px]">
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                aria-label="Clear selection"
                className="flex h-[15.5px] w-[15.5px] flex-none items-center justify-center rounded-[5px] bg-white"
              >
                <Minus
                  className="h-[10px] w-[10px]"
                  style={{ color: INK }}
                  strokeWidth={3.4}
                />
              </button>
              <span className="text-[11.5px] font-semibold text-white">
                {selected.size} {selected.size === 1 ? noun : nounPlural}{" "}
                selected
              </span>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-[10.5px] text-white/60 hover:text-white"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-[7px]">
              {(panel.bulkActs ?? []).map((act) => {
                const className = cn(
                  "inline-flex items-center whitespace-nowrap rounded-[8px] px-[11px] py-[6px] text-[10.5px] font-semibold transition",
                  act.primary
                    ? "bg-white text-[#0D2315] hover:bg-[#EAF3EE]"
                    : "border border-white/20 bg-white/10 text-white hover:bg-white/20",
                );
                if (act.export) {
                  return (
                    <button key={act.label} type="button" onClick={() => exportRows(true)} className={className}>
                      {act.label}
                    </button>
                  );
                }
                const spec = forSelection(act);
                // A bulk action that goes to another page carries the ticked rows with it, as the page's own query.
                const ids = panel.rows.filter((row) => selected.has(row)).map((row) => row.id).filter((id): id is string => Boolean(id));
                const href = act.href && act.selection ? `${act.href}${act.href.includes("?") ? "&" : "?"}${act.selection.key}=${ids.map(encodeURIComponent).join(",")}` : act.href;
                return (
                  <TriggerControl
                    key={act.label}
                    trigger={{ href, drawer: spec ?? undefined }}
                    label={act.label}
                    openDrawer={openDrawer}
                    className={className}
                  />
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="px-[18px] py-[32px] text-center">
          <p
            className="mb-1 text-[12px] font-semibold"
            style={{ color: "#435048" }}
          >
            {everyRow === 0
              ? (panel.emptyTitle ?? "Nothing here yet")
              : `No ${nounPlural} match that`}
          </p>
          <p
            className="mx-auto max-w-[420px] text-[11px] leading-[1.55]"
            style={{ color: MUTED }}
          >
            {everyRow === 0
              ? (panel.emptyBody ?? panel.empty ?? "Records will appear here as they are created.")
              : "Clear the search or widen a filter to see more."}
          </p>
        </div>
      ) : (
        <div className="-mx-[18px] min-w-0 overflow-x-auto">
          <table className={cn("w-full border-collapse", dense ? "min-w-0" : "min-w-[640px]")}>
            <thead>
              <tr
                style={{
                  background: "#F7FAF8",
                  borderBottom: "1px solid #E6EEE9",
                }}
              >
                {panel.selectable ? (
                  <th
                    scope="col"
                    className="w-[42px] py-[10px] pl-[18px] pr-[9px] text-left"
                  >
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label={`Select every ${noun} on this page`}
                      className="h-[14.5px] w-[14.5px] accent-[#0d2315]"
                    />
                  </th>
                ) : null}
                {panel.head.map((heading, index) => (
                  <th
                    key={`${heading}-${index}`}
                    scope="col"
                    className={cn(
                      "py-[10px] align-middle text-[9.5px] font-semibold uppercase leading-[1.3] tracking-[0.05em]",
                      dense && "text-[9px] tracking-[0.03em]",
                      aligns[index] === "right" ? "text-right" : aligns[index] === "center" ? "text-center" : "text-left",
                      edge(index),
                    )}
                    style={{ color: MUTED }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((tableRow, index) => {
                const absolute = safePage * perPage + index;
                const isSelected = selected.has(tableRow);
                // A row opens exactly what its own first action opens; with none authored it
                // opens the row read back. A table whose cells are the controls says so.
                const ownAction = tableRow.cells.find((cell): cell is Extract<TableCellKind, { kind: "action" }> => cell.kind === "action" && Boolean(cell.href || cell.drawer));
                const rowHref = tableRow.href ?? (tableRow.drawer ? undefined : ownAction?.href);
                const rowDrawer = tableRow.href ? undefined : (tableRow.drawer ?? ownAction?.drawer ?? (panel.noRowOpen ? undefined : rowDetailDrawer(panel, tableRow) ?? undefined));
                const opens = Boolean(rowHref || rowDrawer);

                return (
                  <tr
                    key={absolute}
                    className={cn(
                      "transition-colors duration-150 hover:bg-[#F1F8F4]",
                      isSelected && "bg-[#F1F8F4]",
                      opens && "cursor-pointer",
                    )}
                    style={{ borderBottom: "1px solid #F2F7F4" }}
                    onClick={
                      opens
                        ? (event) => {
                            // A control inside the row keeps its own behaviour.
                            if ((event.target as HTMLElement).closest("a,button,input,select,textarea,label")) return;
                            if (rowHref) router.push(rowHref as Route);
                            else if (rowDrawer) openDrawer(rowDrawer);
                          }
                        : undefined
                    }
                  >
                    {panel.selectable ? (
                      <td className="py-[11px] pl-[18px] pr-[9px] align-middle">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(tableRow)}
                          aria-label={`Select this ${noun}`}
                          className="h-[14.5px] w-[14.5px] accent-[#0d2315]"
                        />
                      </td>
                    ) : null}
                    {tableRow.cells.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className={cn(
                          dense ? "py-[9px] align-middle" : "py-[11px] align-middle",
                          edge(cellIndex),
                          aligns[cellIndex] === "right" && "text-right",
                          aligns[cellIndex] === "center" && "text-center",
                        )}
                      >
                        <Cell cell={cell} openDrawer={openDrawer} dense={dense} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
            {panel.summaryRows?.length ? (
              <tfoot>
                {panel.summaryRows.map((summary, rowIndex) => (
                  <tr key={rowIndex} style={{ background: "#F7FAF8", borderTop: "1px solid #E6EEE9" }}>
                    {panel.selectable ? <td /> : null}
                    {summary.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className={cn("py-[11px] align-middle", edge(cellIndex), aligns[cellIndex] === "right" && "text-right")}
                      >
                        <Cell cell={cell} openDrawer={openDrawer} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tfoot>
            ) : null}
          </table>
        </div>
      )}

      {pageCount > 1 ? (
        <div
          className="-mx-[18px] flex items-center justify-between gap-3 border-t px-[18px] py-[10px]"
          style={{ background: "#FCFDFC", borderColor: "#EDF3EF" }}
        >
          <p className="text-[10.5px]" style={{ color: MUTED }}>
            {`Showing ${safePage * perPage + 1}–${Math.min(shownTotal, safePage * perPage + perPage)} of ${shownTotal.toLocaleString("en-NG")} ${shownTotal === 1 ? noun : nounPlural}`}
          </p>
          <div className="flex flex-none items-center gap-[5px]">
            <button
              type="button"
              onClick={() => turnTo(Math.max(0, safePage - 1))}
              disabled={safePage === 0}
              aria-label="Previous page"
              className={pagerClass(false)}
            >
              <ChevronLeft
                className="h-[11.5px] w-[11.5px]"
                strokeWidth={2.4}
              />
            </button>
            {pageNumbers(pageCount, safePage).map((number, position) =>
              number === null ? (
                <span key={`gap-${position}`} className="px-[3px] text-[11px]" style={{ color: MUTED }}>…</span>
              ) : (
                <button
                  key={number}
                  type="button"
                  onClick={() => turnTo(number)}
                  aria-current={number === safePage ? "page" : undefined}
                  className={pagerClass(number === safePage)}
                >
                  {number + 1}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => turnTo(Math.min(pageCount - 1, safePage + 1))}
              disabled={safePage >= pageCount - 1}
              aria-label="Next page"
              className={pagerClass(false)}
            >
              <ChevronRight
                className="h-[11.5px] w-[11.5px]"
                strokeWidth={2.4}
              />
            </button>
          </div>
        </div>
      ) : null}

      {panel.foot || panel.footActs?.length ? (
        <div
          className="-mx-[18px] -mb-[12px] flex flex-wrap items-center justify-between gap-[10px] border-t bg-[#F7FAF8] px-[18px] py-[10px]"
          style={{ borderColor: "#EDF3EF" }}
        >
          <p className="min-w-0 flex-1 text-pretty text-[10.5px] leading-[1.5]" style={{ color: MUTED }}>
            {panel.foot}
          </p>
          {panel.footActs?.length ? (
            <div className="flex flex-none flex-wrap items-center gap-[7px]">
              {panel.footActs.map((act) => (
                <TriggerControl key={act.label} trigger={act} label={act.label} openDrawer={openDrawer} className={panelActClass(act.primary)} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

const TRACKER_STATE_TONE: Record<string, PanelTone> = {
  Complete: "positive",
  Marked: "positive",
  "In progress": "progress",
  Draft: "attention",
  Unassigned: "negative",
  "Not started": "negative",
  Resolved: "positive",
  Declined: "neutral",
  Overdue: "negative",
  New: "attention",
  Assigned: "progress",
};

/** A row is finished when nothing more is owed on it. */
const TRACKER_DONE = new Set(["Complete", "Resolved", "Declined", "Signed"]);

/**
 * A tracker: one row per thing that has to be true before the school can go on,
 * each naming the person who owns it and, where there is somewhere to do the work,
 * the link that takes you there. Rows can be read by issue or gathered by owner.
 */
function TrackerPanel({
  panel,
  openDrawer,
}: {
  panel: Extract<Panel, { type: "tracker" }>;
  openDrawer: OpenDrawer;
}) {
  const groups = panel.groups ?? [];
  const [group, setGroup] = useState(groups[0] ?? "");
  const clear = panel.rows.filter((row) => TRACKER_DONE.has(row.state)).length;
  const outstanding = panel.rows.length - clear;

  if (panel.rows.length === 0 && panel.clear) {
    return (
      <section className={PANEL_SHELL} style={{ borderColor: CARD_BORDER }}>
        <PanelHeader title={panel.title} sub={panel.sub} meta={panel.meta} openDrawer={openDrawer} />
        <div className="rounded-[12px] border border-[var(--color-success)] bg-[var(--color-success-dim)] px-4 py-3.5">
          <p className="text-[12.5px] font-bold text-[var(--color-text-primary)]">{panel.clear.title}</p>
          <p className="mt-1 text-[12px] leading-[1.5] text-[var(--color-text-secondary)]">{panel.clear.body}</p>
        </div>
      </section>
    );
  }

  const byOwner = group === "By owner";
  const own = panel.groupRows?.[group];
  const source = own ?? panel.rows;
  const ordered = byOwner ? [...source].sort((a, b) => a.owner.localeCompare(b.owner)) : source;

  return (
    <section className={PANEL_SHELL} style={{ borderColor: CARD_BORDER }}>
      <PanelHeader
        title={panel.title}
        sub={panel.sub}
        meta={panel.meta}
        tag={panel.noun ? `${clear} of ${panel.rows.length} ${panel.noun}` : undefined}
        tagTone={outstanding ? "attention" : "positive"}
        openDrawer={openDrawer}
      />
      {groups.length > 1 ? (
        <div className="mb-[10px] flex flex-wrap items-center gap-[6px]">
          {groups.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setGroup(name)}
              className="rounded-full border px-[11px] py-[5px] text-[10.5px] font-semibold"
              style={
                name === group
                  ? { background: INK, color: "#fff", borderColor: INK }
                  : { background: "#fff", color: "#5F6E65", borderColor: "#DEE8E2" }
              }
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}
      {own && own.length === 0 ? (
        <p className="rounded-[12px] border border-dashed px-4 py-5 text-center text-[11.5px] text-[#67766D]" style={{ borderColor: "#DEE8E2" }}>
          Nothing is outstanding when read this way.
        </p>
      ) : null}
      <ul className="grid gap-2">
        {ordered.map((trackerRow, index) => {
          const tone = TRACKER_STATE_TONE[trackerRow.state] ?? "attention";
          const showOwnerHeading = byOwner && (index === 0 || ordered[index - 1].owner !== trackerRow.owner);
          return (
            <li key={`${trackerRow.unit}-${index}`} className="list-none">
              {showOwnerHeading ? (
                <p className="mb-[5px] mt-[4px] text-[9.5px] font-semibold uppercase tracking-[0.06em] text-[#67766D]">
                  {trackerRow.owner} · {trackerRow.role}
                </p>
              ) : null}
              <div
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-[12px] border px-3.5 py-2.5",
                  trackerRow.overdue
                    ? "border-[var(--color-danger)] bg-[var(--color-danger-dim)]"
                    : "border-[var(--color-border-default)]",
                )}
              >
                <div className="min-w-0 flex-[1_1_260px]">
                  <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{trackerRow.unit}</p>
                  {trackerRow.sub ? (
                    <p className="text-[11.5px] text-[var(--color-text-muted)]">{trackerRow.sub}</p>
                  ) : null}
                </div>
                <div className="flex flex-none flex-wrap items-center gap-2.5">
                  {byOwner ? null : (
                    <span className="text-[11.5px] text-[var(--color-text-secondary)]">
                      {trackerRow.owner}
                      <span className="text-[var(--color-text-muted)]"> · {trackerRow.role}</span>
                    </span>
                  )}
                  <span
                    className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                    style={tonePillStyle(tone)}
                  >
                    {trackerRow.state}
                  </span>
                  <span
                    className={cn(
                      "min-w-[52px] text-right text-[11.5px] tabular-nums",
                      trackerRow.overdue
                        ? "font-semibold text-[var(--color-danger)]"
                        : "text-[var(--color-text-muted)]",
                    )}
                  >
                    {trackerRow.age}
                  </span>
                  {trackerRow.href ? (
                    <Link
                      href={trackerRow.href as Route}
                      className="text-[11px] font-semibold hover:underline"
                      style={{ color: "#12796A" }}
                    >
                      {trackerRow.state === "Complete" ? "Review" : "Open"}
                    </Link>
                  ) : null}
                  {trackerRow.drawer ? (
                    <button
                      type="button"
                      onClick={() => openDrawer(trackerRow.drawer as DrawerSpec)}
                      className="text-[11px] font-semibold hover:underline"
                      style={{ color: "#12796A" }}
                    >
                      {trackerRow.act ?? (TRACKER_DONE.has(trackerRow.state) ? "Review" : "Open")}
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function pagerClass(active: boolean) {
  return cn(
    "inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-[7px] border px-[7px] text-[10.5px] font-semibold tabular-nums transition disabled:opacity-40",
    active
      ? "border-[#0D2315] bg-[#0D2315] text-white"
      : "border-[#DEE8E2] bg-white text-[#435048] enabled:hover:border-[#BFDCD1] enabled:hover:bg-[#F7FAF8]",
  );
}

/**
 * The icon tile at the head of a figure card: 28px, a soft tint and a hairline in the card's tone (a calm green when it has none),
 * and a drawn icon — the card's own, or the one its label or its figure calls for.
 */
function CardTile({ card }: { card: KpiCard }) {
  const swatch = card.tone && card.tone !== "neutral" ? toneOf(card.tone) : null;
  const [outline, fill] = cardIcon(card);
  const stroke = swatch ? swatch.fg : "#12796A";
  return (
    <span
      aria-hidden
      className="flex h-[28px] w-[28px] flex-none items-center justify-center rounded-[8px] border"
      style={{ background: swatch ? swatch.bg : "#EEF7F3", borderColor: swatch ? swatch.bd : "#D3E8DE" }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        {fill ? <path d={fill} fill={stroke} fillOpacity={0.16} stroke="none" /> : null}
        <path d={outline} />
      </svg>
    </span>
  );
}

export function PanelView({
  panel,
  openDrawer,
}: {
  panel: Panel;
  openDrawer: OpenDrawer;
}) {
  if (panel.type === "kpi") {
    // ONE card, everywhere in the product: same box, same 1px border, same label
    // scale, same numeral scale, same link affordance, same height. The state a
    // figure is in shows in the numeral colour — never in the box itself, so a
    // row of cards can never read as a row of different components. The mockup
    // is explicit that there is no dark variant here.
    const per = panel.per ?? Math.min(5, panel.cards.length) ?? 4;
    const minCol =
      per >= 6
        ? 142
        : per === 5
          ? 154
          : per === 4
            ? 176
            : per === 3
              ? 208
              : 240;

    // The row normally sits inside its own panel, headed by what it counts —
    // the School Admin mockup never lets a run of figures float loose. A page
    // that asks to be bare gets the cards alone, which is how the student's own
    // pages draw them.
    const bare = panel.bare === true;
    return (
      <section
        className={bare ? "min-w-0" : cn(PANEL_SHELL, "pb-[15px]")}
        style={bare ? undefined : { borderColor: CARD_BORDER }}
      >
        {bare ? null : (
          <PanelHeader
            title={panel.title ?? "Summary"}
            sub={panel.sub}
            openDrawer={openDrawer}
            flush
          />
        )}
        <div
          className="grid items-stretch gap-[10px]"
          style={{
            gridTemplateColumns: `repeat(auto-fit, minmax(${minCol}px, 1fr))`,
          }}
        >
          {panel.cards.map((card) => {
            const swatch = card.tone ? toneOf(card.tone) : null;
            // A card that offers a link always goes somewhere: with no page or form of its own it
            // opens a plain reading of the figure, so the link is never a dead end.
            const drawerSpec: DrawerSpec | undefined =
              card.drawer ??
              (card.link && !card.href
                ? { mode: "view", kicker: panel.title ?? "Summary", title: card.label, facts: [[card.label, `${card.value}${card.unit ? ` ${card.unit}` : ""}`, card.sub ?? ""].filter((part, index) => index < 2 || part) as PanelFact], readOnly: true, readOnlyNote: "A figure, read as it stands." }
                : undefined);
            const linked = Boolean(card.href || drawerSpec || card.link);

            const body = (
              <>
                <div className="mb-[9px] flex items-center justify-between gap-[9px]">
                  <span
                    className="flex min-w-0 items-center gap-[6px] text-[9.5px] font-semibold uppercase leading-[1.35] tracking-[0.05em]"
                    style={{ color: MUTED }}
                  >
                    {card.label}
                  </span>
                  <CardTile card={card} />
                </div>

                <div className="flex flex-wrap items-baseline gap-[6px]">
                  <span
                    className="text-[20.5px] font-extrabold leading-none tracking-[-0.03em] tabular-nums"
                    style={{ color: swatch ? swatch.fg : INK }}
                  >
                    {card.value}
                  </span>
                  {card.unit ? (
                    <span className="text-[10.5px]" style={{ color: MUTED }}>
                      {card.unit}
                    </span>
                  ) : null}
                </div>

                {slimSub(card.sub ?? "", card.label) ? (
                  <p
                    className="mt-[6px] line-clamp-2 text-pretty text-[10.5px] leading-[1.4]"
                    style={{ color: MUTED }}
                  >
                    {slimSub(card.sub ?? "", card.label)}
                  </p>
                ) : null}

                {card.link ? (
                  <span
                    className="mt-auto flex items-center gap-[5px] pt-[9px] text-[10.5px] font-semibold"
                    style={{ color: "#12796A" }}
                  >
                    {card.link}
                    <ArrowRight
                      className="h-[11px] w-[11px]"
                      strokeWidth={2.4}
                    />
                  </span>
                ) : null}
              </>
            );

            const className = cn(
              "group/kpi flex flex-col rounded-[14px] border bg-[var(--color-bg-surface)] px-[14px] pb-[14px] pt-[13px] transition-[transform,border-color] duration-150",
              linked && "cursor-pointer hover:-translate-y-px",
            );
            const style = {
              borderColor: CARD_BORDER,
              minHeight: linked ? 106 : 86,
            } as React.CSSProperties;

            if (card.href) {
              return (
                <Link
                  key={card.label}
                  href={card.href as Route}
                  className={cn(className, "hover:border-[#BFDCD1]")}
                  style={style}
                >
                  {body}
                </Link>
              );
            }

            if (drawerSpec) {
              const spec = drawerSpec;
              return (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => openDrawer(spec)}
                  className={cn(className, "text-left hover:border-[#BFDCD1]")}
                  style={style}
                >
                  {body}
                </button>
              );
            }

            return (
              <article key={card.label} className={className} style={style}>
                {body}
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  if (panel.type === "table") {
    return <TablePanel panel={panel} openDrawer={openDrawer} />;
  }

  if (panel.type === "list") {
    // The mockup's list is a tight run of rows separated by a hairline, not a
    // stack of cards: a 7px tone dot, the label and its sub, then the pill and
    // an explicit View chip — all on one line.
    return (
      <section className={PANEL_SHELL} style={{ borderColor: CARD_BORDER }}>
        <PanelHeader
          title={panel.title}
          sub={panel.sub}
          meta={panel.meta}
          tag={panel.tag}
          tagTone={panel.tagTone}
          acts={panel.acts}
          openDrawer={openDrawer}
        />
        {panel.items.length === 0 && panel.empty ? <p className="py-[14px] text-[11.5px]" style={{ color: MUTED }}>{panel.empty}</p> : null}
        <ul>
          {panel.items.map((item, index) => {
            const swatch = toneOf(item.tone);
            const trigger = {
              href: item.href,
              run: item.run,
              drawer:
                item.drawer ??
                (item.facts?.length
                  ? {
                      title: item.label,
                      sub: item.sub,
                      facts: item.facts,
                      readOnly: panel.readOnly,
                    }
                  : undefined),
            };
            const actionable = Boolean(trigger.href || trigger.drawer || trigger.run);
            // Every row can be read: with nothing authored for it, the row opens what it says.
            const rowRead: DrawerSpec | undefined = trigger.href || trigger.run
              ? undefined
              : (trigger.drawer ??
                { mode: "view", kicker: panel.title, title: item.label, sub: item.sub, facts: [["Item", item.label, item.sub ?? ""], ["State", item.pill ?? "—", ""]].map((fact) => (fact[2] ? fact : [fact[0], fact[1]])) as PanelFact[], readOnly: true, readOnlyNote: "This is a record of what happened. It is read-only." });

            return (
              <li
                key={`${item.label}-${index}`}
                className={cn("flex items-start gap-[10px] border-b py-[10px]", rowRead && "cursor-pointer")}
                style={{ borderColor: "#F2F7F4" }}
                onClick={rowRead ? (event) => { if ((event.target as HTMLElement).closest("a,button")) return; openDrawer(rowRead); } : undefined}
              >
                {item.lead ? (
                  <span
                    className="flex h-[38px] w-[38px] flex-none flex-col items-center justify-center rounded-[10px] border leading-none"
                    style={{ background: toneOf(item.lead.tone ?? item.tone).bg, borderColor: toneOf(item.lead.tone ?? item.tone).bd, color: toneOf(item.lead.tone ?? item.tone).fg }}
                    aria-hidden
                  >
                    {item.lead.top ? <span className="text-[8.5px] font-bold uppercase tracking-[0.06em]">{item.lead.top}</span> : null}
                    <span className="mt-[2px] text-[14px] font-extrabold tabular-nums">{item.lead.value}</span>
                  </span>
                ) : (
                  <span
                    className="mt-[4.5px] h-[7px] w-[7px] flex-none rounded-full"
                    style={{ background: swatch.dot }}
                  />
                )}

                <span className="min-w-0 flex-1">
                  <span
                    className="block text-pretty text-[11.5px] font-semibold leading-[1.4]"
                    style={{ color: INK }}
                  >
                    {item.label}
                  </span>
                  {item.sub ? (
                    <span
                      className="mt-[2.5px] block text-pretty text-[10.5px] leading-[1.5]"
                      style={{ color: MUTED }}
                    >
                      {item.sub}
                    </span>
                  ) : null}
                </span>

                {item.pill ? (
                  <span
                    className="flex flex-none items-center gap-[5px] rounded-full border px-[9px] py-[3px] text-[10.5px] font-semibold"
                    style={tonePillStyle(item.tone ?? "neutral")}
                  >
                    <span
                      className="h-[5px] w-[5px] rounded-full"
                      style={{ background: swatch.dot }}
                    />
                    {item.pill}
                  </span>
                ) : null}

                {actionable ? (
                  <TriggerControl
                    trigger={trigger}
                    label={item.viewLabel ?? "View"}
                    openDrawer={openDrawer}
                    className="flex flex-none items-center gap-[4px] whitespace-nowrap rounded-full border px-[9px] py-[3.5px] text-[10.5px] font-semibold transition hover:border-[#BFDCD1]"
                    style={{
                      color: "#12796A",
                      background: "#F2F7F4",
                      borderColor: "#E1EBE5",
                    }}
                  >
                    {item.viewLabel ?? "View"}
                    <ArrowRight
                      className="h-[9.5px] w-[9.5px]"
                      strokeWidth={2.4}
                    />
                  </TriggerControl>
                ) : null}
              </li>
            );
          })}
        </ul>
        {panel.foot ? <PanelFoot>{panel.foot}</PanelFoot> : null}
      </section>
    );
  }

  if (panel.type === "facts") {
    return (
      <section className={PANEL_SHELL} style={{ borderColor: CARD_BORDER }}>
        <PanelHeader
          title={panel.title}
          sub={panel.sub}
          meta={panel.meta}
          tag={panel.tag}
          tagTone={panel.tagTone}
          acts={panel.acts}
          openDrawer={openDrawer}
        />
        <FactList facts={panel.facts} per={panel.per} />
        {panel.foot ? <PanelFoot>{panel.foot}</PanelFoot> : null}
      </section>
    );
  }

  if (panel.type === "bars") {
    const max = Math.max(...panel.rows.map((barRow) => barRow.value), 1);

    return (
      <section className={PANEL_SHELL} style={{ borderColor: CARD_BORDER }}>
        <PanelHeader
          title={panel.title}
          sub={panel.sub}
          openDrawer={openDrawer}
        />
        <ul className="grid gap-3">
          {panel.rows.map((barRow) => (
            <li key={barRow.label}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="truncate text-[12.5px] text-[var(--color-text-primary)]">
                  {barRow.label}
                </span>
                <span
                  className="flex-none text-[12px] font-semibold tabular-nums"
                  style={toneTextStyle(barRow.tone)}
                >
                  {barRow.display}
                </span>
              </div>
              <div
                className="h-[7px] overflow-hidden rounded-full bg-[var(--color-bg-subtle)]"
                role="img"
                aria-label={`${barRow.label}: ${barRow.display}`}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, Math.round((barRow.value / max) * 100))}%`,
                    background: toneOf(barRow.tone, "submitted").dot,
                  }}
                />
              </div>
              {barRow.sub ? (
                <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                  {barRow.sub}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        {panel.foot ? <PanelFoot>{panel.foot}</PanelFoot> : null}
      </section>
    );
  }

  if (panel.type === "termFilter") {
    const swatch = toneOf(panel.statusTone, "progress");
    const chip = (entry: PanelChip) =>
      entry.disabled || !entry.href ? (
        <span
          key={entry.label}
          title={entry.disabled ? "Nothing on record for this term" : undefined}
          className="cursor-not-allowed whitespace-nowrap rounded-full border px-[12px] py-[6px] text-[11px] font-semibold"
          style={{ background: "#F4F6F5", color: "#9AA8A0", borderColor: "#E4EDE8" }}
        >
          {entry.label}
        </span>
      ) : (
        <Link
          key={entry.label}
          href={entry.href as Route}
          className="whitespace-nowrap rounded-full border px-[12px] py-[6px] text-[11px] font-semibold"
          style={entry.on ? { background: INK, color: "#fff", borderColor: INK } : { background: "#fff", color: "#22332A", borderColor: CARD_BORDER }}
        >
          {entry.label}
        </Link>
      );
    return (
      <section
        className="flex min-w-0 flex-wrap items-center gap-x-[18px] gap-y-[10px] rounded-[13px] border bg-[var(--color-bg-surface)] px-[14px] py-[11px]"
        style={{ borderColor: CARD_BORDER }}
        aria-label="Pick a term"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-[9px]">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.07em]" style={{ color: MUTED }}>Session</span>
          <div className="flex flex-wrap gap-[5px]">{panel.sessions.map(chip)}</div>
        </div>
        <span className="h-[22px] w-px flex-none" style={{ background: "#E4EDE8" }} />
        <div className="flex min-w-0 flex-wrap items-center gap-[9px]">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.07em]" style={{ color: MUTED }}>Term</span>
          <div className="flex flex-wrap gap-[5px]">{panel.terms.map(chip)}</div>
        </div>
        {panel.hint ? <span className="text-[10.5px]" style={{ color: MUTED }}>{panel.hint}</span> : null}
        <div className="ml-auto flex flex-wrap items-center gap-[8px]">
          <span
            className="flex items-center gap-[5px] whitespace-nowrap rounded-full border px-[9px] py-[3px] text-[10.5px] font-semibold"
            style={{ background: swatch.bg, color: swatch.fg, borderColor: swatch.bd }}
          >
            <span className="h-[6px] w-[6px] rounded-full" style={{ background: swatch.dot }} />
            {panel.status}
          </span>
          {panel.back ? (
            <Link
              href={panel.back.href as Route}
              className="whitespace-nowrap rounded-[9px] border bg-white px-[11px] py-[6px] text-[11px] font-semibold"
              style={{ borderColor: CARD_BORDER, color: "#435048" }}
            >
              {panel.back.label}
            </Link>
          ) : null}
        </div>
      </section>
    );
  }

  if (panel.type === "tray") {
    const lit = panel.items.find((item) => item.on) ?? panel.items[0];
    return (
      <section className="min-w-0 rounded-[13px] p-[5px]" style={{ background: INK }} aria-label="Browse by section">
        <div className="flex gap-[3px] overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {panel.items.map((item) => (
            <TriggerControl
              key={item.label}
              trigger={item}
              label={item.label}
              openDrawer={openDrawer}
              className={`flex h-[38px] flex-[1_0_auto] items-center justify-center gap-[7px] rounded-[9px] px-[13px] transition-[background,color] duration-150 ${item.on ? "bg-white text-[#0D2315] shadow-[0_6px_16px_-8px_rgba(0,0,0,0.55)]" : "bg-transparent text-white/80 hover:bg-white/10 hover:text-white"}`}
            >
              <span className="whitespace-nowrap text-[11.5px] font-semibold" title={item.desc ?? item.label}>{item.label}</span>
              {item.flag ? <span className="h-[6px] w-[6px] flex-none rounded-full" style={{ background: item.flagTone === "due" ? (item.on ? "#D08A12" : "#F2B84B") : item.on ? "#1A8C78" : "#5FD6B4" }} /> : null}
              <span className={`flex-none rounded-full px-[6.5px] py-[1.5px] text-[10px] font-bold tabular-nums ${item.on ? "bg-[#0D2315] text-white" : "bg-white/10 text-white/85"}`}>{item.count}</span>
            </TriggerControl>
          ))}
        </div>
        {lit ? (
          <div className="flex flex-wrap items-center justify-between gap-x-[18px] gap-y-[8px] px-[9px] pb-[4px] pt-[9px]">
            <p className="min-w-0 flex-[1_1_260px] text-pretty text-[11px] leading-[1.45] text-white/70">
              <span className="mr-[8px] text-[12px] font-bold text-white">{lit.label}</span>
              {lit.desc}
            </p>
            <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center gap-x-[16px] gap-y-[6px]">
              {(lit.facts ?? []).map(([name, value, due]) => (
                <span key={`${name}${value}`} className="flex items-baseline gap-[5px] whitespace-nowrap text-[10.5px]">
                  {name ? <span className="text-white/60">{name}</span> : null}
                  <span className="font-semibold" style={{ color: due ? "#F5C76B" : "#fff" }}>{value}</span>
                </span>
              ))}
              {lit.cta ? (
                <TriggerControl
                  trigger={lit.cta}
                  label={lit.cta.label}
                  openDrawer={openDrawer}
                  className="flex items-center gap-[6px] rounded-[8px] px-[11px] py-[6.5px] text-[10.5px] font-bold"
                  style={{ background: "#5FD6B4", color: INK }}
                >
                  {lit.cta.label}
                  <svg width="10.5" height="10.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h13M13 6.5l5.5 5.5L13 17.5" /></svg>
                </TriggerControl>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  if (panel.type === "tiles") {
    return (
      <section className={PANEL_SHELL} style={{ borderColor: CARD_BORDER }}>
        <PanelHeader
          title={panel.title}
          sub={panel.sub}
          meta={panel.meta}
          tag={panel.tag}
          tagTone={panel.tagTone}
          openDrawer={openDrawer}
          flush
        />
        <div
          className="tile-grid grid gap-[11px]"
          style={
            { ["--tile-per" as string]: panel.per ?? 2 } as React.CSSProperties
          }
        >
          {panel.tiles.map((tile) => {
            // Tiles default to the positive tone, as the mockup does.
            const swatch = toneOf(tile.tone, "positive");

            return (
              <TriggerControl
                key={tile.label}
                trigger={tile}
                label={tile.label}
                openDrawer={openDrawer}
                className="flex items-start gap-[11px] rounded-[13px] border bg-[var(--color-bg-surface)] px-[14px] py-[13px] text-left transition-[transform,border-color,background] duration-150 hover:-translate-y-px hover:border-[#BFDCD1] hover:bg-[#F6FBF9]"
                style={{ borderColor: CARD_BORDER }}
              >
                <span
                  className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[10px] border"
                  style={{ background: swatch.bg, borderColor: swatch.bd }}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={swatch.fg}
                    strokeWidth={1.85}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d={tile.icon ?? "M5 12h13M13 6.5l5.5 5.5L13 17.5"} />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block text-[11.5px] font-semibold leading-[1.3]"
                    style={{ color: INK }}
                  >
                    {tile.label}
                  </span>
                  {tile.sub ? (
                    <span
                      className="mt-[2.5px] block text-pretty text-[10px] leading-[1.45]"
                      style={{ color: MUTED }}
                    >
                      {tile.sub}
                    </span>
                  ) : null}
                </span>
              </TriggerControl>
            );
          })}
        </div>
      </section>
    );
  }

  if (panel.type === "device") {
    return <DevicePanel title={panel.title} sub={panel.sub} />;
  }

  if (panel.type === "steps") {
    // The mockup draws a pipeline as one ink bar of numbered pills: what is done is ticked, where things
    // stand is lifted, and what is still to come is dimmed. A stage that opens somewhere is a link. A run of
    // children or weeks adds arrows either side and says where you are at the right — and wraps, never slides.
    const arrow = (href: string | undefined, title: string, path: string) => {
      const style = { width: 28, height: 28, borderRadius: 9, background: href ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)", border: `1px solid rgba(255,255,255,${href ? 0.22 : 0.08})`, color: href ? "#fff" : "rgba(255,255,255,0.3)" };
      const body = (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
      );
      return href ? (
        <Link href={href as Route} title={title} aria-label={title} className="flex flex-none items-center justify-center" style={style}>{body}</Link>
      ) : (
        <span aria-hidden="true" className="flex flex-none items-center justify-center" style={style}>{body}</span>
      );
    };
    const arrows = Boolean(panel.prevHref || panel.nextHref);
    return (
      <section className="min-w-0 overflow-hidden rounded-[14px]" style={{ background: "#0D2315" }} aria-label={panel.title ?? "Stages"}>
        {panel.title || panel.sub ? (
          <div className="px-[16px] pt-[12px]">
            {panel.title ? <h3 className="text-[12px] font-semibold text-white">{panel.title}</h3> : null}
            {panel.sub ? <p className="mt-[2px] text-[10.5px]" style={{ color: "rgba(255,255,255,0.55)" }}>{panel.sub}</p> : null}
          </div>
        ) : null}
        <div className={arrows ? "flex items-center gap-[8px] px-[12px] py-[11px]" : "px-[16px] py-[14px]"}>
          {arrows ? arrow(panel.prevHref, panel.prevTitle ?? "Previous", "M14.5 5.5 8 12l6.5 6.5") : null}
        <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-[7px]">
          {panel.steps.map((step, index) => {
            const now = step.state === "current";
            const next = step.state === "todo";
            const blocked = step.state === "blocked";
            const body = (
              <>
                <span
                  className="flex h-[18px] min-w-[18px] flex-none items-center justify-center rounded-full px-[3px] text-[9.5px] font-bold"
                  style={{ background: step.state === "done" ? "#fff" : blocked ? "#DB5555" : now ? "#12796A" : "rgba(255,255,255,0.12)", color: step.state === "done" ? "#0D2315" : "#fff" }}
                >
                  {step.state === "done" ? "\u2713" : (step.n ?? index + 1)}
                </span>
                <span className="whitespace-nowrap text-[10.5px] font-semibold">{step.label}</span>
                {step.sub ? <span className="whitespace-nowrap text-[10px]" style={{ color: "rgba(255,255,255,0.55)" }}>{step.sub}</span> : null}
              </>
            );
            const style = { color: next ? "rgba(255,255,255,0.5)" : "#fff", background: now ? "rgba(255,255,255,0.14)" : "transparent", border: `1px solid ${now ? "rgba(255,255,255,0.2)" : "transparent"}` };
            const className = "flex items-center gap-[8px] rounded-full px-[11.5px] py-[7px]";
            return (
              <li key={`${step.label}-${index}`} aria-current={now ? "step" : undefined}>
                {step.href ? (
                  <Link href={step.href as Route} className={cn(className, "transition hover:bg-white/10")} style={style}>
                    {body}
                  </Link>
                ) : (
                  <span className={className} style={style}>
                    {body}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
          {arrows ? arrow(panel.nextHref, panel.nextTitle ?? "Next", "M9.5 5.5 16 12l-6.5 6.5") : null}
          {panel.note ? <span className="hidden flex-none whitespace-nowrap pr-[4px] text-[10.5px] font-semibold md:block" style={{ color: "rgba(255,255,255,0.62)" }}>{panel.note}</span> : null}
        </div>
        {panel.foot ? <p className="px-[16px] pb-[12px] text-[10.5px]" style={{ color: "rgba(255,255,255,0.55)" }}>{panel.foot}</p> : null}
      </section>
    );
  }

  if (panel.type === "courses") {
    return (
      <section className={PANEL_SHELL} style={{ borderColor: CARD_BORDER }}>
        <PanelHeader title={panel.title} sub={panel.sub} openDrawer={openDrawer} />
        <div className="-mx-[2px] grid gap-[11px] pb-[6px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
          {panel.cards.map((card) => {
            const swatch = toneOf(card.tone);
            return (
              <Link key={`${card.title}-${card.href}`} href={card.href as Route} className="flex min-w-0 flex-col gap-[9px] rounded-[13px] border bg-white px-[15px] py-[14px] transition hover:-translate-y-px hover:border-[#BFDCD1]" style={{ borderColor: CARD_BORDER }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px]" style={{ background: swatch.bg, color: swatch.fg }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={card.icon ?? "M5 4.5h9.5A2.5 2.5 0 0 1 17 7v12.5H7.5A2.5 2.5 0 0 1 5 17zM9 8.5h5M9 12h5"} /></svg>
                  </span>
                  <span className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border px-[9px] py-[3px] text-[10.5px] font-semibold" style={tonePillStyle(card.tone)}>
                    <span className="h-[5px] w-[5px] rounded-full" style={{ background: swatch.dot }} />
                    {card.pill}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-pretty text-[12.5px] font-bold leading-[1.35]" style={{ color: INK }}>{card.title}</p>
                  <p className="mt-[3px] text-[10.5px] leading-[1.4]" style={{ color: MUTED }}>{card.meta}</p>
                </div>
                {card.why ? (
                  <p className="text-pretty rounded-[9px] border px-[9px] py-[7px] text-[10.5px] leading-[1.45]" style={{ color: "#17604F", background: "#F1F8F4", borderColor: "#DCEEE5" }}>{card.why}</p>
                ) : null}
                <div className="mt-auto flex items-center justify-between gap-3 pt-[2px]">
                  <div className="min-w-0 flex-1">
                    {card.pct !== undefined ? (
                      <>
                        <div className="h-[4px] overflow-hidden rounded-full" style={{ background: "#E6EEE9" }}><div className="h-full rounded-full" style={{ width: `${card.pct}%`, background: card.pct >= 100 ? "#22A06B" : "#4A83CE" }} /></div>
                        <p className="mt-[5px] text-[10px] tabular-nums" style={{ color: MUTED }}>{card.progress}</p>
                      </>
                    ) : null}
                  </div>
                  <span className="flex-none text-[10.5px] font-semibold" style={{ color: "#12796A" }}>{card.cta} →</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    );
  }

  if (panel.type === "tracker") {
    return <TrackerPanel panel={panel} openDrawer={openDrawer} />;
  }

  if (panel.type === "blockers") {
    // Same shape as a list row: a tone dot, the thing and why, and the action
    // that clears it — never a boxed card.
    return (
      <section className={PANEL_SHELL} style={{ borderColor: CARD_BORDER }}>
        <PanelHeader
          title={panel.title}
          sub={panel.sub}
          meta={panel.meta}
          tag={panel.tag}
          tagTone={panel.tagTone}
          acts={panel.acts}
          openDrawer={openDrawer}
          onExport={() => {
            const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
            const lines = [["Item", "Detail"].map(escape).join(","), ...panel.items.map((item) => [item.title, item.detail].map(escape).join(","))];
            const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${panel.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "list"}.csv`;
            link.click();
            URL.revokeObjectURL(url);
          }}
        />
        <ul>
          {panel.items.map((item) => (
            <li
              key={item.title}
              className="flex items-start gap-[11px] border-b py-[11px]"
              style={{ borderColor: "#F2F7F4" }}
            >
              <span
                className="mt-[4.5px] h-[7px] w-[7px] flex-none rounded-full"
                style={{ background: toneOf(item.tone, "negative").dot }}
              />
              <span className="min-w-0 flex-1">
                <span
                  className="block text-pretty text-[11.5px] font-semibold leading-[1.4]"
                  style={{ color: INK }}
                >
                  {item.title}
                </span>
                <span
                  className="mt-[2.5px] block text-pretty text-[10.5px] leading-[1.5]"
                  style={{ color: MUTED }}
                >
                  {item.detail}
                </span>
              </span>
              <TriggerControl
                trigger={item}
                label={item.action}
                openDrawer={openDrawer}
                className="flex flex-none items-center gap-[5px] whitespace-nowrap text-[10.5px] font-semibold hover:underline"
                style={{ color: "#12796A" }}
              >
                {item.action}
                <ArrowRight className="h-[11px] w-[11px]" strokeWidth={2.4} />
              </TriggerControl>
            </li>
          ))}
        </ul>
      </section>
    );
  }


/* ------------------------------------------------------------------- Form */

/**
 * A form field, as the mockup draws it.
 *
 * A form is the only panel a person types into, so it shows controls rather
 * than values — a settings page rendered as a list of facts reads as a report
 * of what somebody else already decided.
 */

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; message: string }
  | { kind: "failed"; message: string };

/**
 * A form panel.
 *
 * The fields' values live here rather than in each field, so the panel can
 * build one payload out of them. Only the fields named in `submit.map` travel:
 * a form may show something the endpoint does not accept — a name the school
 * sets — without quietly posting it into a request that would be refused.
 */
function FormPanel({
  panel,
  openDrawer,
}: {
  panel: Extract<Panel, { type: "form" }>;
  openDrawer: OpenDrawer;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(panel.fields.map((field) => [field.label, initialValue(field)])),
  );
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const minCol = panel.per === 1 ? 300 : 210;
  const submit = panel.submit;

  async function save() {
    if (!submit) return;
    setState({ kind: "saving" });

    const payload: Record<string, unknown> = {};
    for (const [label, key] of Object.entries(submit.map)) {
      const value = values[label];
      // An emptied box is sent as "" so a field can be cleared; the API turns
      // that into null. Only a field with no value at all is left out.
      if (value !== undefined) payload[key] = value;
    }

    try {
      const response = await fetch(submit.endpoint, {
        method: submit.method ?? "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": readCookie("fr_csrf") ?? "",
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (!response.ok || result.ok === false) {
        throw new Error(readableError(result.error ?? result.message));
      }
      if (submit.clearOnSuccess?.length) {
        setValues((current) => ({
          ...current,
          ...Object.fromEntries(submit.clearOnSuccess!.map((label) => [label, ""])),
        }));
      }
      setState({ kind: "saved", message: submit.done });
    } catch (error) {
      setState({
        kind: "failed",
        message: error instanceof Error ? error.message : "That did not save.",
      });
    }
  }

  const note =
    state.kind === "saved"
      ? state.message
      : state.kind === "failed"
        ? state.message
        : state.kind === "saving"
          ? "Saving…"
          : (panel.formNote ?? "");
  const noteColour =
    state.kind === "saved"
      ? "#17714F"
      : state.kind === "failed" || panel.formNoteTone === "critical"
        ? "#B23B3B"
        : MUTED;

  return (
    <section className={PANEL_SHELL} style={{ borderColor: CARD_BORDER }}>
      <PanelHeader
        title={panel.title ?? ""}
        sub={panel.sub}
        meta={panel.meta}
        tag={panel.tag}
        tagTone={panel.tagTone}
        openDrawer={openDrawer}
      />
      <div
        className="grid gap-x-4 gap-y-[14px] pb-[4px]"
        style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${minCol}px, 1fr))` }}
      >
        {panel.fields.map((field, index) => (
          <Field
            key={`${field.label}-${index}`}
            field={field}
            value={values[field.label]}
            setValue={(next) => {
              setValues((current) => ({ ...current, [field.label]: next }));
              setState({ kind: "idle" });
            }}
          />
        ))}
      </div>
      {note || panel.actions?.length ? (
        <div className="mt-[14px] flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border-default)] pt-[13px]">
          <p
            className="min-w-0 flex-[1_1_200px] text-pretty text-[10.5px] leading-[1.5]"
            role={state.kind === "failed" ? "alert" : undefined}
            style={{
              color: noteColour,
              fontWeight: state.kind === "idle" && panel.formNoteTone !== "critical" ? 400 : 600,
            }}
          >
            {note}
          </p>
          {panel.actions?.length ? (
            <div className="flex flex-none flex-wrap gap-2">
              {panel.actions.map((act) => {
                const className = cn(
                  "inline-flex items-center whitespace-nowrap rounded-[9px] text-[11.5px] font-semibold transition",
                  act.primary
                    ? "bg-[#0D2315] px-[15px] py-[9px] text-white disabled:opacity-60"
                    : "border bg-white px-[14px] py-[8px] text-[#435048]",
                );

                // The primary action of a wired form saves it, rather than
                // opening a drawer that describes a save that never happens.
                if (act.primary && submit) {
                  return (
                    <button
                      key={act.label}
                      type="button"
                      onClick={save}
                      disabled={state.kind === "saving"}
                      className={className}
                    >
                      {state.kind === "saving" ? "Saving…" : act.label}
                    </button>
                  );
                }

                return (
                  <TriggerControl
                    key={act.label}
                    trigger={act}
                    label={act.label}
                    openDrawer={openDrawer}
                    className={className}
                    style={act.primary ? undefined : { borderColor: CARD_BORDER }}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}


  if (panel.type === "form") {
    return <FormPanel panel={panel} openDrawer={openDrawer} />;
  }

  if (panel.type === "quote") {
    return (
      <blockquote className="surface-card border-l-[3px] border-l-[var(--color-accent-primary)] p-4 md:p-5">
        <p className="text-[13px] leading-[1.6] text-[var(--color-text-primary)]">
          {panel.body}
        </p>
        {panel.attribution ? (
          <footer className="mt-2 text-[11.5px] text-[var(--color-text-muted)]">
            {panel.attribution}
          </footer>
        ) : null}
      </blockquote>
    );
  }

  if (panel.type === "note") {
    // A note is the one panel that carries its tone in the box itself: the tint,
    // the border, the icon stroke and the type are all the state's own colour.
    const swatch = toneOf(panel.tone);
    const icon = panel.icon ?? NOTE_ICON;

    return (
      <section
        className="flex min-w-0 items-start gap-3 rounded-[14px] border px-[17px] py-[15px]"
        style={{ background: swatch.bg, borderColor: swatch.bd }}
      >
        <span
          className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[9px] border bg-white"
          style={{ borderColor: swatch.bd }}
          aria-hidden
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={swatch.fg}
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={icon} />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          {panel.title ? (
            <p
              className="text-[11.5px] font-bold leading-[1.35]"
              style={{ color: swatch.fg }}
            >
              {panel.title}
            </p>
          ) : null}
          <p
            className="mt-[3px] text-[11px] leading-[1.55] opacity-[0.88]"
            style={{ color: swatch.fg }}
          >
            {panel.body}
          </p>
          {panel.acts?.length ? (
            <div className="mt-[11px] flex flex-wrap items-center gap-[7px]">
              {panel.acts.map((act, index) => (
                <TriggerControl
                  key={act.label}
                  trigger={act}
                  label={act.label}
                  openDrawer={openDrawer}
                  className="inline-flex items-center rounded-[8px] px-[12px] py-[6.5px] text-[10.5px] font-semibold transition"
                  style={
                    index === 0
                      ? { background: swatch.fg, color: "#fff" }
                      : {
                          background: "#fff",
                          border: `1px solid ${swatch.bd}`,
                          color: swatch.fg,
                        }
                  }
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (panel.type === "roster") {
    return <AttendanceGrid panel={panel} />;
  }

  if (panel.type === "tierChange") {
    return <TierChange panel={panel} />;
  }

  if (panel.type === "scores") {
    return <ScoreGrid panel={panel} />;
  }

  if (panel.type === "embed") return <EmbeddedPanel component={panel.component} props={panel.props} openDrawer={openDrawer} />;
  if (panel.type === "marker") return <RegisterMarker panel={panel} openDrawer={openDrawer} />;
  if (panel.type === "sheet") return <SheetEntry panel={panel} openDrawer={openDrawer} />;
  if (panel.type === "days") return <DayStrip panel={panel} />;

  if (panel.type === "grid") return <GridPanelView panel={panel} openDrawer={openDrawer} />;
  if (panel.type === "flow") return <FlowPanelView panel={panel} openDrawer={openDrawer} />;
  if (panel.type === "quotes") return <QuotesPanelView panel={panel} openDrawer={openDrawer} />;

  // pending
  return (
    <section className="surface-card border-dashed p-4 md:p-5">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        Not built yet
      </p>
      <h3 className="mt-1.5 text-[14px] font-bold text-[var(--color-text-primary)]">
        {panel.title}
      </h3>
      <p className="mt-1.5 text-[12.5px] leading-[1.55] text-[var(--color-text-secondary)]">
        {panel.body}
      </p>
      <ul className="mt-3 grid gap-1.5 border-t border-[var(--color-border-default)] pt-3">
        {panel.contains.map((entry) => (
          <li
            key={entry}
            className="flex gap-2 text-[12px] leading-[1.5] text-[var(--color-text-muted)]"
          >
            <span aria-hidden="true">·</span>
            <span>{entry}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The panels themselves, driven by a drawer that someone else owns. */
export function PanelRowsWithDrawer({
  rows,
  openDrawer,
}: {
  rows: PanelRow[];
  openDrawer: OpenDrawer;
}) {
  // A panel marked `tuck` is not on the page: it is one line at the foot of it that opens the
  // same content, so the rules a page runs on stay reachable without the page being half rules.
  const tucked: Panel[] = [];
  const kept = rows
    .map((panelRow) => {
      const panels = panelRow.panels.filter((panel) => {
        if (isTucked(panel)) {
          tucked.push(panel);
          return false;
        }
        return true;
      });
      if (!panels.length) return null;
      const cols = panels.length === panelRow.panels.length ? panelRow.cols : panels.map(() => "1fr").join(" ");
      return { cols, panels };
    })
    .filter((row): row is PanelRow => row !== null);

  return (
    <div className="grid min-w-0 gap-4">
      {kept.map((panelRow, index) => (
        <div
          key={index}
          // One column on small screens; the mockup's ratios apply from lg up via
          // the --panel-cols custom property (see .panel-row in globals.css).
          className="panel-row grid gap-4"
          style={
            { ["--panel-cols" as string]: panelRow.cols } as React.CSSProperties
          }
        >
          {panelRow.panels.map((panel, panelIndex) => (
            <PanelView key={panelIndex} panel={panel} openDrawer={openDrawer} />
          ))}
        </div>
      ))}
      {tucked.length ? (
        <div className="flex flex-wrap items-center gap-2 pt-[2px]">
          {tucked.map((panel, index) => (
            <button
              key={index}
              type="button"
              onClick={() => openDrawer(tuckDrawer(panel))}
              className="flex items-center gap-[7px] rounded-full border bg-white py-[7px] pl-[10px] pr-[14px] transition hover:border-[#BFDCD1] hover:bg-[#F1F8F4]"
              style={{ borderColor: "#E3ECE6" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#12796A" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
                <path d={("tuckIcon" in panel && panel.tuckIcon) || TUCK_ICON} />
              </svg>
              <span className="whitespace-nowrap text-[10.5px] font-semibold" style={{ color: "#435048" }}>
                {(panel as { tuck: string }).tuck}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Panels that own their own drawer — used where there is no module header. */
export function PanelRows({ rows }: { rows: PanelRow[] }) {
  const [drawer, setDrawer] = useState<DrawerSpec | null>(null);

  return (
    <>
      <ModuleDrawer spec={drawer} onClose={() => setDrawer(null)} />
      <PanelRowsWithDrawer rows={rows} openDrawer={setDrawer} />
    </>
  );
}
