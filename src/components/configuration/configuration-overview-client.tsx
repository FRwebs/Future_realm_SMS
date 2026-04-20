"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Settings2 } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { configApi } from "./api";

type Resource = {
  key: string;
  label: string;
  group: string;
  description: string;
  mode: string;
  permissions: string[];
};

type Overview = {
  groups: Array<{ group: string; resources: Resource[] }>;
};

const groupChrome: Record<string, string> = {
  General: "from-brand-700 via-emerald-600 to-ink",
  Finance: "from-amber-600 via-orange-500 to-red-500",
  Academics: "from-blue-700 via-sky-600 to-cyan-500",
  Others: "from-slate-800 via-slate-600 to-slate-500",
};

export function ConfigurationOverviewClient() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    configApi<Overview>("/api/v1/configuration")
      .then(setOverview)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load configuration."));
  }, []);

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/65 bg-white/88 shadow-panel backdrop-blur-xl">
        <div className="h-2 bg-gradient-to-r from-brand-700 via-amber to-ink" />
        <div className="p-6">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-700">School administration</p>
          <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-black tracking-tight text-ink">Configuration</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/62">
            Manage tenant-scoped school settings, academic structures, finance defaults, admissions workflows, communication preferences, and audit-style login history.
          </p>
        </div>
      </section>

      {error ? <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">{error}</div> : null}
      {!overview && !error ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-[1.5rem] bg-white/75" />)}</div> : null}

      {overview?.groups.map((group) => (
        <section key={group.group} className="grid gap-3">
          <div className="flex items-center gap-3">
            <span className={cn("rounded-full bg-gradient-to-r px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-white", groupChrome[group.group] ?? groupChrome.General)}>{group.group}</span>
            <span className="h-px flex-1 bg-ink/8" />
            <span className="text-xs font-medium text-ink/45">{group.resources.length} areas</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.resources.map((resource) => (
              <Link
                key={resource.key}
                href={`/school/configuration/${resource.key}`}
                className="group overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/88 shadow-[0_14px_36px_rgba(18,33,23,0.06)] transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-panel"
              >
                <div className={cn("h-1.5 bg-gradient-to-r", groupChrome[group.group] ?? groupChrome.General)} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="rounded-2xl bg-sand p-3 text-brand-800">
                      <Settings2 className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-ink/28 transition group-hover:translate-x-1 group-hover:text-brand-700" />
                  </div>
                  <h2 className="mt-5 font-[var(--font-heading)] text-2xl font-black text-ink">{resource.label}</h2>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink/58">{resource.description}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {resource.permissions.slice(0, 3).map((permission) => (
                      <span key={permission} className="rounded-full bg-brand-50 px-2 py-1 text-[0.65rem] font-bold uppercase text-brand-800">{permission}</span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
