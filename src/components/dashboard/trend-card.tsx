interface TrendCardProps {
  title: string;
  description: string;
  items: Array<{ label: string; value: number; suffix?: string }>;
}

export function TrendCard({ title, description, items }: TrendCardProps) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-[var(--color-border-default)] bg-[radial-gradient(circle_at_top_left,var(--color-accent-primary-dim),transparent_48%),linear-gradient(180deg,color-mix(in_srgb,var(--color-bg-surface)_96%,transparent),color-mix(in_srgb,var(--color-bg-elevated)_88%,transparent))] p-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-accent)]">
          Insights
        </div>

        <h3 className="mt-3 text-[20px] font-bold text-[var(--color-text-primary)]">
          {title}
        </h3>

        <p className="mt-2 max-w-md text-[13px] leading-6 text-[var(--color-text-secondary)]">
          {description}
        </p>
      </div>

      <div className="p-6 ">
        <div className="grid gap-5">
          {items.map((item) => {
            const percentage = (item.value / max) * 100;

            return (
              <div
                key={item.label}
                className="group rounded-xl px-2 py-2 transition hover:bg-[var(--color-bg-elevated)]"
              >
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-medium text-[var(--color-text-secondary)] transition group-hover:text-[var(--color-text-primary)]">
                    {item.label}
                  </span>

                  <span className="font-semibold text-[var(--color-text-primary)]">
                    {item.value}
                    {item.suffix ?? ""}
                  </span>
                </div>

                <div className="relative mt-2 h-3 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                  <div
                    className="relative h-3 rounded-full bg-gradient-to-r from-primary-600 via-primary-500 to-[#4fa895] transition-all duration-500 ease-out"
                    style={{ width: `${percentage}%` }}
                  />

                  <div
                    className="absolute left-0 top-0 h-full w-full bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.45),transparent)] opacity-20"
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                  {percentage.toFixed(0)}% of max
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
