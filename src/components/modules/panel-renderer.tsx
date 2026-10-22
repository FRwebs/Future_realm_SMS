"use client";

import { EmbeddedPanel } from "@/components/modules/embed-registry";
import { DevicePanel } from "@/components/modules/device-panel";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Minus,
  Search,
  X,
} from "lucide-react";

import { AttendanceGrid } from "@/components/modules/attendance-grid";
import { DayStrip } from "@/components/modules/day-strip";
import { SheetEntry } from "@/components/modules/sheet-entry";
import { RegisterMarker } from "@/components/modules/register-marker";
import { ScoreGrid } from "@/components/modules/score-grid";
import { FlowPanelView, GridPanelView, QuotesPanelView } from "@/components/modules/panel-extras";
import { Field, initialValue } from "@/components/modules/field";
import { ModuleDrawer } from "@/components/modules/module-drawer";
import type {
  DrawerSpec,
  Panel,
  PanelAction,
  PanelFact,
  PanelRow,
  PanelTone,
  TableCellKind,
  TableRow,
  Trigger,
} from "@/lib/modules/panels";
import { readCookie, readableError } from "@/lib/modules/submit";
import { CARD_BORDER, INK, MUTED, toneOf } from "@/lib/modules/tones";
import { cn } from "@/lib/utils/cn";

/** Opens whatever a trigger points at: a route, or a drawer over this page. */
type OpenDrawer = (spec: DrawerSpec) => void;

/** The mockup's default note icon: the warning triangle. */
const NOTE_ICON = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";

/**
 * The supporting line under a figure earns its place by adding something the
 * label and the number do not already say. Anything longer than a glance is cut
 * back to the clauses that do — the rest belongs on the list the card links to.
 */
function slimSub(value: string): string {
  const text = value.trim();
  if (text.length <= 46) return text;

  const parts = text.split(" · ");
  if (parts.length === 1) return text;

  let out = parts[0]!;
  for (const part of parts.slice(1)) {
    if (`${out} · ${part}`.length > 46) break;
    out += ` · ${part}`;
  }
  return out;
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
      {facts.map(([label, value, hint], index) => (
        <div key={`${label}-${index}`} className="min-w-0">
          <dt className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.05em] text-[#67766D]">
            {label}
          </dt>
          <dd className="min-w-0">
            <span className="block text-[12.5px] font-semibold leading-[1.35] text-[#0D2315]">
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
      <div className="flex min-w-0 items-center gap-[9px]">
        {cell.avatar === false ? null : (
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
    const base = "inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border px-[9px] py-[3px] text-[10.5px] font-semibold";
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

/** Text a row exposes to the search box and the column filters. */
function rowText(tableRow: TableRow): string[] {
  const cells = tableRow.cells.map((cell) => {
    if (cell.kind === "name") return `${cell.name} ${cell.sub ?? ""}`;
    if (cell.kind === "pill") return cell.label;
    if (cell.kind === "bar") return cell.label;
    if (cell.kind === "action") return "";
    // A tick is searchable as the word, so "included" narrows a comparison table.
    if (cell.kind === "mark") return cell.ok ? "Included" : "Not included";
    if (cell.kind === "node") return cell.plain ?? "";
    return cell.text;
  });
  return [...cells, tableRow.keywords ?? ""];
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
  const [query, setQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (panel.filters ?? []).map((filter) => [filter.label, filter.value]),
    ),
  );
  const [selected, setSelected] = useState<Set<TableRow>>(new Set());
  const [page, setPage] = useState(0);
  const router = useRouter();

  const noun = panel.noun ?? "row";
  const nounPlural = panel.nounPlural ?? `${noun}s`;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return panel.rows.filter((tableRow) => {
      const texts = rowText(tableRow);

      if (
        needle &&
        !texts.some((value) => value.toLowerCase().includes(needle))
      ) {
        return false;
      }

      for (const filter of panel.filters ?? []) {
        const chosen = filterValues[filter.label];
        // The first option is the "all" one and never narrows anything; a switcher between pages never narrows this one.
        if (!chosen || chosen === filter.options[0] || filter.go) continue;

        const haystack =
          filter.column !== undefined ? [texts[filter.column] ?? ""] : texts;
        const wanted = (filter.match?.[chosen] ?? chosen).toLowerCase();
        if (!haystack.some((value) => value.toLowerCase().includes(wanted))) {
          return false;
        }
      }

      return true;
    });
  }, [panel.rows, panel.filters, query, filterValues]);

  // Any list long enough to need it is paged, without each page asking for it.
  const perPage = panel.per ?? (filtered.length > 12 ? 12 : filtered.length);
  const pageCount =
    perPage > 0 ? Math.max(1, Math.ceil(filtered.length / perPage)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const visible =
    perPage > 0
      ? filtered.slice(safePage * perPage, safePage * perPage + perPage)
      : filtered;

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

  /** The ticked rows, or every row that passes the filters when none is ticked. */
  function exportRows(onlySelected: boolean) {
    const rows = onlySelected ? panel.rows.filter((row) => selected.has(row)) : filtered;
    const keep = panel.head.map((heading, index) => (heading.trim() ? index : -1)).filter((index) => index >= 0);
    const cell = (value: TableCellKind | undefined) => {
      if (!value) return "";
      if (value.kind === "name") return value.sub ? `${value.name} (${value.sub})` : value.name;
      if (value.kind === "pill") return value.label;
      if (value.kind === "bar") return value.label;
      if (value.kind === "mark") return value.ok ? "Yes" : "No";
      if (value.kind === "action") return "";
      if (value.kind === "node") return value.plain ?? "";
      return value.text;
    };
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = [
      keep.map((index) => escape(panel.head[index])).join(","),
      ...rows.map((row) => keep.map((index) => escape(cell(row.cells[index]))).join(",")),
    ];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${panel.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "export"}.csv`;
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
  const gap = dense ? "5px" : "9px";
  const edge = (index: number) =>
    cn(
      index === 0 && !panel.selectable ? "pl-[18px]" : dense ? "pl-[5px]" : "pl-[9px]",
      index === lastIndex ? "pr-[18px]" : dense ? "pr-[5px]" : "pr-[9px]",
    );
  void gap;
  // The meta line asserts a count; the pager states the truth below it. Where the two disagree the
  // line says which it is, appended — so an authored figure can never contradict the rows.
  const claimed = panel.meta?.match(/^([\d,]+)\s+(\S+)/);
  const metaLine =
    panel.meta && claimed && claimed[2].toLowerCase().replace(/[^a-z]/g, "") === nounPlural.toLowerCase().replace(/[^a-z]/g, "") && Number(claimed[1].replace(/,/g, "")) !== filtered.length
      ? `${panel.meta} · showing ${filtered.length.toLocaleString("en-NG")}`
      : panel.meta;
  const filterNote =
    filtered.length === panel.rows.length
      ? `${panel.rows.length.toLocaleString("en-NG")} ${panel.rows.length === 1 ? noun : nounPlural}`
      : `${filtered.length.toLocaleString("en-NG")} of ${panel.rows.length.toLocaleString("en-NG")} ${nounPlural}`;

  return (
    <section
      className={cn(PANEL_SHELL, "pb-0")}
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
                  setQuery(event.target.value);
                  setPage(0);
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
                return (
                  <TriggerControl
                    key={act.label}
                    trigger={{ href: act.href, drawer: spec ?? undefined }}
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
            {panel.rows.length === 0
              ? (panel.emptyTitle ?? "Nothing here yet")
              : `No ${nounPlural} match that`}
          </p>
          <p
            className="mx-auto max-w-[420px] text-[11px] leading-[1.55]"
            style={{ color: MUTED }}
          >
            {panel.rows.length === 0
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
            {`Showing ${safePage * perPage + 1}–${Math.min(filtered.length, safePage * perPage + perPage)} of ${filtered.length} ${filtered.length === 1 ? noun : nounPlural}`}
          </p>
          <div className="flex flex-none items-center gap-[5px]">
            <button
              type="button"
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage === 0}
              aria-label="Previous page"
              className={pagerClass(false)}
            >
              <ChevronLeft
                className="h-[11.5px] w-[11.5px]"
                strokeWidth={2.4}
              />
            </button>
            {Array.from({ length: pageCount }, (_, number) => (
              <button
                key={number}
                type="button"
                onClick={() => setPage(number)}
                aria-current={number === safePage ? "page" : undefined}
                className={pagerClass(number === safePage)}
              >
                {number + 1}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
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

    // The row sits inside its own panel, headed by what it counts — the mockup
    // never lets a run of figures float loose on the page.
    return (
      <section
        className={cn(PANEL_SHELL, "pb-[15px]")}
        style={{ borderColor: CARD_BORDER }}
      >
        <PanelHeader
          title={panel.title ?? "Summary"}
          sub={panel.sub}
          openDrawer={openDrawer}
          flush
        />
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
                <div className="mb-[10px] flex items-start justify-between gap-[9px]">
                  <span
                    className="flex min-w-0 items-center gap-[6px] text-[9.5px] font-semibold uppercase leading-[1.35] tracking-[0.05em]"
                    style={{ color: MUTED }}
                  >
                    {card.label}
                  </span>
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

                {card.sub ? (
                  <p
                    className="mt-[6px] line-clamp-2 text-pretty text-[10.5px] leading-[1.4]"
                    style={{ color: MUTED }}
                  >
                    {slimSub(card.sub)}
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
                <span
                  className="mt-[4.5px] h-[7px] w-[7px] flex-none rounded-full"
                  style={{ background: swatch.dot }}
                />

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
