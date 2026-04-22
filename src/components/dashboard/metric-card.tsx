import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { DashboardMetric } from "@/lib/domain/types";

export function MetricCard({ metric }: { metric: DashboardMetric }) {
  const isPositive =
    typeof metric.change === "string" &&
    metric.change.trim().startsWith("+");

  return (
    <article className="group surface-card relative overflow-hidden p-5 transition-all duration-200 hover:border-primary-200 hover:shadow-md">
      <div className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-100 text-primary-600">
        {isPositive ? (
          <ArrowUpRight className="h-4 w-4" />
        ) : (
          <ArrowDownRight className="h-4 w-4" />
        )}
      </div>

      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
        {metric.label}
      </p>

      <p className="mt-4 text-[28px] font-extrabold leading-none tracking-tight text-slate-900">
        {metric.value}
      </p>

      {metric.change ? (
        <div className="mt-4 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              isPositive
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700"
            }`}
          >
            {isPositive ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {metric.change}
          </span>

          <span className="text-[12px] text-slate-400">vs last period</span>
        </div>
      ) : null}
    </article>
  );
}
