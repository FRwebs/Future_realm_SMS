import Link from "next/link";
import type { Route } from "next";
import { ReactNode } from "react";

interface DetailPageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  backHref: string;
  backLabel: string;
  badges?: string[];
  actions?: ReactNode;
}

export function DetailPageHeader({ eyebrow, title, description, backHref, backLabel, badges = [], actions }: DetailPageHeaderProps) {
  return (
    <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href={backHref as Route} className="text-sm font-semibold text-brand-700">{backLabel}</Link>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-brand-700">{eyebrow}</p>
          <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">{title}</h1>
          {description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">{description}</p> : null}
          {badges.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {badges.map((badge) => (
                <span key={badge} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div> : null}
      </div>
    </section>
  );
}
