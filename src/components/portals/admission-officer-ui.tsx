import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

import type { AdmissionApplicationView } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

export function AdmissionPortalPageHeader({
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
    <section className="surface-card relative overflow-hidden p-6 md:p-8">
      <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[var(--color-accent-primary-dim)] blur-3xl" />
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-4xl">
          <p className="section-eyebrow">{eyebrow}</p>
          <h1 className="mt-3 font-[var(--font-display)] text-[40px] font-black tracking-tight text-[var(--color-text-primary)]">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--color-text-secondary)]">
            {description}
          </p>
        </div>
        {actions ? (
          <div className="relative flex flex-wrap items-center gap-3">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function AdmissionMetricCard({
  label,
  value,
  helper,
  accent = "teal",
}: {
  label: string;
  value: string | number;
  helper: string;
  accent?: "teal" | "amber" | "rose" | "slate";
}) {
  const barClass =
    accent === "teal"
      ? "from-teal-400 to-emerald-400"
      : accent === "amber"
        ? "from-amber-400 to-orange-400"
        : accent === "rose"
          ? "from-rose-400 to-pink-400"
          : "from-slate-400 to-slate-500";

  return (
    <article className="surface-card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-4 font-[var(--font-display)] text-[32px] font-black tracking-tight text-[var(--color-text-primary)]">
        {value}
      </p>
      <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
        {helper}
      </p>
      <div className={cn("mt-5 h-1 rounded-full bg-gradient-to-r", barClass)} />
    </article>
  );
}

export function AdmissionStatusPill({
  status,
}: {
  status: AdmissionApplicationView["status"] | string;
}) {
  const normalized = status.toUpperCase();
  const tone =
    normalized.includes("REJECT") || normalized.includes("DECLIN") || normalized.includes("WAIT")
      ? "danger"
      : normalized.includes("ACCEPT") ||
          normalized.includes("ENROLL") ||
          normalized.includes("APPROV") ||
          normalized.includes("ACTIVE")
        ? "success"
        : normalized.includes("PAYMENT") ||
            normalized.includes("SCREENING") ||
            normalized.includes("RECOMMENDED") ||
            normalized.includes("OFFER")
          ? "warning"
          : "neutral";

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
              : "bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]",
      )}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function AdmissionQuickLink({
  href,
  label,
}: {
  href: Route;
  label: string;
}) {
  return (
    <Link href={href} className="btn-secondary min-h-[44px] px-4">
      {label}
    </Link>
  );
}

export function AdmissionInfoCard({
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
      <div className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          {title}
        </p>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
          {description}
        </p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
