"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Filter, Search, Trash2, X } from "lucide-react";

export type FilterOption = {
  label: string;
  value: string;
};

type BaseControl = {
  name: string;
  label: string;
  defaultValue?: string;
};

export type FilterControl =
  | (BaseControl & {
      type: "search" | "date";
      placeholder?: string;
    })
  | (BaseControl & {
      type: "select";
      options: FilterOption[];
    });

interface FilterToolbarProps {
  title?: string;
  description?: string;
  action: Route | string;
  controls: FilterControl[];
  activeSummary?: string[];
  resultCount?: number;
  primaryCount?: number;
  showAdvancedToggle?: boolean;
  advancedOpen?: boolean;
}

/**
 * A single compact row: an optional search box, a chip per filter, and a result
 * count — all filters apply immediately on change, no Apply/Reset buttons.
 * Matches the mockup's minimal inline filter bar (attaches directly above a table).
 */
export function FilterToolbar({
  action,
  controls,
  resultCount,
}: FilterToolbarProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function submitNow() {
    formRef.current?.requestSubmit();
  }

  function submitDebounced() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(submitNow, 450);
  }

  const searchControl = controls.find((control) => control.type === "search");
  const otherControls = controls.filter((control) => control !== searchControl);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-center gap-[9px] border-b border-[#EDF3EF] bg-[#FCFDFC] px-5 py-3.5">
      {searchControl ? (
        <div className="flex w-full items-center gap-[9px] rounded-[10px] border border-[#DEE8E2] bg-white px-[13px] py-[9px] sm:w-[280px]">
          <Search className="h-[15px] w-[15px] shrink-0 text-[#9FB8A7]" />
          <input
            name={searchControl.name}
            type="search"
            placeholder={searchControl.type === "search" ? searchControl.placeholder : undefined}
            defaultValue={searchControl.defaultValue}
            onChange={submitDebounced}
            className="w-full min-w-0 bg-transparent text-[13px] text-[#0D2315] placeholder:text-[#9FB8A7] focus:outline-none"
          />
        </div>
      ) : null}

      {otherControls.map((control) => {
        if (control.type === "select") {
          return (
            <div key={control.name} className="relative">
              <select
                name={control.name}
                defaultValue={control.defaultValue ?? ""}
                onChange={submitNow}
                aria-label={control.label}
                className="peer appearance-none rounded-[10px] border border-[#DEE8E2] bg-white py-[9px] pl-[13px] pr-8 text-[12.5px] font-semibold text-[#0D2315] focus:outline-none"
              >
                {control.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {control.label}: {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-[13px] w-[13px] -translate-y-1/2 text-[#9FB8A7] peer-focus:text-[#12796A]" />
            </div>
          );
        }

        if (control.type === "date") {
          return (
            <input
              key={control.name}
              name={control.name}
              type="date"
              aria-label={control.label}
              defaultValue={control.defaultValue}
              onChange={submitNow}
              className="rounded-[10px] border border-[#DEE8E2] bg-white px-[13px] py-[9px] text-[12.5px] font-semibold text-[#0D2315] focus:outline-none"
            />
          );
        }

        return (
          <input
            key={control.name}
            name={control.name}
            type="search"
            placeholder={control.placeholder ?? control.label}
            defaultValue={control.defaultValue}
            onChange={submitDebounced}
            className="w-36 rounded-[10px] border border-[#DEE8E2] bg-white px-[13px] py-[9px] text-[12.5px] font-semibold text-[#0D2315] placeholder:text-[#9FB8A7] focus:outline-none"
          />
        );
      })}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <SavedViews action={action} />
        {typeof resultCount === "number" ? (
          <span className="text-[11.5px] text-[#8C9A92]">
            {resultCount.toLocaleString()} shown
          </span>
        ) : null}
        <Link
          href={action as Route}
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#8C9A92] transition hover:text-[#12796A]"
        >
          <X className="h-3 w-3" />
          Clear
        </Link>
      </div>
    </form>
  );
}

type SavedView = { id: string; name: string; query: string };

function savedViewsKey(action: Route | string) {
  return `sms:saved-views:${action}`;
}

/**
 * A "saved view" is just a named URL: FilterToolbar's entire state already lives
 * in the query string, so saving one is storing {name, query} and saving-and-
 * revisiting is a Link back to `${action}?${query}`. Persisted in localStorage,
 * scoped per page (action) — there's no backend model for this, and none is
 * needed since it's purely a per-browser shortcut.
 */
function SavedViews({ action }: { action: Route | string }) {
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<SavedView[]>([]);
  const [draftName, setDraftName] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(savedViewsKey(action));
      if (stored) setViews(JSON.parse(stored));
    } catch {
      // Ignore malformed/blocked storage — falls back to no saved views.
    }
  }, [action]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function persist(next: SavedView[]) {
    setViews(next);
    try {
      window.localStorage.setItem(savedViewsKey(action), JSON.stringify(next));
    } catch {
      // Best-effort persistence only.
    }
  }

  function saveCurrentView() {
    const name = draftName.trim();
    if (!name) return;
    const query = window.location.search.replace(/^\?/, "");
    persist([...views, { id: `${Date.now()}`, name, query }]);
    setDraftName("");
  }

  function removeView(id: string) {
    persist(views.filter((view) => view.id !== id));
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-[7px] rounded-[10px] border border-[#DEE8E2] bg-white px-[13px] py-[9px] text-[12.5px] font-semibold text-[#435048]"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Filter className="h-3.5 w-3.5" />
        Saved views
        {views.length ? (
          <span className="ml-0.5 rounded-full bg-[var(--color-bg-subtle)] px-[6px] text-[10.5px] font-bold text-[#435048]">{views.length}</span>
        ) : null}
      </button>
      {open ? (
        <div className="popover-enter absolute right-0 top-[calc(100%+6px)] z-20 w-64 rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-2.5 shadow-[var(--shadow-md)]">
          <p className="px-1.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Saved views</p>
          {views.length ? (
            <div className="mb-2 grid gap-0.5">
              {views.map((view) => (
                <div key={view.id} className="flex items-center gap-1.5 rounded-[8px] px-1.5 py-1 hover:bg-[var(--color-bg-subtle)]">
                  <Link
                    href={(view.query ? `${action}?${view.query}` : `${action}`) as Route}
                    className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--color-text-primary)]"
                    onClick={() => setOpen(false)}
                  >
                    {view.name}
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeView(view.id)}
                    aria-label={`Delete saved view ${view.name}`}
                    className="shrink-0 text-[var(--color-text-muted)] transition hover:text-[var(--color-danger)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-1.5 py-2 text-[11.5px] text-[var(--color-text-muted)]">No saved views yet.</p>
          )}
          <div className="flex items-center gap-1.5 border-t border-[#EDF3EF] pt-2">
            <input
              type="text"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveCurrentView();
                }
              }}
              placeholder="Name this filter combination"
              className="min-w-0 flex-1 rounded-[8px] border border-[#DEE8E2] px-2 py-1.5 text-[12px] text-[#0D2315] placeholder:text-[#9FB8A7] focus:outline-none"
            />
            <button
              type="button"
              onClick={saveCurrentView}
              disabled={!draftName.trim()}
              className="shrink-0 rounded-[8px] bg-[var(--color-accent-primary)] px-2.5 py-1.5 text-[11.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
