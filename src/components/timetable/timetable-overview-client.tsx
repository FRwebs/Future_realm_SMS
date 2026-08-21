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
export type TimetableOverviewPayload = OverviewPayload;

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
  "Early Years": { gradient: "from-[var(--color-accent-primary)] to-[var(--color-accent-primary-hover)]", chip: "bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)] border-[var(--color-border-default)]" },
  Primary: { gradient: "from-[var(--color-info)] to-[var(--color-accent-primary-hover)]", chip: "bg-[var(--color-info-dim)] text-[var(--color-info)] border-[var(--color-border-default)]" },
  "Junior Secondary": { gradient: "from-[var(--color-accent-primary)] to-[var(--color-success)]", chip: "bg-[var(--color-success-dim)] text-[var(--color-success)] border-[var(--color-border-default)]" },
  "Senior Secondary": { gradient: "from-[var(--color-warning)] to-[var(--color-danger)]", chip: "bg-[var(--color-warning-dim)] text-[var(--color-warning)] border-[var(--color-border-default)]" },
  Other: { gradient: "from-[var(--color-text-muted)] to-[var(--color-text-primary)]", chip: "bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]" },
};

const statusConfig = {
  published: { label: "Published", icon: CheckCircle2, badge: "bg-[var(--color-success-dim)] text-[var(--color-success)] border-[var(--color-border-default)]", bar: "bg-[var(--color-success)]" },
  draft: { label: "Draft", icon: Clock, badge: "bg-[var(--color-warning-dim)] text-[var(--color-warning)] border-[var(--color-border-default)]", bar: "bg-[var(--color-warning)]" },
  empty: { label: "Not Set Up", icon: AlertCircle, badge: "bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]", bar: "bg-[var(--color-text-muted)]" },
  structure_only: { label: "Needs Subjects", icon: AlertCircle, badge: "bg-[var(--color-danger-dim)] text-[var(--color-danger)] border-[var(--color-border-default)]", bar: "bg-[var(--color-danger)]" },
};

function StatCard({ label, value, tone, icon: Icon }: { label: string; value: number; tone: string; icon: typeof Calendar }) {
  return (
    <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</span>
        <span className={cn("rounded-[10px] p-2", tone)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{value}</p>
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
      className="group overflow-hidden rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-left transition duration-200 hover:-translate-y-0.5 hover:border-[var(--color-accent-primary)]"
    >
      <div className={cn("h-1.5 bg-gradient-to-r", config.gradient)} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-black text-[var(--color-text-primary)] transition group-hover:text-[var(--color-text-accent)]">{classItem.name}</p>
            <p className="mt-1 text-xs font-medium text-[var(--color-text-muted)]">{classItem.level} · {classItem.arm ?? "Class arm"}</p>
          </div>
          <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[0.65rem] font-black", status.badge)}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </span>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-[10px] bg-[var(--color-bg-subtle)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
          <User className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
          <span className="truncate">{classItem.classTeacherName ?? classItem.class_teacher_name ?? "No form teacher assigned"}</span>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs font-semibold text-[var(--color-text-muted)]">
            <span>Slots filled</span>
            <span>{filledSlots}/{totalSlots}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-border-default)]">
            <span className={cn("block h-full rounded-full transition-all", fillPercent >= 100 ? "bg-[var(--color-success)]" : fillPercent >= 50 ? "bg-[var(--color-warning)]" : "bg-[var(--color-danger)]")} style={{ width: `${fillPercent}%` }} />
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
      <button type="button" onClick={check} className="btn-secondary h-11 rounded-full px-4">
        <Zap className="h-4 w-4" />
        Check Conflicts
      </button>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/55 p-4 backdrop-blur-sm">
          <div className="modal-surface w-full max-w-2xl overflow-hidden rounded-[14px] border border-[var(--color-border-strong)] bg-[var(--color-bg-overlay)] shadow-[var(--shadow-lg)]">
            <div className="flex items-start justify-between border-b border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-6 py-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-accent)]">Timetable audit</p>
                <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">Teacher Conflicts</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="icon-btn shrink-0" aria-label="Close teacher conflicts">
                Close
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-6">
              {loading ? <p className="text-[13px] text-[var(--color-text-secondary)]">Checking every teacher against every class period...</p> : null}
              {error ? (
                <p className="rounded-[10px] p-4 text-[13px] font-semibold" style={{ background: "var(--color-danger-dim)", color: "var(--color-danger)" }}>
                  {error}
                </p>
              ) : null}
              {!loading && result && result.conflict_count === 0 ? (
                <div className="rounded-[14px] border border-[var(--color-border-default)] p-8 text-center" style={{ background: "var(--color-success-dim)", color: "var(--color-success)" }}>
                  <CheckCircle2 className="mx-auto h-9 w-9" />
                  <p className="mt-3 font-bold">No timetable conflicts found.</p>
                </div>
              ) : null}
              {!loading && result && result.conflict_count > 0 ? (
                <div className="grid gap-3">
                  {result.data.map((conflict, index) => (
                    <div key={`${conflict.teacher_name}-${index}`} className="rounded-[10px] border border-[var(--color-border-default)] p-4" style={{ background: "var(--color-danger-dim)" }}>
                      <p className="font-bold" style={{ color: "var(--color-danger)" }}>{conflict.teacher_name ?? "Teacher"}</p>
                      <p className="mt-1 text-xs font-semibold" style={{ color: "var(--color-danger)" }}>
                        {dayNames[conflict.day_of_week]} · Period {conflict.period_number} · {formatTime(conflict.start_time)} - {formatTime(conflict.end_time)}
                      </p>
                      <p className="mt-3 text-[13px] text-[var(--color-text-primary)]">{conflict.class_1}: {conflict.subject_1} vs {conflict.class_2}: {conflict.subject_2}</p>
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
      <button type="button" disabled={loading} onClick={() => publish("unpublish")} className="btn-secondary h-11 rounded-full px-4 disabled:opacity-50">
        Unpublish All
      </button>
      <button type="button" disabled={loading} onClick={() => publish("publish")} className="btn-primary h-11 rounded-full px-4 disabled:opacity-50">
        <Send className="h-4 w-4" />
        {loading ? "Publishing..." : "Publish All"}
      </button>
    </div>
  );
}

export function TimetableOverviewClient({ initialPayload }: { initialPayload?: TimetableOverviewPayload | null }) {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [payload, setPayload] = useState<OverviewPayload | null>(initialPayload ?? null);
  const [loading, setLoading] = useState(!initialPayload);
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
    if (!initialPayload) {
      void load();
    }
  }, [initialPayload]);

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
    <div className="portal-page">
      <section className="surface-hero">
        <div className="h-2 bg-gradient-to-r from-[var(--color-accent-primary)] via-[var(--color-warning)] to-[var(--color-text-primary)]" />
        <div className="flex flex-col gap-4 p-6 md:p-7 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Academic planning</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black tracking-tight text-[var(--color-text-primary)]">Timetable</h1>
            <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
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
          <StatCard label="Total Classes" value={allClasses.length} tone="bg-[var(--color-info-dim)] text-[var(--color-info)]" icon={Calendar} />
          <StatCard label="Published" value={published} tone="bg-[var(--color-success-dim)] text-[var(--color-success)]" icon={CheckCircle2} />
          <StatCard label="Draft" value={Math.max(0, allClasses.length - published - empty)} tone="bg-[var(--color-warning-dim)] text-[var(--color-warning)]" icon={Clock} />
          <StatCard label="Not Set Up" value={empty} tone="bg-[var(--color-danger-dim)] text-[var(--color-danger)]" icon={AlertCircle} />
        </div>
      ) : null}

      <section className="surface-card p-4">
        <div className="flex flex-wrap gap-3">
          <label className="relative min-w-[220px] flex-1 md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search classes..." className="field-control h-11 pl-10" />
          </label>
          {canViewAll ? (
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="field-select h-11">
              <option value="">All categories</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          ) : null}
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="field-select h-11">
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="empty">Not Set Up</option>
            <option value="structure_only">Needs Subjects</option>
          </select>
        </div>
      </section>

      {loading ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-[10px] bg-[var(--color-bg-subtle)]" />)}</div> : null}
      {error ? <div className="rounded-[10px] border border-[var(--color-border-default)] p-5 text-sm font-semibold" style={{ background: "var(--color-danger-dim)", color: "var(--color-danger)" }}>{error}</div> : null}
      {!loading && !error && filteredData.length === 0 ? <div className="rounded-[14px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-10 text-center text-sm text-[var(--color-text-muted)]">No timetables match your filters.</div> : null}

      {!loading && !error ? filteredData.map(([group, classes]) => {
        const config = categoryConfig[group] ?? categoryConfig.Primary;
        return (
          <section key={group} className="grid gap-3">
            <div className="flex items-center gap-3">
              <span className={cn("rounded-full border px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.22em]", config.chip)}>{group}</span>
              <span className="h-px flex-1 bg-[var(--color-border-default)]" />
              <span className="text-xs font-medium text-[var(--color-text-muted)]">{classes.length} classes</span>
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
