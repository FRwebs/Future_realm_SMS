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
    <div className="grid gap-6">
      <section className="rounded-[1.85rem] border border-white/65 bg-white/92 p-5 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">
              {eyebrow}
            </p>
            <h2 className="mt-2 font-[var(--font-heading)] text-3xl font-black tracking-tight text-ink">
              {title}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/62">{description}</p>
          </div>
          <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-600">
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
                  "min-w-[240px] rounded-[1.5rem] border px-4 py-4 transition",
                  active
                    ? "border-[rgb(18,33,23)] bg-[rgb(18,33,23)] text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-800 hover:border-primary-200 hover:bg-primary-50",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-2xl",
                      active ? "bg-white/12 text-white" : "bg-primary-50 text-primary-700",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{tab.label}</p>
                    <p className={cn("mt-1 text-xs", active ? "text-white/75" : "text-slate-500")}>
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
