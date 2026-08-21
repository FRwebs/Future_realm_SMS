"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, DoorOpen, EyeOff, Plus, Send, Sparkles, Trash2 } from "lucide-react";

import { usePermissions } from "@/components/auth/permission-provider";
import { useToast } from "@/components/ui/toast-provider";
import { SidePanel } from "@/components/ui/side-panel";
import { cn } from "@/lib/utils/cn";
import { apiJson, formatTime, getCookie } from "./api";

type Day = { number: number; name: string; short: string };
type Slot = {
  id: string;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  slot_type: string;
  room?: string | null;
  notes?: string | null;
  is_published: boolean;
  is_double_period: boolean;
  subject_id?: string | null;
  subject_name?: string | null;
  subject_code?: string | null;
  teacher_id?: string | null;
  teacher_name?: string | null;
};
type PeriodRow = {
  period_number: number;
  label: string;
  start_time: string;
  end_time: string;
  slot_type: string;
  slots: Array<{ day_number: number; day_name: string; slot: Slot | null }>;
};
type TimetablePayload = {
  class: {
    id: string;
    name: string;
    short_name?: string | null;
    level: string;
    category: string;
    arm?: string | null;
    class_teacher_name?: string | null;
  };
  grid: PeriodRow[];
  days: Day[];
  meta: {
    total_lesson_slots: number;
    filled_slots: number;
    published_slots: number;
    is_fully_published: boolean;
    is_draft: boolean;
    is_empty: boolean;
  };
};
type SubjectOption = { subject_id: string; name: string; code: string; teacher_id?: string | null; teacher_name?: string | null };
type TeacherOption = { id: string; name: string; email: string };
type ActiveSlot = {
  dayOfWeek: number;
  dayName: string;
  periodNumber: number;
  periodLabel: string;
  startTime: string;
  endTime: string;
  existingSlot: Slot | null;
};

type SubjectTone = { background: string; color: string; borderColor: string };

const subjectTones: Array<{ match: string } & SubjectTone> = [
  { match: "english", background: "var(--color-info-dim)", color: "var(--color-info)", borderColor: "var(--color-info)" },
  { match: "math", background: "var(--color-accent-primary-dim)", color: "var(--color-text-accent)", borderColor: "var(--color-accent-primary)" },
  { match: "science", background: "var(--color-success-dim)", color: "var(--color-success)", borderColor: "var(--color-success)" },
  { match: "biology", background: "var(--color-success-dim)", color: "var(--color-success)", borderColor: "var(--color-success)" },
  { match: "chemistry", background: "var(--color-warning-dim)", color: "var(--color-warning)", borderColor: "var(--color-warning)" },
  { match: "physics", background: "var(--color-danger-dim)", color: "var(--color-danger)", borderColor: "var(--color-danger)" },
  { match: "civic", background: "var(--color-bg-subtle)", color: "var(--color-text-secondary)", borderColor: "var(--color-border-default)" },
];

const defaultSubjectTone: SubjectTone = {
  background: "var(--color-accent-primary-dim)",
  color: "var(--color-text-accent)",
  borderColor: "var(--color-accent-primary)",
};

function toneForSubject(subject?: string | null): SubjectTone {
  const normalized = subject?.toLowerCase() ?? "";
  return subjectTones.find((tone) => normalized.includes(tone.match)) ?? defaultSubjectTone;
}

function StatusBadge({ meta }: { meta: TimetablePayload["meta"] }) {
  if (meta.is_empty) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black"
        style={{ background: "var(--color-bg-subtle)", color: "var(--color-text-muted)" }}
      >
        <AlertCircle className="h-3 w-3" />Not Set Up
      </span>
    );
  }
  if (meta.is_fully_published) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black"
        style={{ background: "var(--color-success-dim)", color: "var(--color-success)" }}
      >
        <CheckCircle2 className="h-3 w-3" />Published
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black"
      style={{ background: "var(--color-warning-dim)", color: "var(--color-warning)" }}
    >
      <Clock className="h-3 w-3" />Draft {meta.published_slots}/{meta.total_lesson_slots}
    </span>
  );
}

function TimetableCell({
  slot,
  period,
  canEdit,
  canDelete,
  onClick,
  onDelete,
}: {
  slot: Slot | null;
  period: PeriodRow;
  canEdit: boolean;
  canDelete: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const nonTeaching = ["break", "lunch", "assembly", "closing"].includes(period.slot_type);
  if (nonTeaching) {
    return (
      <div className="flex h-16 items-center justify-center rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        {period.label}
      </div>
    );
  }
  if (!slot) {
    return (
      <button
        type="button"
        onClick={canEdit ? onClick : undefined}
        className={cn(
          "flex h-20 w-full items-center justify-center rounded-[10px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-xs font-bold text-[var(--color-text-muted)]",
          canEdit && "transition hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary-dim)] hover:text-[var(--color-text-accent)]",
        )}
      >
        {canEdit ? <><Plus className="mr-1 h-3.5 w-3.5" />Add</> : "Free"}
      </button>
    );
  }
  if (slot.slot_type === "free" || !slot.subject_id) {
    return (
      <button
        type="button"
        onClick={canEdit ? onClick : undefined}
        className={cn("flex h-20 w-full items-center justify-center rounded-[10px] border border-dashed text-xs font-bold transition", canEdit && "hover:brightness-95")}
        style={{ borderColor: "var(--color-warning)", background: "var(--color-warning-dim)", color: "var(--color-warning)" }}
      >
        Free Period
      </button>
    );
  }
  const tone: SubjectTone =
    slot.slot_type === "sports"
      ? { background: "var(--color-info-dim)", color: "var(--color-info)", borderColor: "var(--color-info)" }
      : toneForSubject(slot.subject_name);
  return (
    <div
      className={cn("group relative h-20 rounded-2xl border p-3 text-left transition", canEdit && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md")}
      style={{ background: tone.background, borderColor: tone.borderColor }}
      onClick={canEdit ? onClick : undefined}
    >
      <div className="flex items-start gap-2">
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: tone.color }} />
        <div className="min-w-0">
          <p className="truncate text-xs font-black" style={{ color: tone.color }}>{slot.slot_type === "sports" ? "Sports / PE" : slot.subject_name}</p>
          <p className="mt-1 truncate text-[0.68rem] font-medium text-[var(--color-text-muted)]">{slot.teacher_name ?? "No teacher assigned"}</p>
          {slot.room ? <p className="mt-1 flex items-center gap-1 truncate text-[0.65rem] text-[var(--color-text-muted)]"><DoorOpen className="h-3 w-3" />{slot.room}</p> : null}
        </div>
      </div>
      {!slot.is_published ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full" style={{ background: "var(--color-warning)" }} title="Draft" /> : null}
      {canDelete ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete?.();
          }}
          className="absolute bottom-2 right-2 hidden rounded-full bg-[var(--color-bg-surface)] p-1.5 text-[var(--color-text-muted)] shadow-sm transition hover:text-[var(--color-danger)] group-hover:block"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

function TimetableGrid({ data, canEdit, canDelete, onEdit, onDelete }: { data: TimetablePayload; canEdit: boolean; canDelete: boolean; onEdit: (slot: ActiveSlot) => void; onDelete: (slotId: string) => void }) {
  return (
    <section className="surface-hero overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-subtle)]">
              <th className="sticky left-0 z-10 w-36 bg-[var(--color-bg-subtle)] px-4 py-4 text-left text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Period</th>
              {data.days.map((day) => <th key={day.number} className="px-3 py-4 text-center text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{day.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.grid.map((period) => (
              <tr key={period.period_number} className="border-b border-[var(--color-border-default)]">
                <td className="sticky left-0 z-10 border-r border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3">
                  <p className="text-sm font-black text-[var(--color-text-primary)]">{period.label}</p>
                  <p className="mt-1 text-[0.68rem] font-mono text-[var(--color-text-muted)]">{formatTime(period.start_time)} - {formatTime(period.end_time)}</p>
                </td>
                {data.days.map((day) => {
                  const slot = period.slots.find((item) => item.day_number === day.number)?.slot ?? null;
                  return (
                    <td key={`${period.period_number}-${day.number}`} className="align-top p-2">
                      <TimetableCell
                        slot={slot}
                        period={period}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onClick={() => onEdit({ dayOfWeek: day.number, dayName: day.name, periodNumber: period.period_number, periodLabel: period.label, startTime: period.start_time, endTime: period.end_time, existingSlot: slot })}
                        onDelete={slot ? () => onDelete(slot.id) : undefined}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SlotEditPanel({ classId, className, slot, onClose, onSaved }: { classId: string; className: string; slot: ActiveSlot; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [form, setForm] = useState({
    slot_type: slot.existingSlot?.slot_type ?? "lesson",
    subject_id: slot.existingSlot?.subject_id ?? "",
    teacher_id: slot.existingSlot?.teacher_id ?? "",
    room: slot.existingSlot?.room ?? "",
    notes: slot.existingSlot?.notes ?? "",
    is_double_period: slot.existingSlot?.is_double_period ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiJson<SubjectOption[]>(`/api/v1/timetable/${classId}/subjects`),
      apiJson<TeacherOption[]>("/api/v1/timetable/teacher-options"),
    ])
      .then(([subjectOptions, teacherOptions]) => {
        setSubjects(subjectOptions);
        setTeachers(teacherOptions);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load slot options."));
  }, [classId]);

  function selectSubject(subjectId: string) {
    const subject = subjects.find((item) => item.subject_id === subjectId);
    setForm((current) => ({ ...current, subject_id: subjectId, teacher_id: subject?.teacher_id ?? current.teacher_id }));
  }

  async function save() {
    if (form.slot_type === "lesson" && !form.subject_id) {
      const message = "Select a subject before saving this lesson slot.";
      setError(message);
      showToast({
        variant: "warning",
        title: "Subject required",
        description: message,
      });
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/timetable/${classId}/slot`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCookie("fr_csrf") ?? "" },
        body: JSON.stringify({ ...form, day_of_week: slot.dayOfWeek, period_number: slot.periodNumber }),
      });
      const body = await response.json();
      if (!response.ok || body.success === false || body.ok === false) {
        const message = typeof body.message === "string" ? body.message : typeof body.response?.message === "string" ? body.response.message : "Unable to save timetable slot.";
        throw new Error(message);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save timetable slot.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel
      open
      onClose={onClose}
      size="lg"
      title="Edit timetable slot"
      subtitle={`${className} · ${slot.dayName} · ${slot.periodLabel} · ${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`}
      footer={(
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary px-5">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="btn-primary px-5 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save slot"}
          </button>
        </div>
      )}
    >
      <div className="grid gap-5">
        <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-accent)]">
            Teaching window
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-[var(--color-text-secondary)]">
            <span className="rounded-full bg-[var(--color-bg-surface)] px-3 py-1 font-medium">{slot.dayName}</span>
            <span className="rounded-full bg-[var(--color-bg-surface)] px-3 py-1 font-medium">{slot.periodLabel}</span>
            <span className="rounded-full bg-[var(--color-bg-surface)] px-3 py-1 font-medium">
              {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
            </span>
            {slot.existingSlot?.is_published ? (
              <span className="rounded-full px-3 py-1 font-medium" style={{ background: "var(--color-success-dim)", color: "var(--color-success)" }}>
                Published
              </span>
            ) : (
              <span className="rounded-full px-3 py-1 font-medium" style={{ background: "var(--color-warning-dim)", color: "var(--color-warning)" }}>
                Draft
              </span>
            )}
          </div>
        </div>

        {error ? (
          <div className="rounded-[10px] px-4 py-3 text-sm font-semibold" style={{ background: "var(--color-danger-dim)", color: "var(--color-danger)" }}>
            {error}
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-3">
          {["lesson", "free", "sports"].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setForm((current) => ({ ...current, slot_type: type }))}
              className={cn(
                "rounded-[10px] border px-4 py-3 text-sm font-black capitalize transition",
                form.slot_type === type
                  ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)] text-white"
                  : "border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]",
              )}
            >
              {type === "sports" ? "Sports / PE" : type}
            </button>
          ))}
        </div>

        {form.slot_type === "lesson" ? (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)]">
                Subject
                <select value={form.subject_id} onChange={(event) => selectSubject(event.target.value)} className="field-select h-11 rounded-[10px]">
                  <option value="">Select subject</option>
                  {subjects.map((subject) => <option key={subject.subject_id} value={subject.subject_id}>{subject.name} ({subject.code})</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)]">
                Teacher
                <select value={form.teacher_id} onChange={(event) => setForm((current) => ({ ...current, teacher_id: event.target.value }))} className="field-select h-11 rounded-[10px]">
                  <option value="">No teacher</option>
                  {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                </select>
              </label>
            </div>

            {form.subject_id ? (
              <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4 text-[13px] text-[var(--color-text-secondary)]">
                <p className="font-semibold text-[var(--color-text-primary)]">
                  {subjects.find((subject) => subject.subject_id === form.subject_id)?.name ?? "Selected subject"}
                </p>
                <p className="mt-1">
                  {form.teacher_id
                    ? `Assigned teacher: ${teachers.find((teacher) => teacher.id === form.teacher_id)?.name ?? "Chosen teacher"}`
                    : "No teacher linked yet. You can still save the slot and assign a teacher later."}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)]">
            Room
            <input value={form.room} onChange={(event) => setForm((current) => ({ ...current, room: event.target.value }))} placeholder="Room 7, Lab, Field" className="field-input h-11 rounded-[10px]" />
          </label>
          <label className="flex items-center gap-3 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3 text-sm font-semibold text-[var(--color-text-secondary)]">
            <input type="checkbox" checked={form.is_double_period} onChange={(event) => setForm((current) => ({ ...current, is_double_period: event.target.checked }))} className="h-4 w-4 rounded border-[var(--color-border-default)] text-[var(--color-accent-primary)]" />
            Double period
          </label>
        </div>

        <label className="grid gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)]">
          Notes
          <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={4} className="field-textarea min-h-[120px] rounded-[10px]" placeholder="Add any context for timetable managers, for example practical grouping or room constraints." />
        </label>
      </div>
    </SidePanel>
  );
}

export function ClassTimetableClient({ classId }: { classId: string }) {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [data, setData] = useState<TimetablePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<ActiveSlot | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const canEdit = hasPermission("timetable.create") || hasPermission("timetable.edit");
  const canDelete = hasPermission("timetable.delete");
  const canPublish = hasPermission("timetable.publish");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiJson<TimetablePayload>(`/api/v1/timetable/${classId}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load timetable.");
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    void load();
  }, [load]);

  const completion = useMemo(() => {
    if (!data?.meta.total_lesson_slots) return 0;
    return Math.round((data.meta.filled_slots / data.meta.total_lesson_slots) * 100);
  }, [data]);

  async function clearSlot(slotId: string) {
    await apiJson(`/api/v1/timetable/${classId}/slot/${slotId}?clear_only=true`, { method: "DELETE" });
    await load();
  }

  async function publish(action: "publish" | "unpublish") {
    setPublishing(true);
    setPublishError(null);
    try {
      await apiJson(`/api/v1/timetable/${classId}/publish`, { method: "PATCH", body: JSON.stringify({ action }) });
      await load();
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Unable to update publish status.");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <div className="grid gap-4">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-[14px] bg-[var(--color-bg-subtle)]" />)}</div>;
  if (error)
    return (
      <div className="rounded-[14px] p-5 text-sm font-semibold" style={{ background: "var(--color-danger-dim)", color: "var(--color-danger)" }}>
        {error}
      </div>
    );
  if (!data) return null;

  return (
    <div className="portal-page">
      <button
        type="button"
        onClick={() => router.push("/timetable" as Route)}
        className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--color-bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-elevated)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Timetable
      </button>

      <section className="surface-hero">
        <div className="h-2 bg-gradient-to-r from-[var(--color-accent-primary)] via-[var(--color-warning)] to-[var(--color-text-primary)]" />
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[var(--color-text-accent)]">{data.class.category}</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-black tracking-tight text-[var(--color-text-primary)]">{data.class.name}</h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">{data.class.level} · {data.class.arm ?? "Class arm"}{data.class.class_teacher_name ? ` · Form Teacher: ${data.class.class_teacher_name}` : ""}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge meta={data.meta} />
            {canPublish && data.meta.is_fully_published ? (
              <button
                type="button"
                disabled={publishing}
                onClick={() => publish("unpublish")}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-elevated)] disabled:opacity-50"
              >
                <EyeOff className="h-4 w-4" />
                Unpublish
              </button>
            ) : null}
            {canPublish && !data.meta.is_fully_published ? (
              <button
                type="button"
                disabled={publishing || data.meta.is_empty}
                onClick={() => publish("publish")}
                className="btn-primary inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {publishing ? "Publishing..." : "Publish Timetable"}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {publishError ? (
        <div className="rounded-[14px] p-4 text-sm font-semibold" style={{ background: "var(--color-danger-dim)", color: "var(--color-danger)" }}>
          {publishError}
        </div>
      ) : null}

      <section className="surface-card grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-[var(--color-text-primary)]"><Sparkles className="h-4 w-4 text-[var(--color-warning)]" />Completion</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{data.meta.filled_slots} of {data.meta.total_lesson_slots} teaching slots are filled.</p>
        </div>
        <div className="flex min-w-[240px] items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
            <span className="block h-full rounded-full bg-[var(--color-accent-primary)]" style={{ width: `${completion}%` }} />
          </div>
          <span className="text-sm font-black text-[var(--color-text-primary)]">{completion}%</span>
        </div>
      </section>

      <TimetableGrid data={data} canEdit={canEdit} canDelete={canDelete} onEdit={setActiveSlot} onDelete={clearSlot} />

      {activeSlot ? (
        <SlotEditPanel
          classId={classId}
          className={data.class.name}
          slot={activeSlot}
          onClose={() => setActiveSlot(null)}
          onSaved={() => {
            setActiveSlot(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
