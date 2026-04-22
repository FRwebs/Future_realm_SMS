interface TrendCardProps {
  title: string;
  description: string;
  items: Array<{ label: string; value: number; suffix?: string }>;
}

export function TrendCard({ title, description, items }: TrendCardProps) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(235,244,238,0.85),rgba(255,255,255,0.98),rgba(246,250,247,0.9))] p-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary-700">
          Insights
        </div>

        <h3 className="mt-3 text-[20px] font-bold text-slate-900">
          {title}
        </h3>

        <p className="mt-2 max-w-md text-[13px] leading-6 text-slate-600">
          {description}
        </p>
      </div>

      <div className="p-6">
        <div className="grid gap-5">
          {items.map((item) => {
            const percentage = (item.value / max) * 100;

            return (
              <div
                key={item.label}
                className="group rounded-xl px-2 py-2 transition hover:bg-slate-50"
              >
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-medium text-slate-600 transition group-hover:text-slate-900">
                    {item.label}
                  </span>

                  <span className="font-semibold text-slate-900">
                    {item.value}
                    {item.suffix ?? ""}
                  </span>
                </div>

                <div className="relative mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="relative h-3 rounded-full bg-gradient-to-r from-primary-600 via-primary-500 to-teal-400 transition-all duration-500 ease-out"
                    style={{ width: `${percentage}%` }}
                  />

                  <div
                    className="absolute left-0 top-0 h-full w-full bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.45),transparent)] opacity-20"
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                <div className="mt-1 text-[11px] text-slate-400">
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
