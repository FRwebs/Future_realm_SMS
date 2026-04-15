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
  action: Route;
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
    <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/90 shadow-panel backdrop-blur">
      <div className="border-b border-ink/5 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),rgba(255,255,255,0.92),rgba(250,245,235,0.95))] px-5 py-5 md:px-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-brand-700 shadow-sm">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Smart filters</span>
            </div>

            <h2 className="mt-3 font-[var(--font-heading)] text-2xl font-bold tracking-tight text-ink md:text-[1.9rem]">
              {title}
            </h2>

            {description ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/62">
                {description}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {typeof resultCount === "number" ? (
                <div className="inline-flex items-center rounded-full border border-ink/8 bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-sm">
                  Showing {resultCount.toLocaleString()} result
                  {resultCount === 1 ? "" : "s"}
                </div>
              ) : null}

              {activeSummary.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {activeSummary.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800 shadow-sm"
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
                className="inline-flex h-11 items-center gap-2 rounded-full border border-ink/10 bg-white px-4 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/15 hover:bg-sand/60"
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
              href={action}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-ink/10 bg-white px-4 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/15 hover:bg-sand/60"
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
            <div className="rounded-[1.5rem] border border-ink/6 bg-sand/35 p-4 md:p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-ink shadow-sm ring-1 ring-ink/5">
                  <Filter className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">
                    Advanced filters
                  </p>
                  <p className="text-xs text-ink/50">
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

          <div className="flex flex-col gap-3 border-t border-ink/5 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink/55">
              Refine records by search, date, and status to find the exact data
              you need.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={action}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-ink/10 bg-white px-5 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/15 hover:bg-sand/60"
              >
                <X className="h-4 w-4" />
                <span>Reset</span>
              </Link>

              <button
                type="submit"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)] transition hover:bg-brand-800 active:scale-[0.99]"
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
      <span className="mb-2 inline-flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-ink/45">
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
              className="h-12 w-full appearance-none rounded-2xl border border-ink/10 bg-white px-4 pr-10 text-sm font-semibold text-ink shadow-sm outline-none transition duration-200 hover:border-ink/15 focus:border-brand-500 focus:ring-4 focus:ring-brand-100/70"
            >
              {control.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
          </>
        ) : (
          <>
            {isSearch ? (
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
            ) : null}

            {isDate ? (
              <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
            ) : null}

            <input
              name={control.name}
              type={isSearch ? "search" : "date"}
              placeholder={control.placeholder}
              defaultValue={control.defaultValue}
              className="h-12 w-full rounded-2xl border border-ink/10 bg-white px-4 text-sm font-semibold text-ink shadow-sm outline-none transition duration-200 placeholder:text-ink/35 hover:border-ink/15 focus:border-brand-500 focus:ring-4 focus:ring-brand-100/70"
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