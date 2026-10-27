"use client";

import { useId, useMemo, useRef, useState } from "react";
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
  const listId = useId();
  /** Which row the arrow keys are on; -1 is the typed text itself. */
  const [active, setActive] = useState(-1);

  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();
  const filtered = useMemo(() => {
    if (!open || !lower) return options;
    return options.filter((option) => option.toLowerCase().includes(lower));
  }, [options, open, lower]);
  const exactHit = options.find((option) => option.toLowerCase() === lower);
  const shown = filtered.slice(0, 260);
  const offerTyped = Boolean(trimmed && !exactHit);
  const rows = offerTyped ? [trimmed, ...shown] : shown;
  const optionId = (index: number) => `${listId}-option-${index}`;

  function commit(next: string) {
    committingRef.current = true;
    onChange(next);
    setOpen(false);
    setQuery("");
    setActive(-1);
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
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
          onChange={(e) => {
            setOpen(true);
            setQuery(e.target.value);
            setActive(-1);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              setActive((current) => {
                const step = e.key === "ArrowDown" ? 1 : -1;
                return rows.length ? (current + step + rows.length) % rows.length : -1;
              });
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (open && active >= 0 && rows[active] !== undefined) commit(rows[active]!);
              else if (trimmed) commit(exactHit || trimmed);
            } else if (e.key === "Escape") {
              setOpen(false);
              setQuery("");
            }
          }}
          placeholder={value || placeholder}
          className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-[#0d2315] outline-hidden placeholder:text-[#5f6e65]"
        />
        <ChevronDown className="h-[13px] w-[13px] shrink-0 text-[#9fb8a7]" />
      </div>
      {open ? (
        <div id={listId} role="listbox" className="absolute left-0 right-0 top-[calc(100%+5px)] z-40 max-h-[234px] overflow-y-auto rounded-xl border-[1.5px] border-[#dee8e2] bg-white p-[5px] shadow-[0_18px_38px_-18px_rgba(13,35,21,0.4)]">
          {rows.map((option, index) => {
            const typed = offerTyped && index === 0;
            const chosen = !typed && value === option;
            return (
              <div
                key={typed ? "typed" : option}
                id={optionId(index)}
                role="option"
                tabIndex={-1}
                aria-selected={chosen}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(option)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); commit(option); } }}
                onMouseEnter={() => setActive(index)}
                className="cursor-pointer rounded-lg px-[10px] py-2 text-[11.5px]"
                style={
                  typed
                    ? { background: "#edf7f1", color: "#17604f", fontWeight: 600, outline: active === index ? "2px solid #12796a" : "none" }
                    : {
                        background: chosen ? "#f2f6f4" : active === index ? "#f7faf8" : "transparent",
                        color: chosen ? "#0d2315" : "#435048",
                        fontWeight: chosen ? 600 : 500,
                      }
                }
              >
                {typed ? <>Use “{trimmed}”</> : option}
              </div>
            );
          })}
          {filtered.length === 0 && !trimmed ? (
            <div className="px-[10px] py-2 text-[11px] leading-normal text-[#5f6e65]">
              {emptyNote || "Type it in full and we will use exactly what you write."}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
