"use client";

import { Search, X, ChevronDown } from "lucide-react";

export interface TableFilterOption {
  label: string;
  value: string;
}

export interface TableFilterPill {
  label: string;
  value: string;
  /** Present + options => a real, working `<select>`. Absent => an honest, non-interactive pill showing a fixed value. */
  options?: TableFilterOption[];
  onChange?: (value: string) => void;
}

interface TableFilterBarProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
  };
  filters?: TableFilterPill[];
  note?: string;
}

/**
 * Matches the mockup's table-panel filter toolbar exactly: search box + filter
 * pills + a right-aligned note. A pill with `options`/`onChange` is a real
 * native select; one without is an honest static label (no fake interactivity).
 */
export function TableFilterBar({ search, filters, note }: TableFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-[7px] border-b border-[#EDF3EF] bg-[#FCFDFC] px-[18px] py-[12.5px]">
      {search ? (
        <div className="flex min-w-[236px] items-center gap-2 rounded-[9px] border border-[#DEE8E2] bg-white px-[11px] py-[7px]">
          <Search className="h-3.5 w-3.5 shrink-0 text-[#5E6D64]" />
          <input
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder}
            className="min-w-0 flex-1 border-none bg-transparent text-[11.5px] text-[#0D2315] outline-hidden placeholder:text-[#7a8f82]"
          />
          {search.value ? (
            <button
              type="button"
              onClick={() => search.onChange("")}
              className="flex shrink-0 items-center text-[#5E6D64] hover:text-[#0D2315]"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}

      {(filters ?? []).map((filter) =>
        filter.options && filter.onChange ? (
          <label
            key={filter.label}
            className="relative flex items-center gap-[6.5px] rounded-[9px] border border-[#DEE8E2] bg-white px-[10px] py-[7px] text-[11px] text-[#0D2315]"
          >
            <span className="text-[#5f6e65]">{filter.label}</span>
            <select
              value={filter.value}
              onChange={(event) => filter.onChange?.(event.target.value)}
              className="appearance-none bg-transparent pr-4 font-semibold text-[#0D2315] outline-hidden"
            >
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 h-3 w-3 text-[#5E6D64]" />
          </label>
        ) : (
          <div
            key={filter.label}
            className="flex items-center gap-[6.5px] rounded-[9px] border border-[#DEE8E2] bg-white px-[10px] py-[7px] text-[11px] text-[#0D2315]"
          >
            <span className="text-[#5f6e65]">{filter.label}</span>
            <span className="font-semibold">{filter.value}</span>
          </div>
        )
      )}

      {note ? <div className="ml-auto text-[10.5px] text-[#5f6e65]">{note}</div> : null}
    </div>
  );
}
