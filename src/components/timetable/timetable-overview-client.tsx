"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Calendar, CheckCircle2, Clock, Search, Send, User, Zap } from "lucide-react";

import { CanDo, usePermissions } from "@/components/auth/permission-provider";
import { cn } from "@/lib/utils/cn";
import { apiJson, formatTime } from "./api";

type Status = "published" | "draft" | "empty" | "structure_only";
type TimetableClass = {
  id: string;
  name: string;
  shortName: string;
  short_name: string;
  level: string;
  category: string;
  arm?: string | null;
  classTeacherName?: string | null;
  class_teacher_name?: string | null;
  totalSlots: number;
  total_slots: number;
  lessonSlots?: number;
  lesson_slots?: number;
  publishedSlots: number;
  published_slots: number;
  filledSlots: number;
  filled_slots: number;
  setupStatus: Status;
  setup_status: Status;
};

type OverviewPayload = {
  data: Record<string, TimetableClass[]>;
  meta: {
    totalClasses: number;
    total_classes: number;
    publishedClasses: number;
    published_classes: number;
    emptyClasses: number;
    empty_classes: number;
  };
};

type ConflictResult = {
  data: Array<{
    teacher_name: string | null;
    day_of_week: number;
    period_number: number;
    start_time: string;
    end_time: string;
    class_1: string;
    subject_1: string;
    class_2: string;
    subject_2: string;
  }>;
  conflict_count: number;
};

const categories = ["Early Years", "Primary", "Junior Secondary", "Senior Secondary", "Other"];
const categoryConfig: Record<string, { gradient: string; chip: string }> = {
  "Early Years": { gradient: "from-violet-500 via-fuchsia-500 to-purple-600", chip: "bg-violet-50 text-violet-800 border-violet-200" },
  Primary: { gradient: "from-blue-500 via-sky-500 to-indigo-600", chip: "bg-blue-50 text-blue-800 border-blue-200" },
  "Junior Secondary": { gradient: "from-teal-500 via-emerald-500 to-green-600", chip: "bg-teal-50 text-teal-800 border-teal-200" },
  "Senior Secondary": { gradient: "from-orange-500 via-amber-500 to-red-600", chip: "bg-orange-50 text-orange-800 border-orange-200" },
  Other: { gradient: "from-slate-500 via-slate-600 to-ink", chip: "bg-slate-50 text-slate-700 border-slate-200" },
};

const statusConfig = {
  published: { label: "Published", icon: CheckCircle2, badge: "bg-emerald-50 text-emerald-700 border-emerald-200", bar: "bg-emerald-500" },
  draft: { label: "Draft", icon: Clock, badge: "bg-amber-50 text-amber-700 border-amber-200", bar: "bg-amber-500" },
  empty: { label: "Not Set Up", icon: AlertCircle, badge: "bg-slate-50 text-slate-600 border-slate-200", bar: "bg-slate-400" },
  structure_only: { label: "Needs Subjects", icon: AlertCircle, badge: "bg-rose-50 text-rose-700 border-rose-200", bar: "bg-rose-400" },
};

function StatCard({ label, value, tone, icon: Icon }: { label: string; value: number; tone: string; icon: typeof Calendar }) {
  return (
    <div className="rounded-[1.5rem] border border-white/65 bg-white/85 p-4 shadow-[0_16px_40px_rgba(18,33,23,0.06)]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-ink/42">{label}</span>
        <span className={cn("rounded-2xl p-2", tone)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 font-[var(--font-heading)] text-3xl font-black text-ink">{value}</p>
    </div>
  );
}

function ClassCard({ classItem, onOpen }: { classItem: TimetableClass; onOpen: () => void }) {
  const status = statusConfig[classItem.setupStatus ?? classItem.setup_status] ?? statusConfig.empty;
  const StatusIcon = status.icon;
  const totalSlots = classItem.lessonSlots ?? classItem.lesson_slots ?? classItem.totalSlots ?? classItem.total_slots ?? 0;
  const filledSlots = classItem.filledSlots ?? classItem.filled_slots ?? 0;
  const fillPercent = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
  const config = categoryConfig[classItem.category] ?? categoryConfig.Primary;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/88 text-left shadow-[0_14px_36px_rgba(18,33,23,0.06)] transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-panel"
    >
      <div className={cn("h-1.5 bg-gradient-to-r", config.gradient)} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-black text-ink transition group-hover:text-brand-800">{classItem.name}</p>
            <p className="mt-1 text-xs font-medium text-ink/45">{classItem.level} · {classItem.arm ?? "Class arm"}</p>
          </div>
          <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[0.65rem] font-black", status.badge)}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </span>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-sand/60 px-3 py-2 text-xs text-ink/62">
          <User className="h-3.5 w-3.5 text-ink/35" />
          <span className="truncate">{classItem.classTeacherName ?? classItem.class_teacher_name ?? "No form teacher assigned"}</span>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs font-semibold text-ink/50">
            <span>Slots filled</span>
            <span>{filledSlots}/{totalSlots}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/8">
            <span className={cn("block h-full rounded-full transition-all", fillPercent >= 100 ? "bg-emerald-500" : fillPercent >= 50 ? "bg-amber-500" : "bg-rose-400")} style={{ width: `${fillPercent}%` }} />
          </div>
        </div>
      </div>
    </button>
  );
}

function ConflictChecker() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConflictResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      setResult(await apiJson<ConflictResult>("/api/v1/timetable/conflicts/check"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to check conflicts.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={check} className="inline-flex h-11 items-center gap-2 rounded-full border border-ink/10 bg-white/80 px-4 text-sm font-semibold text-ink/70 transition hover:bg-white">
        <Zap className="h-4 w-4" />
        Check Conflicts
      </button>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_30px_90px_rgba(18,33,23,0.28)]">
            <div className="flex items-start justify-between border-b border-ink/8 bg-sand/50 px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-700">Timetable audit</p>
                <h2 className="mt-2 font-[var(--font-heading)] text-3xl font-black text-ink">Teacher Conflicts</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full px-4 py-2 text-sm font-semibold text-ink/58 hover:bg-white">Close</button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-6">
              {loading ? <p className="text-sm text-ink/55">Checking every teacher against every class period...</p> : null}
              {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p> : null}
              {!loading && result && result.conflict_count === 0 ? (
                <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-8 text-center text-emerald-800">
                  <CheckCircle2 className="mx-auto h-9 w-9" />
                  <p className="mt-3 font-bold">No timetable conflicts found.</p>
                </div>
              ) : null}
              {!loading && result && result.conflict_count > 0 ? (
                <div className="grid gap-3">
                  {result.data.map((conflict, index) => (
                    <div key={`${conflict.teacher_name}-${index}`} className="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-4">
                      <p className="font-bold text-rose-900">{conflict.teacher_name ?? "Teacher"}</p>
                      <p className="mt-1 text-xs font-semibold text-rose-700">
                        {dayNames[conflict.day_of_week]} · Period {conflict.period_number} · {formatTime(conflict.start_time)} - {formatTime(conflict.end_time)}
                      </p>
                      <p className="mt-3 text-sm text-rose-800">{conflict.class_1}: {conflict.subject_1} vs {conflict.class_2}: {conflict.subject_2}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function PublishAll({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(false);

  async function publish(action: "publish" | "unpublish") {
    setLoading(true);
    try {
      await apiJson("/api/v1/timetable/publish-all", { method: "POST", body: JSON.stringify({ action }) });
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" disabled={loading} onClick={() => publish("unpublish")} className="h-11 rounded-full border border-ink/10 bg-white/80 px-4 text-sm font-semibold text-ink/65 transition hover:bg-white disabled:opacity-50">
        Unpublish All
      </button>
      <button type="button" disabled={loading} onClick={() => publish("publish")} className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(18,33,23,0.18)] transition hover:bg-brand-800 disabled:opacity-50">
        <Send className="h-4 w-4" />
        {loading ? "Publishing..." : "Publish All"}
      </button>
    </div>
  );
}

export function TimetableOverviewClient() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [payload, setPayload] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const canViewAll = hasPermission("timetable.view_all");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setPayload(await apiJson<OverviewPayload>("/api/v1/timetable/classes"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load timetables.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const allClasses = useMemo(() => Object.values(payload?.data ?? {}).flat(), [payload]);
  const filteredData = useMemo(() => {
    const grouped = payload?.data ?? {};
    return categories
      .filter((item) => !category || item === category)
      .map((item) => {
        const classes = (grouped[item] ?? []).filter((classItem) => {
          const matchesSearch = !search || `${classItem.name} ${classItem.level} ${classItem.arm ?? ""}`.toLowerCase().includes(search.toLowerCase());
          const matchesStatus = !status || (classItem.setupStatus ?? classItem.setup_status) === status;
          return matchesSearch && matchesStatus;
        });
        return [item, classes] as const;
      })
      .filter(([, classes]) => classes.length > 0);
  }, [payload, search, category, status]);

  const published = allClasses.filter((item) => (item.setupStatus ?? item.setup_status) === "published").length;
  const empty = allClasses.filter((item) => ["empty", "structure_only"].includes(item.setupStatus ?? item.setup_status)).length;

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/65 bg-white/88 shadow-panel backdrop-blur-xl">
        <div className="h-2 bg-gradient-to-r from-brand-700 via-amber to-ink" />
        <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-700">Academic planning</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-black tracking-tight text-ink">Timetable</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/62">
              Build weekly class timetables for Nigerian school arms, enforce teacher clashes, and publish approved schedules to teachers, students, and parents.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CanDo permission="timetable.view_all">
              <ConflictChecker />
            </CanDo>
            <CanDo permission="timetable.publish">
              <PublishAll onDone={load} />
            </CanDo>
          </div>
        </div>
      </section>

      {canViewAll ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Classes" value={allClasses.length} tone="bg-blue-50 text-blue-700" icon={Calendar} />
          <StatCard label="Published" value={published} tone="bg-emerald-50 text-emerald-700" icon={CheckCircle2} />
          <StatCard label="Draft" value={Math.max(0, allClasses.length - published - empty)} tone="bg-amber-50 text-amber-700" icon={Clock} />
          <StatCard label="Not Set Up" value={empty} tone="bg-rose-50 text-rose-700" icon={AlertCircle} />
        </div>
      ) : null}

      <section className="rounded-[1.75rem] border border-white/65 bg-white/82 p-4 shadow-[0_16px_40px_rgba(18,33,23,0.06)] backdrop-blur-xl">
        <div className="flex flex-wrap gap-3">
          <label className="relative min-w-[220px] flex-1 md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search classes..." className="h-11 w-full rounded-2xl border border-ink/10 bg-white/80 pl-10 pr-4 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-100" />
          </label>
          {canViewAll ? (
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 rounded-2xl border border-ink/10 bg-white/80 px-4 text-sm font-medium text-ink/70 outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-100">
              <option value="">All categories</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          ) : null}
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-2xl border border-ink/10 bg-white/80 px-4 text-sm font-medium text-ink/70 outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-100">
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="empty">Not Set Up</option>
            <option value="structure_only">Needs Subjects</option>
          </select>
        </div>
      </section>

      {loading ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-[1.5rem] bg-white/75" />)}</div> : null}
      {error ? <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">{error}</div> : null}
      {!loading && !error && filteredData.length === 0 ? <div className="rounded-[2rem] border border-dashed border-ink/12 bg-white/70 p-10 text-center text-sm text-ink/55">No timetables match your filters.</div> : null}

      {!loading && !error ? filteredData.map(([group, classes]) => {
        const config = categoryConfig[group] ?? categoryConfig.Primary;
        return (
          <section key={group} className="grid gap-3">
            <div className="flex items-center gap-3">
              <span className={cn("rounded-full border px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.22em]", config.chip)}>{group}</span>
              <span className="h-px flex-1 bg-ink/8" />
              <span className="text-xs font-medium text-ink/45">{classes.length} classes</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {classes.map((classItem) => <ClassCard key={classItem.id} classItem={classItem} onOpen={() => router.push(`/timetable/${classItem.id}` as Route)} />)}
            </div>
          </section>
        );
      }) : null}
    </div>
  );
}

const dayNames = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
