"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, DoorOpen, EyeOff, Plus, Send, Sparkles, Trash2, X } from "lucide-react";

import { usePermissions } from "@/components/auth/permission-provider";
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

const subjectTones = [
  { match: "english", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-900", dot: "bg-blue-500" },
  { match: "math", bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-900", dot: "bg-violet-500" },
  { match: "science", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900", dot: "bg-emerald-500" },
  { match: "biology", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900", dot: "bg-emerald-500" },
  { match: "chemistry", bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-900", dot: "bg-orange-500" },
  { match: "physics", bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-900", dot: "bg-rose-500" },
  { match: "civic", bg: "bg-cyan-50", border: "border-cyan-200", text: "text-cyan-900", dot: "bg-cyan-500" },
];

function toneForSubject(subject?: string | null) {
  const normalized = subject?.toLowerCase() ?? "";
  return subjectTones.find((tone) => normalized.includes(tone.match)) ?? { bg: "bg-brand-50", border: "border-brand-200", text: "text-brand-900", dot: "bg-brand-600" };
}

function StatusBadge({ meta }: { meta: TimetablePayload["meta"] }) {
  if (meta.is_empty) {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600"><AlertCircle className="h-3 w-3" />Not Set Up</span>;
  }
  if (meta.is_fully_published) {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700"><CheckCircle2 className="h-3 w-3" />Published</span>;
  }
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700"><Clock className="h-3 w-3" />Draft {meta.published_slots}/{meta.total_lesson_slots}</span>;
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
      <div className="flex h-16 items-center justify-center rounded-2xl border border-ink/8 bg-sand/75 text-xs font-black uppercase tracking-[0.16em] text-ink/40">
        {period.label}
      </div>
    );
  }
  if (!slot) {
    return (
      <button type="button" onClick={canEdit ? onClick : undefined} className={cn("flex h-20 w-full items-center justify-center rounded-2xl border border-dashed border-ink/12 bg-white/45 text-xs font-bold text-ink/30", canEdit && "transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800")}>
        {canEdit ? <><Plus className="mr-1 h-3.5 w-3.5" />Add</> : "Free"}
      </button>
    );
  }
  if (slot.slot_type === "free" || !slot.subject_id) {
    return (
      <button type="button" onClick={canEdit ? onClick : undefined} className={cn("flex h-20 w-full items-center justify-center rounded-2xl border border-dashed border-amber-200 bg-amber-50/70 text-xs font-bold text-amber-700", canEdit && "transition hover:bg-amber-100")}>
        Free Period
      </button>
    );
  }
  const tone = slot.slot_type === "sports" ? { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-900", dot: "bg-sky-500" } : toneForSubject(slot.subject_name);
  return (
    <div className={cn("group relative h-20 rounded-2xl border p-3 text-left transition", tone.bg, tone.border, canEdit && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md")} onClick={canEdit ? onClick : undefined}>
      <div className="flex items-start gap-2">
        <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", tone.dot)} />
        <div className="min-w-0">
          <p className={cn("truncate text-xs font-black", tone.text)}>{slot.slot_type === "sports" ? "Sports / PE" : slot.subject_name}</p>
          <p className="mt-1 truncate text-[0.68rem] font-medium text-ink/50">{slot.teacher_name ?? "No teacher assigned"}</p>
          {slot.room ? <p className="mt-1 flex items-center gap-1 truncate text-[0.65rem] text-ink/40"><DoorOpen className="h-3 w-3" />{slot.room}</p> : null}
        </div>
      </div>
      {!slot.is_published ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-500" title="Draft" /> : null}
      {canDelete ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete?.();
          }}
          className="absolute bottom-2 right-2 hidden rounded-full bg-white/90 p-1.5 text-ink/35 shadow-sm transition hover:text-rose-600 group-hover:block"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

function TimetableGrid({ data, canEdit, canDelete, onEdit, onDelete }: { data: TimetablePayload; canEdit: boolean; canDelete: boolean; onEdit: (slot: ActiveSlot) => void; onDelete: (slotId: string) => void }) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-panel">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse">
          <thead>
            <tr className="border-b border-ink/8 bg-sand/70">
              <th className="sticky left-0 z-10 w-36 bg-sand/95 px-4 py-4 text-left text-[0.68rem] font-black uppercase tracking-[0.18em] text-ink/45">Period</th>
              {data.days.map((day) => <th key={day.number} className="px-3 py-4 text-center text-xs font-black uppercase tracking-[0.16em] text-ink/55">{day.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.grid.map((period) => (
              <tr key={period.period_number} className="border-b border-ink/6">
                <td className="sticky left-0 z-10 border-r border-ink/6 bg-white/95 px-4 py-3">
                  <p className="text-sm font-black text-ink">{period.label}</p>
                  <p className="mt-1 text-[0.68rem] font-mono text-ink/42">{formatTime(period.start_time)} - {formatTime(period.end_time)}</p>
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

function SlotEditModal({ classId, className, slot, onClose, onSaved }: { classId: string; className: string; slot: ActiveSlot; onClose: () => void; onSaved: () => void }) {
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_30px_90px_rgba(18,33,23,0.28)]">
        <div className="flex items-start justify-between gap-4 border-b border-ink/8 bg-sand/50 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-700">{slot.dayName} · {slot.periodLabel}</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-3xl font-black text-ink">Edit Slot</h2>
            <p className="mt-1 text-sm text-ink/58">{className} · {formatTime(slot.startTime)} - {formatTime(slot.endTime)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-ink/10 bg-white p-3 text-ink/55 transition hover:bg-white/70"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-4 p-6">
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
          <div className="grid gap-2 sm:grid-cols-3">
            {["lesson", "free", "sports"].map((type) => (
              <button key={type} type="button" onClick={() => setForm((current) => ({ ...current, slot_type: type }))} className={cn("rounded-2xl border px-4 py-3 text-sm font-black capitalize transition", form.slot_type === type ? "border-brand-600 bg-brand-700 text-white" : "border-ink/10 bg-white text-ink/58 hover:bg-sand")}>
                {type === "sports" ? "Sports / PE" : type}
              </button>
            ))}
          </div>
          {form.slot_type === "lesson" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold text-ink/70">
                Subject
                <select value={form.subject_id} onChange={(event) => selectSubject(event.target.value)} className="h-11 rounded-2xl border border-ink/10 bg-white px-3 text-sm outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100">
                  <option value="">Select subject</option>
                  {subjects.map((subject) => <option key={subject.subject_id} value={subject.subject_id}>{subject.name} ({subject.code})</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-ink/70">
                Teacher
                <select value={form.teacher_id} onChange={(event) => setForm((current) => ({ ...current, teacher_id: event.target.value }))} className="h-11 rounded-2xl border border-ink/10 bg-white px-3 text-sm outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100">
                  <option value="">No teacher</option>
                  {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                </select>
              </label>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-ink/70">
              Room
              <input value={form.room} onChange={(event) => setForm((current) => ({ ...current, room: event.target.value }))} placeholder="Room 7, Lab, Field" className="h-11 rounded-2xl border border-ink/10 bg-white px-3 text-sm outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100" />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm font-semibold text-ink/70">
              <input type="checkbox" checked={form.is_double_period} onChange={(event) => setForm((current) => ({ ...current, is_double_period: event.target.checked }))} className="h-4 w-4 rounded border-ink/20 text-brand-700" />
              Double period
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-semibold text-ink/70">
            Notes
            <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={3} className="rounded-2xl border border-ink/10 bg-white px-3 py-3 text-sm outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100" />
          </label>
        </div>
        <div className="flex justify-end gap-3 border-t border-ink/8 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-full px-5 py-2 text-sm font-semibold text-ink/60 transition hover:bg-sand">Cancel</button>
          <button type="button" disabled={saving || (form.slot_type === "lesson" && !form.subject_id)} onClick={save} className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-50">
            {saving ? "Saving..." : "Save Slot"}
          </button>
        </div>
      </div>
    </div>
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

  if (loading) return <div className="grid gap-4">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-[1.5rem] bg-white/75" />)}</div>;
  if (error) return <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">{error}</div>;
  if (!data) return null;

  return (
    <div className="grid gap-5">
      <button type="button" onClick={() => router.push("/timetable" as Route)} className="inline-flex w-fit items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-sm font-semibold text-ink/60 transition hover:bg-white">
        <ArrowLeft className="h-4 w-4" />
        Timetable
      </button>

      <section className="overflow-hidden rounded-[2rem] border border-white/65 bg-white/88 shadow-panel backdrop-blur-xl">
        <div className="h-2 bg-gradient-to-r from-brand-700 via-amber to-ink" />
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-700">{data.class.category}</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-black tracking-tight text-ink">{data.class.name}</h1>
            <p className="mt-2 text-sm text-ink/58">{data.class.level} · {data.class.arm ?? "Class arm"}{data.class.class_teacher_name ? ` · Form Teacher: ${data.class.class_teacher_name}` : ""}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge meta={data.meta} />
            {canPublish && data.meta.is_fully_published ? (
              <button type="button" disabled={publishing} onClick={() => publish("unpublish")} className="inline-flex h-11 items-center gap-2 rounded-full border border-ink/10 bg-white/80 px-4 text-sm font-semibold text-ink/65 transition hover:bg-white disabled:opacity-50">
                <EyeOff className="h-4 w-4" />
                Unpublish
              </button>
            ) : null}
            {canPublish && !data.meta.is_fully_published ? (
              <button type="button" disabled={publishing || data.meta.is_empty} onClick={() => publish("publish")} className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(18,33,23,0.18)] transition hover:bg-brand-800 disabled:opacity-50">
                <Send className="h-4 w-4" />
                {publishing ? "Publishing..." : "Publish Timetable"}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {publishError ? <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{publishError}</div> : null}

      <section className="grid gap-3 rounded-[1.5rem] border border-white/65 bg-white/82 p-4 shadow-[0_16px_40px_rgba(18,33,23,0.06)] md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-ink"><Sparkles className="h-4 w-4 text-amber-600" />Completion</p>
          <p className="mt-1 text-xs text-ink/55">{data.meta.filled_slots} of {data.meta.total_lesson_slots} teaching slots are filled.</p>
        </div>
        <div className="flex min-w-[240px] items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/8">
            <span className="block h-full rounded-full bg-brand-700" style={{ width: `${completion}%` }} />
          </div>
          <span className="text-sm font-black text-ink">{completion}%</span>
        </div>
      </section>

      <TimetableGrid data={data} canEdit={canEdit} canDelete={canDelete} onEdit={setActiveSlot} onDelete={clearSlot} />

      {activeSlot ? (
        <SlotEditModal
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
