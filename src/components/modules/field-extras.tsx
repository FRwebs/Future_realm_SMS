"use client";

import { Fragment, useMemo, useState } from "react";

import type { FormField, MatrixRow, PickerOption } from "@/lib/modules/panels";
import { CARD_BORDER, INK, MUTED } from "@/lib/modules/tones";
import { cn } from "@/lib/utils/cn";

type Kind<K extends FormField["kind"]> = Extract<FormField, { kind: K }>;

const SEARCH =
  "w-full min-w-0 rounded-[10px] border-[1.5px] bg-white px-[11px] py-[8px] text-[11.5px] font-medium text-[#0D2315] outline-hidden focus:border-[#12796A]";

/** A list of checkboxes where the person may also type an option the list does not hold. */
export function AddableChecks({
  field,
  value,
  setValue,
}: {
  field: Kind<"checks">;
  value: string[];
  setValue: (next: string[]) => void;
}) {
  const [extra, setExtra] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const options = [...field.options, ...extra.filter((item) => !field.options.includes(item))];
  // A value already ticked but not in the list (a duty added earlier) must still be shown.
  for (const item of value) if (!options.includes(item)) options.push(item);

  function add() {
    const text = draft.trim();
    if (!text) return;
    if (!options.includes(text)) setExtra((current) => [...current, text]);
    if (!value.includes(text)) setValue([...value, text]);
    setDraft("");
  }

  const rowWise = field.row === true;
  return (
    <>
      <div className={rowWise ? "flex flex-wrap items-center gap-[7px]" : "flex flex-col gap-[2px]"}>
        {options.map((option) => {
          const on = value.includes(option);
          return (
            <button
              key={option}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => setValue(on ? value.filter((item) => item !== option) : [...value, option])}
              className={
                rowWise
                  ? "inline-flex items-center gap-[7px] whitespace-nowrap rounded-full border py-[6px] pl-[9px] pr-[11px]"
                  : "flex min-h-[32px] items-center gap-[9px] text-left"
              }
              style={rowWise ? { borderColor: on ? INK : CARD_BORDER, background: on ? "#F1F8F4" : "#fff" } : undefined}
            >
              <span
                className="flex h-[15px] w-[15px] flex-none items-center justify-center rounded-[4.5px] border-[1.5px] text-[9.5px] font-extrabold text-white"
                style={{ background: on ? INK : "#fff", borderColor: on ? INK : "#C2D2C8" }}
                aria-hidden
              >
                {on ? "✓" : ""}
              </span>
              <span className="text-[11.5px]" style={{ color: on ? INK : "#435048", fontWeight: on ? 600 : 400 }}>
                {option}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-[9px] flex items-center gap-[7px]">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder={field.addPlaceholder ?? "Something else"}
          aria-label={`${field.label} — add another`}
          className={cn(SEARCH, "min-h-[34px] flex-1")}
          style={{ borderColor: CARD_BORDER }}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="whitespace-nowrap rounded-[9px] border border-[#CFDDD5] bg-white px-[12px] py-[8px] text-[11px] font-semibold text-[#435048] disabled:opacity-50"
        >
          {field.addLabel ?? "Add"}
        </button>
      </div>
    </>
  );
}

/** Search a list, tick as many as you like, and see who you have chosen. */
export function PickerField({
  field,
  value,
  setValue,
}: {
  field: Kind<"picker">;
  value: string[];
  setValue: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const groups = useMemo(() => Array.from(new Set(field.options.map((option) => option.group).filter((item): item is string => Boolean(item)))), [field.options]);
  const needle = query.trim().toLowerCase();
  const shown = field.options.filter(
    (option) =>
      (!group || option.group === group) &&
      (!needle || `${option.label} ${option.sub ?? ""} ${option.group ?? ""}`.toLowerCase().includes(needle)),
  );
  const noun = field.noun ?? "person";
  const plural = field.nounPlural ?? `${noun}s`;
  const toggle = (option: PickerOption) =>
    setValue(value.includes(option.value) ? value.filter((item) => item !== option.value) : [...value, option.value]);

  return (
    <div className="grid gap-[8px]">
      <div className="flex flex-wrap items-center gap-[7px]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={field.placeholder ?? `Search ${plural}`}
          aria-label={`${field.label} — search`}
          className={cn(SEARCH, "min-w-[180px] flex-1")}
          style={{ borderColor: CARD_BORDER }}
        />
        {groups.length ? (
          <select
            value={group}
            onChange={(event) => setGroup(event.target.value)}
            aria-label={`${field.label} — narrow by group`}
            className={cn(SEARCH, "w-auto cursor-pointer")}
            style={{ borderColor: CARD_BORDER }}
          >
            <option value="">{field.groupAll ?? "All groups"}</option>
            {groups.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="max-h-[210px] overflow-y-auto rounded-[11px] border" style={{ borderColor: "#E4EDE8" }}>
        {shown.length ? (
          shown.map((option) => {
            const on = value.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggle(option)}
                aria-pressed={on}
                className="flex w-full items-center justify-between gap-[10px] border-b px-[11px] py-[8px] text-left last:border-b-0 hover:bg-[#F7FAF8]"
                style={{ borderColor: "#F2F7F4", background: on ? "#F1F8F4" : undefined }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[11.5px] font-semibold" style={{ color: INK }}>
                    {option.label}
                  </span>
                  {option.sub || option.group ? (
                    <span className="block truncate text-[10px]" style={{ color: MUTED }}>
                      {[option.sub, option.group].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </span>
                <span
                  className="flex-none rounded-full border px-[9px] py-[3px] text-[10px] font-semibold"
                  style={{ borderColor: on ? INK : "#DEE8E2", background: on ? INK : "#fff", color: on ? "#fff" : "#5F6E65" }}
                >
                  {on ? "Selected" : "Select"}
                </span>
              </button>
            );
          })
        ) : (
          <p className="px-[12px] py-[16px] text-center text-[11px]" style={{ color: MUTED }}>
            Nobody matches that.
          </p>
        )}
      </div>
      {value.length ? (
        <div className="flex flex-wrap items-center gap-[6px]">
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: MUTED }}>
            {value.length} {value.length === 1 ? noun : plural} selected
          </span>
          {value.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setValue(value.filter((entry) => entry !== item))}
              className="inline-flex items-center gap-[5px] rounded-full border px-[9px] py-[3px] text-[10.5px] font-semibold"
              style={{ borderColor: "#CFE4DB", background: "#F1F8F4", color: "#17714F" }}
              aria-label={`Remove ${field.options.find((option) => option.value === item)?.label ?? item}`}
            >
              {field.options.find((option) => option.value === item)?.label ?? item}
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Rows down, actions across. A tick is "rowKey|column". */
export function MatrixField({
  field,
  value,
  setValue,
  visibleGroups,
}: {
  field: Kind<"matrix">;
  value: string[];
  setValue: (next: string[]) => void;
  /** The groups (modules) currently offered, or undefined for all rows. */
  visibleGroups?: string[];
}) {
  const rows = field.rows.filter((row) => !row.group || !visibleGroups || visibleGroups.includes(row.group));
  const set = new Set(value);
  const key = (row: MatrixRow, col: string) => `${row.key}|${col}`;
  const open = (row: MatrixRow, col: string) => !row.lock?.includes(col);

  function toggle(row: MatrixRow, col: string) {
    if (!open(row, col)) return;
    const next = new Set(set);
    const id = key(row, col);
    if (next.has(id)) {
      next.delete(id);
      // Taking away View takes the rest with it: a tab nobody can see cannot be edited.
      if (col === field.cols[0]) for (const other of field.cols.slice(1)) next.delete(key(row, other));
    } else {
      next.add(id);
      if (col !== field.cols[0] && open(row, field.cols[0])) next.add(key(row, field.cols[0]));
    }
    setValue(Array.from(next));
  }

  function toggleRow(row: MatrixRow) {
    const allOn = field.cols.filter((col) => open(row, col)).every((col) => set.has(key(row, col)));
    const next = new Set(set);
    for (const col of field.cols) {
      if (!open(row, col)) continue;
      if (allOn) next.delete(key(row, col));
      else next.add(key(row, col));
    }
    setValue(Array.from(next));
  }

  function toggleCol(col: string) {
    const eligible = rows.filter((row) => open(row, col));
    const allOn = eligible.length > 0 && eligible.every((row) => set.has(key(row, col)));
    const next = new Set(set);
    for (const row of eligible) {
      if (allOn) next.delete(key(row, col));
      else {
        next.add(key(row, col));
        if (col !== field.cols[0] && open(row, field.cols[0])) next.add(key(row, field.cols[0]));
      }
    }
    setValue(Array.from(next));
  }

  function quick(kind: "view" | "all" | "none") {
    const next = new Set(value.filter((item) => !rows.some((row) => item.startsWith(`${row.key}|`))));
    if (kind !== "none") {
      for (const row of rows) {
        for (const col of kind === "view" ? field.cols.slice(0, 1) : field.cols) {
          if (open(row, col)) next.add(key(row, col));
        }
      }
    }
    setValue(Array.from(next));
  }

  const ticks = rows.reduce((sum, row) => sum + field.cols.filter((col) => set.has(key(row, col))).length, 0);
  let lastGroup: string | undefined;

  return (
    <div className="grid gap-[8px]">
      {field.quick?.length ? (
        <div className="flex flex-wrap items-center gap-[6px]">
          {field.quick.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => quick(item.set)}
              className="rounded-full border border-[#DEE8E2] bg-white px-[11px] py-[5px] text-[10.5px] font-semibold text-[#435048] hover:bg-[#F7FAF8]"
            >
              {item.label}
            </button>
          ))}
          <span className="ml-auto text-[10.5px]" style={{ color: MUTED }}>
            {ticks} {ticks === 1 ? "action" : "actions"} granted across {rows.length} {rows.length === 1 ? "row" : "rows"}
          </span>
        </div>
      ) : null}
      <div className="max-h-[320px] overflow-auto rounded-[11px] border" style={{ borderColor: "#E4EDE8" }}>
        <table className="w-full min-w-[420px] border-collapse">
          <thead>
            <tr style={{ background: "#F7FAF8" }}>
              <th className="sticky top-0 bg-[#F7FAF8] px-[11px] py-[8px] text-left text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                {field.rowHead ?? "Row"}
              </th>
              {field.cols.map((col) => (
                <th key={col} className="sticky top-0 bg-[#F7FAF8] px-[6px] py-[8px] text-center">
                  <button
                    type="button"
                    onClick={() => toggleCol(col)}
                    className="text-[9.5px] font-semibold uppercase tracking-wider hover:underline"
                    style={{ color: MUTED }}
                    title={`Tick or clear ${col} for every row`}
                  >
                    {col}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const heading = row.group && row.group !== lastGroup ? row.group : null;
              lastGroup = row.group;
              return (
                <Fragment key={row.key}>
                  {heading ? (
                    <tr key={`g-${heading}`}>
                      <td colSpan={field.cols.length + 1} className="bg-[#FCFDFC] px-[11px] pb-[3px] pt-[8px] text-[9.5px] font-bold uppercase tracking-[0.06em]" style={{ color: "#12796A" }}>
                        {heading}
                      </td>
                    </tr>
                  ) : null}
                  <tr key={row.key} className="border-t" style={{ borderColor: "#F2F7F4" }}>
                    <td className="px-[11px] py-[7px]">
                      <button type="button" onClick={() => toggleRow(row)} className="text-left" title="Tick or clear the whole row">
                        <span className="block text-[11.5px] font-semibold" style={{ color: INK }}>
                          {row.label}
                        </span>
                        {row.sub ? (
                          <span className="block text-[10px]" style={{ color: MUTED }}>
                            {row.sub}
                          </span>
                        ) : null}
                      </button>
                    </td>
                    {field.cols.map((col) => {
                      const on = set.has(key(row, col));
                      const locked = !open(row, col);
                      return (
                        <td key={col} className="px-[6px] py-[7px] text-center">
                          {locked ? (
                            <span aria-label={`${col} is never available here`} style={{ color: "#C2D2C8" }}>
                              —
                            </span>
                          ) : (
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={on}
                              aria-label={`${row.label} — ${col}`}
                              onClick={() => toggle(row, col)}
                              className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border-[1.5px] text-[10px] font-extrabold text-white"
                              style={{ background: on ? INK : "#fff", borderColor: on ? INK : "#C2D2C8" }}
                            >
                              {on ? "✓" : ""}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </Fragment>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={field.cols.length + 1} className="px-[12px] py-[16px] text-center text-[11px]" style={{ color: MUTED }}>
                  Nothing to set yet. Tick a module above and its tabs arrive here.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Rows a person writes, one column at a time. */
export function LinesField({
  field,
  value,
  setValue,
}: {
  field: Kind<"lines">;
  value: Array<Record<string, string>>;
  setValue: (next: Array<Record<string, string>>) => void;
}) {
  const template = field.cols.map((col) => col.w ?? "minmax(100px,1fr)").join(" ") + " 28px";
  const change = (index: number, key: string, next: string) =>
    setValue(value.map((row, i) => (i === index ? { ...row, [key]: next } : row)));

  return (
    <div className="grid gap-[7px]">
      {field.presets?.length ? (
        <div className="flex flex-wrap items-center gap-[6px]">
          {field.presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setValue(preset.rows.map((row) => ({ ...row })))}
              className="rounded-full border border-[#DEE8E2] bg-white px-[11px] py-[5px] text-[10.5px] font-semibold text-[#435048] hover:bg-[#F7FAF8]"
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <div className="grid min-w-[560px] gap-[5px]">
          <div className="grid items-end gap-[6px]" style={{ gridTemplateColumns: template }}>
            {field.cols.map((col) => (
              <span key={col.key} className="text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                {col.label}
              </span>
            ))}
            <span />
          </div>
          {value.map((row, index) => (
            <div key={index} className="grid items-center gap-[6px]" style={{ gridTemplateColumns: template }}>
              {field.cols.map((col) =>
                col.kind === "select" ? (
                  <select
                    key={col.key}
                    value={row[col.key] ?? ""}
                    onChange={(event) => change(index, col.key, event.target.value)}
                    aria-label={`${col.label}, line ${index + 1}`}
                    className={cn(SEARCH, "cursor-pointer")}
                    style={{ borderColor: CARD_BORDER }}
                  >
                    {(col.options ?? []).map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    key={col.key}
                    value={row[col.key] ?? ""}
                    inputMode={col.num ? "decimal" : undefined}
                    onChange={(event) => change(index, col.key, event.target.value)}
                    placeholder={col.placeholder}
                    aria-label={`${col.label}, line ${index + 1}`}
                    className={cn(SEARCH, col.num && "text-right tabular-nums")}
                    style={{ borderColor: CARD_BORDER }}
                  />
                ),
              )}
              <button
                type="button"
                onClick={() => setValue(value.filter((_, i) => i !== index))}
                aria-label={`Remove line ${index + 1}`}
                className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] border border-[#DEE8E2] bg-white text-[#8B9A91] hover:border-[#E4B9B9] hover:text-[#B23B3B]"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <button
          type="button"
          onClick={() => setValue([...value, { ...field.blank }])}
          className="rounded-[9px] border border-[#CFDDD5] bg-white px-[12px] py-[7px] text-[11px] font-semibold text-[#435048] hover:bg-[#F7FAF8]"
        >
          {field.addLabel ?? "Add a line"}
        </button>
      </div>
    </div>
  );
}
