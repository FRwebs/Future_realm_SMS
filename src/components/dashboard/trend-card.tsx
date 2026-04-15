interface TrendCardProps {
  title: string;
  description: string;
  items: Array<{ label: string; value: number; suffix?: string }>;
}

export function TrendCard({ title, description, items }: TrendCardProps) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/90 shadow-panel backdrop-blur">
      {/* Header */}
      <div className="border-b border-ink/5 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),rgba(255,255,255,0.92),rgba(250,245,235,0.95))] p-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-brand-700">
          Insights
        </div>

        <h3 className="mt-3 font-[var(--font-heading)] text-2xl font-bold tracking-tight text-ink">
          {title}
        </h3>

        <p className="mt-2 max-w-md text-sm leading-6 text-ink/60">
          {description}
        </p>
      </div>

      {/* Body */}
      <div className="p-6">
        <div className="grid gap-5">
          {items.map((item) => {
            const percentage = (item.value / max) * 100;

            return (
              <div
                key={item.label}
                className="group rounded-xl px-2 py-2 transition hover:bg-sand/40"
              >
                {/* Top row */}
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-ink/70 group-hover:text-ink transition">
                    {item.label}
                  </span>

                  <span className="font-semibold text-ink">
                    {item.value}
                    {item.suffix ?? ""}
                  </span>
                </div>

                {/* Bar */}
                <div className="mt-2 relative h-3 rounded-full bg-sand/90 overflow-hidden">
                  {/* Glow background */}
                  <div className="absolute inset-0 opacity-30 blur-sm bg-brand-400/20" />

                  {/* Progress */}
                  <div
                    className="relative h-3 rounded-full bg-gradient-to-r from-brand-600 via-brand-500 to-amber-400 shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition-all duration-500 ease-out"
                    style={{ width: `${percentage}%` }}
                  />

                  {/* Shine overlay */}
                  <div
                    className="absolute top-0 left-0 h-full w-full opacity-20 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.5),transparent)]"
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                {/* Optional percentage */}
                <div className="mt-1 text-[0.7rem] text-ink/40">
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