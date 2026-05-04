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

function DashboardCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-[2rem] border border-white/60 bg-white/90 shadow-panel backdrop-blur ${className}`}>
      {children}
    </section>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h2 className="font-[var(--font-heading)] text-2xl font-bold tracking-tight text-ink">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-ink/62">{description}</p> : null}
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "emerald" | "sky" | "amber" | "violet";
}) {
  const tone =
    accent === "emerald"
      ? "from-emerald-50 to-emerald-100/70 text-emerald-900 border-emerald-100"
      : accent === "sky"
        ? "from-sky-50 to-sky-100/70 text-sky-900 border-sky-100"
        : accent === "amber"
          ? "from-amber-50 to-amber-100/70 text-amber-900 border-amber-100"
          : "from-violet-50 to-violet-100/70 text-violet-900 border-violet-100";

  return (
    <article className={`rounded-[1.5rem] border bg-gradient-to-br p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
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
    <div className="grid gap-6 xl:gap-7">
      <DashboardCard>
        <div className="relative overflow-hidden border-b border-ink/5 bg-gradient-to-br from-primary-950 via-primary-900 to-primary-700 p-6 text-white md:p-7">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative grid gap-6 xl:grid-cols-[1.2fr_0.85fr]">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-white/65">Student command center</p>
              <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-black tracking-tight text-white">
                {portal.headline}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/72">
                {portal.studentName} can see today’s learning plan, subjects, attendance, assignments, fees, announcements, and published results from one focused student workspace.
              </p>

              <div className="mt-6 grid gap-3 text-sm text-white/78 md:grid-cols-2 xl:grid-cols-4">
                {[
                  `Class: ${portal.className}`,
                  `Admission no: ${portal.admissionNumber ?? "Not recorded"}`,
                  `Session: ${portal.session ?? "Current"}`,
                  `Term: ${portal.term ?? "Current"}`,
                ].map((line, index) => (
                  <p
                    key={line}
                    className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 shadow-sm motion-safe:animate-[fade-up_420ms_ease-out_both]"
                    style={{ animationDelay: `${index * 70}ms` }}
                  >
                    {line}
                  </p>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/15 bg-white/10 p-5 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">Today focus</p>
                  <h2 className="mt-2 text-2xl font-black text-white">
                    {currentFocusEntry?.subject ?? "No class scheduled"}
                  </h2>
                  <p className="mt-2 text-sm text-white/72">
                    {currentFocusEntry
                      ? `${currentFocusEntry.day} · ${currentFocusEntry.time} · ${currentFocusEntry.venue}`
                      : "Your school timetable has not been published yet."}
                  </p>
                </div>
                <ActionMenu triggerLabel="Student quick actions" panelClassName="bg-white">
                  <ActionMenuLink href="/portals/student/timetable">Open timetable</ActionMenuLink>
                  <ActionMenuLink href="/portals/student/assignments">View assignments</ActionMenuLink>
                  <ActionMenuLink href="/portals/student/results">View results</ActionMenuLink>
                </ActionMenu>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.35rem] border border-white/15 bg-black/10 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Attendance</p>
                  <p className="mt-2 text-2xl font-black text-white">{attendanceRate}%</p>
                  <p className="mt-2 text-xs text-white/65">{lowAttendanceWarning ?? "Attendance remains within the expected range."}</p>
                </div>
                <div className="rounded-[1.35rem] border border-white/15 bg-black/10 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Outstanding fees</p>
                  <p className="mt-2 text-2xl font-black text-white">{formatCurrency(paymentOutstanding)}</p>
                  <p className="mt-2 text-xs text-white/65">
                    {nextFeeDue ? `${nextFeeDue.title} due ${formatDate(nextFeeDue.dueOn)}` : "No outstanding invoice due right now."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-7">
          <div className="grid gap-4 md:grid-cols-4">
            {portal.stats.slice(0, 4).map((stat, index) => (
              <StatTile
                key={stat.label}
                label={stat.label}
                value={stat.value}
                accent={index === 0 ? "emerald" : index === 1 ? "sky" : index === 2 ? "amber" : "violet"}
              />
            ))}
          </div>
        </div>
      </DashboardCard>

      <section className="rounded-[1.75rem] border border-white/65 bg-white/90 p-4 shadow-panel">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          {[
            { label: "Timetable", href: "/portals/student/timetable", icon: CalendarDays },
            { label: "Subjects", href: "/my-subjects", icon: BookOpen },
            { label: "Assignments", href: "/portals/student/assignments", icon: ClipboardList },
            { label: "Results", href: "/portals/student/results", icon: Trophy },
            { label: "Fees", href: "/portals/student/fees", icon: CreditCard },
            { label: "Notices", href: "/portals/student/announcements", icon: Megaphone },
          ].map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href as Route}
                className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:bg-primary-50"
                style={{ animationDelay: `${index * 60}ms` }}
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

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <DashboardCard>
          <div className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionHeader
                title="This week at a glance"
                description="Switch days without leaving the dashboard. Focus on one schedule lane at a time."
              />
              <Link href="/portals/student/timetable" className="inline-flex items-center gap-2 text-sm font-semibold text-primary-800 transition hover:text-primary-700">
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
                    "rounded-full px-4 py-2 text-sm font-semibold transition duration-200",
                    activeDay === day
                      ? "bg-primary-900 text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-primary-50 hover:text-primary-800",
                  ].join(" ")}
                >
                  {prettyDay(day)}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-3">
              {daySchedule.length ? (
                daySchedule.map((entry, index) => (
                  <article
                    key={`${entry.day}-${entry.time}-${entry.subject}`}
                    className="group rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary-100 hover:shadow-md"
                    style={{ animationDelay: `${index * 70}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{entry.subject}</p>
                        <p className="mt-1 text-sm text-slate-600">{entry.teacherName} · {entry.venue}</p>
                      </div>
                      <span className="rounded-full bg-primary-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-800">
                        {entry.time}
                      </span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                  No timetable entry is available for {prettyDay(activeDay)}.
                </div>
              )}
            </div>
          </div>
        </DashboardCard>

        <div className="grid gap-6">
          <DashboardCard>
            <div className="p-6">
              <SectionHeader title="Learning tasks" description="See the next thing that needs your attention." />
              {spotlightAssignment ? (
                <div className="mt-5 rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{spotlightAssignment.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{spotlightAssignment.description ?? "Assignment details are available in your full assignments page."}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-sm">
                      {spotlightAssignment.status}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                    {spotlightAssignment.subject ? <span className="rounded-full bg-white px-3 py-1 shadow-sm">{spotlightAssignment.subject}</span> : null}
                    {spotlightAssignment.dueAt ? <span className="rounded-full bg-white px-3 py-1 shadow-sm">Due {formatDate(spotlightAssignment.dueAt)}</span> : null}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-ink/65">
                  No assignment module items are currently assigned.
                </p>
              )}

              <Link href="/portals/student/assignments" className="btn-secondary mt-5 inline-flex px-4">
                View assignments
              </Link>
            </div>
          </DashboardCard>

          <DashboardCard>
            <div className="p-6">
              <SectionHeader title="Latest result" />

              {portal.latestResult ? (
                <div className="mt-4 grid gap-3 text-sm leading-6 text-ink/72">
                  <div className="rounded-2xl border border-ink/8 bg-sand/45 px-4 py-3">
                    <p className="font-semibold text-ink">
                      {portal.latestResult.session} · {portal.latestResult.term}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-ink/8 bg-white px-4 py-3 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Average</p>
                      <p className="mt-1 font-semibold text-ink">{portal.latestResult.average.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-2xl border border-ink/8 bg-white px-4 py-3 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Grade</p>
                      <p className="mt-1 font-semibold text-ink">{portal.latestResult.grade}</p>
                    </div>
                    <div className="rounded-2xl border border-ink/8 bg-white px-4 py-3 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Position</p>
                      <p className="mt-1 font-semibold text-ink">{portal.latestResult.position ?? "Not published"}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-ink/65">No published result is available yet.</p>
              )}
            </div>
          </DashboardCard>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_1.15fr]">
        <DashboardCard>
          <div className="p-6">
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
              {subjectCards.slice(0, 6).map((subject, index) => (
                <button
                  key={`${subject.name}-${subject.teacherName ?? "teacher"}`}
                  type="button"
                  onClick={() => openSubjectPanel(subject)}
                  className="rounded-[1.5rem] border border-slate-100 bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary-100 hover:shadow-md"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <p className="font-semibold text-slate-900">{subject.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{subject.teacherName ?? "Teacher not assigned"}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
                    {subject.track ?? subject.departmentName ?? "General"}
                  </p>
                </button>
              ))}
              {!subjectCards.length ? (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500 sm:col-span-2">
                  No subject assignment is visible for your class yet.
                </div>
              ) : null}
            </div>
          </div>
        </DashboardCard>

        <DashboardCard>
          <div className="p-6">
            <SectionHeader title="Money and services" description="Keep an eye on fees and the support services tied to your school life." />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <article className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-5">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-amber-600" />
                  <p className="font-semibold text-slate-900">Fee status</p>
                </div>
                <p className="mt-4 text-2xl font-black text-slate-900">{formatCurrency(paymentOutstanding)}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {nextFeeDue ? `${nextFeeDue.title} is due on ${formatDate(nextFeeDue.dueOn)}.` : "There is no active outstanding invoice."}
                </p>
                <Link href="/portals/student/fees" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-800 hover:text-primary-700">
                  Open fees
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>

              <article className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-5">
                <div className="flex items-center gap-3">
                  <Clock3 className="h-5 w-5 text-sky-600" />
                  <p className="font-semibold text-slate-900">Attendance watch</p>
                </div>
                <p className="mt-4 text-2xl font-black text-slate-900">{attendanceRate}%</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {lowAttendanceWarning ?? "Attendance remains within the expected range for this term."}
                </p>
                <Link href="/portals/student/attendance" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-800 hover:text-primary-700">
                  Open attendance
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            </div>

            {(Boolean(portal.library?.length) || transportPreview || hostelPreview) ? (
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {portal.library ? (
                  <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm shadow-sm">
                    <p className="inline-flex items-center gap-2 font-semibold text-slate-900">
                      <Library className="h-4 w-4 text-violet-600" />
                      Library
                    </p>
                    <p className="mt-2 text-slate-600">{portal.library.length} active loan(s)</p>
                  </div>
                ) : null}
                {transportPreview ? (
                  <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm shadow-sm">
                    <p className="inline-flex items-center gap-2 font-semibold text-slate-900">
                      <Bus className="h-4 w-4 text-emerald-600" />
                      Transport
                    </p>
                    <p className="mt-2 text-slate-600">{transportPreview.routeName || "Route assigned"}</p>
                  </div>
                ) : null}
                {hostelPreview ? (
                  <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm shadow-sm">
                    <p className="inline-flex items-center gap-2 font-semibold text-slate-900">
                      <BedDouble className="h-4 w-4 text-amber-600" />
                      Hostel
                    </p>
                    <p className="mt-2 text-slate-600">{hostelPreview.building} · Room {hostelPreview.room}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </DashboardCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
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
                  <p className="font-semibold text-ink">{item.session} · {item.term}</p>
                  <p className="text-xs text-ink/55">Published {formatDate(item.publishedAt)}</p>
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

        <DashboardCard>
          <div className="p-6">
            <SectionHeader title="School notices" description="Recent communication from the school." />
            <div className="mt-5 grid gap-3">
              {notices.map((notice, index) => (
                <article
                  key={notice.id}
                  className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-sm"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{notice.title}</p>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{notice.time}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{notice.detail}</p>
                </article>
              ))}
              {!notices.length ? (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                  No school notice has been published yet.
                </div>
              ) : null}
            </div>
          </div>
        </DashboardCard>
      </section>

      <SidePanel
        open={focusPanelOpen && Boolean(focusSubject)}
        onClose={() => setFocusPanelOpen(false)}
        title={focusSubject?.name ?? "Subject quick view"}
        subtitle={focusSubject ? `${focusSubject.teacherName ?? "Teacher not assigned"} · ${focusSubject.track ?? focusSubject.departmentName ?? "General track"}` : "Preview your current subject context."}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] text-slate-500">Use the full pages for complete notes, materials, and results.</p>
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
            <section className="rounded-[1.5rem] border border-primary-100 bg-primary-50/70 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-700">Subject focus</p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {focusSubject.name} is currently handled by <span className="font-semibold text-slate-900">{focusSubject.teacherName ?? "the school"}</span>.
              </p>
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile label="Track" value={focusSubject.track ?? focusSubject.departmentName ?? "General"} accent="sky" />
              <StatTile label="Class" value={portal.className} accent="emerald" />
            </div>

            <section className="rounded-[1.5rem] border border-slate-100 bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">How to use this space</p>
              <div className="mt-4 grid gap-3 text-sm text-slate-600">
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
