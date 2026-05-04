"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DoorOpen,
  FileCheck2,
  Layers3,
  ListFilter,
  TimerReset,
  TriangleAlert,
} from "lucide-react";

import { SidePanel } from "@/components/ui/side-panel";
import type { PortalTimetableEntry, TeacherPortalView } from "@/lib/domain/types";

type TimetableViewMode = "day" | "week" | "list";
type SupportTab = "today" | "next" | "attention";

function weekdayOrder(day: string) {
  const lookup: Record<string, number> = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 7,
  };
  return lookup[day.trim().toLowerCase()] ?? 99;
}

function normalizeDay(day: string) {
  return day.trim().toLowerCase();
}

function todayName() {
  return new Date().toLocaleDateString("en-NG", { weekday: "long" });
}

function toMinutes(value?: string) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function buildWeekDates(days: string[]) {
  const now = new Date();
  const currentDay = now.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + mondayOffset);

  return new Map(
    days.map((day) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + (weekdayOrder(day) - 1));
      return [normalizeDay(day), date];
    }),
  );
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

function formatTimeLabel(entry: PortalTimetableEntry) {
  return entry.time || [entry.startsAt, entry.endsAt].filter(Boolean).join(" - ");
}

type DecoratedEntry = PortalTimetableEntry & {
  dayDate?: Date;
  temporalState: "past" | "current" | "next" | "upcoming";
  attendanceState: "marked" | "pending" | "overdue" | "future";
};

function entryTone(entry: DecoratedEntry) {
  if (entry.temporalState === "current") {
    return "border-teal-300 bg-teal-50 shadow-[0_22px_44px_rgba(13,148,136,0.16)]";
  }
  if (entry.attendanceState === "overdue") {
    return "border-rose-200 bg-rose-50/80";
  }
  if (entry.attendanceState === "pending") {
    return "border-amber-200 bg-amber-50/80";
  }
  if (entry.temporalState === "past") {
    return "border-slate-200 bg-slate-50/80";
  }
  return "border-slate-200 bg-white";
}

function attendanceTone(state: DecoratedEntry["attendanceState"]) {
  if (state === "marked") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (state === "pending") return "border-amber-200 bg-amber-50 text-amber-700";
  if (state === "overdue") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-500";
}

function temporalLabel(entry: DecoratedEntry) {
  if (entry.temporalState === "current") return "Current period";
  if (entry.temporalState === "next") return "Next up";
  if (entry.temporalState === "past") return "Completed";
  return "Upcoming";
}

function buildAttendanceKey(entry: PortalTimetableEntry, dateKey: string) {
  return `${entry.classId ?? ""}:${entry.subjectId ?? ""}:${dateKey}`;
}

export function TeacherTimetableWorkspace({
  portal,
  canOpenScores = true,
}: {
  portal: TeacherPortalView;
  canOpenScores?: boolean;
}) {
  const [selectedEntry, setSelectedEntry] = useState<DecoratedEntry | null>(null);
  const [viewMode, setViewMode] = useState<TimetableViewMode>("week");
  const [supportTab, setSupportTab] = useState<SupportTab>("today");
  const timetable = portal.weeklyTimetable;
  const attendanceHistory = portal.attendanceHistory ?? [];
  const todaysName = todayName();
  const todayKey = new Date().toISOString().slice(0, 10);
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  const availableDays = useMemo(() => {
    const unique = Array.from(new Set(timetable.map((entry) => entry.day)));
    return unique.sort((left, right) => weekdayOrder(left) - weekdayOrder(right));
  }, [timetable]);

  const [activeDay, setActiveDay] = useState<string>(
    () =>
      availableDays.find((day) => normalizeDay(day) === normalizeDay(todaysName)) ??
      availableDays[0] ??
      "Monday",
  );

  const weekDates = useMemo(() => buildWeekDates(availableDays), [availableDays]);

  const attendanceKeys = useMemo(() => {
    return new Set(
      attendanceHistory.map((record) =>
        `${record.classId}:${record.subjectId ?? ""}:${record.date.slice(0, 10)}`,
      ),
    );
  }, [attendanceHistory]);

  const nextTodayEntryId = useMemo(() => {
    const todayEntries = timetable
      .filter((entry) => normalizeDay(entry.day) === normalizeDay(todaysName))
      .sort((left, right) => (toMinutes(left.startsAt) ?? 0) - (toMinutes(right.startsAt) ?? 0));

    return (
      todayEntries.find((entry) => {
        const start = toMinutes(entry.startsAt);
        return start !== null && start > nowMinutes;
      })?.id ?? null
    );
  }, [nowMinutes, timetable, todaysName]);

  const decoratedEntries = useMemo(() => {
    return timetable.map((entry) => {
      const dayDate = weekDates.get(normalizeDay(entry.day));
      const start = toMinutes(entry.startsAt);
      const end = toMinutes(entry.endsAt);
      const isToday = normalizeDay(entry.day) === normalizeDay(todaysName);
      const temporalState: DecoratedEntry["temporalState"] =
        isToday && start !== null && end !== null && nowMinutes >= start && nowMinutes <= end
          ? "current"
          : entry.id === nextTodayEntryId
            ? "next"
            : isToday && end !== null && end < nowMinutes
              ? "past"
              : weekdayOrder(entry.day) < weekdayOrder(todaysName)
                ? "past"
                : "upcoming";

      const attendanceState: DecoratedEntry["attendanceState"] =
        !dayDate || dayDate.toISOString().slice(0, 10) > todayKey
          ? "future"
          : attendanceKeys.has(buildAttendanceKey(entry, dayDate.toISOString().slice(0, 10)))
            ? "marked"
            : temporalState === "past" || temporalState === "current"
              ? temporalState === "past"
                ? "overdue"
                : "pending"
              : "future";

      return {
        ...entry,
        dayDate,
        temporalState,
        attendanceState,
      };
    });
  }, [attendanceKeys, nextTodayEntryId, nowMinutes, timetable, todayKey, todaysName, weekDates]);

  const entriesByDay = useMemo(() => {
    const grouped = new Map<string, DecoratedEntry[]>();
    for (const day of availableDays) grouped.set(day, []);
    for (const entry of decoratedEntries) {
      const bucket = grouped.get(entry.day) ?? [];
      bucket.push(entry);
      grouped.set(entry.day, bucket);
    }
    for (const [day, entries] of grouped.entries()) {
      grouped.set(
        day,
        entries.sort(
          (left, right) => (toMinutes(left.startsAt) ?? 0) - (toMinutes(right.startsAt) ?? 0),
        ),
      );
    }
    return grouped;
  }, [availableDays, decoratedEntries]);

  const activeEntries = entriesByDay.get(activeDay) ?? [];
  const todaysEntries = entriesByDay.get(
    availableDays.find((day) => normalizeDay(day) === normalizeDay(todaysName)) ?? activeDay,
  ) ?? [];
  const nextUp = todaysEntries.find((entry) => entry.temporalState === "current" || entry.temporalState === "next") ?? todaysEntries[0] ?? null;

  const summary = useMemo(() => {
    const total = todaysEntries.length;
    const marked = todaysEntries.filter((entry) => entry.attendanceState === "marked").length;
    const pending = todaysEntries.filter((entry) => entry.attendanceState === "pending").length;
    const overdue = todaysEntries.filter((entry) => entry.attendanceState === "overdue").length;
    return { total, marked, pending, overdue };
  }, [todaysEntries]);

  const subjectCount = useMemo(
    () => new Set(portal.assignedClasses.map((item) => item.subjectId).filter(Boolean)).size,
    [portal.assignedClasses],
  );

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-[rgba(18,33,23,0.12)] bg-gradient-to-br from-[#0f1d15] via-[#17382c] to-[#1c6a5b] p-6 text-white shadow-panel">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-white/12 blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <Link href="/portals/teacher" className="inline-flex items-center gap-2 text-sm font-semibold text-white/95">
              <ArrowLeft className="h-4 w-4" />
              Back to teacher portal
            </Link>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/88">
              Teaching workspace
            </p>
            <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-black tracking-tight text-white">
              My timetable
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/95">
              Work from a live teaching board, not a dead schedule. See what is happening now,
              what is next, and which periods still need attendance before the day gets away from
              you.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-[1.5rem] border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/88">
                Today
              </p>
              <p className="mt-2 text-3xl font-black">{summary.total}</p>
              <p className="mt-1 text-xs text-white/95">Scheduled periods</p>
            </article>
            <article className="rounded-[1.5rem] border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/88">
                Marked
              </p>
              <p className="mt-2 text-3xl font-black">{summary.marked}</p>
              <p className="mt-1 text-xs text-white/95">Attendance completed</p>
            </article>
            <article className="rounded-[1.5rem] border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/88">
                Subjects
              </p>
              <p className="mt-2 text-3xl font-black">{subjectCount}</p>
              <p className="mt-1 text-xs text-white/95">Teaching lanes</p>
            </article>
          </div>
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="min-w-0 rounded-[2rem] border border-white/60 bg-white/92 p-5 shadow-panel">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary-700" />
                <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">
                  Live timetable
                </h2>
              </div>
              <p className="mt-2 text-sm text-ink/60">
                {todaysName} is highlighted automatically, and overdue attendance stays visible
                until it is resolved.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {([
                { id: "day", label: "Day", icon: Clock3 },
                { id: "week", label: "Week", icon: Layers3 },
                { id: "list", label: "List", icon: ListFilter },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setViewMode(id)}
                  className={
                    viewMode === id
                      ? "inline-flex h-10 items-center gap-2 rounded-full bg-[rgb(18,33,23)] px-4 text-sm font-semibold text-white"
                      : "inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-800"
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {availableDays.map((day) => {
              const active = day === activeDay;
              const dayDate = weekDates.get(normalizeDay(day));
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setActiveDay(day);
                    if (viewMode === "week") setViewMode("day");
                  }}
                  className={
                    active
                      ? "inline-flex min-w-[112px] flex-col rounded-[1.35rem] bg-brand-700 px-4 py-3 text-left text-white shadow-sm"
                      : "inline-flex min-w-[112px] flex-col rounded-[1.35rem] border border-slate-200 bg-white px-4 py-3 text-left text-slate-700 transition hover:border-primary-200 hover:bg-primary-50"
                  }
                >
                  <span className="text-sm font-bold">{day.slice(0, 3)}</span>
                  <span className={active ? "mt-1 text-xs text-white/70" : "mt-1 text-xs text-slate-500"}>
                    {dayDate ? formatDate(dayDate) : "This week"}
                  </span>
                </button>
              );
            })}
          </div>

          {viewMode === "week" ? (
            <div className="mt-5 grid gap-4 xl:grid-cols-5">
              {availableDays.map((day) => {
                const entries = entriesByDay.get(day) ?? [];
                const isToday = normalizeDay(day) === normalizeDay(todaysName);
                return (
                  <section
                    key={day}
                    className={`rounded-[1.6rem] border p-4 ${isToday ? "border-primary-200 bg-primary-50/50" : "border-slate-100 bg-slate-50/50"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{day}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDate(weekDates.get(normalizeDay(day)) ?? new Date())}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500">
                        {entries.length}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3">
                      {entries.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-5 text-center text-xs text-slate-500">
                          Free day
                        </div>
                      ) : (
                        entries.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => setSelectedEntry(entry)}
                            className={`rounded-[1.25rem] border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${entryTone(entry)}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                  {formatTimeLabel(entry)}
                                </p>
                                <p className="mt-2 text-sm font-bold text-slate-900">{entry.subject}</p>
                                <p className="mt-1 text-xs text-slate-600">
                                  {entry.className ?? "Assigned class"} · {entry.venue}
                                </p>
                              </div>
                              {entry.temporalState === "current" ? (
                                <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-teal-500 shadow-[0_0_0_6px_rgba(20,184,166,0.14)]" />
                              ) : null}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${attendanceTone(entry.attendanceState)}`}>
                                {entry.attendanceState === "marked"
                                  ? "Attendance marked"
                                  : entry.attendanceState === "pending"
                                    ? "Attendance pending"
                                    : entry.attendanceState === "overdue"
                                      ? "Attendance overdue"
                                      : "Scheduled"}
                              </span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : viewMode === "day" ? (
            <div className="mt-5 grid gap-3">
              {activeEntries.length === 0 ? (
                <div className="grid place-items-center rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50 py-16 text-center">
                  <div>
                    <p className="text-base font-semibold text-slate-900">No periods on this day</p>
                    <p className="mt-2 text-sm text-slate-500">
                      Switch to another day to review lessons and attendance status.
                    </p>
                  </div>
                </div>
              ) : (
                activeEntries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedEntry(entry)}
                    className={`rounded-[1.6rem] border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${entryTone(entry)}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-sm font-black text-primary-700 shadow-sm">
                          {entry.startsAt ? entry.startsAt.slice(0, 2) : "--"}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900">{entry.subject}</p>
                            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500">
                              {temporalLabel(entry)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">
                            {entry.className ?? "Assigned class"} · {formatTimeLabel(entry)}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">{entry.venue}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${attendanceTone(entry.attendanceState)}`}>
                          {entry.attendanceState === "marked"
                            ? "Marked"
                            : entry.attendanceState === "pending"
                              ? "Pending"
                              : entry.attendanceState === "overdue"
                                ? "Overdue"
                                : "Upcoming"}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-100">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Day", "Time", "Subject", "Class", "Room", "Attendance"].map((heading) => (
                        <th
                          key={heading}
                          className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {decoratedEntries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="cursor-pointer transition hover:bg-primary-50/50"
                        onClick={() => setSelectedEntry(entry)}
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900">{entry.day}</td>
                        <td className="px-4 py-3 text-slate-600">{formatTimeLabel(entry)}</td>
                        <td className="px-4 py-3 text-slate-900">{entry.subject}</td>
                        <td className="px-4 py-3 text-slate-600">{entry.className ?? "Assigned class"}</td>
                        <td className="px-4 py-3 text-slate-600">{entry.venue}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${attendanceTone(entry.attendanceState)}`}>
                            {entry.attendanceState === "marked"
                              ? "Marked"
                              : entry.attendanceState === "pending"
                                ? "Pending"
                                : entry.attendanceState === "overdue"
                                  ? "Overdue"
                                  : "Upcoming"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </article>

        <aside className="grid gap-4 2xl:sticky 2xl:top-24 2xl:self-start">
          <section className="rounded-[2rem] border border-white/60 bg-white/92 p-5 shadow-panel">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <TimerReset className="h-4 w-4 text-emerald-600" />
                <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">
                  Teaching companion
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  { id: "today", label: "Today strip" },
                  { id: "next", label: "Next up" },
                  { id: "attention", label: "Attention" },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSupportTab(tab.id)}
                    className={
                      supportTab === tab.id
                        ? "inline-flex h-10 items-center rounded-full bg-[rgb(18,33,23)] px-4 text-sm font-semibold text-white"
                        : "inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-800"
                    }
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {supportTab === "today" ? (
              <div className="mt-4 grid max-h-[30rem] gap-3 overflow-y-auto pr-1">
                {todaysEntries.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-500">
                    No periods scheduled for today.
                  </div>
                ) : (
                  todaysEntries.map((entry) => (
                    <button
                      key={`today-${entry.id}`}
                      type="button"
                      onClick={() => setSelectedEntry(entry)}
                      className={`rounded-[1.35rem] border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${entryTone(entry)}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {formatTimeLabel(entry)}
                          </p>
                          <p className="mt-2 font-semibold text-slate-900">{entry.subject}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {entry.className ?? "Assigned class"} · {entry.venue}
                          </p>
                        </div>
                        {entry.temporalState === "current" ? (
                          <span className="rounded-full bg-teal-500 px-2.5 py-1 text-[10px] font-bold text-white">
                            NOW
                          </span>
                        ) : null}
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : null}

            {supportTab === "next" ? (
              <div className="mt-4">
                {nextUp ? (
                  <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Next live context
                    </p>
                    <p className="mt-3 text-lg font-bold text-slate-900">{nextUp.subject}</p>
                    <p className="mt-1 text-sm text-slate-600">{nextUp.className ?? "Assigned class"}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {nextUp.day} · {formatTimeLabel(nextUp)} · {nextUp.venue}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        href={`/portals/teacher/attendance?classId=${nextUp.classId ?? ""}&subjectId=${nextUp.subjectId ?? ""}`}
                        className="btn-primary px-4"
                      >
                        Mark attendance
                      </Link>
                      <button
                        type="button"
                        onClick={() => setSelectedEntry(nextUp)}
                        className="btn-secondary px-4"
                      >
                        Open period
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">Your teaching board is clear right now.</p>
                )}
              </div>
            ) : null}

            {supportTab === "attention" ? (
              <div className="mt-4 grid gap-3">
                <div className="rounded-[1.35rem] border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <p className="text-sm font-semibold text-emerald-900">Marked today</p>
                  </div>
                  <p className="mt-2 text-2xl font-black text-emerald-900">{summary.marked}</p>
                </div>
                <div className="rounded-[1.35rem] border border-amber-100 bg-amber-50/70 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <TriangleAlert className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-semibold text-amber-900">Pending now</p>
                  </div>
                  <p className="mt-2 text-2xl font-black text-amber-900">{summary.pending}</p>
                </div>
                <div className="rounded-[1.35rem] border border-rose-100 bg-rose-50/70 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <TriangleAlert className="h-4 w-4 text-rose-600" />
                    <p className="text-sm font-semibold text-rose-900">Overdue</p>
                  </div>
                  <p className="mt-2 text-2xl font-black text-rose-900">{summary.overdue}</p>
                </div>
              </div>
            ) : null}
          </section>
        </aside>
      </section>

      <SidePanel
        open={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
        title={selectedEntry?.subject ?? "Teaching period"}
        subtitle={
          selectedEntry
            ? `${selectedEntry.day} · ${formatTimeLabel(selectedEntry)} · ${selectedEntry.className ?? "Assigned class"}`
            : undefined
        }
        size="md"
        footer={
          selectedEntry ? (
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Link
                href={`/portals/teacher/attendance?classId=${selectedEntry.classId ?? ""}&subjectId=${selectedEntry.subjectId ?? ""}`}
                className="btn-secondary px-5"
              >
                Attendance
              </Link>
              {canOpenScores ? (
                <Link href="/portals/teacher/gradebook" className="btn-primary px-5">
                  Gradebook
                </Link>
              ) : null}
            </div>
          ) : null
        }
      >
        {selectedEntry ? (
          <div className="grid gap-5">
            <div className="rounded-[1.5rem] border border-primary-100 bg-primary-50/70 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-700">
                Period context
              </p>
              <div className="mt-3 grid gap-3 text-sm text-slate-700">
                <p className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary-600" />
                  {selectedEntry.day}
                  {selectedEntry.dayDate ? ` · ${formatDate(selectedEntry.dayDate)}` : ""}
                </p>
                <p className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-emerald-600" />
                  {formatTimeLabel(selectedEntry)}
                </p>
                <p className="inline-flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-violet-600" />
                  {selectedEntry.subject}
                </p>
                <p className="inline-flex items-center gap-2">
                  <DoorOpen className="h-4 w-4 text-amber-600" />
                  {selectedEntry.venue}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.4rem] border border-slate-100 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Teaching lane
                </p>
                <p className="mt-2 font-semibold text-slate-900">
                  {selectedEntry.className ?? "Assigned class"}
                </p>
                <p className="mt-1 text-sm text-slate-500">{temporalLabel(selectedEntry)}</p>
              </div>
              <div className="rounded-[1.4rem] border border-slate-100 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Attendance
                </p>
                <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${attendanceTone(selectedEntry.attendanceState)}`}>
                  {selectedEntry.attendanceState === "marked"
                    ? "Attendance marked"
                    : selectedEntry.attendanceState === "pending"
                      ? "Attendance pending"
                      : selectedEntry.attendanceState === "overdue"
                        ? "Attendance overdue"
                        : "Upcoming"}
                </span>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/80 p-5">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-semibold text-slate-900">Teacher actions</p>
              </div>
              <div className="mt-4 grid gap-3">
                <Link
                  href={`/portals/teacher/attendance?classId=${selectedEntry.classId ?? ""}&subjectId=${selectedEntry.subjectId ?? ""}`}
                  className="flex items-center justify-between rounded-[1.2rem] border border-white bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-primary-200 hover:bg-primary-50"
                >
                  Mark attendance for this period
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
                <Link
                  href="/portals/teacher/content/lesson-notes/planning"
                  className="flex items-center justify-between rounded-[1.2rem] border border-white bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-primary-200 hover:bg-primary-50"
                >
                  Open lesson notes
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
                {canOpenScores ? (
                  <Link
                    href="/portals/teacher/gradebook"
                    className="flex items-center justify-between rounded-[1.2rem] border border-white bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-primary-200 hover:bg-primary-50"
                  >
                    Open gradebook
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </SidePanel>
    </div>
  );
}
