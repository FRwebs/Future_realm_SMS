import Link from "next/link";
import type { Route } from "next";

import { CanDo } from "@/components/auth/permission-provider";
import { MetricCard } from "@/components/dashboard/metric-card";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import type { DashboardMetric } from "@/lib/domain/types";

type OperationsOverview = {
  metrics: Array<{ label: string; value: number; detail: string }>;
  resultWindows: Array<{
    id: string;
    title: string;
    status: string;
    closesAt: string;
  }>;
};

export default async function OperationsPage() {
  const overview = await apiGet<OperationsOverview>("/api/v1/operations/overview");
  const metrics: DashboardMetric[] = overview.metrics.map((metric) => ({
    label: metric.label,
    value: String(metric.value),
    change: ""
  }));

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">
          School operations
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">
              Daily Operations Command Centre
            </h1>
            <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              A role-aware workspace for welfare, front desk, facilities, exam logistics, result deadlines, and support actions that happen in a real Nigerian school.
            </p>
          </div>
          <CanDo permission="results.approve">
            <ResourceActionDialog
              triggerLabel="Open Result Window"
              title="Open result entry window"
              description="Set a controlled deadline for teachers to enter scores before HOD and VP Academics review."
              endpoint="/api/v1/operations/result-entry-windows"
              fields={[
                { name: "academicSessionId", label: "Academic session ID", required: true },
                { name: "termId", label: "Term ID", required: true },
                { name: "title", label: "Window title", required: true, defaultValue: "Second Term Result Entry" },
                { name: "opensAt", label: "Opens at (ISO date-time)", required: true, placeholder: "2026-04-01T07:00:00.000Z" },
                { name: "closesAt", label: "Closes at (ISO date-time)", required: true, placeholder: "2026-04-20T17:00:00.000Z" }
              ]}
              submitLabel="Create Window"
              confirmLabel="Confirm Window"
              confirmMessage="Teachers will see this result deadline. Confirm the dates before saving."
            />
          </CanDo>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {[
          ["Welfare & Discipline", "/operations/welfare", "Incidents, counselling, health visits."],
          ["Lesson Plans & Questions", "/operations/academics", "HOD review, question bank, materials."],
          ["Exam Logistics", "/operations/exams", "External exams and invigilation readiness."],
          ["Front Desk", "/operations/front-desk", "Visitor logs and parent meetings."],
          ["Assets & Facilities", "/operations/assets", "Inventory, maintenance, transport vehicles."]
        ].map(([label, href, description]) => (
          <Link key={href} href={href as Route} className="surface-card p-5 transition hover:border-[var(--color-border-strong)]">
            <p className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">{label}</p>
            <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">{description}</p>
          </Link>
        ))}
      </section>

      <TableCard
        title="Result Entry Windows"
        description="Deadline controls that prevent score edits after submission windows close."
        items={overview.resultWindows}
        emptyState="No result entry windows have been opened yet."
        columns={[
          { key: "title", header: "Window", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.title}</span> },
          { key: "status", header: "Status", render: (item) => <span className="rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 text-xs font-semibold text-[var(--color-text-accent)]">{item.status}</span> },
          { key: "deadline", header: "Closes", render: (item) => new Date(item.closesAt).toLocaleString("en-NG") }
        ]}
      />
    </div>
  );
}
