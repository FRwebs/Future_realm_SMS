"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Search } from "lucide-react";

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
import { CARD_BORDER, INK, MUTED, toneOf } from "@/lib/modules/tones";
import { cn } from "@/lib/utils/cn";

/** Opens whatever a trigger points at: a route, or a drawer over this page. */
type OpenDrawer = (spec: DrawerSpec) => void;

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
      <button type="button" onClick={() => openDrawer(spec)} className={className} style={style}>
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

function PanelHeader({
  title,
  sub,
  meta,
  tag,
  tagTone = "neutral",
  acts,
  openDrawer,
}: {
  title: string;
  sub?: string;
  meta?: string;
  tag?: string;
  tagTone?: PanelTone;
  acts?: PanelAction[];
  openDrawer: OpenDrawer;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[14px] font-bold tracking-[-0.01em] text-[var(--color-text-primary)]">
            {title}
          </h3>
          {tag ? (
            <span
              className="rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.05em]"
              style={tonePillStyle(tagTone)}
            >
              {tag}
            </span>
          ) : null}
        </div>
        {sub ? (
          <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--color-text-secondary)]">{sub}</p>
        ) : null}
        {meta ? (
          <p className="mt-1 text-[11.5px] text-[var(--color-text-muted)]">{meta}</p>
        ) : null}
      </div>
      {acts?.length ? (
        <div className="flex flex-none flex-wrap gap-2">
          {acts.map((act) => (
            <TriggerControl
              key={act.label}
              trigger={act}
              label={act.label}
              openDrawer={openDrawer}
              className={cn(
                "inline-flex items-center rounded-full px-3.5 py-2 text-[12px] font-semibold transition",
                act.primary
                  ? "bg-[#0d2315] text-white hover:bg-[#164028]"
                  : "border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PanelFoot({ children }: { children: string }) {
  return (
    <p className="mt-3 border-t border-[var(--color-border-default)] pt-3 text-[11.5px] leading-[1.5] text-[var(--color-text-muted)]">
      {children}
    </p>
  );
}

function FactList({ facts }: { facts: PanelFact[] }) {
  return (
    <dl className="grid gap-2.5">
      {facts.map(([label, value, hint], index) => (
        <div key={`${label}-${index}`} className="grid gap-0.5 sm:grid-cols-[160px_1fr] sm:gap-3">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
            {label}
          </dt>
          <dd className="min-w-0">
            <span className="text-[12.5px] text-[var(--color-text-primary)]">{value}</span>
            {hint ? (
              <span className="mt-0.5 block text-[11.5px] leading-[1.45] text-[var(--color-text-muted)]">
                {hint}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Cell({ cell, openDrawer }: { cell: TableCellKind; openDrawer: OpenDrawer }) {
  if (cell.kind === "name") {
    const swatch = toneOf(cell.avatarTone);

    return (
      <div className="flex min-w-0 items-center gap-[9px]">
        {cell.avatar === false ? null : (
          <span
            aria-hidden="true"
            className="flex h-[24px] w-[24px] flex-none items-center justify-center rounded-full border text-[9.5px] font-bold"
            style={{ background: swatch.bg, color: swatch.fg, borderColor: swatch.bd }}
          >
            {initialsOf(cell.name)}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-[11.5px] font-semibold" style={{ color: INK }}>
            {cell.name}
          </span>
          {cell.sub ? (
            <span className="mt-[1.5px] block truncate text-[10px]" style={{ color: MUTED }}>
              {cell.sub}
            </span>
          ) : null}
        </span>
      </div>
    );
  }

  if (cell.kind === "pill") {
    return (
      <span
        className="inline-flex whitespace-nowrap rounded-full border px-[9px] py-[3px] text-[10.5px] font-semibold"
        style={tonePillStyle(cell.tone ?? "neutral")}
      >
        {cell.label}
      </span>
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
        cell.strong && "font-semibold",
        cell.mono && "font-semibold tabular-nums",
      )}
      style={cell.tone ? toneTextStyle(cell.tone) : { color: cell.mono ? INK : "#435048" }}
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
    if (cell.kind === "action") return "";
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
    Object.fromEntries((panel.filters ?? []).map((filter) => [filter.label, filter.value])),
  );
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(0);

  const noun = panel.noun ?? "row";
  const nounPlural = panel.nounPlural ?? `${noun}s`;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return panel.rows.filter((tableRow) => {
      const texts = rowText(tableRow);

      if (needle && !texts.some((value) => value.toLowerCase().includes(needle))) {
        return false;
      }

      for (const filter of panel.filters ?? []) {
        const chosen = filterValues[filter.label];
        // The first option is the "all" one and never narrows anything.
        if (!chosen || chosen === filter.options[0]) continue;

        const haystack =
          filter.column !== undefined ? [texts[filter.column] ?? ""] : texts;
        if (!haystack.some((value) => value.toLowerCase().includes(chosen.toLowerCase()))) {
          return false;
        }
      }

      return true;
    });
  }, [panel.rows, panel.filters, query, filterValues]);

  const perPage = panel.per ?? filtered.length ?? 0;
  const pageCount = perPage > 0 ? Math.max(1, Math.ceil(filtered.length / perPage)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const visible = perPage > 0 ? filtered.slice(safePage * perPage, safePage * perPage + perPage) : filtered;

  const hasControls = Boolean(panel.search || panel.filters?.length);
  const allVisibleSelected =
    visible.length > 0 && visible.every((_, index) => selected.has(safePage * perPage + index));

  function toggleRow(index: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current);
      visible.forEach((_, index) => {
        const absolute = safePage * perPage + index;
        if (allVisibleSelected) next.delete(absolute);
        else next.add(absolute);
      });
      return next;
    });
  }

  return (
    <section className="surface-card p-4 md:p-5">
      <PanelHeader
        title={panel.title}
        sub={panel.sub}
        meta={panel.meta}
        tag={panel.tag}
        tagTone={panel.tagTone}
        acts={panel.acts}
        openDrawer={openDrawer}
      />

      {hasControls ? (
        <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
          {panel.search ? (
            <label className="relative min-w-[200px] flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]"
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
                className="min-h-[38px] w-full rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] pl-9 pr-3 text-[12.5px] text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-accent-primary)]"
              />
            </label>
          ) : null}

          {(panel.filters ?? []).map((filter) => (
            <label key={filter.label} className="inline-flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                {filter.label}
              </span>
              <select
                value={filterValues[filter.label] ?? filter.value}
                onChange={(event) => {
                  setFilterValues((current) => ({ ...current, [filter.label]: event.target.value }));
                  setPage(0);
                }}
                className="min-h-[38px] rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-3 text-[12.5px] text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-accent-primary)]"
              >
                {filter.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : null}

      {panel.selectable && selected.size > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2.5 rounded-[12px] border border-[var(--color-accent-primary)] bg-[var(--color-accent-primary-dim)] px-3.5 py-2.5">
          <span className="text-[12px] font-semibold text-[var(--color-text-accent)]">
            {selected.size} selected
          </span>
          {(panel.bulkActs ?? []).map((act) => (
            <TriggerControl
              key={act.label}
              trigger={act}
              label={act.label}
              openDrawer={openDrawer}
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition",
                act.primary
                  ? "bg-[#0d2315] text-white hover:bg-[#164028]"
                  : "border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]",
              )}
            />
          ))}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-[11.5px] font-semibold text-[var(--color-text-secondary)] hover:underline"
          >
            Clear
          </button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-[var(--color-border-default)] px-4 py-6 text-center text-[12.5px] text-[var(--color-text-muted)]">
          {panel.rows.length === 0
            ? (panel.empty ?? "Nothing here yet.")
            : `No ${nounPlural} match that.`}
        </p>
      ) : (
        <div className="-mx-4 min-w-0 overflow-x-auto px-4 md:mx-0 md:px-0">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr style={{ background: "#F7FAF8", borderBottom: "1px solid #E6EEE9" }}>
                {panel.selectable ? (
                  <th scope="col" className="w-8 px-[10px] py-[10px] text-left">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label={`Select every ${noun} on this page`}
                      className="h-3.5 w-3.5 accent-[#0d2315]"
                    />
                  </th>
                ) : null}
                {panel.head.map((heading, index) => (
                  <th
                    key={`${heading}-${index}`}
                    scope="col"
                    className={cn(
                      "py-[10px] text-[9.5px] font-semibold uppercase leading-[1.3] tracking-[0.05em]",
                      // The last column carries the row action, which is right aligned.
                      index === panel.head.length - 1 && heading === "" ? "text-right" : "text-left",
                      index === 0 && !panel.selectable ? "pl-[2px] pr-[9px]" : "px-[9px]",
                      index === panel.head.length - 1 && "pr-[2px]",
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
                const isSelected = selected.has(absolute);

                return (
                  <tr
                    key={absolute}
                    className={cn("transition-colors duration-150", isSelected && "bg-[#F1F8F4]")}
                    style={{ borderBottom: "1px solid #F2F7F4" }}
                  >
                    {panel.selectable ? (
                      <td className="px-[10px] py-[11px] align-middle">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(absolute)}
                          aria-label={`Select this ${noun}`}
                          className="h-3.5 w-3.5 accent-[#0d2315]"
                        />
                      </td>
                    ) : null}
                    {tableRow.cells.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className={cn(
                          "py-[11px] align-middle",
                          cellIndex === 0 && !panel.selectable ? "pl-[2px] pr-[9px]" : "px-[9px]",
                          cellIndex === tableRow.cells.length - 1 && "pr-[2px]",
                          cell.kind === "action" && "text-right",
                          cell.kind === "text" && cell.mono && "text-right",
                        )}
                      >
                        <Cell cell={cell} openDrawer={openDrawer} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 ? (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--color-border-default)] pt-3">
          <p className="text-[11.5px] text-[var(--color-text-muted)]">
            {filtered.length} {filtered.length === 1 ? noun : nounPlural}
            {filtered.length !== panel.rows.length ? ` of ${panel.rows.length}` : ""} · page{" "}
            {safePage + 1} of {pageCount}
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage === 0}
              aria-label="Previous page"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border-default)] text-[var(--color-text-secondary)] transition disabled:opacity-40 enabled:hover:border-[var(--color-border-strong)]"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
              disabled={safePage >= pageCount - 1}
              aria-label="Next page"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border-default)] text-[var(--color-text-secondary)] transition disabled:opacity-40 enabled:hover:border-[var(--color-border-strong)]"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {panel.foot ? <PanelFoot>{panel.foot}</PanelFoot> : null}
    </section>
  );
}

export function PanelView({ panel, openDrawer }: { panel: Panel; openDrawer: OpenDrawer }) {
  if (panel.type === "kpi") {
    // ONE card, everywhere in the product: same box, same 1px border, same label
    // scale, same numeral scale, same link affordance, same height. The state a
    // figure is in shows in the numeral colour — never in the box itself, so a
    // row of cards can never read as a row of different components. The mockup
    // is explicit that there is no dark variant here.
    const per = panel.per ?? Math.min(5, panel.cards.length) ?? 4;
    const minCol = per >= 6 ? 142 : per === 5 ? 154 : per === 4 ? 176 : per === 3 ? 208 : 240;

    return (
      <div
        className="grid items-stretch gap-[10px]"
        style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${minCol}px, 1fr))` }}
      >
        {panel.cards.map((card) => {
          const swatch = card.tone ? toneOf(card.tone) : null;
          const linked = Boolean(card.href || card.link);

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
                  <ArrowRight className="h-[11px] w-[11px]" strokeWidth={2.4} />
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

          return card.href ? (
            <Link
              key={card.label}
              href={card.href as Route}
              className={cn(className, "hover:border-[#BFDCD1]")}
              style={style}
            >
              {body}
            </Link>
          ) : (
            <article key={card.label} className={className} style={style}>
              {body}
            </article>
          );
        })}
      </div>
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
      <section className="surface-card p-4 md:p-5">
        <PanelHeader title={panel.title} sub={panel.sub} acts={panel.acts} openDrawer={openDrawer} />
        <ul>
          {panel.items.map((item, index) => {
            const swatch = toneOf(item.tone);
            const trigger = {
              href: item.href,
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
            const actionable = Boolean(trigger.href || trigger.drawer);

            return (
              <li
                key={`${item.label}-${index}`}
                className="flex items-start gap-[10px] border-b py-[10px]"
                style={{ borderColor: "#F2F7F4" }}
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
                    style={{ color: "#12796A", background: "#F2F7F4", borderColor: "#E1EBE5" }}
                  >
                    {item.viewLabel ?? "View"}
                    <ArrowRight className="h-[9.5px] w-[9.5px]" strokeWidth={2.4} />
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
      <section className="surface-card p-4 md:p-5">
        <PanelHeader title={panel.title} sub={panel.sub} openDrawer={openDrawer} />
        <FactList facts={panel.facts} />
        {panel.foot ? <PanelFoot>{panel.foot}</PanelFoot> : null}
      </section>
    );
  }

  if (panel.type === "bars") {
    const max = Math.max(...panel.rows.map((barRow) => barRow.value), 1);

    return (
      <section className="surface-card p-4 md:p-5">
        <PanelHeader title={panel.title} sub={panel.sub} openDrawer={openDrawer} />
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
                <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{barRow.sub}</p>
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
      <section className="surface-card p-4 md:p-5">
        <PanelHeader title={panel.title} sub={panel.sub} openDrawer={openDrawer} />
        <div
          className="tile-grid grid gap-[11px]"
          style={{ ["--tile-per" as string]: panel.per ?? 2 } as React.CSSProperties}
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

  if (panel.type === "steps") {
    const stateStyles: Record<string, string> = {
      done: "bg-[var(--color-success)] text-white",
      current: "bg-[#0d2315] text-white",
      todo: "bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]",
      blocked: "bg-[var(--color-danger-dim)] text-[var(--color-danger)]",
    };

    return (
      <section className="surface-card p-4 md:p-5">
        <PanelHeader title={panel.title} sub={panel.sub} openDrawer={openDrawer} />
        <ol className="grid gap-2.5">
          {panel.steps.map((step, index) => (
            <li key={step.label} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full text-[11px] font-bold",
                  stateStyles[step.state],
                )}
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">
                  {step.label}
                </p>
                {step.sub ? (
                  <p className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">{step.sub}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
        {panel.foot ? <PanelFoot>{panel.foot}</PanelFoot> : null}
      </section>
    );
  }

  if (panel.type === "tracker") {
    if (panel.rows.length === 0 && panel.clear) {
      return (
        <section className="surface-card p-4 md:p-5">
          <PanelHeader title={panel.title} sub={panel.sub} meta={panel.meta} openDrawer={openDrawer} />
          <div className="rounded-[12px] border border-[var(--color-success)] bg-[var(--color-success-dim)] px-4 py-3.5">
            <p className="text-[12.5px] font-bold text-[var(--color-text-primary)]">
              {panel.clear.title}
            </p>
            <p className="mt-1 text-[12px] leading-[1.5] text-[var(--color-text-secondary)]">
              {panel.clear.body}
            </p>
          </div>
        </section>
      );
    }

    return (
      <section className="surface-card p-4 md:p-5">
        <PanelHeader title={panel.title} sub={panel.sub} meta={panel.meta} openDrawer={openDrawer} />
        <ul className="grid gap-2">
          {panel.rows.map((trackerRow, index) => (
            <li
              key={`${trackerRow.unit}-${index}`}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-[12px] border px-3.5 py-2.5",
                trackerRow.overdue
                  ? "border-[var(--color-danger)] bg-[var(--color-danger-dim)]"
                  : "border-[var(--color-border-default)]",
              )}
            >
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">
                  {trackerRow.unit}
                </p>
                {trackerRow.sub ? (
                  <p className="text-[11.5px] text-[var(--color-text-muted)]">{trackerRow.sub}</p>
                ) : null}
              </div>
              <div className="flex flex-none flex-wrap items-center gap-2.5">
                <span className="text-[11.5px] text-[var(--color-text-secondary)]">
                  {trackerRow.owner}
                  <span className="text-[var(--color-text-muted)]"> · {trackerRow.role}</span>
                </span>
                <span
                  className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                  style={tonePillStyle(
                    trackerRow.state === "Marked"
                      ? "positive"
                      : trackerRow.state === "In progress"
                        ? "progress"
                        : "attention",
                  )}
                >
                  {trackerRow.state}
                </span>
                <span
                  className={cn(
                    "text-[11.5px] tabular-nums",
                    trackerRow.overdue
                      ? "font-semibold text-[var(--color-danger)]"
                      : "text-[var(--color-text-muted)]",
                  )}
                >
                  {trackerRow.age}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (panel.type === "blockers") {
    // Same shape as a list row: a tone dot, the thing and why, and the action
    // that clears it — never a boxed card.
    return (
      <section className="surface-card p-4 md:p-5">
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

  if (panel.type === "quote") {
    return (
      <blockquote className="surface-card border-l-[3px] border-l-[var(--color-accent-primary)] p-4 md:p-5">
        <p className="text-[13px] leading-[1.6] text-[var(--color-text-primary)]">{panel.body}</p>
        {panel.attribution ? (
          <footer className="mt-2 text-[11.5px] text-[var(--color-text-muted)]">
            {panel.attribution}
          </footer>
        ) : null}
      </blockquote>
    );
  }

  if (panel.type === "note") {
    return (
      <section
        className={cn(
          "rounded-[14px] border px-4 py-3.5",
          panel.tone === "attention"
            ? "border-[var(--color-warning)] bg-[var(--color-warning-dim)]"
            : panel.tone === "negative"
              ? "border-[var(--color-danger)] bg-[var(--color-danger-dim)]"
              : "border-[var(--color-border-default)] bg-[var(--color-bg-subtle)]",
        )}
      >
        {panel.title ? (
          <p className="mb-1 text-[12px] font-bold text-[var(--color-text-primary)]">{panel.title}</p>
        ) : null}
        <p className="text-[12.5px] leading-[1.55] text-[var(--color-text-secondary)]">{panel.body}</p>
      </section>
    );
  }

  // pending
  return (
    <section className="surface-card border-dashed p-4 md:p-5">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        Not built yet
      </p>
      <h3 className="mt-1.5 text-[14px] font-bold text-[var(--color-text-primary)]">{panel.title}</h3>
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
  return (
    <div className="grid min-w-0 gap-4">
      {rows.map((panelRow, index) => (
        <div
          key={index}
          // One column on small screens; the mockup's ratios apply from lg up via
          // the --panel-cols custom property (see .panel-row in globals.css).
          className="panel-row grid gap-4"
          style={{ ["--panel-cols" as string]: panelRow.cols } as React.CSSProperties}
        >
          {panelRow.panels.map((panel, panelIndex) => (
            <PanelView key={panelIndex} panel={panel} openDrawer={openDrawer} />
          ))}
        </div>
      ))}
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
