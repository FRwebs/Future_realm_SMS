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
  neutral: { badge: "bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]" },
  accent: { badge: "bg-[var(--color-accent-primary-dim)] text-[var(--color-accent-primary)]" },
  success: { badge: "bg-[var(--color-success-dim)] text-[var(--color-success)]" },
  warning: { badge: "bg-[var(--color-warning-dim)] text-[var(--color-warning)]" },
  danger: { badge: "bg-[var(--color-danger-dim)] text-[var(--color-danger)]" },
  info: { badge: "bg-[var(--color-info-dim)] text-[var(--color-info)]" },
};

// Every mockup KPI row opens with one dark, ink-themed card ahead of the plain
// white ones (see kpi() in the source template) — this variant matches that exactly.
export function StatCard({ label, value, detail, tone = "neutral", icon: Icon }: StatCardProps) {
  if (tone === "dark") {
    return (
      <article className="relative min-h-[112px] overflow-hidden rounded-[14px] border border-[#0d2315] bg-[#0d2315] px-[18px] py-4">
        <div className="mb-[11px] flex items-start justify-between gap-2.5">
          <p className="line-clamp-2 min-w-0 text-[10.5px] font-semibold uppercase leading-[1.35] tracking-[0.05em] text-white/[62%]" title={label}>{label}</p>
          {Icon ? (
            <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[9px] bg-[rgba(255,255,255,0.13)]">
              <Icon className="h-3.5 w-3.5 text-[#5FD6B4]" />
            </div>
          ) : null}
        </div>
        <p className="text-pretty font-[var(--font-body)] text-[23px] font-extrabold leading-none tracking-[-0.03em] text-white tabular-nums">{value}</p>
        {detail ? <p className="mt-[7px] line-clamp-2 text-[11.5px] leading-[1.4] text-white/[62%]" title={detail}>{detail}</p> : null}
      </article>
    );
  }

  const style = toneStyles[tone];

  return (
    <article className="surface-card group relative min-h-[112px] overflow-hidden px-[18px] py-4 transition-all duration-200 hover:border-[var(--color-border-strong)] hover:shadow-md">
      <div className="mb-[11px] flex items-start justify-between gap-2.5">
        <p className="line-clamp-2 min-w-0 text-[10.5px] font-semibold uppercase leading-[1.35] tracking-[0.05em] text-[var(--color-text-muted)]" title={label}>{label}</p>
        {Icon ? (
          <div className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[9px] ${style.badge}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        ) : null}
      </div>
      <p className="text-pretty font-[var(--font-body)] text-[23px] font-extrabold leading-none tracking-[-0.03em] text-[var(--color-text-primary)] tabular-nums">{value}</p>
      {detail ? <p className="mt-[7px] line-clamp-2 text-[11.5px] leading-[1.4] text-[#8C9A92]" title={detail}>{detail}</p> : null}
    </article>
  );
}
