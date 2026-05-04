import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export function SupportPortalPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className="surface-hero relative overflow-hidden p-6 md:p-8">
      <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_top_right,var(--color-accent-primary-dim),transparent_70%)]" />
      <div className="absolute left-6 top-6 h-20 w-20 rounded-full bg-[var(--color-gold-dim)] blur-2xl" />
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-4xl">
          <p className="section-eyebrow">{eyebrow}</p>
          <h1 className="mt-3 font-[var(--font-display)] text-[36px] font-black tracking-tight text-[var(--color-text-primary)] md:text-[44px]">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--color-text-secondary)]">
            {description}
          </p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}

export function SupportMetricCard({
  label,
  value,
  helper,
  tone = "teal",
}: {
  label: string;
  value: string | number;
  helper: string;
  tone?: "teal" | "amber" | "rose" | "slate";
}) {
  const barClass =
    tone === "amber"
      ? "from-[var(--color-warning)] to-[#fbbf24]"
      : tone === "rose"
        ? "from-[var(--color-danger)] to-[#fb7185]"
        : tone === "slate"
          ? "from-slate-500 to-slate-400"
          : "from-[var(--color-accent-primary)] to-[#6ee7d8]";

  return (
    <article className="surface-card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-4 font-[var(--font-display)] text-[30px] font-black tracking-tight text-[var(--color-text-primary)]">
        {value}
      </p>
      <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
        {helper}
      </p>
      <div className={cn("mt-5 h-1 rounded-full bg-gradient-to-r", barClass)} />
    </article>
  );
}

export function SupportInfoCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="surface-card p-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          {title}
        </p>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          {description}
        </p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function SupportBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "warning" | "danger" | "success";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]",
        tone === "success"
          ? "bg-[var(--color-success-dim)] text-[var(--color-success)]"
          : tone === "warning"
            ? "bg-[var(--color-warning-dim)] text-[var(--color-warning)]"
            : tone === "danger"
              ? "bg-[var(--color-danger-dim)] text-[var(--color-danger)]"
              : "bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]",
      )}
    >
      {label}
    </span>
  );
}

export function SupportQuickLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link href={href as Route} className="btn-secondary min-h-[44px] px-4">
      {label}
    </Link>
  );
}

export function SupportCommandLink({
  href,
  title,
  detail,
}: {
  href: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href as Route}
      className="group surface-card flex h-full flex-col justify-between p-5 transition hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)]"
    >
      <div>
        <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">{title}</p>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">{detail}</p>
      </div>
      <span className="mt-5 inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-accent)]">
        Open
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export function SupportEmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state rounded-[1.5rem] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)] p-8">
      <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">{title}</p>
      <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
        {detail}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
