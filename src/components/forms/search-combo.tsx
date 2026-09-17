"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

interface SearchComboProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  emptyNote?: string;
  hasError?: boolean;
}

/**
 * A dropdown you can type into. Dozens of countries and states is a scroll nobody should
 * have to do — a few letters should be enough. And because no list of regions is ever
 * complete, whatever you type IS the answer when nothing in the list matches it: closing
 * the field or pressing Enter commits the typed text, it's never silently dropped.
 */
export function SearchCombo({ value, onChange, options, placeholder, emptyNote, hasError }: SearchComboProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Guards against handleBlur re-committing with its own stale (pre-commit) query text
  // when commit()'s own deliberate blur (see below) triggers that same blur handler.
  const committingRef = useRef(false);

  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();
  const filtered = useMemo(() => {
    if (!open || !lower) return options;
    return options.filter((option) => option.toLowerCase().includes(lower));
  }, [options, open, lower]);
  const exactHit = options.find((option) => option.toLowerCase() === lower);

  function commit(next: string) {
    committingRef.current = true;
    onChange(next);
    setOpen(false);
    setQuery("");
    // Selecting an option deliberately never blurs via the option's own mousedown (see
    // onMouseDown preventDefault below — it avoids a blur-then-click race), so the input
    // is still focused after this. Blur it explicitly so the *next* click is a fresh
    // focus event — otherwise the browser won't refire onFocus on an already-focused
    // input, its reset-to-empty-query never runs, and typing appends onto the committed
    // value instead of replacing it. That forced blur re-enters handleBlur below with its
    // own (now-stale) closure over the pre-commit query — committingRef tells it to skip.
    inputRef.current?.blur();
    window.setTimeout(() => {
      committingRef.current = false;
    }, 0);
  }

  function handleBlur() {
    if (committingRef.current) return;
    window.setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        if (trimmed) commit(exactHit || trimmed);
        else setOpen(false);
      }
    }, 120);
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex items-center gap-2 rounded-[10px] border-[1.5px] px-[13px] py-[11px] transition"
        style={{
          borderColor: hasError ? "#e0a3a3" : open ? "#12796a" : "#dee8e2",
          background: hasError ? "#fdf7f7" : "#fff",
          boxShadow: open ? "0 0 0 2.5px rgba(18,121,106,0.14)" : "none"
        }}
      >
        <Search className="h-[13.5px] w-[13.5px] shrink-0 text-[#9fb8a7]" />
        <input
          ref={inputRef}
          value={open ? query : value}
          onChange={(e) => {
            setOpen(true);
            setQuery(e.target.value);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (trimmed) commit(exactHit || trimmed);
            } else if (e.key === "Escape") {
              setOpen(false);
              setQuery("");
            }
          }}
          placeholder={value || placeholder}
          className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-[#0d2315] outline-none placeholder:text-[#8c9a92]"
        />
        <ChevronDown className="h-[13px] w-[13px] shrink-0 text-[#9fb8a7]" />
      </div>
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+5px)] z-40 max-h-[234px] overflow-y-auto rounded-xl border-[1.5px] border-[#dee8e2] bg-white p-[5px] shadow-[0_18px_38px_-18px_rgba(13,35,21,0.4)]">
          {trimmed && !exactHit ? (
            <div
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(trimmed)}
              className="cursor-pointer rounded-lg px-[10px] py-2 text-[11.5px] font-semibold"
              style={{ background: "#edf7f1", color: "#17604f" }}
            >
              Use “{trimmed}”
            </div>
          ) : null}
          {filtered.slice(0, 260).map((option) => (
            <div
              key={option}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(option)}
              className="cursor-pointer rounded-lg px-[10px] py-2 text-[11.5px]"
              style={{
                background: value === option ? "#f2f6f4" : "transparent",
                color: value === option ? "#0d2315" : "#435048",
                fontWeight: value === option ? 600 : 500
              }}
            >
              {option}
            </div>
          ))}
          {filtered.length === 0 && !trimmed ? (
            <div className="px-[10px] py-2 text-[11px] leading-[1.5] text-[#8c9a92]">
              {emptyNote || "Type it in full and we will use exactly what you write."}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
