const toneStyle: Record<string, { bg: string; fg: string }> = {
  good: { bg: "var(--color-success-dim)", fg: "var(--color-success)" },
  teal: { bg: "var(--color-accent-primary-dim)", fg: "var(--color-text-accent)" },
  warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" },
  bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" },
  mute: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" }
};

export type ReferenceItem = { label: string; detail: string; pill?: string; tone: "good" | "teal" | "warn" | "bad" | "mute" };

/** The mockup's list card: a title, a line of context, and rows of label + detail with an optional coloured pill. */
export function ReferenceList({ title, sub, items }: { title: string; sub?: string; items: ReferenceItem[] }) {
  return (
    <section className="surface-card p-6">
      <p className="text-[12.5px] font-bold text-[var(--color-text-primary)]">{title}</p>
      {sub ? <p className="mt-1.5 max-w-2xl text-[10.5px] leading-relaxed text-[var(--color-text-muted)]">{sub}</p> : null}
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-start justify-between gap-3 rounded-[9px] bg-[var(--color-bg-subtle)] px-4 py-3">
            <div>
              <p className="text-[11.5px] font-semibold text-[var(--color-text-primary)]">{item.label}</p>
              <p className="mt-1 text-[10.5px] leading-snug text-[var(--color-text-secondary)]">{item.detail}</p>
            </div>
            {item.pill ? (
              <span className="shrink-0 rounded-full px-2.5 py-1 text-[9.5px] font-bold" style={{ background: toneStyle[item.tone].bg, color: toneStyle[item.tone].fg }}>{item.pill}</span>
            ) : (
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: toneStyle[item.tone].fg }} />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
