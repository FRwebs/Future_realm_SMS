"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PANEL_SHELL, PanelHeader } from "@/components/modules/panel-renderer";
import type { DrawerSpec, FlowPanel, GridCell, GridPanel, PanelTone, QuotesPanel } from "@/lib/modules/panels";
import { sendJson } from "@/lib/modules/submit";
import { CARD_BORDER, INK, MUTED, toneOf } from "@/lib/modules/tones";
import { cn } from "@/lib/utils/cn";

type OpenDrawer = (spec: DrawerSpec) => void;

/* ───────────────────────── a tiny, safe formula reader ───────────────────────── */

/** Reads "(c2 + c3) * 12" against a row's numbers. No eval: numbers, cN, + - * / and brackets only. */
function evaluate(expression: string, numbers: number[]): number {
  const tokens = expression.match(/c\d+|\d+(?:\.\d+)?|[()+\-*/]/g) ?? [];
  let at = 0;
  const peek = () => tokens[at];
  const next = () => tokens[at++];

  function primary(): number {
    const token = next();
    if (token === undefined) return 0;
    if (token === "(") {
      const inside = sum();
      if (peek() === ")") next();
      return inside;
    }
    if (token === "-") return -primary();
    if (token.startsWith("c")) return numbers[Number(token.slice(1))] ?? 0;
    return Number(token);
  }
  function product(): number {
    let value = primary();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const right = primary();
      value = op === "*" ? value * right : right === 0 ? 0 : value / right;
    }
    return value;
  }
  function sum(): number {
    let value = product();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const right = product();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }
  return sum();
}

const toNumber = (text: string) => Number.parseFloat(String(text).replace(/[^0-9.-]/g, "")) || 0;
const naira = (value: number) => `₦${Math.round(value).toLocaleString("en-NG")}`;

/* ───────────────────────── editable grid ───────────────────────── */

export function GridPanelView({ panel, openDrawer }: { panel: GridPanel; openDrawer: OpenDrawer }) {
  const router = useRouter();
  const original = useMemo(() => panel.rows.map((row) => row.cells.map((cell) => cell.value)), [panel.rows]);
  const [values, setValues] = useState<string[][]>(() => original.map((row) => [...row]));
  const [draft, setDraft] = useState<string[]>(() => (panel.draft?.cells ?? []).map((cell) => cell.value));
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "failed"; text?: string }>({ kind: "idle" });
  const [removing, setRemoving] = useState<number | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(panel.presets?.find((preset) => preset.on)?.label ?? null);

  const template = panel.cols ?? panel.head.map(() => "minmax(0,1fr)").join(" ");
  const gridStyle = { gridTemplateColumns: `${template}${panel.rows.some((row) => row.remove) ? " 70px" : ""}` };
  const align = (index: number) => (panel.right?.includes(index) ? "text-right" : "text-left");

  const dirty = values.some((row, r) => row.some((value, c) => value !== original[r][c]));

  /** The figure a cell shows: typed, or worked out from its row. */
  function shown(r: number, c: number): string {
    const cell = panel.rows[r].cells[c];
    if (cell.calc) {
      const numbers = values[r].map((value, index) => (panel.rows[r].cells[index].calc ? 0 : toNumber(value)));
      // A calculated cell may read another calculated one; settle in column order.
      for (let index = 0; index < values[r].length; index += 1) {
        const calc = panel.rows[r].cells[index].calc;
        if (calc) numbers[index] = evaluate(calc, numbers);
      }
      const result = numbers[c];
      return cell.naira ? naira(result) : String(Math.round(result * 100) / 100);
    }
    const raw = values[r][c];
    return cell.naira && cell.static ? naira(toNumber(raw)) : raw;
  }

  function change(r: number, c: number, next: string) {
    setValues((current) => current.map((row, i) => (i === r ? row.map((value, j) => (j === c ? next : value)) : row)));
    setActivePreset(null);
    setState({ kind: "idle" });
  }

  function applyPreset(preset: NonNullable<GridPanel["presets"]>[number]) {
    setValues((current) => {
      const first = toNumber(current[0]?.[preset.column] ?? "0");
      return current.map((row, i) =>
        row.map((value, c) => {
          if (c !== preset.column) return value;
          if (preset.apply === "reset") return original[i][c];
          if (preset.apply === "flat") return String(Math.round(first));
          return String(Math.round(first * Math.pow(1 + (preset.rate ?? 8) / 100, i)));
        }),
      );
    });
    setActivePreset(preset.label);
    setState({ kind: "idle" });
  }

  async function save() {
    if (!panel.save) return;
    setState({ kind: "saving" });
    try {
      await sendJson(panel.save.endpoint, panel.save.method ?? "PATCH", {
        ...(panel.save.body ?? {}),
        rows: panel.rows.map((row, r) => ({
          id: row.id,
          values: Object.fromEntries(panel.save!.keys.map((key, c) => [key, values[r][c]])),
        })),
      });
      setState({ kind: "saved", text: panel.save.done });
      router.refresh();
    } catch (cause) {
      setState({ kind: "failed", text: cause instanceof Error ? cause.message : "That did not save." });
    }
  }

  async function addDraft() {
    if (!panel.draft) return;
    setState({ kind: "saving" });
    try {
      await sendJson(panel.draft.add.endpoint, panel.draft.add.method ?? "POST", {
        ...(panel.draft.add.body ?? {}),
        ...Object.fromEntries(panel.draft.add.keys.map((key, c) => [key, draft[c]])),
      });
      setDraft((panel.draft.cells ?? []).map((cell) => cell.value));
      setState({ kind: "saved", text: `${panel.draft.label} — done.` });
      router.refresh();
    } catch (cause) {
      setState({ kind: "failed", text: cause instanceof Error ? cause.message : "That did not go through." });
    }
  }

  async function remove(r: number) {
    const row = panel.rows[r];
    if (!row.remove) return;
    setState({ kind: "saving" });
    try {
      await sendJson(row.remove.endpoint, row.remove.method ?? "DELETE", {});
      setRemoving(null);
      setState({ kind: "saved", text: "Removed." });
      router.refresh();
    } catch (cause) {
      setState({ kind: "failed", text: cause instanceof Error ? cause.message : "That could not be removed." });
    }
  }

  const meter = panel.meter
    ? (() => {
        const total = values.reduce((sum, row, r) => sum + toNumber(shown(r, panel.meter!.column)), 0);
        const ok = Math.round(total) === panel.meter!.target;
        const pct = Math.min(100, Math.max(0, (total / panel.meter!.target) * 100));
        return { total, ok, pct, over: total > panel.meter!.target };
      })()
    : null;

  const inputClass =
    "w-full min-w-0 rounded-[8px] border-[1.5px] bg-white px-[9px] py-[6.5px] text-[11.5px] font-medium text-[#0D2315] outline-hidden focus:border-[#12796A]";

  function cellView(cell: GridCell, c: number, value: string, display: string, onChange: (next: string) => void, key: string) {
    if (cell.static || cell.calc) {
      return (
        <span key={key} className={cn("block truncate px-[2px] py-[7px] text-[11.5px] tabular-nums", align(c), cell.bold && "font-semibold")} style={{ color: cell.bad ? "#B23B3B" : cell.bold ? INK : "#435048" }}>
          {display}
        </span>
      );
    }
    return (
      <input
        key={key}
        value={value}
        inputMode={cell.num ? "decimal" : undefined}
        onChange={(event) => onChange(event.target.value)}
        placeholder={cell.placeholder}
        aria-label={`${panel.head[c]}`}
        className={cn(inputClass, cell.num && "text-right tabular-nums", cell.bold && "font-semibold")}
        style={{ borderColor: cell.bad ? "#E4B9B9" : CARD_BORDER, color: cell.bad ? "#B23B3B" : undefined, background: cell.bad ? "#FDF3F3" : "#fff" }}
      />
    );
  }

  return (
    <section className={PANEL_SHELL} style={{ borderColor: CARD_BORDER }}>
      <PanelHeader title={panel.title} sub={panel.sub} meta={panel.meta} tag={panel.tag} tagTone={panel.tagTone} acts={panel.acts} openDrawer={openDrawer} />

      {panel.presets?.length ? (
        <div className="mb-[10px] flex flex-wrap items-center gap-[6px]">
          <span className="mr-[3px] text-[9.5px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>
            {panel.presetLabel ?? "Start from"}
          </span>
          {panel.presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset)}
              className="rounded-full border px-[11px] py-[5px] text-[10.5px] font-semibold"
              style={
                activePreset === preset.label
                  ? { background: INK, color: "#fff", borderColor: INK }
                  : { background: "#fff", color: "#5F6E65", borderColor: "#DEE8E2" }
              }
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mx-[-18px] overflow-x-auto px-[18px]">
        <div className="grid min-w-[620px] gap-[6px]">
          <div className="grid items-end gap-[8px] border-b pb-[6px]" style={{ ...gridStyle, borderColor: "#EDF3EF" }}>
            {panel.head.map((heading, index) => (
              <span key={heading + index} className={cn("text-[9.5px] font-semibold uppercase tracking-wider", align(index))} style={{ color: MUTED }}>
                {heading}
              </span>
            ))}
            {panel.rows.some((row) => row.remove) ? <span /> : null}
          </div>
          {panel.rows.map((row, r) => (
            <div key={row.id ?? r} className="grid items-center gap-[8px]" style={gridStyle}>
              {row.cells.map((cell, c) => cellView(cell, c, values[r][c], shown(r, c), (next) => change(r, c, next), `${r}-${c}`))}
              {row.remove ? (
                removing === r ? (
                  <span className="flex items-center gap-[4px]">
                    <button type="button" onClick={() => remove(r)} className="rounded-[7px] bg-[#B23B3B] px-[8px] py-[4px] text-[10px] font-semibold text-white">
                      Sure
                    </button>
                    <button type="button" onClick={() => setRemoving(null)} className="text-[10px]" style={{ color: MUTED }}>
                      No
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setRemoving(r)} className="text-right text-[10.5px] font-semibold text-[#B23B3B] hover:underline" title={row.remove.warn}>
                    Remove
                  </button>
                )
              ) : null}
            </div>
          ))}
          {panel.draft ? (
            <div className="mt-[4px] grid items-center gap-[8px] rounded-[11px] border border-dashed px-[8px] py-[8px]" style={{ ...gridStyle, borderColor: "#CFDDD5", background: "#FCFDFC" }}>
              {panel.draft.cells.map((cell, c) => cellView(cell, c, draft[c] ?? "", draft[c] ?? "", (next) => setDraft((current) => current.map((value, i) => (i === c ? next : value))), `d-${c}`))}
              <button type="button" onClick={addDraft} className="col-span-full justify-self-start rounded-[8px] border border-[#CFDDD5] bg-white px-[12px] py-[6px] text-[11px] font-semibold text-[#435048] hover:bg-[#F7FAF8]">
                {panel.draft.label}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {meter && panel.meter ? (
        <div className="mt-[13px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11.5px] font-semibold" style={{ color: meter.ok ? "#17714F" : meter.over ? "#B23B3B" : "#8A6410" }}>
              {panel.meter.label.replace("{total}", String(Math.round(meter.total)))}
            </span>
          </div>
          <span className="mt-[6px] block h-[5px] overflow-hidden rounded-full" style={{ background: "#EDF3EF" }} aria-hidden>
            <span className="block h-full rounded-full" style={{ width: `${meter.pct}%`, background: meter.ok ? "#17714F" : meter.over ? "#B23B3B" : "#C9972B" }} />
          </span>
          <p className="mt-[6px] text-[10.5px] leading-normal" style={{ color: MUTED }}>
            {meter.ok ? panel.meter.okNote : panel.meter.note}
          </p>
        </div>
      ) : null}

      {panel.save ? (
        <div className="mt-[14px] flex flex-wrap items-center justify-between gap-3 border-t pt-[12px]" style={{ borderColor: "#EDF3EF" }}>
          <p
            className="min-w-0 flex-[1_1_200px] text-[10.5px] leading-normal"
            role={state.kind === "failed" ? "alert" : undefined}
            style={{ color: state.kind === "failed" ? "#B23B3B" : state.kind === "saved" ? "#17714F" : MUTED, fontWeight: state.kind === "idle" ? 400 : 600 }}
          >
            {state.kind === "idle" ? (dirty ? "You have unsaved changes." : "Type over any figure, then save.") : state.text ?? (state.kind === "saving" ? "Saving…" : "")}
          </p>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || state.kind === "saving"}
            className="rounded-[9px] bg-[#0D2315] px-[15px] py-[9px] text-[11.5px] font-semibold text-white disabled:opacity-50"
          >
            {state.kind === "saving" ? "Saving…" : (panel.save.label ?? "Save")}
          </button>
        </div>
      ) : state.kind === "failed" || state.kind === "saved" ? (
        <p className="mt-[10px] text-[10.5px] font-semibold" style={{ color: state.kind === "failed" ? "#B23B3B" : "#17714F" }}>
          {state.text}
        </p>
      ) : null}
      {panel.foot ? (
        <p className="mx-[-18px] mb-[-12px] mt-[12px] border-t bg-[#F7FAF8] px-[18px] py-[10px] text-[10.5px] leading-normal" style={{ borderColor: "#EDF3EF", color: MUTED }}>
          {panel.foot}
        </p>
      ) : null}
    </section>
  );
}

/* ───────────────────────── process flow ───────────────────────── */

const SILENCE_SHORT: Record<string, string> = {
  "Escalate to the next stage": "then moves on",
  "Remind daily": "then reminds daily",
  "Return it to the requester": "then returns to them",
  "Approve it automatically": "then auto-approves",
  "Move on without it": "then moves on",
  "Nothing publishes until it is done": "blocks publishing",
  "The manager’s rating stands": "manager rating stands",
  "Return it to the Bursar": "then returns to the Bursar",
};

function flowTone(stage: FlowPanel["stages"][number]): PanelTone {
  if (/automatic/i.test(stage.silence)) return "negative";
  if (/Notified only|Comments only/.test(stage.does)) return "neutral";
  return "positive";
}

function flowPill(stage: FlowPanel["stages"][number]): string {
  return /Notified only/.test(stage.does)
    ? "Notified"
    : /Comments only/.test(stage.does)
      ? "Comments"
      : /cover/i.test(stage.does)
        ? "Cover"
        : /Approve|Sign|Release/i.test(stage.does)
          ? "Decides"
          : "Acts";
}

/** Lower-case the first letter only, so “each KPI” and “the Proprietor” keep their capitals. */
const lowerFirst = (value: string) => (value ? value.charAt(0).toLowerCase() + value.slice(1) : value);

export function FlowPanelView({ panel, openDrawer }: { panel: FlowPanel; openDrawer: OpenDrawer }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);

  async function call(path: string, method: "POST" | "DELETE" | "PATCH", body: unknown = {}) {
    setBusy(true);
    setError(null);
    try {
      await sendJson(`${panel.endpoint}${path}`, method, body);
      setConfirm(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  }

  const count = panel.stages.length;
  const arrow = "flex h-[24px] w-[24px] items-center justify-center rounded-[7px] border bg-white text-[11px] disabled:opacity-40";

  return (
    <section className={PANEL_SHELL} style={{ borderColor: CARD_BORDER }}>
      <PanelHeader
        title={panel.title}
        sub={panel.sub}
        tag={panel.tag ?? `${count} ${count === 1 ? "stage" : "stages"}`}
        tagTone={panel.tagTone ?? "neutral"}
        acts={[...(panel.acts ?? []), { label: "Add a stage", primary: true, drawer: panel.addDrawer }]}
        openDrawer={openDrawer}
      />
      {panel.plain ? (
        <p className="mb-[10px] text-[11px] font-semibold" style={{ color: "#435048" }}>
          {panel.plain}
        </p>
      ) : null}
      {panel.presets?.length ? (
        <div className="mb-[10px] flex flex-wrap items-center gap-[6px]">
          <span className="mr-[3px] text-[9.5px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>
            Start from
          </span>
          {panel.presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={busy}
              onClick={() => call("/preset", "POST", { label: preset.label })}
              className="rounded-full border border-[#DEE8E2] bg-white px-[11px] py-[5px] text-[10.5px] font-semibold text-[#5F6E65] hover:bg-[#F7FAF8] disabled:opacity-50"
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mb-[10px] rounded-[10px] border border-[#E4B9B9] bg-[#FBF2F2] px-[12px] py-[8px] text-[11px] font-medium text-[#B23B3B]">
          {error}
        </p>
      ) : null}
      {count === 0 ? (
        <p className="rounded-[12px] border border-dashed px-[14px] py-[18px] text-center text-[11.5px]" style={{ borderColor: "#DEE8E2", color: MUTED }}>
          No stages — nothing would ever be decided. Add one.
        </p>
      ) : (
        <ol className="grid gap-[8px]">
          {panel.stages.map((stage, index) => {
            const tone = toneOf(flowTone(stage));
            const now = panel.nowIndex === index;
            return (
              <li
                key={`${stage.name}-${index}`}
                className="grid gap-[10px] rounded-[12px] border px-[13px] py-[11px] sm:grid-cols-[28px_minmax(0,1fr)_auto]"
                style={{ borderColor: now ? "#BFDCD1" : "#E4EDE8", background: now ? "#F6FBF8" : "#fff" }}
              >
                <span className="flex h-[24px] w-[24px] items-center justify-center rounded-full text-[10.5px] font-bold text-white" style={{ background: INK }}>
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-[7px]">
                    <p className="text-[12px] font-semibold" style={{ color: INK }}>
                      {stage.name}
                    </p>
                    <span className="rounded-full border px-[8px] py-[2px] text-[9.5px] font-semibold" style={{ background: tone.bg, borderColor: tone.bd, color: tone.fg }}>
                      {flowPill(stage)}
                    </span>
                    {now ? (
                      <span className="rounded-full bg-[#0D2315] px-[8px] py-[2px] text-[9.5px] font-semibold text-white">Here now</span>
                    ) : null}
                  </div>
                  <p className="mt-[3px] text-[11px] leading-normal" style={{ color: "#435048" }}>
                    <strong className="font-semibold">{stage.who}</strong> · {lowerFirst(stage.does)} · {lowerFirst(stage.scope)}
                  </p>
                  <p className="text-[10.5px] leading-normal" style={{ color: MUTED }}>
                    {stage.win}, {SILENCE_SHORT[stage.silence] ?? lowerFirst(stage.silence)} · tells {stage.notify.map(lowerFirst).join(", ")}
                  </p>
                </div>
                <div className="flex flex-none items-center gap-[5px] sm:justify-end">
                  <button type="button" aria-label="Move earlier" title="Move earlier" disabled={busy || index === 0} onClick={() => call("/move", "POST", { index, delta: -1 })} className={arrow} style={{ borderColor: "#DEE8E2", color: "#435048" }}>
                    {"↑"}
                  </button>
                  <button type="button" aria-label="Move later" title="Move later" disabled={busy || index === count - 1} onClick={() => call("/move", "POST", { index, delta: 1 })} className={arrow} style={{ borderColor: "#DEE8E2", color: "#435048" }}>
                    {"↓"}
                  </button>
                  <button type="button" onClick={() => openDrawer(panel.editDrawers[index])} className="rounded-[8px] border border-[#DEE8E2] bg-white px-[10px] py-[5px] text-[10.5px] font-semibold text-[#435048] hover:bg-[#F7FAF8]">
                    Edit
                  </button>
                  {confirm === index ? (
                    <>
                      <button type="button" disabled={busy} onClick={() => call(`/stages/${index}`, "DELETE")} className="rounded-[8px] bg-[#B23B3B] px-[9px] py-[5px] text-[10.5px] font-semibold text-white">
                        Remove it
                      </button>
                      <button type="button" onClick={() => setConfirm(null)} className="text-[10.5px]" style={{ color: MUTED }}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirm(index)} className="px-[6px] py-[5px] text-[10.5px] font-semibold text-[#B23B3B] hover:underline">
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {panel.rules?.length ? (
        <ul className="mt-[12px] grid gap-[3px] border-t pt-[10px]" style={{ borderColor: "#EDF3EF" }}>
          {panel.rules.map((rule) => (
            <li key={rule} className="flex gap-[8px] text-[10.5px] leading-normal" style={{ color: MUTED }}>
              <span aria-hidden>{"·"}</span>
              <span>{rule}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/* ───────────────────────── words, side by side ───────────────────────── */

export function QuotesPanelView({ panel, openDrawer }: { panel: QuotesPanel; openDrawer: OpenDrawer }) {
  return (
    <section className={PANEL_SHELL} style={{ borderColor: CARD_BORDER }}>
      <PanelHeader title={panel.title} sub={panel.sub} openDrawer={openDrawer} />
      <div className="grid gap-[10px]">
        {panel.quotes.map((quote) => {
          const tone = toneOf(quote.tone ?? "positive");
          return (
            <article key={quote.label} className="rounded-[12px] border px-[14px] py-[12px]" style={{ borderColor: "#E4EDE8" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.07em]" style={{ color: MUTED }}>
                  {quote.label}
                </p>
                {quote.pill ? (
                  <span className="rounded-full border px-[9px] py-[2px] text-[10px] font-semibold" style={{ background: tone.bg, borderColor: tone.bd, color: tone.fg }}>
                    {quote.pill}
                  </span>
                ) : null}
              </div>
              <p className="mt-[3px] text-[11.5px] font-semibold" style={{ color: INK }}>
                {quote.by}
                {quote.role ? <span className="font-normal" style={{ color: MUTED }}> · {quote.role}</span> : null}
                {quote.when ? <span className="font-normal" style={{ color: MUTED }}> · {quote.when}</span> : null}
              </p>
              {quote.text ? (
                <p className="mt-[7px] text-pretty text-[11.5px] leading-[1.6]" style={{ color: "#243B2E" }}>
                  {quote.text}
                </p>
              ) : (
                <p className="mt-[7px] text-pretty text-[11.5px] italic leading-[1.6]" style={{ color: MUTED }}>
                  {quote.emptyText}
                </p>
              )}
              {quote.photos?.length ? (
                <div className="mt-[9px] flex flex-wrap gap-[8px]">
                  {quote.photos.map((src, index) => (
                    <a key={src} href={src} target="_blank" rel="noreferrer" title="Open the photograph">
                      <img src={src} alt={`Photograph ${index + 1} for ${quote.label}`} className="h-[72px] w-[96px] rounded-[9px] border object-cover" style={{ borderColor: "#E4EDE8" }} loading="lazy" />
                    </a>
                  ))}
                </div>
              ) : null}
              {quote.act && quote.trigger?.drawer ? (
                <button type="button" onClick={() => openDrawer(quote.trigger!.drawer!)} className="mt-[9px] rounded-[8px] bg-[#0D2315] px-[12px] py-[6px] text-[11px] font-semibold text-white">
                  {quote.act}
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
