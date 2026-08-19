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

function toneColor(tone: "good" | "info" | "warn" | "neutral") {
  if (tone === "good") return "var(--color-success)";
  if (tone === "info") return "var(--color-text-accent)";
  if (tone === "warn") return "var(--color-warning)";
  return "var(--color-text-primary)";
}

function ParentQuickStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "info" | "warn" | "neutral";
}) {
  return (
    <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-2 text-[19px] font-bold" style={{ color: toneColor(tone) }}>{value}</p>
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
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              <Sparkles className="h-3.5 w-3.5" />
              Parent family command center
            </div>
            <h1 className="mt-4 max-w-3xl font-[var(--font-heading)] text-[28px] font-black leading-tight tracking-tight text-[var(--color-text-primary)] md:text-[34px]">
              {portal.headline}
            </h1>
            <p className="mt-3 max-w-3xl text-[13.5px] leading-6 text-[var(--color-text-secondary)]">
              {portal.parentName} can review each child&apos;s timetable, attendance, results, fee balance, payments,
              and school notices from one secure family workspace.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {portal.familyStats.map((stat) => (
                <article key={stat.label} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{stat.label}</p>
                  <p className="mt-2 font-[var(--font-heading)] text-[19px] font-bold text-[var(--color-text-primary)]">{stat.value}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-4 rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Featured child</p>
                <h2 className="mt-2 text-[20px] font-black text-[var(--color-text-primary)]">
                  {selectedChild?.studentName ?? "No child linked yet"}
                </h2>
                <p className="mt-2 text-[12.5px] text-[var(--color-text-secondary)]">
                  {selectedChild ? `${selectedChild.className} · ${selectedChild.admissionNumber ?? "No admission number"}` : "Link a child to begin reviewing school records."}
                </p>
              </div>
              {selectedChild ? (
                <ActionMenu triggerLabel={`Actions for ${selectedChild.studentName}`}>
                  <ActionMenuButton onClick={() => setPanelOpen(true)}>Quick view</ActionMenuButton>
                  <ActionMenuLink href={`/portals/parent/children/${selectedChild.studentId}`}>Open overview</ActionMenuLink>
                  <ActionMenuLink href={`/portals/parent/children/${selectedChild.studentId}/results`}>View results</ActionMenuLink>
                  <ActionMenuLink href={`/portals/parent/children/${selectedChild.studentId}/fees`}>View fees</ActionMenuLink>
                </ActionMenu>
              ) : null}
            </div>

            {selectedChild ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Attendance</p>
                  <p className="mt-2 text-[19px] font-bold text-[var(--color-text-primary)]">{formatPercentage(selectedChild.attendanceRate)}</p>
                  <p className="mt-2 text-[11.5px] text-[var(--color-text-muted)]">{selectedChild.notes[0] ?? "Steady routine this week."}</p>
                </div>
                <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Outstanding</p>
                  <p className="mt-2 text-[19px] font-bold text-[var(--color-text-primary)]">{formatCurrency(paymentBalance)}</p>
                  <p className="mt-2 text-[11.5px] text-[var(--color-text-muted)]">
                    {nextPaymentDue ? `Next due ${formatDate(nextPaymentDue.dueOn)}` : "No unpaid invoice due right now."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-[10px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-6 text-[13px] text-[var(--color-text-secondary)]">
                No child record is available in this portal yet.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        {[
          { label: "Children", href: "/portals/parent/children", icon: Users },
          { label: "Announcements", href: "/portals/parent/announcements", icon: Megaphone },
          { label: "Fees", href: selectedChild ? `/portals/parent/children/${selectedChild.studentId}/fees` : "/portals/parent/children", icon: CreditCard },
          { label: "Results", href: selectedChild ? `/portals/parent/children/${selectedChild.studentId}/results` : "/portals/parent/children", icon: GraduationCap },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href as Route}
              className="group inline-flex items-center gap-2 rounded-[11px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-2.5 transition hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary-dim)]"
            >
              <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{action.label}</span>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_1.35fr]">
        <section className="surface-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-eyebrow">Child switcher</p>
              <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Family roster</h2>
            </div>
            <span className="rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 text-[11px] font-semibold text-[var(--color-text-accent)]">
              {portal.children.length} linked
            </span>
          </div>

          <div className="mt-5 grid gap-3">
            {portal.children.map((child) => {
              const active = child.studentId === selectedChild?.studentId;
              return (
                <button
                  key={child.studentId}
                  type="button"
                  onClick={() => setSelectedChildId(child.studentId)}
                  className={[
                    "group flex w-full items-start justify-between gap-4 rounded-[10px] border px-4 py-4 text-left transition",
                    active
                      ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary-dim)]"
                      : "border-[var(--color-border-default)] bg-[var(--color-bg-surface)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-subtle)]",
                  ].join(" ")}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--color-text-primary)]">{child.studentName}</p>
                    <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">{child.className}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[var(--color-bg-surface)] px-3 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)] shadow-[var(--shadow-sm)]">
                        {formatPercentage(child.attendanceRate)} attendance
                      </span>
                      <span className="rounded-full bg-[var(--color-bg-surface)] px-3 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)] shadow-[var(--shadow-sm)]">
                        {child.averageScore.toFixed(1)}% average
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{formatCurrency(child.outstandingBalance)}</p>
                    <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{child.nextClass}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-5">
          <section className="surface-card p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="section-eyebrow">Child spotlight</p>
                <h2 className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">
                  {selectedChild?.studentName ?? "Select a child"}
                </h2>
                <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
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
                  <ParentQuickStat label="Attendance" value={formatPercentage(selectedChild.attendanceRate)} tone="good" />
                  <ParentQuickStat label="Average" value={`${selectedChild.averageScore.toFixed(1)}%`} tone="info" />
                  <ParentQuickStat label="Balance" value={formatCurrency(paymentBalance)} tone="warn" />
                  <ParentQuickStat label="Notes" value={selectedChild.notes[0] ?? "Stable"} tone="neutral" />
                </div>

                <div className="mt-6 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                  <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Next academic stop</p>
                    <p className="mt-3 text-[16px] font-black text-[var(--color-text-primary)]">{selectedChild.nextClass}</p>
                    <p className="mt-2 text-[12.5px] leading-6 text-[var(--color-text-secondary)]">
                      {highlightedResult
                        ? `Latest result: ${highlightedResult.term} ${highlightedResult.session}, ${highlightedResult.average.toFixed(1)}% average and grade ${highlightedResult.grade}.`
                        : "No published result has been shared with the family yet."}
                    </p>
                  </article>

                  <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Fee readiness</p>
                    <p className="mt-3 text-[16px] font-black text-[var(--color-text-primary)]">
                      {nextPaymentDue ? `${formatCurrency(nextPaymentDue.balance)} due next` : "No active balance"}
                    </p>
                    <p className="mt-2 text-[12.5px] leading-6 text-[var(--color-text-secondary)]">
                      {nextPaymentDue
                        ? `${nextPaymentDue.title} is due on ${formatDate(nextPaymentDue.dueOn)}.`
                        : "All visible invoices are settled or not yet due."}
                    </p>
                  </article>
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-[10px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-8 text-[13px] text-[var(--color-text-secondary)]">
                No learner is linked to this parent account yet.
              </div>
            )}
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
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
                      <p className="font-semibold text-[var(--color-text-primary)]">{item.subject}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{item.teacherName}</p>
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

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="surface-card p-6">
          <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Published result snapshots</p>
          <div className="mt-5 grid gap-3">
            {(selectedChild?.resultHistory ?? []).slice(0, 3).map((result) => (
              <article key={result.id} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-[var(--color-text-primary)]">
                      {result.session} · {result.term}
                    </p>
                    <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">Published {formatDate(result.publishedAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[12.5px] text-[var(--color-text-secondary)]">
                    <span className="rounded-full bg-[var(--color-bg-surface)] px-3 py-1 font-semibold">Average {result.average.toFixed(1)}%</span>
                    <span className="rounded-full bg-[var(--color-bg-surface)] px-3 py-1 font-semibold">Grade {result.grade}</span>
                    <span className="rounded-full bg-[var(--color-bg-surface)] px-3 py-1 font-semibold">Position {result.position ?? "-"}</span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {result.subjects.slice(0, 6).map((subject) => (
                    <div key={subject.subject} className="rounded-[10px] bg-[var(--color-bg-surface)] px-4 py-3 text-[12.5px]">
                      <p className="font-semibold text-[var(--color-text-primary)]">{subject.subject}</p>
                      <p className="mt-1 text-[var(--color-text-secondary)]">
                        {subject.score}% · {subject.grade}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
            {selectedChild && selectedChild.resultHistory.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-8 text-[13px] text-[var(--color-text-secondary)]">
                This child does not have a published result yet.
              </div>
            ) : null}
          </div>
        </section>

        <section className="surface-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
              <Bell className="h-4 w-4" />
            </div>
            <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Family notices</p>
          </div>
          <div className="mt-5 grid gap-3">
            {portal.announcements.slice(0, 4).map((item) => (
              <article key={item.id} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-5">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{item.time}</span>
                </div>
                <p className="mt-3 text-[12.5px] leading-6 text-[var(--color-text-secondary)]">{item.detail}</p>
              </article>
            ))}
            {portal.announcements.length === 0 ? (
              <p className="text-[13px] text-[var(--color-text-secondary)]">No family notices right now.</p>
            ) : null}
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
              <p className="text-[12px] text-[var(--color-text-muted)]">Open detailed routes only when you need the full record.</p>
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
              <ParentQuickStat label="Attendance" value={formatPercentage(selectedChild.attendanceRate)} tone="good" />
              <ParentQuickStat label="Average" value={`${selectedChild.averageScore.toFixed(1)}%`} tone="info" />
              <ParentQuickStat label="Outstanding" value={formatCurrency(paymentBalance)} tone="warn" />
            </div>

            <section className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Parent notes</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedChild.notes.map((note) => (
                  <span key={note} className="rounded-full bg-[var(--color-bg-surface)] px-3 py-1 text-[12px] font-medium text-[var(--color-text-secondary)] shadow-[var(--shadow-sm)]">
                    {note}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Finance snapshot</p>
              <div className="mt-4 grid gap-3">
                {selectedChild.finance.slice(0, 4).map((item) => (
                  <div key={`${item.title}-${item.dueOn}`} className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3">
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                      <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">Due {formatDate(item.dueOn)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-[var(--color-text-primary)]">{formatCurrency(item.balance)}</p>
                      <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">of {formatCurrency(item.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Recent result</p>
              {highlightedResult ? (
                <div className="mt-4 grid gap-3">
                  <div className="flex flex-wrap gap-2 text-[13px]">
                    <span className="rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 font-semibold text-[var(--color-text-accent)]">
                      {highlightedResult.term}
                    </span>
                    <span className="rounded-full bg-[var(--color-bg-subtle)] px-3 py-1 font-semibold text-[var(--color-text-secondary)]">
                      {highlightedResult.average.toFixed(1)}% average
                    </span>
                    <span className="rounded-full bg-[var(--color-bg-subtle)] px-3 py-1 font-semibold text-[var(--color-text-secondary)]">
                      Grade {highlightedResult.grade}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {highlightedResult.subjects.slice(0, 4).map((subject) => (
                      <div key={subject.subject} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3 text-[13px]">
                        <p className="font-semibold text-[var(--color-text-primary)]">{subject.subject}</p>
                        <p className="mt-1 text-[var(--color-text-secondary)]">
                          {subject.score}% · {subject.grade}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-[13px] text-[var(--color-text-secondary)]">No published result is available for this child yet.</p>
              )}
            </section>
          </div>
        ) : null}
      </SidePanel>
    </div>
  );
}
