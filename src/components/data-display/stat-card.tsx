import type { LucideIcon } from "lucide-react";

type StatTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

interface StatCardProps {
  label: string;
  value: string | number;
  detail?: string;
  tone?: StatTone;
  icon?: LucideIcon;
}

const toneStyles: Record<StatTone, { value: string; badge: string }> = {
  neutral: {
    value: "text-[var(--color-text-primary)]",
    badge: "bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]",
  },
  accent: {
    value: "text-[var(--color-text-primary)]",
    badge: "bg-[var(--color-accent-primary-dim)] text-[var(--color-accent-primary)]",
  },
  success: {
    value: "text-[var(--color-success)]",
    badge: "bg-[var(--color-success-dim)] text-[var(--color-success)]",
  },
  warning: {
    value: "text-[var(--color-warning)]",
    badge: "bg-[var(--color-warning-dim)] text-[var(--color-warning)]",
  },
  danger: {
    value: "text-[var(--color-danger)]",
    badge: "bg-[var(--color-danger-dim)] text-[var(--color-danger)]",
  },
  info: {
    value: "text-[var(--color-info)]",
    badge: "bg-[var(--color-info-dim)] text-[var(--color-info)]",
  },
};

export function StatCard({ label, value, detail, tone = "neutral", icon: Icon }: StatCardProps) {
  const style = toneStyles[tone];

  return (
    <article className="surface-card group relative min-h-[112px] overflow-hidden p-4 transition-all duration-200 hover:border-[var(--color-border-strong)] hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{label}</p>
          <p className={`mt-3 font-[var(--font-mono)] text-[23px] font-black leading-none ${style.value}`}>{value}</p>
        </div>
        {Icon ? (
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${style.badge}`}>
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
      {detail ? <p className="mt-3 line-clamp-2 text-[11.5px] leading-4 text-[var(--color-text-secondary)]" title={detail}>{detail}</p> : null}
    </article>
  );
}
