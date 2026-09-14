"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRef } from "react";
import { ChevronDown, Columns3, Filter, Search, X } from "lucide-react";

import { useToast } from "@/components/ui/toast-provider";

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
  const { showToast } = useToast();

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
        <button
          type="button"
          onClick={() => showToast({ variant: "info", title: "Not built", description: "There is no column-visibility control in this codebase — every table shows a fixed set of columns." })}
          className="inline-flex items-center gap-[7px] rounded-[10px] border border-[#DEE8E2] bg-white px-[13px] py-[9px] text-[12.5px] font-semibold text-[#435048]"
        >
          <Columns3 className="h-3.5 w-3.5" />
          Columns
        </button>
        <button
          type="button"
          onClick={() => showToast({ variant: "info", title: "Not built", description: "There is no saved-view feature in this codebase — a filter combination can't be named and revisited later." })}
          className="inline-flex items-center gap-[7px] rounded-[10px] border border-[#DEE8E2] bg-white px-[13px] py-[9px] text-[12.5px] font-semibold text-[#435048]"
        >
          <Filter className="h-3.5 w-3.5" />
          Saved views
        </button>
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
