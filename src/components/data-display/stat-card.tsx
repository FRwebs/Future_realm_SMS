import type { LucideIcon } from "lucide-react";

type StatTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "dark";

interface StatCardProps {
  label: string;
  value: string | number;
  detail?: string;
  tone?: StatTone;
  icon?: LucideIcon;
}

const toneStyles: Record<Exclude<StatTone, "dark">, { badge: string }> = {
  neutral: { badge: "bg-(--color-bg-subtle) text-(--color-text-muted)" },
  accent: { badge: "bg-(--color-accent-primary-dim) text-(--color-accent-primary)" },
  success: { badge: "bg-(--color-success-dim) text-(--color-success)" },
  warning: { badge: "bg-(--color-warning-dim) text-(--color-warning)" },
  danger: { badge: "bg-(--color-danger-dim) text-danger" },
  info: { badge: "bg-(--color-info-dim) text-(--color-info)" },
};

// Every mockup KPI row opens with one dark, ink-themed card ahead of the plain
// white ones (see kpi() in the source template) — this variant matches that exactly.
export function StatCard({ label, value, detail, tone = "neutral", icon: Icon }: StatCardProps) {
  if (tone === "dark") {
    return (
      <article className="relative min-w-0 overflow-hidden rounded-[14px] border border-[#0d2315] bg-[#0d2315] px-[16px] pb-[15.5px] pt-[14.5px]">
        <div className="mb-[11px] flex items-start justify-between gap-2.5">
          <p className="min-w-0 text-[9.5px] font-semibold uppercase leading-[1.35] tracking-wider text-white/62" title={label}>{label}</p>
          {Icon ? (
            <div className="flex h-[23.5px] w-[23.5px] shrink-0 items-center justify-center rounded-[9px] bg-[rgba(255,255,255,0.13)]">
              <Icon className="h-3.5 w-3.5 text-[#5FD6B4]" />
            </div>
          ) : null}
        </div>
        <p className="text-pretty font-(--font-body) text-[20.5px] font-extrabold leading-none tracking-[-0.03em] text-white tabular-nums">{value}</p>
        {detail ? <p className="mt-[6.5px] text-[10.5px] leading-[1.4] text-white/62" title={detail}>{detail}</p> : null}
      </article>
    );
  }

  const style = toneStyles[tone];

  return (
    <article className="surface-card relative min-w-0 overflow-hidden px-[16px] pb-[15.5px] pt-[14.5px]">
      <div className="mb-[11px] flex items-start justify-between gap-2.5">
        <p className="min-w-0 text-[9.5px] font-semibold uppercase leading-[1.35] tracking-wider text-[#5f6e65]" title={label}>{label}</p>
        {Icon ? (
          <div className={`flex h-[23.5px] w-[23.5px] shrink-0 items-center justify-center rounded-[9px] ${style.badge}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        ) : null}
      </div>
      <p className="text-pretty font-(--font-body) text-[20.5px] font-extrabold leading-none tracking-[-0.03em] text-(--color-text-primary) tabular-nums">{value}</p>
      {detail ? <p className="mt-[6.5px] text-[10.5px] leading-[1.4] text-[#5f6e65]" title={detail}>{detail}</p> : null}
    </article>
  );
}
