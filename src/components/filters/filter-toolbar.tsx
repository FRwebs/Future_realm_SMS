"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRef } from "react";
import { ChevronDown, Search, X } from "lucide-react";

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
    <form ref={formRef} action={action} className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2.5">
      {searchControl ? (
        <div className="flex min-w-[220px] items-center gap-2 rounded-[9px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
          <input
            name={searchControl.name}
            type="search"
            placeholder={searchControl.type === "search" ? searchControl.placeholder : undefined}
            defaultValue={searchControl.defaultValue}
            onChange={submitDebounced}
            className="w-full min-w-0 bg-transparent text-[12.5px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
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
                className="peer appearance-none rounded-[9px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] py-2 pl-3 pr-8 text-[12px] text-[var(--color-text-primary)] focus:outline-none"
              >
                {control.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {control.label}: {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)] peer-focus:text-[var(--color-text-accent)]" />
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
              className="rounded-[9px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-3 py-2 text-[12px] text-[var(--color-text-primary)] focus:outline-none"
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
            className="w-36 rounded-[9px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-3 py-2 text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
          />
        );
      })}

      <div className="ml-auto flex items-center gap-3">
        {typeof resultCount === "number" ? (
          <span className="text-[11.5px] text-[var(--color-text-muted)]">
            {resultCount.toLocaleString()} shown
          </span>
        ) : null}
        <Link
          href={action as Route}
          className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--color-text-muted)] transition hover:text-[var(--color-text-accent)]"
        >
          <X className="h-3 w-3" />
          Clear
        </Link>
      </div>
    </form>
  );
}
