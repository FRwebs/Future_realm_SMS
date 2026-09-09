"use client";

import { type ReactNode, useState } from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export type CaseSignalTone = "good" | "warn" | "bad";

export interface CaseFact {
  label: string;
  value: string;
}

export interface CaseSignal {
  text: string;
  tone: CaseSignalTone;
}

export interface CaseEvidenceItem {
  name: string;
  who: string;
}

export interface CaseCheckItem {
  label: string;
  done: boolean;
  who?: string;
}

export interface CaseHistoryItem {
  what: string;
  when: string;
}

export interface CaseRecord {
  id: string;
  subject: string;
  meta: string;
  type: string;
  initials: string;
  assignee: string;
  age: string;
  sla?: string;
  slaTone?: CaseSignalTone | "neutral";
  facts: CaseFact[];
  signals: CaseSignal[];
  evidence: CaseEvidenceItem[];
  checks: CaseCheckItem[];
  history: CaseHistoryItem[];
  /** Pre-built decision action elements (e.g. ResourceActionDialog), most important first. */
  decisions: ReactNode;
  /** Lean variant only — link behind the "School record" button. */
  recordHref?: string;
  /** Lean variant only — link behind the "History" button. */
  historyHref?: string;
}

export interface CaseTypeFilter {
  label: string;
  value: string;
  count: number;
}

function toneDot(tone: CaseSignalTone | "neutral") {
  if (tone === "bad") return "bg-[var(--color-danger)]";
  if (tone === "warn") return "bg-[var(--color-warning)]";
  if (tone === "good") return "bg-[var(--color-success)]";
  return "bg-[var(--color-text-muted)]";
}

function slaStyle(tone?: CaseSignalTone | "neutral") {
  if (tone === "bad") return "text-[var(--color-danger)] font-semibold";
  if (tone === "warn") return "text-[var(--color-warning)] font-semibold";
  if (tone === "good") return "text-[var(--color-success)] font-semibold";
  return "text-[var(--color-text-muted)]";
}

function signalToneStyle(tone: CaseSignalTone) {
  if (tone === "bad") return { background: "#FDF3F3", color: "#B23B3B" };
  if (tone === "warn") return { background: "#FDF6E7", color: "#8A6410" };
  return { background: "#EAF6F0", color: "#17714F" };
}

export function CaseReviewBoard({
  types,
  cases,
  emptyState,
  footerNote,
  searchPlaceholder,
  variant = "rich",
}: {
  types: CaseTypeFilter[];
  cases: CaseRecord[];
  emptyState: string;
  footerNote?: string;
  /** Shows a search box above the queue, filtering by subject/meta/type/assignee, when given. */
  searchPlaceholder?: string;
  /**
   * "lean" matches the mockup's simpler Schools case layout (header + a 4-fact
   * strip + signals + checks/decisions split — no facts grid, evidence or inline
   * history). "rich" (default) is the fuller layout used by Users/Features/Partners.
   */
  variant?: "rich" | "lean";
}) {
  const [activeType, setActiveType] = useState<string>(types[0]?.value ?? "all");
  const [query, setQuery] = useState("");
  const byType = activeType === "all" ? cases : cases.filter((item) => item.type === activeType);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? byType.filter((item) => `${item.subject} ${item.meta} ${item.type} ${item.assignee}`.toLowerCase().includes(q))
    : byType;
  const [selectedId, setSelectedId] = useState<string | null>(filtered[0]?.id ?? null);
  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;

  function selectType(value: string) {
    setActiveType(value);
    const next = (value === "all" ? cases : cases.filter((item) => item.type === value))[0]?.id ?? null;
    setSelectedId(next);
  }

  if (cases.length === 0) {
    return (
      <div className="surface-card p-8 text-center text-[13px] text-[var(--color-text-secondary)]">{emptyState}</div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {types.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => selectType(filter.value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12.5px] font-semibold transition",
              activeType === filter.value
                ? "border-[var(--color-text-primary)] bg-[var(--color-text-primary)] text-white"
                : "border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]",
            )}
          >
            {filter.label}
            <span
              className={cn(
                "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10.5px] font-bold",
                activeType === filter.value ? "bg-white/20 text-white" : "bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]",
              )}
            >
              {filter.count}
            </span>
          </button>
        ))}
        {searchPlaceholder ? (
          <div className="ml-auto flex min-w-[220px] items-center gap-2 rounded-[9px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="min-w-0 flex-1 border-none bg-transparent text-[12.5px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} className="flex shrink-0 items-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" aria-label="Clear search">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {searchPlaceholder ? (
        <p className="-mt-2 text-[11.5px] text-[var(--color-text-muted)]">
          {filtered.length} case{filtered.length === 1 ? "" : "s"}
          {q ? ` matching "${query}"` : ""} · {types.find((t) => t.value === activeType)?.label.toLowerCase()}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
        <div className="grid grid-cols-[2.1fr_1.1fr_0.9fr_0.9fr_1fr_0.6fr] gap-3 border-b border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--color-text-muted)]">
          <div>Subject</div>
          <div>Type</div>
          <div>Signals</div>
          <div>Time left</div>
          <div>Assignee</div>
          <div className="text-right">Age</div>
        </div>
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12.5px] text-[var(--color-text-secondary)]">Nothing in this queue matches &ldquo;{query}&rdquo;.</div>
        ) : null}
        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelectedId(item.id)}
            className={cn(
              "grid w-full grid-cols-[2.1fr_1.1fr_0.9fr_0.9fr_1fr_0.6fr] items-center gap-3 border-b border-[var(--color-border-default)] px-4 py-2.5 text-left text-[12.5px] transition last:border-b-0",
              selected?.id === item.id ? "bg-[var(--color-accent-primary-dim)]" : "hover:bg-[var(--color-bg-subtle)]",
            )}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", toneDot(item.slaTone ?? "neutral"))} />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-[var(--color-text-primary)]">{item.subject}</span>
                <span className="block truncate text-[11px] text-[var(--color-text-muted)]">{item.meta}</span>
              </span>
            </div>
            <div>
              <span className="rounded-full bg-[var(--color-bg-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                {item.type}
              </span>
            </div>
            <div className="text-[var(--color-text-secondary)]">{item.signals.length}</div>
            <div className={slaStyle(item.slaTone)}>{item.sla ?? "—"}</div>
            <div className="truncate text-[var(--color-text-secondary)]">{item.assignee}</div>
            <div className="text-right text-[var(--color-text-muted)]">{item.age}</div>
          </button>
        ))}
        {footerNote ? (
          <div className="bg-[var(--color-bg-subtle)] px-4 py-2.5 text-[11px] text-[var(--color-text-muted)]">{footerNote}</div>
        ) : null}
      </div>

      {selected && variant === "lean" ? <LeanDetailPanel selected={selected} /> : null}

      {selected && variant === "rich" ? (
        <div className="overflow-hidden rounded-[16px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-accent-primary-dim)] text-[13px] font-black text-[var(--color-text-accent)]">
                {selected.initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">
                  {selected.subject}
                </span>
                <span className="block truncate text-[11.5px] text-[var(--color-text-muted)]">{selected.meta}</span>
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="rounded-full bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                {selected.type}
              </span>
              <span className={cn("text-[12px]", slaStyle(selected.slaTone))}>{selected.sla}</span>
              <span className="h-5 w-px bg-[var(--color-border-default)]" />
              <span className="text-[12px] text-[var(--color-text-secondary)]">{selected.assignee}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1.55fr_1fr]">
            <div className="min-w-0 border-b border-[var(--color-border-default)] p-5 md:border-b-0 md:border-r">
              <SectionLabel label="Subject" hint="deep-linked" />
              <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {selected.facts.map((fact) => (
                  <div key={fact.label} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-2.5">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">{fact.label}</p>
                    <p className="mt-1 text-[12.5px] font-semibold text-[var(--color-text-primary)]">{fact.value}</p>
                  </div>
                ))}
              </div>

              <SectionLabel label="Signals" hint="machine-generated" />
              <div className="mb-5 grid gap-2">
                {selected.signals.length ? (
                  selected.signals.map((signal, index) => (
                    <div key={index} className="flex items-start gap-2.5 rounded-[10px] bg-[var(--color-bg-subtle)] p-2.5">
                      <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", toneDot(signal.tone))} />
                      <span className="text-[12.5px] leading-relaxed text-[var(--color-text-primary)]">{signal.text}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-[12px] text-[var(--color-text-muted)]">No automated signals for this case.</p>
                )}
              </div>

              <SectionLabel label="Evidence" hint="gathered, with attachments" />
              <div className="overflow-hidden rounded-[11px] border border-[var(--color-border-default)]">
                {selected.evidence.length ? (
                  selected.evidence.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 border-b border-[var(--color-border-default)] px-3 py-2.5 text-[12.5px] last:border-b-0"
                    >
                      <span className="min-w-0 flex-1 truncate text-[var(--color-text-primary)]">{item.name}</span>
                      <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">{item.who}</span>
                    </div>
                  ))
                ) : (
                  <p className="px-3 py-3 text-[12px] text-[var(--color-text-muted)]">No evidence attached yet.</p>
                )}
              </div>
            </div>

            <div className="min-w-0 bg-[var(--color-bg-subtle)]/40 p-5">
              <SectionLabel label="Checks" hint="verified by a human" />
              <div className="mb-5 grid gap-2.5">
                {selected.checks.length ? (
                  selected.checks.map((check, index) => (
                    <div key={index} className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border",
                          check.done
                            ? "border-[var(--color-success)] bg-[var(--color-success)]"
                            : "border-[var(--color-border-strong)] bg-transparent",
                        )}
                      >
                        {check.done ? <span className="block h-1.5 w-1.5 rounded-full bg-white" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className={cn("block text-[12.5px] font-medium", check.done ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]")}>
                          {check.label}
                        </span>
                        {check.who ? <span className="block text-[11px] text-[var(--color-text-muted)]">{check.who}</span> : null}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-[12px] text-[var(--color-text-muted)]">No checklist for this case.</p>
                )}
              </div>

              <SectionLabel label="History" hint="every prior action" />
              <div className="mb-5 grid gap-2">
                {selected.history.length ? (
                  selected.history.map((item, index) => (
                    <div key={index} className="flex items-baseline gap-2.5">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-border-strong)]" />
                      <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--color-text-secondary)]">{item.what}</span>
                      <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">{item.when}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-[12px] text-[var(--color-text-muted)]">No prior actions recorded.</p>
                )}
              </div>

              <SectionLabel label="Decision" hint="each requires a reason" />
              <div className="grid gap-2.5">{selected.decisions}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LeanDetailPanel({ selected }: { selected: CaseRecord }) {
  const strip = selected.facts.slice(0, 4);
  const confirmedCount = selected.checks.filter((check) => check.done).length;

  return (
    <div className="overflow-hidden rounded-[16px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border-default)] bg-[#FBFDFC] px-5 py-[18px]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px] bg-[#F0F5F2] text-[13px] font-extrabold text-[#0D2315]">
            {selected.initials}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-[var(--font-heading)] text-[17px] font-extrabold tracking-[-0.015em] text-[#0D2315]">{selected.subject}</span>
            <span className="mt-0.5 block truncate text-[11.5px] text-[#8C9A92]">{selected.meta}</span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className={cn("text-[12.5px]", slaStyle(selected.slaTone))}>{selected.sla}</span>
          {selected.recordHref ? (
            <a href={selected.recordHref} className="whitespace-nowrap rounded-[9px] border border-[#DEE8E2] bg-white px-3 py-2 text-[12px] font-semibold text-[#435048] hover:bg-[var(--color-bg-subtle)]">
              School record
            </a>
          ) : null}
          {selected.historyHref ? (
            <a href={selected.historyHref} className="whitespace-nowrap rounded-[9px] border border-[#DEE8E2] bg-white px-3 py-2 text-[12px] font-semibold text-[#435048] hover:bg-[var(--color-bg-subtle)]">
              History
            </a>
          ) : null}
        </div>
      </div>

      {strip.length > 0 ? (
        <div className="grid grid-cols-2 border-b border-[var(--color-border-default)] sm:grid-cols-4">
          {strip.map((fact, index) => (
            <div key={fact.label} className={cn("min-w-0 px-[18px] py-[13px]", index < strip.length - 1 ? "border-r border-[#F2F7F4]" : "")}>
              <p className="mb-[5px] text-[10px] font-bold uppercase tracking-[0.06em] text-[#8C9A92]">{fact.label}</p>
              <p className="text-pretty text-[12.5px] font-semibold text-[#0D2315]">{fact.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="border-b border-[var(--color-border-default)] px-5 py-[18px]">
        <p className="mb-1 text-[13px] font-semibold text-[#0D2315]">Why the system flagged this</p>
        <p className="mb-3 text-[11.5px] text-[#8C9A92]">Machine-generated. Nothing here is a conclusion — it is what a human is being asked to judge.</p>
        <div className="flex flex-col gap-2">
          {selected.signals.length ? (
            selected.signals.map((signal, index) => {
              const tone = signalToneStyle(signal.tone);
              return (
                <div key={index} className="flex items-start gap-2.5 rounded-[10px] px-3 py-2.5" style={{ background: tone.background }}>
                  <span className={cn("mt-[5px] h-2 w-2 shrink-0 rounded-full", toneDot(signal.tone))} />
                  <span className="min-w-0 text-pretty text-[12.5px] leading-relaxed" style={{ color: tone.color }}>{signal.text}</span>
                </div>
              );
            })
          ) : (
            <p className="text-[12px] text-[var(--color-text-muted)]">No automated signals for this case.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="border-b border-[var(--color-border-default)] px-5 py-[18px] md:border-b-0 md:border-r">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-[#0D2315]">Confirm before you decide</p>
              <p className="mt-[3px] text-[11.5px] text-[#8C9A92]">Each box is a person&rsquo;s word, not the system&rsquo;s.</p>
            </div>
            {selected.checks.length ? (
              <span className="whitespace-nowrap text-[11.5px] font-semibold text-[#12796A]">{confirmedCount} of {selected.checks.length} confirmed</span>
            ) : null}
          </div>
          <div className="flex flex-col gap-[11px]">
            {selected.checks.length ? (
              selected.checks.map((check, index) => (
                <div key={index} className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-0.5 flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border",
                      check.done ? "border-[var(--color-success)] bg-[var(--color-success)]" : "border-[#D5E0DA] bg-white",
                    )}
                  >
                    {check.done ? <span className="block h-1.5 w-1.5 rounded-full bg-white" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-[12.5px] font-medium", check.done ? "text-[#0D2315]" : "text-[var(--color-text-secondary)]")}>{check.label}</span>
                    <span className="block text-[11px] text-[#9FB8A7]">{check.who ? `Verified by ${check.who}` : "Not yet verified"}</span>
                  </span>
                </div>
              ))
            ) : (
              <p className="text-[12px] text-[var(--color-text-muted)]">No checklist for this case.</p>
            )}
          </div>
        </div>
        <div className="bg-[#FDFEFD] px-5 py-[18px]">
          <p className="text-[13px] font-semibold text-[#0D2315]">Your decision</p>
          <p className="mb-3 mt-[3px] text-[11.5px] text-[#8C9A92]">Each one asks for a reason, and is written to the audit log under your name.</p>
          <div className="flex flex-col gap-[11px]">{selected.decisions}</div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{label}</span>
      <span className="h-px flex-1 bg-[var(--color-border-default)]" />
      <span className="whitespace-nowrap text-[10.5px] text-[var(--color-text-muted)]">{hint}</span>
    </div>
  );
}
