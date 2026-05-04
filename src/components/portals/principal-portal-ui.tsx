import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export function PrincipalPageHeader({
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
    <section className="surface-hero relative p-6 md:p-8">
      <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-[var(--color-accent-primary-dim)] blur-3xl" />
      <div className="absolute left-16 top-10 h-24 w-24 rounded-full bg-[var(--color-gold-dim)] blur-2xl" />
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-4xl">
          <p className="section-eyebrow">{eyebrow}</p>
          <h1 className="mt-3 font-[var(--font-display)] text-[38px] font-black tracking-tight text-[var(--color-text-primary)] md:text-[46px]">
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

export function PrincipalMetricCard({
  label,
  value,
  helper,
  tone = "teal",
}: {
  label: string;
  value: string | number;
  helper: string;
  tone?: "teal" | "gold" | "amber" | "rose";
}) {
  const toneClasses =
    tone === "gold"
      ? "from-[var(--color-gold)] to-[#f7d978]"
      : tone === "amber"
        ? "from-[var(--color-warning)] to-[#fbbf24]"
        : tone === "rose"
          ? "from-[var(--color-danger)] to-[#fb7185]"
          : "from-[var(--color-accent-primary)] to-[#6ee7d8]";

  return (
    <article className="surface-card relative overflow-hidden p-5">
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", toneClasses)} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-4 font-[var(--font-display)] text-[32px] font-black tracking-tight text-[var(--color-text-primary)]">
        {value}
      </p>
      <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
        {helper}
      </p>
    </article>
  );
}

export function PrincipalInfoCard({
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

export function PrincipalDataList({
  items,
}: {
  items: Array<{
    label: string;
    value: ReactNode;
    detail?: ReactNode;
  }>;
}) {
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-[1.25rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                {item.label}
              </p>
              {item.detail ? (
                <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">
                  {item.detail}
                </p>
              ) : null}
            </div>
            <div className="text-right font-[var(--font-mono)] text-[13px] font-semibold text-[var(--color-text-primary)]">
              {item.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PrincipalSpotlightCard({
  eyebrow,
  title,
  detail,
  children,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <section className="surface-hero relative overflow-hidden p-5">
      <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_top_right,var(--color-accent-primary-dim),transparent_70%)]" />
      <div className="relative">
        <p className="section-eyebrow">{eyebrow}</p>
        <h3 className="mt-2 font-[var(--font-display)] text-[24px] font-bold tracking-tight text-[var(--color-text-primary)]">
          {title}
        </h3>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          {detail}
        </p>
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
    </section>
  );
}

export function PrincipalQuickLink({
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

export function PrincipalCommandLink({
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
        <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">
          {title}
        </p>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
          {detail}
        </p>
      </div>
      <span className="mt-5 inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-accent)]">
        Open
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export function PrincipalEmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="empty-state rounded-[1.5rem] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)] p-8">
      <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">{title}</p>
      <p className="mt-2 max-w-xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
        {detail}
      </p>
    </div>
  );
}
