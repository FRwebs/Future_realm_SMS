const toneColour: Record<string, string> = {
  good: "var(--color-success)",
  warn: "var(--color-warning)",
  bad: "var(--color-danger)",
  teal: "var(--color-accent-primary)",
  mute: "var(--color-text-muted)"
};

export type BarItem = { label: string; value: string; pct: number; tone: "good" | "warn" | "bad" | "teal" | "mute"; note?: string };

/** The mockup's bar card: a title, a line of context, and one labelled bar per row. A bar past 100% is drawn full and flagged by its note. */
export function BarList({ title, sub, items, empty }: { title: string; sub?: string; items: BarItem[]; empty?: string }) {
  return (
    <section className="surface-card p-6">
      <p className="text-[12.5px] font-bold text-[var(--color-text-primary)]">{title}</p>
      {sub ? <p className="mt-1.5 max-w-2xl text-[10.5px] leading-relaxed text-[var(--color-text-muted)]">{sub}</p> : null}
      <div className="mt-4 grid gap-3.5">
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11.5px] font-semibold text-[var(--color-text-primary)]">{item.label}</span>
              <span className="font-[var(--font-mono)] text-[11.5px] font-bold text-[var(--color-text-primary)]">{item.value}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
              <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, item.pct))}%`, background: toneColour[item.tone] }} />
            </div>
            {item.note ? <p className="mt-1 text-[10px]" style={{ color: toneColour[item.tone] }}>{item.note}</p> : null}
          </div>
        ))}
        {items.length === 0 ? <p className="text-[11.5px] text-[var(--color-text-muted)]">{empty ?? "Nothing to show yet."}</p> : null}
      </div>
    </section>
  );
}
