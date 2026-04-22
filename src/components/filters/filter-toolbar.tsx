"use client";

import Link from "next/link";
import type { Route } from "next";
import {
  CalendarDays,
  ChevronDown,
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

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

export function FilterToolbar({
  title = "Filter records",
  description,
  action,
  controls,
  activeSummary = [],
  resultCount,
  primaryCount = 4,
  showAdvancedToggle = true,
  advancedOpen = true,
}: FilterToolbarProps) {
  const primaryControls = controls.slice(0, primaryCount);
  const advancedControls = controls.slice(primaryCount);
  const hasAdvanced = advancedControls.length > 0;

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(235,244,238,0.88),rgba(255,255,255,0.97),rgba(246,250,247,0.92))] px-5 py-5 md:px-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary-700 shadow-sm">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Smart filters</span>
            </div>

            <h2 className="mt-3 text-[20px] font-bold text-slate-900 md:text-[24px]">
              {title}
            </h2>

            {description ? (
              <p className="mt-2 max-w-2xl text-[13px] leading-6 text-slate-600">
                {description}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {typeof resultCount === "number" ? (
                <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm">
                  Showing {resultCount.toLocaleString()} result
                  {resultCount === 1 ? "" : "s"}
                </div>
              ) : null}

              {activeSummary.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {activeSummary.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary-100 bg-primary-50 px-3 py-1.5 text-[11px] font-semibold text-primary-700 shadow-sm"
                    >
                      <span>{item}</span>
                      <X className="h-3.5 w-3.5 opacity-60" />
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasAdvanced && showAdvancedToggle ? (
              <button
                type="button"
                className="btn-secondary h-11 gap-2 rounded-2xl px-4"
                aria-expanded={advancedOpen}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span>Advanced filters</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    advancedOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            ) : null}

            <Link
              href={action as Route}
              className="btn-secondary h-11 gap-2 rounded-2xl px-4"
            >
              <X className="h-4 w-4" />
              <span>Clear all</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-5 py-5 md:px-6">
        <form action={action} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {primaryControls.map((control) => (
              <FilterField key={control.name} control={control} />
            ))}
          </div>

          {hasAdvanced && advancedOpen ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50/90 p-4 md:p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-primary-600 shadow-sm ring-1 ring-slate-100">
                  <Filter className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-slate-800">
                    Advanced filters
                  </p>
                  <p className="text-[12px] text-slate-500">
                    Narrow your results with more specific filter options.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {advancedControls.map((control) => (
                  <FilterField key={control.name} control={control} />
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-slate-500">
              Refine records by search, date, and status to find the exact data
              you need.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={action as Route}
                className="btn-secondary h-11 gap-2 rounded-2xl px-5"
              >
                <X className="h-4 w-4" />
                <span>Reset</span>
              </Link>

              <button
                type="submit"
                className="btn-primary h-11 gap-2 rounded-2xl px-6 active:scale-[0.99]"
              >
                <Filter className="h-4 w-4" />
                <span>Apply filters</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}

function FilterField({ control }: { control: FilterControl }) {
  const isSearch = control.type === "search";
  const isDate = control.type === "date";
  const isSelect = control.type === "select";

  return (
    <label className="group block min-w-0">
      <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {isSearch ? <Search className="h-3.5 w-3.5" /> : null}
        {isDate ? <CalendarDays className="h-3.5 w-3.5" /> : null}
        <span>{control.label}</span>
      </span>

      <div className="relative">
        {isSelect ? (
          <>
            <select
              name={control.name}
              defaultValue={control.defaultValue ?? ""}
              className="field-select h-11 rounded-2xl pr-10 text-[13px] font-semibold"
            >
              {control.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </>
        ) : (
          <>
            {isSearch ? (
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            ) : null}

            {isDate ? (
              <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            ) : null}

            <input
              name={control.name}
              type={isSearch ? "search" : "date"}
              placeholder={control.placeholder}
              defaultValue={control.defaultValue}
              className="field-control h-11 rounded-2xl text-[13px] font-semibold placeholder:text-slate-400"
              style={{
                paddingLeft: isSearch || isDate ? "2.75rem" : undefined,
              }}
            />
          </>
        )}
      </div>
    </label>
  );
}
