"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cardIcon } from "@/lib/modules/card-icons";
import type { DrawerSpec, KpiCard, Panel, PanelAction, PanelTone, TableCellKind, TableRow } from "@/lib/modules/panels";
import { toneOf } from "@/lib/modules/tones";
import { tightFor } from "@/lib/ui/tight-copy";
import { useUiText } from "@/hooks/use-ui-text";
import { cn } from "@/lib/utils/cn";

/**
 * The teacher's phone, drawn from the teacher mobile mockup: the same panels the desktop reads, as that mockup's own blocks.
 *
 * Stat cards are a two-across grid whose first card is the dark one; a list is a heading above one white, softly raised card of rows with
 * a chevron at the right; a note is a tinted card with its own icon. None of this changes what a panel says — it is built from the very
 * cells, items and figures the desktop table, list and cards are built from, so a phone and a laptop cannot disagree.
 */

type OpenDrawer = (spec: DrawerSpec) => void;

export const RAISED = "0 1px 2px rgba(13,35,21,0.05), 0 8px 22px -14px rgba(13,35,21,0.22)";
export const DARK = "linear-gradient(150deg, #123324 0%, #0D2315 62%)";
const CHEVRON = "M9 6l6 6-6 6";

/** The words a cell says, for a row that has no room to draw the cell itself. */
function plain(cell: TableCellKind | undefined): string {
  if (!cell) return "";
  if (cell.kind === "text") return cell.text;
  if (cell.kind === "name") return cell.name;
  if (cell.kind === "pill") return cell.label;
  if (cell.kind === "bar") return cell.label;
  if (cell.kind === "action") return cell.label;
  if (cell.kind === "mark") return cell.ok ? "Yes" : "No";
  return cell.plain ?? "";
}

export function Pill({ label, tone }: { label: string; tone?: PanelTone }) {
  const swatch = toneOf(tone);
  return (
    <span className="inline-flex max-w-full items-center whitespace-nowrap rounded-full px-[10px] py-[3px] text-[11.5px] font-extrabold" style={{ background: swatch.bg, color: swatch.fg }}>
      {label}
    </span>
  );
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9AA8A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="flex-none">
      <path d={CHEVRON} />
    </svg>
  );
}

/** A block's heading sits above its card, as the mockup draws it: the name, a small tag beside it, one line under. */
export function BlockHead({ title, sub, tag, tagTone, acts, openDrawer }: { title?: string; sub?: string; tag?: string; tagTone?: PanelTone; acts?: PanelAction[]; openDrawer: OpenDrawer }) {
  const ui = useUiText();
  // The phone's copy rule, same as a panel's sub-heading on a laptop.
  const line = tightFor(true, "bsub", sub);
  if (!title && !line) return null;
  return (
    <div className="mb-[10px] px-[2px]">
      <div className="flex items-center justify-between gap-[10px]">
        <h2 className="flex min-w-0 flex-wrap items-center gap-[8px] text-[18px] font-extrabold leading-[1.2] tracking-[-0.01em] text-[#0D2315]">
          <span>{title ? ui(title) : null}</span>
          {tag ? <Pill label={tag} tone={tagTone ?? "attention"} /> : null}
        </h2>
        {(acts ?? []).slice(0, 1).map((act) =>
          act.href ? (
            <Link key={act.label} href={act.href as Route} className="flex-none text-[13px] font-extrabold text-[#12796A]">{act.label}</Link>
          ) : act.drawer ? (
            <button key={act.label} type="button" onClick={() => openDrawer(act.drawer!)} className="flex-none text-[13px] font-extrabold text-[#12796A]">{act.label}</button>
          ) : null,
        )}
      </div>
      {line ? <p className="mt-[4px] text-pretty text-[13px] leading-[1.45] text-[#5F6E65]">{line}</p> : null}
    </div>
  );
}

/** A panel's footnote on a phone: it keeps the figure it carries, or it is not drawn. */
function PhoneFoot({ foot }: { foot?: string }) {
  const line = tightFor(true, "foot", foot);
  return line ? <p className="mt-[10px] px-[4px] text-pretty text-[12.5px] leading-[1.5] text-[#5C6B62]">{line}</p> : null;
}

/* ───────────────────────── stat cards ───────────────────────── */

export function PhoneStats({ panel, openDrawer }: { panel: Extract<Panel, { type: "kpi" }>; openDrawer: OpenDrawer }) {
  const router = useRouter();
  const cards = panel.cards;
  return (
    <section className="min-w-0">
      <div className="grid grid-cols-2 gap-[10px]">
        {cards.map((card: KpiCard, index) => {
          const dark = index === 0 && cards.length > 1;
          const swatch = card.tone && card.tone !== "neutral" ? toneOf(card.tone) : null;
          const [outline] = cardIcon(card);
          const span = cards.length % 2 === 1 && index === cards.length - 1;
          const value = String(card.value ?? "—");
          const big = value.length <= 7;
          const drawer = card.drawer;
          const go = card.href ? () => router.push(card.href as Route) : drawer ? () => openDrawer(drawer) : undefined;
          return (
            <div
              key={`${card.label}-${index}`}
              role={go ? "button" : undefined}
              tabIndex={go ? 0 : undefined}
              onClick={go}
              onKeyDown={go ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); go(); } } : undefined}
              className={cn("relative flex min-w-0 flex-col overflow-hidden rounded-[18px] px-[14px] pb-[13px] pt-[14px]", span && "col-span-2", go && "cursor-pointer active:scale-[0.99]")}
              style={{ background: dark ? DARK : "#fff", boxShadow: dark ? "0 16px 28px -20px rgba(13,35,21,0.95)" : RAISED }}
            >
              {dark ? <span aria-hidden className="pointer-events-none absolute -bottom-[60px] -right-[40px] h-[130px] w-[130px] rounded-full border-[1.5px]" style={{ borderColor: "rgba(95,214,180,0.14)" }} /> : null}
              <div className="relative flex items-start gap-[10px]">
                <span
                  className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full"
                  style={{ background: dark ? "rgba(95,214,180,0.16)" : swatch ? swatch.bg : "#EEF4F0", color: dark ? "#5FD6B4" : swatch ? swatch.fg : "#17604F" }}
                  aria-hidden
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={outline} /></svg>
                </span>
                <span className="min-w-0 pt-[2px] text-pretty text-[12px] font-bold leading-[1.3]" style={{ color: dark ? "rgba(255,255,255,0.8)" : "#5F6E65" }}>{card.label}</span>
              </div>
              <div className="relative mt-[12px] flex items-baseline gap-[6px]">
                <span
                  className="min-w-0 truncate font-black leading-[1.05] tracking-[-0.02em] tabular-nums"
                  style={{ fontSize: big ? "min(26px, 7.3vw)" : "min(19px, 5.3vw)", color: dark ? "#fff" : swatch && card.tone === "negative" ? swatch.fg : "#0D2315" }}
                >
                  {value}
                </span>
                {card.unit ? <span className="whitespace-nowrap text-[12px] font-bold" style={{ color: dark ? "rgba(255,255,255,0.62)" : "#5C6B62" }}>{card.unit}</span> : null}
              </div>
              {card.sub ? <span className="relative mt-[6px] text-pretty text-[12px] font-medium leading-[1.4]" style={{ color: dark ? "rgba(255,255,255,0.72)" : "#5C6B62" }}>{card.sub}</span> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ───────────────────────── rows ───────────────────────── */

export type Row = {
  key: string;
  title: string;
  sub?: string;
  lead?: { top?: string; value: string; tone?: PanelTone; icon?: string; round?: boolean };
  pill?: { label: string; tone?: PanelTone };
  side?: string;
  figure?: string;
  bar?: { pct: number; label: string; tone?: PanelTone };
  quote?: string;
  act?: { label: string; icon?: string; run?: () => void; href?: string };
  open?: () => void;
};

function RowView({ row, last }: { row: Row; last: boolean }) {
  const content = (
    <>
      {row.lead?.round ? (
        <span className="flex h-[44px] w-[44px] flex-none items-center justify-center rounded-full text-[13.5px] font-extrabold tracking-[0.02em]" style={{ background: row.lead.tone && row.lead.tone !== "neutral" ? toneOf(row.lead.tone).bg : "#EEF4F0", color: row.lead.tone && row.lead.tone !== "neutral" ? toneOf(row.lead.tone).fg : "#0D2315" }} aria-hidden>{row.lead.value}</span>
      ) : row.lead?.icon ? (
        <span className="flex h-[44px] w-[44px] flex-none items-center justify-center rounded-full" style={{ background: row.lead.tone && row.lead.tone !== "neutral" ? toneOf(row.lead.tone).bg : "#EEF4F0", color: row.lead.tone && row.lead.tone !== "neutral" ? toneOf(row.lead.tone).fg : "#17604F" }} aria-hidden>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={row.lead.icon} /></svg>
        </span>
      ) : row.lead ? (
        <span
          className="flex h-[50px] w-[46px] flex-none flex-col items-center justify-center rounded-[14px] text-[17px] font-black leading-none"
          style={{ background: toneOf(row.lead.tone).bg, color: toneOf(row.lead.tone).fg }}
          aria-hidden
        >
          {row.lead.top ? <span className="mb-[2px] text-[9.5px] font-extrabold uppercase tracking-[0.06em]">{row.lead.top}</span> : null}
          {row.lead.value}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-pretty text-[14px] font-bold leading-[1.35] text-[#0D2315]">{row.title}</span>
        {row.sub ? <span className="mt-[3px] block text-pretty text-[12.5px] font-medium leading-[1.45] text-[#5C6B62]">{row.sub}</span> : null}
        {row.quote ? <span className="mt-[10px] block rounded-[14px] px-[14px] py-[11px] text-pretty text-[13px] font-medium italic leading-[1.5]" style={{ background: "#FDF3F3", color: "#B23B3B" }}>{row.quote}</span> : null}
        {row.bar ? (
          <span className="mt-[8px] flex items-center gap-[10px]">
            <span className="h-[6px] min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: "#EDF3EF" }}>
              <span className="block h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, row.bar.pct))}%`, background: toneOf(row.bar.tone ?? "attention").dot }} />
            </span>
            <span className="flex-none text-[12.5px] font-semibold tabular-nums text-[#5C6B62]">{row.bar.label}</span>
          </span>
        ) : null}
      </span>
      {row.act ? (
        row.act.href ? (
          <Link href={row.act.href as Route} className="flex h-[40px] flex-none items-center gap-[6px] rounded-[12px] bg-[#EEF4F0] px-[14px] text-[13px] font-extrabold text-[#0D2315]">{row.act.label}</Link>
        ) : (
          <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); row.act!.run?.(); }} onKeyDown={(event) => { if (event.key === "Enter") { event.stopPropagation(); row.act!.run?.(); } }} className="flex h-[40px] flex-none cursor-pointer items-center gap-[6px] rounded-[12px] bg-[#EEF4F0] px-[14px] text-[13px] font-extrabold text-[#0D2315]">
            {row.act.icon ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={row.act.icon} /></svg> : null}
            {row.act.label}
          </span>
        )
      ) : row.pill || row.side || row.figure ? (
        <span className="flex max-w-[44%] flex-none flex-col items-end gap-[5px] text-right">
          {row.figure ? <span className="text-[17px] font-extrabold leading-none tabular-nums text-[#0D2315]">{row.figure}</span> : null}
          {row.pill ? <Pill label={row.pill.label} tone={row.pill.tone} /> : null}
          {row.side ? <span className="text-[12px] font-bold text-[#5C6B62]">{row.side}</span> : null}
        </span>
      ) : null}
      {row.open && !row.act ? <Chevron /> : null}
    </>
  );
  const className = cn("flex min-h-[66px] w-full items-center gap-[12px] px-[16px] py-[12px] text-left", !last && "border-b", row.open && "active:bg-[#F7FAF8]");
  const style = { borderColor: "#EDF3EF" };
  return row.open ? (
    <button type="button" onClick={row.open} className={className} style={style}>{content}</button>
  ) : (
    <div className={className} style={style}>{content}</div>
  );
}

export function RowsCard({ rows, empty, per = 10 }: { rows: Row[]; empty?: string; per?: number }) {
  const [shown, setShown] = useState(per);
  const visible = per ? rows.slice(0, shown) : rows;
  const rest = rows.length - visible.length;
  if (!rows.length) {
    return empty ? <p className="rounded-[20px] bg-white px-[18px] py-[22px] text-center text-[13px] text-[#5C6B62]" style={{ boxShadow: RAISED }}>{empty}</p> : null;
  }
  return (
    <div className="overflow-hidden rounded-[20px] bg-white" style={{ boxShadow: RAISED }}>
      {visible.map((row, index) => <RowView key={row.key} row={row} last={index === visible.length - 1 && !rest} />)}
      {rest > 0 || (per && rows.length > per && shown > per) ? (
        <div className="flex items-center gap-[10px] border-t px-[16px] py-[12px]" style={{ borderColor: "#EDF3EF", background: "#FBFDFC" }}>
          <span className="flex-1 text-[12.5px] font-semibold text-[#5C6B62]">Showing {visible.length} of {rows.length}</span>
          {rest > 0 && rest > per ? (
            <button type="button" onClick={() => setShown(rows.length)} className="text-[13px] font-extrabold text-[#0D2315]">Show all</button>
          ) : null}
          {rest > 0 ? (
            <button type="button" onClick={() => setShown((count) => count + per)} className="rounded-[12px] bg-[#0D2315] px-[16px] py-[10px] text-[13px] font-extrabold text-white">
              Show {Math.min(per, rest)} more
            </button>
          ) : (
            <button type="button" onClick={() => setShown(per)} className="text-[13px] font-extrabold text-[#12796A]">Show fewer</button>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ───────────────────────── a table, as rows ───────────────────────── */

function tableRow(row: TableRow, head: string[], index: number, router: ReturnType<typeof useRouter>, openDrawer: OpenDrawer): Row {
  const cells = row.cells;
  const lead = cells.find((cell): cell is Extract<TableCellKind, { kind: "name" }> => cell.kind === "name") ?? null;
  const pill = cells.find((cell): cell is Extract<TableCellKind, { kind: "pill" }> => cell.kind === "pill") ?? null;
  const action = cells.find((cell): cell is Extract<TableCellKind, { kind: "action" }> => cell.kind === "action" && Boolean(cell.href || cell.drawer)) ?? null;
  const first = lead ?? cells.find((cell) => cell.kind === "text" && cell.text.trim()) ?? null;
  const others = cells
    .filter((cell) => cell !== lead && cell !== pill && cell !== action && cell !== first && cell.kind !== "action")
    .map((cell) => ({ cell, label: head[cells.indexOf(cell)] }))
    .filter(({ cell }) => plain(cell).trim() && plain(cell).trim() !== "—");
  const sub = [lead?.sub, ...others.slice(0, 2).map(({ cell, label }) => (label && plain(cell).length < 18 ? `${label} ${plain(cell)}` : plain(cell)))].filter(Boolean).join(" · ");
  const target = row.drawer ?? action?.drawer;
  const href = row.href ?? action?.href;
  return {
    key: `${index}-${plain(first ?? undefined)}`,
    title: plain(first ?? undefined) || head[0] || "—",
    sub: sub || undefined,
    pill: pill ? { label: pill.label, tone: pill.tone } : undefined,
    open: target ? () => openDrawer(target) : href ? () => router.push(href as Route) : undefined,
  };
}

export function PhoneTable({ panel, openDrawer }: { panel: Extract<Panel, { type: "table" }>; openDrawer: OpenDrawer }) {
  const router = useRouter();
  const rows = panel.rows.map((row, index) => tableRow(row, panel.head, index, router, openDrawer));
  return (
    <section className="min-w-0">
      <BlockHead title={panel.title} sub={panel.sub} tag={panel.tag} tagTone={panel.tagTone} acts={panel.acts} openDrawer={openDrawer} />
      <RowsCard rows={rows} empty={panel.empty ?? "Nothing here yet."} per={panel.per === 0 ? 0 : Math.min(panel.per ?? 10, 10)} />
      <PhoneFoot foot={panel.foot} />
    </section>
  );
}

/* ───────────────────────── a list ───────────────────────── */

export function PhoneList({ panel, openDrawer }: { panel: Extract<Panel, { type: "list" }>; openDrawer: OpenDrawer }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const rows: Row[] = panel.items.map((item, index) => {
    const drawer = item.drawer ?? (item.facts?.length ? ({ title: item.label, sub: item.sub, facts: item.facts, readOnly: panel.readOnly } as DrawerSpec) : undefined);
    const act = item.act ? { label: item.act.label, icon: item.act.icon, href: item.act.href, run: item.act.drawer ? () => openDrawer(item.act!.drawer!) : undefined } : undefined;
    return {
      // The phone's copy rule on a row's second line. The drawer behind the row keeps the full sentence.
      key: `${index}-${item.label}`, title: item.label, sub: tightFor(true, "opt", item.sub),
      lead: item.lead ? { top: item.lead.top, value: item.lead.value, tone: item.lead.tone ?? item.tone } : item.avatar ? { value: item.avatar, round: true, tone: item.tone } : item.icon ? { value: "", icon: item.icon, tone: item.tone } : undefined,
      pill: item.pill ? { label: item.pill, tone: item.tone } : undefined,
      side: item.side, figure: item.figure, bar: item.bar, quote: item.quote, act,
      open: act ? undefined : drawer ? () => openDrawer(drawer) : item.href ? () => router.push(item.href as Route) : item.run,
    };
  });
  // A long list of people is found by name, not scrolled; the search is over what the rows say.
  const searchable = rows.length > 8 && !panel.noFind;
  const needle = q.trim().toLowerCase();
  const shown = needle ? rows.filter((row) => `${row.title} ${row.sub ?? ""}`.toLowerCase().includes(needle)) : rows;
  return (
    <section className="min-w-0">
      {searchable ? (
        <label className="mb-[14px] flex h-[48px] items-center gap-[10px] rounded-[16px] bg-white px-[14px]" style={{ boxShadow: RAISED }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8C9A92" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Find by name" aria-label="Find in this list" className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-[#0D2315] outline-none placeholder:text-[#8C9A92]" />
        </label>
      ) : null}
      <BlockHead title={panel.title} sub={panel.sub} tag={panel.tag} tagTone={panel.tagTone} acts={panel.acts} openDrawer={openDrawer} />
      <RowsCard rows={shown} empty={needle ? "Nothing matches that." : panel.empty ?? "Nothing here yet."} per={shown.length > 8 && !panel.noFind ? 6 : 0} />
      <PhoneFoot foot={panel.foot} />
    </section>
  );
}

/* ───────────────────────── a note ───────────────────────── */

export function PhoneNote({ panel, openDrawer }: { panel: Extract<Panel, { type: "note" }>; openDrawer: OpenDrawer }) {
  const swatch = toneOf(panel.tone ?? "neutral");
  const tinted = panel.tone && panel.tone !== "neutral";
  // The phone's copy rule: a note's heading keeps its first thought and its body keeps whole sentences up to a phone's worth.
  const title = tightFor(true, "title", panel.title);
  const body = tightFor(true, "body", panel.body);
  return (
    <div className="flex items-start gap-[12px] rounded-[20px] px-[16px] py-[15px]" style={{ background: tinted ? swatch.bg : "#fff", boxShadow: tinted ? undefined : RAISED, border: tinted ? `1px solid ${swatch.bd}` : undefined }}>
      <span className="flex h-[36px] w-[36px] flex-none items-center justify-center rounded-full bg-white" style={{ color: swatch.fg }} aria-hidden>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d={panel.icon ?? "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z"} /></svg>
      </span>
      <div className="min-w-0 flex-1 pt-[2px]">
        {title ? <p className="text-pretty text-[14px] font-extrabold leading-[1.3]" style={{ color: tinted ? swatch.fg : "#0D2315" }}>{title}</p> : null}
        {body ? <p className="mt-[4px] text-pretty text-[12.5px] font-medium leading-[1.55] text-[#435048]">{body}</p> : null}
        {panel.acts?.length ? (
          <div className="mt-[12px] flex flex-wrap gap-[8px]">
            {panel.acts.map((act) => {
              const className = "inline-flex min-h-[40px] items-center rounded-[13px] bg-white px-[14px] text-[13px] font-extrabold text-[#0D2315] active:scale-[0.97]";
              return act.href ? (
                <Link key={act.label} href={act.href as Route} className={className}>{act.label}</Link>
              ) : act.drawer ? (
                <button key={act.label} type="button" onClick={() => openDrawer(act.drawer!)} className={className}>{act.label}</button>
              ) : null;
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ───────────────────────── a set of facts ───────────────────────── */

/**
 * Facts as the mockup draws them: one white card, a heading with a small chevron, and — when the block is a rule rather than an answer —
 * folded shut until it is asked for. Each fact is its label, its value and the line of reasoning under it.
 */
export function PhoneFacts({ panel, openDrawer }: { panel: Extract<Panel, { type: "facts" }>; openDrawer: OpenDrawer }) {
  const fold = Boolean(panel.phoneFold || panel.tuck);
  const [open, setOpen] = useState(!fold);
  const head = (
    <>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-[8px]">
          <span className="text-[15.5px] font-extrabold leading-[1.3] tracking-[-0.01em] text-[#0D2315]">{panel.title}</span>
          {panel.tag ? <Pill label={panel.tag} tone={panel.tagTone ?? "attention"} /> : null}
        </span>
        {panel.sub ? <span className="mt-[3px] block text-pretty text-[12.5px] leading-[1.45] text-[#5C6B62]">{panel.sub}</span> : null}
      </span>
      {fold ? (
        <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full" style={{ background: "#F1F5F3" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#435048" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transition: "transform 180ms ease", transform: `rotate(${open ? 180 : 0}deg)` }}><path d="m6 9 6 6 6-6" /></svg>
        </span>
      ) : null}
    </>
  );
  return (
    <section className="overflow-hidden rounded-[20px] bg-white" style={{ boxShadow: RAISED }}>
      {fold ? (
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex min-h-[56px] w-full items-center gap-[10px] py-[15px] pl-[16px] pr-[14px] text-left">{head}</button>
      ) : (
        <div className="flex min-h-[56px] items-center gap-[10px] py-[15px] pl-[16px] pr-[14px]">{head}</div>
      )}
      {open ? (
        <div className="pb-[4px]">
          {panel.facts.map(([label, value, hint], index) => (
            <div key={`${index}-${label}`} className="mx-[16px] border-t py-[11px]" style={{ borderColor: "#EEF2F0" }}>
              <p className="text-[12px] font-semibold leading-[1.4] text-[#5C6B62]">{label}</p>
              <p className="mt-[2px] text-pretty text-[14px] font-bold leading-[1.4] text-[#0D2315]">{value || "—"}</p>
              {hint ? <p className="mt-[2px] text-pretty text-[12px] leading-[1.45] text-[#5C6B62]">{hint}</p> : null}
            </div>
          ))}
          {panel.acts?.length ? (
            <div className="mx-[16px] flex flex-wrap gap-[8px] border-t py-[12px]" style={{ borderColor: "#EEF2F0" }}>
              {panel.acts.map((act) => act.href ? (
                <Link key={act.label} href={act.href as Route} className="inline-flex min-h-[40px] items-center rounded-[12px] bg-[#EEF4F0] px-[14px] text-[13px] font-extrabold text-[#0D2315]">{act.label}</Link>
              ) : act.drawer ? (
                <button key={act.label} type="button" onClick={() => openDrawer(act.drawer!)} className="inline-flex min-h-[40px] items-center rounded-[12px] bg-[#EEF4F0] px-[14px] text-[13px] font-extrabold text-[#0D2315]">{act.label}</button>
              ) : null)}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/* ───────────────────────── steps ───────────────────────── */

/** A run of stages as the mockup draws it: numbered circles down a line, the stage you are at ringed. */
export function PhoneSteps({ panel }: { panel: Extract<Panel, { type: "steps" }> }) {
  return (
    <section className="min-w-0">
      {panel.title ? <h2 className="mb-[10px] px-[2px] text-[18px] font-extrabold leading-[1.2] tracking-[-0.01em] text-[#0D2315]">{panel.title}</h2> : null}
      <ol className="rounded-[20px] bg-white px-[16px] py-[16px]" style={{ boxShadow: RAISED }}>
        {panel.steps.map((step, index) => {
          const now = step.state === "current";
          const done = step.state === "done";
          return (
            <li key={`${index}-${step.label}`} className="relative flex gap-[12px] pb-[18px] last:pb-0">
              <span className="relative flex w-[32px] flex-none justify-center">
                {index < panel.steps.length - 1 ? <span aria-hidden className="absolute bottom-[-18px] top-[32px] w-[2px] rounded-full" style={{ background: "#E3ECE6" }} /> : null}
                <span
                  className="relative flex h-[32px] w-[32px] items-center justify-center rounded-full text-[13px] font-extrabold"
                  style={now ? { background: "#fff", color: "#0D2315", border: "2px solid #0D2315", boxShadow: "0 0 0 4px #D6EBE3" } : done ? { background: "#EAF6F0", color: "#17714F" } : { background: "#F1F5F3", color: "#5C6B62" }}
                >
                  {step.n ?? index + 1}
                </span>
              </span>
              <span className="min-w-0 flex-1 pt-[4px]">
                <span className="block text-pretty text-[14.5px] font-extrabold leading-[1.3]" style={{ color: now || done ? "#0D2315" : "#5C6B62" }}>{step.label}</span>
                {step.sub ? <span className="mt-[3px] block text-pretty text-[12.5px] font-medium leading-[1.45] text-[#5C6B62]">{step.sub}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
      <PhoneFoot foot={panel.foot} />
    </section>
  );
}
