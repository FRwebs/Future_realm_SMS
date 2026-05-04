"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import { Bell, CreditCard, GraduationCap, Megaphone, Sparkles, Users } from "lucide-react";

import { TableCard } from "@/components/data-display/table-card";
import { ActionMenu, ActionMenuButton, ActionMenuLink } from "@/components/ui/action-menu";
import { SidePanel } from "@/components/ui/side-panel";
import { ParentPortalView } from "@/lib/domain/types";
import { formatCurrency, formatDate, formatPercentage } from "@/lib/utils/formatters";

function ParentQuickStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "blue" | "amber" | "slate";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-800 border-emerald-100"
      : tone === "blue"
        ? "bg-sky-50 text-sky-800 border-sky-100"
        : tone === "amber"
          ? "bg-amber-50 text-amber-800 border-amber-100"
          : "bg-slate-50 text-slate-800 border-slate-100";

  return (
    <article className={`rounded-[1.5rem] border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-70">{label}</p>
      <p className="mt-2 text-xl font-black">{value}</p>
    </article>
  );
}

export function ParentPortalDashboard({ portal }: { portal: ParentPortalView }) {
  const [selectedChildId, setSelectedChildId] = useState<string | null>(portal.children[0]?.studentId ?? null);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    if (!portal.children.length) {
      setSelectedChildId(null);
      return;
    }

    setSelectedChildId((current) =>
      current && portal.children.some((child) => child.studentId === current) ? current : portal.children[0]!.studentId,
    );
  }, [portal.children]);

  const selectedChild = useMemo(
    () => portal.children.find((child) => child.studentId === selectedChildId) ?? portal.children[0] ?? null,
    [portal.children, selectedChildId],
  );

  const paymentBalance = selectedChild?.finance.reduce((sum, item) => sum + item.balance, 0) ?? selectedChild?.outstandingBalance ?? 0;
  const nextPaymentDue = selectedChild?.finance
    .filter((item) => item.balance > 0)
    .sort((a, b) => new Date(a.dueOn).getTime() - new Date(b.dueOn).getTime())[0];

  const highlightedResult = selectedChild?.resultHistory[0] ?? null;
  const timetablePreview = (selectedChild?.weeklyTimetable ?? []).slice(0, 5);

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-gradient-to-br from-primary-950 via-primary-900 to-primary-700 p-6 text-white shadow-panel md:p-8">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/75">
              <Sparkles className="h-3.5 w-3.5" />
              Parent family command center
            </div>
            <h1 className="mt-4 font-[var(--font-heading)] text-4xl font-black tracking-tight text-white md:text-5xl">
              {portal.headline}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/74">
              {portal.parentName} can review each child's timetable, attendance, results, fee balance, payments, and school notices from one secure family workspace.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {portal.familyStats.map((stat, index) => (
                <article
                  key={stat.label}
                  className="rounded-[1.4rem] border border-white/15 bg-white/10 p-4 backdrop-blur transition duration-200 motion-safe:animate-[fade-up_480ms_ease-out_both]"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">{stat.label}</p>
                  <p className="mt-2 font-[var(--font-heading)] text-2xl font-black text-white">{stat.value}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-4 rounded-[1.75rem] border border-white/15 bg-white/10 p-5 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">Featured child</p>
                <h2 className="mt-2 text-2xl font-black text-white">
                  {selectedChild?.studentName ?? "No child linked yet"}
                </h2>
                <p className="mt-2 text-sm text-white/72">
                  {selectedChild ? `${selectedChild.className} · ${selectedChild.admissionNumber ?? "No admission number"}` : "Link a child to begin reviewing school records."}
                </p>
              </div>
              {selectedChild ? (
                <ActionMenu triggerLabel={`Actions for ${selectedChild.studentName}`} panelClassName="bg-white">
                  <ActionMenuButton onClick={() => setPanelOpen(true)}>Quick view</ActionMenuButton>
                  <ActionMenuLink href={`/portals/parent/children/${selectedChild.studentId}`}>Open overview</ActionMenuLink>
                  <ActionMenuLink href={`/portals/parent/children/${selectedChild.studentId}/results`}>View results</ActionMenuLink>
                  <ActionMenuLink href={`/portals/parent/children/${selectedChild.studentId}/fees`}>View fees</ActionMenuLink>
                </ActionMenu>
              ) : null}
            </div>

            {selectedChild ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.35rem] border border-white/15 bg-black/10 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Attendance</p>
                  <p className="mt-2 text-2xl font-black text-white">{formatPercentage(selectedChild.attendanceRate)}</p>
                  <p className="mt-2 text-xs text-white/65">{selectedChild.notes[0] ?? "Steady routine this week."}</p>
                </div>
                <div className="rounded-[1.35rem] border border-white/15 bg-black/10 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Outstanding</p>
                  <p className="mt-2 text-2xl font-black text-white">{formatCurrency(paymentBalance)}</p>
                  <p className="mt-2 text-xs text-white/65">
                    {nextPaymentDue ? `Next due ${formatDate(nextPaymentDue.dueOn)}` : "No unpaid invoice due right now."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-[1.35rem] border border-dashed border-white/20 bg-black/10 px-4 py-6 text-sm text-white/72">
                No child record is available in this portal yet.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/65 bg-white/90 p-4 shadow-panel">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Children", href: "/portals/parent/children", icon: Users },
            { label: "Announcements", href: "/portals/parent/announcements", icon: Megaphone },
            { label: "Fees", href: selectedChild ? `/portals/parent/children/${selectedChild.studentId}/fees` : "/portals/parent/children", icon: CreditCard },
            { label: "Results", href: selectedChild ? `/portals/parent/children/${selectedChild.studentId}/results` : "/portals/parent/children", icon: GraduationCap },
          ].map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href as Route}
                className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:bg-primary-50"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 transition group-hover:bg-white">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-[13px] font-bold text-slate-900 group-hover:text-primary-800">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_1.35fr]">
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-700">Child switcher</p>
              <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-ink">Family roster</h2>
            </div>
            <span className="rounded-full bg-primary-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-800">
              {portal.children.length} linked
            </span>
          </div>

          <div className="mt-5 grid gap-3">
            {portal.children.map((child, index) => {
              const active = child.studentId === selectedChild?.studentId;
              return (
                <button
                  key={child.studentId}
                  type="button"
                  onClick={() => setSelectedChildId(child.studentId)}
                  className={[
                    "group flex w-full items-start justify-between gap-4 rounded-[1.5rem] border px-4 py-4 text-left transition duration-200",
                    active
                      ? "border-primary-200 bg-primary-50/80 shadow-sm"
                      : "border-slate-100 bg-white hover:-translate-y-0.5 hover:border-primary-100 hover:bg-slate-50",
                  ].join(" ")}
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{child.studentName}</p>
                    <p className="mt-1 text-sm text-slate-600">{child.className}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
                        {formatPercentage(child.attendanceRate)} attendance
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
                        {child.averageScore.toFixed(1)}% average
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(child.outstandingBalance)}</p>
                    <p className="mt-1 text-xs text-slate-500">{child.nextClass}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-6">
          <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-700">Child spotlight</p>
                <h2 className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-ink">
                  {selectedChild?.studentName ?? "Select a child"}
                </h2>
                <p className="mt-2 text-sm text-ink/68">
                  {selectedChild
                    ? `${selectedChild.className} · ${selectedChild.admissionNumber ?? "No admission number"}`
                    : "Choose a child from the roster to review timetable, finance, and result updates."}
                </p>
              </div>
              {selectedChild ? (
                <button type="button" onClick={() => setPanelOpen(true)} className="btn-secondary px-4">
                  Open quick view
                </button>
              ) : null}
            </div>

            {selectedChild ? (
              <>
                <div className="mt-6 grid gap-4 md:grid-cols-4">
                  <ParentQuickStat label="Attendance" value={formatPercentage(selectedChild.attendanceRate)} tone="emerald" />
                  <ParentQuickStat label="Average" value={`${selectedChild.averageScore.toFixed(1)}%`} tone="blue" />
                  <ParentQuickStat label="Balance" value={formatCurrency(paymentBalance)} tone="amber" />
                  <ParentQuickStat label="Notes" value={selectedChild.notes[0] ?? "Stable"} tone="slate" />
                </div>

                <div className="mt-6 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                  <article className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Next academic stop</p>
                    <p className="mt-3 text-lg font-black text-slate-900">{selectedChild.nextClass}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {highlightedResult
                        ? `Latest result: ${highlightedResult.term} ${highlightedResult.session}, ${highlightedResult.average.toFixed(1)}% average and grade ${highlightedResult.grade}.`
                        : "No published result has been shared with the family yet."}
                    </p>
                  </article>

                  <article className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Fee readiness</p>
                    <p className="mt-3 text-lg font-black text-slate-900">
                      {nextPaymentDue ? `${formatCurrency(nextPaymentDue.balance)} due next` : "No active balance"}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {nextPaymentDue
                        ? `${nextPaymentDue.title} is due on ${formatDate(nextPaymentDue.dueOn)}.`
                        : "All visible invoices are settled or not yet due."}
                    </p>
                  </article>
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                No learner is linked to this parent account yet.
              </div>
            )}
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <TableCard
              title="Upcoming timetable"
              description="A compact look at the selected child's next visible classes this week."
              items={timetablePreview}
              emptyState="No timetable entry has been published for this child yet."
              columns={[
                { key: "day", header: "Day", render: (item) => item.day },
                { key: "time", header: "Time", render: (item) => item.time },
                {
                  key: "subject",
                  header: "Subject",
                  render: (item) => (
                    <div>
                      <p className="font-semibold text-ink">{item.subject}</p>
                      <p className="text-xs text-ink/55">{item.teacherName}</p>
                    </div>
                  ),
                },
                { key: "venue", header: "Venue", render: (item) => item.venue },
              ]}
              getRowKey={(item) => `${item.day}-${item.time}-${item.subject}`}
              primaryColumnKey="subject"
            />

            <TableCard
              title="Fee tracker"
              description="Current invoices, balances, and due dates for the selected child."
              items={(selectedChild?.finance ?? []).slice(0, 5)}
              emptyState="No invoice or fee record is visible yet."
              columns={[
                { key: "title", header: "Invoice", render: (item) => item.title },
                { key: "amount", header: "Total", render: (item) => formatCurrency(item.amount) },
                { key: "balance", header: "Balance", render: (item) => formatCurrency(item.balance) },
                { key: "dueOn", header: "Due", render: (item) => formatDate(item.dueOn) },
              ]}
              getRowKey={(item) => item.title}
              primaryColumnKey="title"
              featuredColumnKeys={["balance"]}
            />
          </section>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h3 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Published result snapshots</h3>
          <div className="mt-5 grid gap-4">
            {(selectedChild?.resultHistory ?? []).slice(0, 3).map((result) => (
              <article key={result.id} className="rounded-[1.5rem] border border-ink/8 bg-sand/55 p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-ink">
                      {result.session} · {result.term}
                    </p>
                    <p className="mt-1 text-sm text-ink/60">Published {formatDate(result.publishedAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-ink/72">
                    <span className="rounded-full bg-white px-3 py-1 font-semibold">Average {result.average.toFixed(1)}%</span>
                    <span className="rounded-full bg-white px-3 py-1 font-semibold">Grade {result.grade}</span>
                    <span className="rounded-full bg-white px-3 py-1 font-semibold">Position {result.position ?? "-"}</span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {result.subjects.slice(0, 6).map((subject) => (
                    <div key={subject.subject} className="rounded-2xl bg-white px-4 py-3 text-sm">
                      <p className="font-semibold text-ink">{subject.subject}</p>
                      <p className="mt-1 text-ink/65">
                        {subject.score}% · {subject.grade}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
            {selectedChild && selectedChild.resultHistory.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                This child does not have a published result yet.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <Bell className="h-4 w-4" />
            </div>
            <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Family notices</h2>
          </div>
          <div className="mt-5 grid gap-4">
            {portal.announcements.slice(0, 4).map((item) => (
              <article key={item.id} className="rounded-[1.5rem] border border-ink/8 bg-sand/55 p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-semibold text-ink">{item.title}</p>
                  <span className="text-xs uppercase tracking-[0.24em] text-ink/35">{item.time}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-ink/68">{item.detail}</p>
              </article>
            ))}
          </div>
        </section>
      </section>

      <SidePanel
        open={panelOpen && Boolean(selectedChild)}
        onClose={() => setPanelOpen(false)}
        title={selectedChild?.studentName ?? "Child quick view"}
        subtitle={selectedChild ? `${selectedChild.className} · ${selectedChild.admissionNumber ?? "No admission number"}` : "Preview the selected learner without leaving the dashboard."}
        footer={
          selectedChild ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12px] text-slate-500">Open detailed routes only when you need the full record.</p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/portals/parent/children/${selectedChild.studentId}` as Route} className="btn-secondary px-4">
                  Overview
                </Link>
                <Link href={`/portals/parent/children/${selectedChild.studentId}/fees` as Route} className="btn-primary px-4">
                  Fees
                </Link>
              </div>
            </div>
          ) : null
        }
      >
        {selectedChild ? (
          <div className="grid gap-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <ParentQuickStat label="Attendance" value={formatPercentage(selectedChild.attendanceRate)} tone="emerald" />
              <ParentQuickStat label="Average" value={`${selectedChild.averageScore.toFixed(1)}%`} tone="blue" />
              <ParentQuickStat label="Outstanding" value={formatCurrency(paymentBalance)} tone="amber" />
            </div>

            <section className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Parent notes</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedChild.notes.map((note) => (
                  <span key={note} className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-slate-700 shadow-sm">
                    {note}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-100 bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Finance snapshot</p>
              <div className="mt-4 grid gap-3">
                {selectedChild.finance.slice(0, 4).map((item) => (
                  <div key={`${item.title}-${item.dueOn}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500">Due {formatDate(item.dueOn)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{formatCurrency(item.balance)}</p>
                      <p className="mt-1 text-xs text-slate-500">of {formatCurrency(item.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-100 bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Recent result</p>
              {highlightedResult ? (
                <div className="mt-4 grid gap-3">
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full bg-primary-50 px-3 py-1 font-semibold text-primary-800">
                      {highlightedResult.term}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                      {highlightedResult.average.toFixed(1)}% average
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                      Grade {highlightedResult.grade}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {highlightedResult.subjects.slice(0, 4).map((subject) => (
                      <div key={subject.subject} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                        <p className="font-semibold text-slate-900">{subject.subject}</p>
                        <p className="mt-1 text-slate-600">
                          {subject.score}% · {subject.grade}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No published result is available for this child yet.</p>
              )}
            </section>
          </div>
        ) : null}
      </SidePanel>
    </div>
  );
}
