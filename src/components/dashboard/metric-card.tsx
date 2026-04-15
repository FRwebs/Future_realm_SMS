import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { DashboardMetric } from "@/lib/domain/types";

export function MetricCard({ metric }: { metric: DashboardMetric }) {
  const isPositive =
    typeof metric.change === "string" &&
    metric.change.trim().startsWith("+");

  return (
    <article className="group relative overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/90 p-5 shadow-panel backdrop-blur transition-all duration-300 hover:shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
      
      {/* Subtle glow */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute -top-10 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-brand-400/20 blur-3xl" />
      </div>

      {/* Header */}
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-ink/45">
        {metric.label}
      </p>

      {/* Value */}
      <p className="mt-4 font-[var(--font-heading)] text-3xl font-extrabold tracking-tight text-ink">
        {metric.value}
      </p>

      {/* Change */}
      {metric.change ? (
        <div className="mt-4 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
              isPositive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            {isPositive ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {metric.change}
          </span>

          <span className="text-xs text-ink/40">vs last period</span>
        </div>
      ) : null}
    </article>
  );
}