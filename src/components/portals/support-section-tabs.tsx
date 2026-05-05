"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

export type SupportSectionTab = {
  href: string;
  label: string;
};

export function SupportSectionTabs({
  title,
  description,
  tabs,
}: {
  title: string;
  description: string;
  tabs: SupportSectionTab[];
}) {
  const pathname = usePathname();

  return (
    <section className="surface-card p-4 md:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            {title}
          </p>
          <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
            {description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

            return (
              <Link
                key={tab.href}
                href={tab.href as Route}
                className={cn(
                  "inline-flex min-h-[42px] items-center rounded-full border px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.08em] transition",
                  active
                    ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]"
                    : "border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
