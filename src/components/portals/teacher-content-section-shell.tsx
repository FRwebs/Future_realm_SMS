"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { BookMarked, BookOpen, FileStack, Layers3, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils/cn";

const iconMap = {
  BookMarked,
  BookOpen,
  FileStack,
  Layers3,
  ShieldCheck,
} as const;

type SectionTab = {
  href: Route;
  label: string;
  description: string;
  icon: keyof typeof iconMap;
  matches: string[];
};

export function TeacherContentSectionShell({
  eyebrow,
  title,
  description,
  tabs,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  tabs: SectionTab[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="portal-page">
      <section className="surface-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-eyebrow">
              {eyebrow}
            </p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">
              {title}
            </h2>
            <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">{description}</p>
          </div>
          <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3 text-sm font-semibold text-[var(--color-text-secondary)]">
            Structured subsection workspace
          </div>
        </div>

        <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const active = tab.matches.some((match) => pathname === match || pathname.startsWith(`${match}/`));
            const Icon = iconMap[tab.icon];

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "min-w-[240px] rounded-[10px] border px-4 py-4 transition",
                  active
                    ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)] text-[var(--color-text-inverse)]"
                    : "border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary-dim)]",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-[10px]",
                      active
                        ? "bg-[rgba(255,255,255,0.16)] text-[var(--color-text-inverse)]"
                        : "bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{tab.label}</p>
                    <p
                      className={cn(
                        "mt-1 text-xs",
                        active ? "text-[rgba(255,255,255,0.75)]" : "text-[var(--color-text-secondary)]",
                      )}
                    >
                      {tab.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {children}
    </div>
  );
}
