"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { useToast } from "@/components/ui/toast-provider";

import type { PreparedColumn, PreparedRow, SelectionAction, SelectionConfig } from "./table-card-body";

/**
 * The Back Office table, drawn the way the mockup draws it: a head with the title, a line of context and the actions; an optional
 * toolbar; a header row in small capitals; rows with generous padding and a hairline between them; a pager that numbers the pages;
 * and a footnote strip. Nothing in it sorts, hides columns or shows a big empty-state icon — the mockup has none of those.
 */

type Props = {
  title: string;
  description?: ReactNode;
  emptyState: string;
  actions?: ReactNode;
  filterBar?: ReactNode;
  footnote?: ReactNode;
  columns: PreparedColumn[];
  rows: PreparedRow[];
  pageSize: number | false;
  selection?: SelectionConfig;
};

const csrf = () => document.cookie.split("; ").find((item) => item.startsWith("fr_csrf="))?.split("=")[1] ?? "";

/** The mockup pages a table of ten or more rows, eight to a page. */
const perPage = (total: number, pageSize: number | false) => (pageSize === false || total < 10 ? 0 : 8);

export function BackOfficeTable({ title, description, emptyState, actions, filterBar, footnote, columns, rows, pageSize, selection }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [picked, setPicked] = useState<Array<string | number>>([]);
  const [acting, setActing] = useState(false);
  const [page, setPage] = useState(0);
  const [choices, setChoices] = useState<Record<string, string>>({});

  useEffect(() => {
    setPage(0);
    setPicked([]);
  }, [rows]);

  const per = perPage(rows.length, pageSize);
  const pages = per ? Math.max(1, Math.ceil(rows.length / per)) : 1;
  const current = Math.min(page, pages - 1);
  const shown = per ? rows.slice(current * per, current * per + per) : rows;
  const hasHead = Boolean(title) || Boolean(actions);

  async function run(action: SelectionAction) {
    if (action.confirm && !window.confirm(action.confirm)) return;
    const ids = picked.map(String);
    if (action.method === "DOWNLOAD") {
      window.location.href = `${action.endpoint}${action.endpoint.includes("?") ? "&" : "?"}${action.idsField}=${encodeURIComponent(ids.join(","))}`;
      return;
    }
    setActing(true);
    try {
      const response = await fetch(action.endpoint, { method: action.method ?? "POST", credentials: "include", headers: { "Content-Type": "application/json", "x-csrf-token": csrf() }, body: JSON.stringify({ ...(action.extra ?? {}), ...(action.choice ? { [action.choice.field]: choices[action.label] } : {}), [action.idsField]: ids }) });
      const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error ?? "That did not go through.");
      showToast({ variant: "success", title: action.label, description: body.message ?? `Done for ${ids.length} ${ids.length === 1 ? selection?.noun : selection?.nounPlural}.` });
      setPicked([]);
      router.refresh();
    } catch (error) {
      showToast({ variant: "error", title: action.label, description: error instanceof Error ? error.message : "That did not go through." });
    } finally {
      setActing(false);
    }
  }

  const pageIds = shown.map((row) => row.key);
  const allOn = pageIds.length > 0 && pageIds.every((id) => picked.includes(id));
  const box = (on: boolean) => `flex h-4 w-4 flex-none cursor-pointer items-center justify-center rounded-[4.5px] border-[1.5px] text-[10.5px] font-extrabold text-white ${on ? "border-[#0D2315] bg-[#0D2315]" : "border-[#C2D2C8] bg-white"}`;
  const pageButton = (on: boolean, disabled: boolean) => `flex h-7 min-w-7 items-center justify-center rounded-lg border px-2 text-[12px] font-semibold ${on ? "border-[#0D2315] bg-[#0D2315] text-white" : `border-[#DEE8E2] bg-white ${disabled ? "cursor-default text-[#C2D2C8]" : "cursor-pointer text-[#435048] hover:border-[#BFDCD1] hover:bg-[#EFF6F2]"}`}`;

  // Which page numbers to draw: all of them up to seven, else first, last and the neighbours of the current one.
  const numbers: Array<number | "gap-a" | "gap-b"> = [];
  if (pages <= 7) for (let i = 0; i < pages; i += 1) numbers.push(i);
  else {
    numbers.push(0);
    if (current > 2) numbers.push("gap-a");
    for (let i = Math.max(1, current - 1); i <= Math.min(pages - 2, current + 1); i += 1) numbers.push(i);
    if (current < pages - 3) numbers.push("gap-b");
    numbers.push(pages - 1);
  }
  const first = rows.length ? current * per + 1 : 0;
  const last = per ? Math.min(rows.length, current * per + per) : rows.length;

  return (
    <section className="surface-card min-w-0 overflow-hidden">
      {hasHead ? (
        <div className="flex flex-wrap items-start justify-between gap-[14px] border-b border-[#EDF3EF] px-5 pb-[14px] pt-4">
          <div className="min-w-0 flex-[1_1_300px]">
            <h3 className="text-pretty text-[14px] font-semibold leading-[1.3] text-[var(--color-text-primary)]">{title}</h3>
            {description ? <p className="mt-1 text-pretty text-[11.5px] leading-[1.5] text-[#8C9A92]">{description}</p> : null}
          </div>
          {actions ? <div className="flex min-w-0 flex-none items-center justify-end gap-2">{actions}</div> : null}
        </div>
      ) : null}

      {filterBar}

      {selection && picked.length > 0 ? (
        <div className="px-3 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#0D2315] px-4 py-[11px]">
            <div className="flex items-center gap-[11px]">
              <button type="button" aria-label="Clear the selection" onClick={() => setPicked([])} className="flex h-[17px] w-[17px] flex-none items-center justify-center rounded-[5px] bg-white">
                <span className="block h-[2px] w-[9px] rounded bg-[#0D2315]" />
              </button>
              <span className="text-[12.5px] font-semibold text-white">{picked.length} {picked.length === 1 ? selection.noun : selection.nounPlural} selected</span>
              <button type="button" onClick={() => setPicked([])} className="text-[11.5px] text-white/60 hover:text-white">Clear</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selection.actions.map((action) => (
                <span key={action.label} className="inline-flex items-center gap-1.5">
                  {action.choice ? (
                    <select aria-label={action.choice.label} value={choices[action.label] ?? ""} onChange={(event) => setChoices((currentChoices) => ({ ...currentChoices, [action.label]: event.target.value }))} className="rounded-lg border border-white/30 bg-[#0D2315] px-2.5 py-[6px] text-[12px] font-semibold text-white">
                      <option value="">{action.choice.label}</option>
                      {action.choice.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : null}
                  <button type="button" disabled={acting || Boolean(action.choice && !choices[action.label])} onClick={() => void run(action)} className={action.kind === "primary" ? "whitespace-nowrap rounded-lg bg-white px-3 py-[6px] text-[12px] font-semibold text-[#0D2315] hover:bg-[#E4F1EC] disabled:opacity-60" : "whitespace-nowrap rounded-lg border border-white/30 px-3 py-[6px] text-[12px] font-semibold text-white hover:bg-white/10 disabled:opacity-60"}>
                    {action.label}
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="px-5 py-[26px] text-center text-[12.5px] text-[#8C9A92]">{emptyState}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-full border-separate border-spacing-0 text-[12.5px]">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                {selection ? (
                  <th scope="col" className="w-[34px] border-b border-[#E6EEE9] bg-[#F7FAF8] px-5 py-[11px]">
                    <button type="button" role="checkbox" aria-checked={allOn} aria-label="Select every row on this page" onClick={() => setPicked((currentPicked) => (allOn ? currentPicked.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...currentPicked, ...pageIds]))))} className={box(allOn)}>{allOn ? "✓" : ""}</button>
                  </th>
                ) : null}
                {columns.map((column) => (
                  <th key={column.key} scope="col" className={["whitespace-nowrap border-b border-[#E6EEE9] bg-[#F7FAF8] px-5 py-[11px] text-left text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[#8C9A92]", column.headerClassName ?? ""].join(" ")}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.key} className="text-[12.5px] text-[var(--color-text-secondary)]">
                  {selection ? (
                    <td className="w-[34px] border-b border-[#F2F7F4] px-5 py-[13px] align-middle">
                      <button type="button" role="checkbox" aria-checked={picked.includes(row.key)} aria-label="Select this row" onClick={() => setPicked((currentPicked) => (currentPicked.includes(row.key) ? currentPicked.filter((id) => id !== row.key) : [...currentPicked, row.key]))} className={box(picked.includes(row.key))}>{picked.includes(row.key) ? "✓" : ""}</button>
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td key={column.key} className={["border-b border-[#F2F7F4] px-5 py-[13px] align-middle", column.cellClassName ?? ""].join(" ")}>
                      {row.cells[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {per && pages > 1 ? (
        <div className="flex items-center justify-between gap-[14px] border-t border-[#EDF3EF] bg-[#FCFDFC] px-5 py-[11px]">
          <p className="text-[11.5px] text-[#8C9A92]">Showing {first}–{last} of {rows.length}</p>
          <div className="flex flex-none items-center gap-[6px]">
            <button type="button" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(Math.max(0, current - 1))} className={pageButton(false, current === 0)}>‹</button>
            {numbers.map((n, index) =>
              typeof n === "number" ? (
                <button key={n} type="button" onClick={() => setPage(n)} className={pageButton(n === current, false)}>{n + 1}</button>
              ) : (
                <span key={`${n}-${index}`} className="flex h-7 min-w-5 items-center justify-center text-[12px] text-[#B4C4BB]">…</span>
              )
            )}
            <button type="button" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(Math.min(pages - 1, current + 1))} className={pageButton(false, current >= pages - 1)}>›</button>
          </div>
        </div>
      ) : null}

      {footnote ? <div className="border-t border-[#EDF3EF] bg-[#F7FAF8] px-5 py-3 text-[11.5px] text-[#8C9A92]">{footnote}</div> : null}
    </section>
  );
}
