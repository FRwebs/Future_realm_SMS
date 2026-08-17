import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { DashboardMetric } from "@/lib/domain/types";

export function MetricCard({ metric }: { metric: DashboardMetric }) {
  const isPositive =
    typeof metric.change === "string" &&
    metric.change.trim().startsWith("+");
  const isNegative =
    typeof metric.change === "string" &&
    metric.change.trim().startsWith("-");
  const Icon = isPositive ? ArrowUpRight : isNegative ? ArrowDownRight : Minus;

  return (
    <article className="group surface-card relative overflow-hidden p-5 transition-all duration-200 hover:border-[var(--color-border-strong)] hover:shadow-md">
      <div
        className={`absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-2xl ${
          isNegative
            ? "bg-[var(--color-danger-dim)] text-[var(--color-danger)]"
            : "bg-[var(--color-accent-primary-dim)] text-[var(--color-accent-primary)]"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-text-secondary)]">
        {metric.label}
      </p>

      <p className="mt-4 text-[28px] font-extrabold leading-none tracking-tight text-[var(--color-text-primary)]">
        {metric.value}
      </p>

      {metric.change ? (
        <div className="mt-4 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              isPositive
                ? "bg-[var(--color-success-dim)] text-[var(--color-success)]"
                : isNegative
                  ? "bg-[var(--color-danger-dim)] text-[var(--color-danger)]"
                  : "bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {metric.change}
          </span>

          <span className="text-[12px] text-[var(--color-text-secondary)]">vs last period</span>
        </div>
      ) : null}
    </article>
  );
}
