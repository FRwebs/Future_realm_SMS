"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Megaphone,
  Trophy,
  ArrowRight,
  Clock3,
  Library,
  Bus,
  BedDouble,
} from "lucide-react";

import { TableCard } from "@/components/data-display/table-card";
import { ActionMenu, ActionMenuLink } from "@/components/ui/action-menu";
import { SidePanel } from "@/components/ui/side-panel";
import { StudentPortalView } from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

type StudentSubjectCard = NonNullable<StudentPortalView["subjects"]>[number];

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h2 className="font-[var(--font-heading)] text-[20px] font-bold tracking-tight text-[var(--color-text-primary)]">{title}</h2>
      {description ? <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">{description}</p> : null}
    </div>
  );
}

function toneColor(tone: "good" | "info" | "warn" | "violet") {
  if (tone === "good") return "var(--color-success)";
  if (tone === "info") return "var(--color-text-accent)";
  if (tone === "warn") return "var(--color-warning)";
  return "var(--color-text-primary)";
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "good" | "info" | "warn" | "violet";
}) {
  return (
    <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-2 text-[19px] font-bold" style={{ color: toneColor(accent) }}>{value}</p>
    </article>
  );
}

function normalizeDay(value: string) {
  return value.trim().toLowerCase();
}

function prettyDay(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function StudentPortalDashboard({ portal }: { portal: StudentPortalView }) {
  const attendanceRate = portal.attendance?.summary.attendanceRate ?? 0;
  const lowAttendanceWarning = portal.attendance?.summary.lowAttendanceWarning ?? null;
  const dayOptions = useMemo(() => {
    const seen = new Set<string>();
    return portal.weeklyTimetable.reduce<string[]>((days, item) => {
      const day = normalizeDay(item.day);
      if (!seen.has(day)) {
        seen.add(day);
        days.push(day);
      }
      return days;
    }, []);
  }, [portal.weeklyTimetable]);

  const todayKey = useMemo(() => {
    const fallback = dayOptions[0] ?? "monday";
    const current = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());
    const normalized = normalizeDay(current);
    return dayOptions.includes(normalized) ? normalized : fallback;
  }, [dayOptions]);

  const [activeDay, setActiveDay] = useState<string>(todayKey);
  const [focusPanelOpen, setFocusPanelOpen] = useState(false);
  const [focusSubject, setFocusSubject] = useState<StudentSubjectCard | null>(portal.subjects?.[0] ?? null);

  const daySchedule = useMemo(
    () => portal.weeklyTimetable.filter((item) => normalizeDay(item.day) === activeDay),
    [activeDay, portal.weeklyTimetable],
  );

  const currentFocusEntry = daySchedule[0] ?? portal.timetablePreview?.[0] ?? portal.weeklyTimetable[0] ?? null;
  const paymentOutstanding = portal.finance.reduce((sum, item) => sum + item.balance, 0);
  const nextFeeDue = portal.finance
    .filter((item) => item.balance > 0)
    .sort((a, b) => new Date(a.dueOn).getTime() - new Date(b.dueOn).getTime())[0];
  const transportPreview = portal.transport?.[0] ?? null;
  const hostelPreview = portal.hostel?.[0] ?? null;

  const spotlightAssignment = portal.assignments?.[0] ?? null;
  const notices = portal.announcements.slice(0, 4);
  const subjectCards = portal.subjects ?? portal.profile?.subjectDetails ?? [];

  const openSubjectPanel = (subject: StudentSubjectCard) => {
    setFocusSubject(subject);
    setFocusPanelOpen(true);
  };

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.85fr]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Student command center</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-[28px] font-black leading-tight tracking-tight text-[var(--color-text-primary)] md:text-[34px]">
              {portal.headline}
            </h1>
            <p className="mt-3 max-w-3xl text-[13.5px] leading-6 text-[var(--color-text-secondary)]">
              {portal.studentName} can see today&apos;s learning plan, subjects, attendance, assignments, fees,
              announcements, and published results from one focused student workspace.
            </p>

            <div className="mt-6 grid gap-3 text-[13px] text-[var(--color-text-secondary)] md:grid-cols-2 xl:grid-cols-4">
              {[
                `Class: ${portal.className}`,
                `Admission no: ${portal.admissionNumber ?? "Not recorded"}`,
                `Session: ${portal.session ?? "Current"}`,
                `Term: ${portal.term ?? "Current"}`,
              ].map((line) => (
                <p key={line} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3">
                  {line}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Today focus</p>
                <h2 className="mt-2 text-[20px] font-black text-[var(--color-text-primary)]">
                  {currentFocusEntry?.subject ?? "No class scheduled"}
                </h2>
                <p className="mt-2 text-[12.5px] text-[var(--color-text-secondary)]">
                  {currentFocusEntry
                    ? `${currentFocusEntry.day} · ${currentFocusEntry.time} · ${currentFocusEntry.venue}`
                    : "Your school timetable has not been published yet."}
                </p>
              </div>
              <ActionMenu triggerLabel="Student quick actions">
                <ActionMenuLink href="/portals/student/timetable">Open timetable</ActionMenuLink>
                <ActionMenuLink href="/portals/student/assignments">View assignments</ActionMenuLink>
                <ActionMenuLink href="/portals/student/results">View results</ActionMenuLink>
              </ActionMenu>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Attendance</p>
                <p className="mt-2 text-[19px] font-bold text-[var(--color-text-primary)]">{attendanceRate}%</p>
                <p className="mt-2 text-[11.5px] text-[var(--color-text-muted)]">{lowAttendanceWarning ?? "Attendance remains within the expected range."}</p>
              </div>
              <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Outstanding fees</p>
                <p className="mt-2 text-[19px] font-bold text-[var(--color-text-primary)]">{formatCurrency(paymentOutstanding)}</p>
                <p className="mt-2 text-[11.5px] text-[var(--color-text-muted)]">
                  {nextFeeDue ? `${nextFeeDue.title} due ${formatDate(nextFeeDue.dueOn)}` : "No outstanding invoice due right now."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {portal.stats.slice(0, 4).map((stat, index) => (
            <StatTile
              key={stat.label}
              label={stat.label}
              value={stat.value}
              accent={index === 0 ? "good" : index === 1 ? "info" : index === 2 ? "warn" : "violet"}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        {[
          { label: "Timetable", href: "/portals/student/timetable", icon: CalendarDays },
          { label: "Subjects", href: "/my-subjects", icon: BookOpen },
          { label: "Assignments", href: "/portals/student/assignments", icon: ClipboardList },
          { label: "Results", href: "/portals/student/results", icon: Trophy },
          { label: "Fees", href: "/portals/student/fees", icon: CreditCard },
          { label: "Notices", href: "/portals/student/announcements", icon: Megaphone },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
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

      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.95fr]">
        <section className="surface-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionHeader
              title="This week at a glance"
              description="Switch days without leaving the dashboard. Focus on one schedule lane at a time."
            />
            <Link href="/portals/student/timetable" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text-accent)] transition hover:opacity-80">
              Full timetable
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {dayOptions.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setActiveDay(day)}
                className={[
                  "rounded-full px-4 py-2 text-[13px] font-semibold transition",
                  activeDay === day
                    ? "bg-[var(--color-accent-primary)] text-[var(--color-text-inverse)]"
                    : "bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-primary-dim)] hover:text-[var(--color-text-accent)]",
                ].join(" ")}
              >
                {prettyDay(day)}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-3">
            {daySchedule.length ? (
              daySchedule.map((entry) => (
                <article
                  key={`${entry.day}-${entry.time}-${entry.subject}`}
                  className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)]">{entry.subject}</p>
                      <p className="mt-1 text-[12.5px] text-[var(--color-text-secondary)]">{entry.teacherName} · {entry.venue}</p>
                    </div>
                    <span className="rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-accent)]">
                      {entry.time}
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[10px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-8 text-[13px] text-[var(--color-text-secondary)]">
                No timetable entry is available for {prettyDay(activeDay)}.
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-5">
          <section className="surface-card p-6">
            <SectionHeader title="Learning tasks" description="See the next thing that needs your attention." />
            {spotlightAssignment ? (
              <div className="mt-5 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--color-text-primary)]">{spotlightAssignment.title}</p>
                    <p className="mt-2 text-[12.5px] leading-6 text-[var(--color-text-secondary)]">{spotlightAssignment.description ?? "Assignment details are available in your full assignments page."}</p>
                  </div>
                  <span className="rounded-full bg-[var(--color-bg-surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)] shadow-[var(--shadow-sm)]">
                    {spotlightAssignment.status}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-[11.5px] text-[var(--color-text-secondary)]">
                  {spotlightAssignment.subject ? <span className="rounded-full bg-[var(--color-bg-surface)] px-3 py-1 shadow-[var(--shadow-sm)]">{spotlightAssignment.subject}</span> : null}
                  {spotlightAssignment.dueAt ? <span className="rounded-full bg-[var(--color-bg-surface)] px-3 py-1 shadow-[var(--shadow-sm)]">Due {formatDate(spotlightAssignment.dueAt)}</span> : null}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-[13px] leading-6 text-[var(--color-text-secondary)]">
                No assignment module items are currently assigned.
              </p>
            )}

            <Link href="/portals/student/assignments" className="btn-secondary mt-5 inline-flex px-4">
              View assignments
            </Link>
          </section>

          <section className="surface-card p-6">
            <SectionHeader title="Latest result" />

            {portal.latestResult ? (
              <div className="mt-4 grid gap-3 text-[13px] leading-6 text-[var(--color-text-secondary)]">
                <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3">
                  <p className="font-semibold text-[var(--color-text-primary)]">
                    {portal.latestResult.session} · {portal.latestResult.term}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Average</p>
                    <p className="mt-1 font-semibold text-[var(--color-text-primary)]">{portal.latestResult.average.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Grade</p>
                    <p className="mt-1 font-semibold text-[var(--color-text-primary)]">{portal.latestResult.grade}</p>
                  </div>
                  <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Position</p>
                    <p className="mt-1 font-semibold text-[var(--color-text-primary)]">{portal.latestResult.position ?? "Not published"}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-[13px] leading-6 text-[var(--color-text-secondary)]">No published result is available yet.</p>
            )}
          </section>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_1.15fr]">
        <section className="surface-card p-6">
          <div className="flex items-center justify-between gap-3">
            <SectionHeader title="Subjects" description="Your current class subjects and assigned teachers." />
            <button
              type="button"
              onClick={() => {
                if (subjectCards[0]) openSubjectPanel(subjectCards[0]);
              }}
              className="btn-secondary px-4"
              disabled={!subjectCards.length}
            >
              Quick view
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {subjectCards.slice(0, 6).map((subject) => (
              <button
                key={`${subject.name}-${subject.teacherName ?? "teacher"}`}
                type="button"
                onClick={() => openSubjectPanel(subject)}
                className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4 text-left transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elevated)]"
              >
                <p className="font-semibold text-[var(--color-text-primary)]">{subject.name}</p>
                <p className="mt-1 text-[12.5px] text-[var(--color-text-secondary)]">{subject.teacherName ?? "Teacher not assigned"}</p>
                <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                  {subject.track ?? subject.departmentName ?? "General"}
                </p>
              </button>
            ))}
            {!subjectCards.length ? (
              <div className="rounded-[10px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-8 text-[13px] text-[var(--color-text-secondary)] sm:col-span-2">
                No subject assignment is visible for your class yet.
              </div>
            ) : null}
          </div>
        </section>

        <section className="surface-card p-6">
          <SectionHeader title="Money and services" description="Keep an eye on fees and the support services tied to your school life." />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-5">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5" style={{ color: "var(--color-warning)" }} />
                <p className="font-semibold text-[var(--color-text-primary)]">Fee status</p>
              </div>
              <p className="mt-4 text-[20px] font-black text-[var(--color-text-primary)]">{formatCurrency(paymentOutstanding)}</p>
              <p className="mt-2 text-[12.5px] leading-6 text-[var(--color-text-secondary)]">
                {nextFeeDue ? `${nextFeeDue.title} is due on ${formatDate(nextFeeDue.dueOn)}.` : "There is no active outstanding invoice."}
              </p>
              <Link href="/portals/student/fees" className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text-accent)] hover:opacity-80">
                Open fees
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>

            <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-5">
              <div className="flex items-center gap-3">
                <Clock3 className="h-5 w-5" style={{ color: "var(--color-text-accent)" }} />
                <p className="font-semibold text-[var(--color-text-primary)]">Attendance watch</p>
              </div>
              <p className="mt-4 text-[20px] font-black text-[var(--color-text-primary)]">{attendanceRate}%</p>
              <p className="mt-2 text-[12.5px] leading-6 text-[var(--color-text-secondary)]">
                {lowAttendanceWarning ?? "Attendance remains within the expected range for this term."}
              </p>
              <Link href="/portals/student/attendance" className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text-accent)] hover:opacity-80">
                Open attendance
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          </div>

          {(Boolean(portal.library?.length) || transportPreview || hostelPreview) ? (
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {portal.library ? (
                <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3 text-[13px]">
                  <p className="inline-flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
                    <Library className="h-4 w-4 text-[var(--color-text-accent)]" />
                    Library
                  </p>
                  <p className="mt-2 text-[var(--color-text-secondary)]">{portal.library.length} active loan(s)</p>
                </div>
              ) : null}
              {transportPreview ? (
                <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3 text-[13px]">
                  <p className="inline-flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
                    <Bus className="h-4 w-4" style={{ color: "var(--color-success)" }} />
                    Transport
                  </p>
                  <p className="mt-2 text-[var(--color-text-secondary)]">{transportPreview.routeName || "Route assigned"}</p>
                </div>
              ) : null}
              {hostelPreview ? (
                <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3 text-[13px]">
                  <p className="inline-flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
                    <BedDouble className="h-4 w-4" style={{ color: "var(--color-warning)" }} />
                    Hostel
                  </p>
                  <p className="mt-2 text-[var(--color-text-secondary)]">{hostelPreview.building} · Room {hostelPreview.room}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <TableCard
          title="Result history"
          description="Your most recent published terms, ready for quick review."
          items={portal.resultHistory.slice(0, 4)}
          emptyState="No result history is available yet."
          columns={[
            {
              key: "term",
              header: "Term",
              render: (item) => (
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{item.session} · {item.term}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Published {formatDate(item.publishedAt)}</p>
                </div>
              ),
            },
            { key: "average", header: "Average", render: (item) => `${item.average.toFixed(1)}%` },
            { key: "grade", header: "Grade", render: (item) => item.grade },
            { key: "position", header: "Position", render: (item) => item.position ?? "-" },
          ]}
          getRowKey={(item) => item.id}
          primaryColumnKey="term"
          featuredColumnKeys={["grade"]}
          actions={
            <Link href="/portals/student/results" className="btn-secondary px-4">
              Open results
            </Link>
          }
        />

        <section className="surface-card p-6">
          <SectionHeader title="School notices" description="Recent communication from the school." />
          <div className="mt-5 grid gap-3">
            {notices.map((notice) => (
              <article key={notice.id} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[var(--color-text-primary)]">{notice.title}</p>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{notice.time}</span>
                </div>
                <p className="mt-2 text-[12.5px] leading-6 text-[var(--color-text-secondary)]">{notice.detail}</p>
              </article>
            ))}
            {!notices.length ? (
              <div className="rounded-[10px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-8 text-[13px] text-[var(--color-text-secondary)]">
                No school notice has been published yet.
              </div>
            ) : null}
          </div>
        </section>
      </section>

      <SidePanel
        open={focusPanelOpen && Boolean(focusSubject)}
        onClose={() => setFocusPanelOpen(false)}
        title={focusSubject?.name ?? "Subject quick view"}
        subtitle={focusSubject ? `${focusSubject.teacherName ?? "Teacher not assigned"} · ${focusSubject.track ?? focusSubject.departmentName ?? "General track"}` : "Preview your current subject context."}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] text-[var(--color-text-muted)]">Use the full pages for complete notes, materials, and results.</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/my-subjects" className="btn-secondary px-4">
                Subjects
              </Link>
              <Link href="/portals/student/results" className="btn-primary px-4">
                Results
              </Link>
            </div>
          </div>
        }
      >
        {focusSubject ? (
          <div className="grid gap-5">
            <section className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-accent)]">Subject focus</p>
              <p className="mt-3 text-[13px] leading-6 text-[var(--color-text-secondary)]">
                {focusSubject.name} is currently handled by <span className="font-semibold text-[var(--color-text-primary)]">{focusSubject.teacherName ?? "the school"}</span>.
              </p>
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile label="Track" value={focusSubject.track ?? focusSubject.departmentName ?? "General"} accent="info" />
              <StatTile label="Class" value={portal.className} accent="good" />
            </div>

            <section className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">How to use this space</p>
              <div className="mt-4 grid gap-3 text-[13px] text-[var(--color-text-secondary)]">
                <p>Check the timetable to see when this subject comes up next.</p>
                <p>Open results to review published performance for this subject.</p>
                <p>Use assignments to track tasks or submissions linked to the subject.</p>
              </div>
            </section>
          </div>
        ) : null}
      </SidePanel>
    </div>
  );
}
