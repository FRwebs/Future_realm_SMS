"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BookOpen, Eye, Plus, Search, UserCheck, X } from "lucide-react";

import { CanDo, usePermissions } from "@/components/auth/permission-provider";
import { Pagination } from "@/components/ui/pagination";
import { usePagination } from "@/hooks/use-pagination";
import { cn } from "@/lib/utils/cn";

type TeacherSummary = { id: string; name: string; email?: string | null; phone?: string | null; avatar?: string | null };

export type ClassListItem = {
  id: string;
  name: string;
  shortName: string;
  level: string;
  section?: string | null;
  category: "Early Years" | "Primary" | "Junior Secondary" | "Senior Secondary" | "Other";
  arm?: string | null;
  capacity: number;
  room?: string | null;
  studentCount: number;
  student_count: number;
  displayOrder: number;
  classTeacher: TeacherSummary | null;
  class_teacher: TeacherSummary | null;
  assistantClassTeacher: TeacherSummary | null;
  assistant_class_teacher: TeacherSummary | null;
};

type PaginatedResponse<T> = {
  data: T[];
  total: number;
};

const categoryOrder = ["Early Years", "Primary", "Junior Secondary", "Senior Secondary", "Other"] as const;
const categoryStyles = {
  "Early Years": "border-violet-200 bg-violet-50 text-violet-700",
  Primary: "border-blue-200 bg-blue-50 text-blue-700",
  "Junior Secondary": "border-teal-200 bg-teal-50 text-teal-700",
  "Senior Secondary": "border-orange-200 bg-orange-50 text-orange-700",
  Other: "border-slate-200 bg-slate-50 text-slate-700",
};

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json", "x-csrf-token": getCookie("fr_csrf") ?? "" } : {}),
      ...init?.headers,
    },
  });
  const body = await response.json();
  if (!response.ok || body.ok === false || body.success === false) {
    throw new Error(body.error ?? body.message ?? "Request failed.");
  }
  return body.data as T;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-ink text-[0.65rem] font-bold text-white">
      {initials(name)}
    </span>
  );
}

function ClassRow({
  item,
  serial,
  onView,
  onAssign,
  canAssign,
}: {
  item: ClassListItem;
  serial: number;
  onView: () => void;
  onAssign: () => void;
  canAssign: boolean;
}) {
  const classTeacher = item.classTeacher ?? item.class_teacher;
  const assistant = item.assistantClassTeacher ?? item.assistant_class_teacher;
  const studentCount = item.studentCount ?? item.student_count ?? 0;
  const capacityPercent = item.capacity > 0 ? Math.min(100, Math.round((studentCount / item.capacity) * 100)) : 0;

  return (
    <tr className="group transition hover:bg-white/75">
      <td className="px-4 py-3 text-xs font-medium text-ink/40">{serial}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-[0.68rem] font-black text-brand-800 ring-1 ring-brand-100">
            {item.shortName}
          </div>
          <div>
            <p className="font-semibold text-ink">{item.name}</p>
            <p className="text-xs text-ink/48">{item.level}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {classTeacher ? (
          <div className="flex items-center gap-2">
            <Avatar name={classTeacher.name} />
            <div>
              <p className="text-xs font-semibold text-ink">{classTeacher.name}</p>
              <p className="text-[0.68rem] text-ink/45">{classTeacher.email}</p>
            </div>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
            <AlertCircle className="h-3 w-3" />
            Not assigned
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-ink/60">
        {assistant ? (
          <div className="flex items-center gap-2">
            <Avatar name={assistant.name} />
            <span className="font-medium text-ink/70">{assistant.name}</span>
          </div>
        ) : (
          "None"
        )}
      </td>
      <td className="px-4 py-3">
        <span className="rounded-full bg-sand px-2.5 py-1 text-xs font-semibold text-ink/65">{item.arm ?? item.section ?? "Section"}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-ink">{studentCount}</span>
          <span className="text-xs text-ink/40">/ {item.capacity}</span>
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-ink/8">
            <span
              className={cn("block h-full rounded-full", capacityPercent >= 90 ? "bg-rose-500" : capacityPercent >= 70 ? "bg-amber-500" : "bg-emerald-500")}
              style={{ width: `${capacityPercent}%` }}
            />
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onView}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-100"
          >
            <Eye className="h-3 w-3" />
            View
          </button>
          {canAssign ? (
            <button
              type="button"
              onClick={onAssign}
              className="inline-flex items-center gap-1.5 rounded-full bg-sand px-3 py-1.5 text-xs font-semibold text-ink/70 transition hover:bg-white"
            >
              <UserCheck className="h-3 w-3" />
              Assign
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function ClassesSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-[1.5rem] bg-white/70" />
      ))}
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-ink/12 bg-white/70 p-10 text-center">
      <BookOpen className="mx-auto h-8 w-8 text-ink/30" />
      <h3 className="mt-4 font-[var(--font-heading)] text-2xl font-bold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-ink/58">{message}</p>
    </div>
  );
}

export function ClassesListClient() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [hasTeacher, setHasTeacher] = useState("");
  const [assigningClass, setAssigningClass] = useState<ClassListItem | null>(null);
  const [creatingClass, setCreatingClass] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchClasses = useCallback(async (params: { page: number; pageSize: number; search: string; category: string; has_teacher: string; refreshKey: number }) => {
    const query = new URLSearchParams();
    query.set("page", "1");
    query.set("pageSize", "200");
    if (params.search) query.set("search", params.search);
    if (params.category) query.set("category", params.category);
    if (params.has_teacher) query.set("has_teacher", params.has_teacher);
    const result = await apiJson<PaginatedResponse<ClassListItem>>(`/api/v1/classes?${query.toString()}`);
    return { data: result.data, total: result.total };
  }, []);

  const {
    data: classes,
    totalItems,
    currentPage,
    pageSize,
    isLoading,
    error,
    setCurrentPage,
    setPageSize,
    updateFilters,
  } = usePagination({
    fetchFn: fetchClasses,
    defaultPageSize: 200,
    defaultFilters: { search: "", category: "", has_teacher: "", refreshKey },
  });

  const grouped = useMemo(
    () =>
      categoryOrder
        .map((group) => [group, classes.filter((item) => item.category === group)] as const)
        .filter(([, items]) => items.length > 0),
    [classes],
  );

  function refresh() {
    setRefreshKey((value) => {
      const next = value + 1;
      updateFilters({ refreshKey: next });
      return next;
    });
  }

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/65 bg-white/88 shadow-panel backdrop-blur-xl">
        <div className="h-2 bg-gradient-to-r from-brand-700 via-amber to-ink" />
        <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-700">Academic Structure</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-black tracking-tight text-ink">Classes</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/62">
              Manage Nigerian class levels and arms from Nursery through Primary, JSS, and SS, including form teacher
              assignments, capacity, rooms, students, attendance, results, and Early Years skills.
            </p>
          </div>
          <CanDo permission="classes.create">
            <button
              type="button"
              onClick={() => setCreatingClass(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(18,33,23,0.18)] transition hover:-translate-y-0.5 hover:bg-brand-800"
            >
              <Plus className="h-4 w-4" />
              Add Class
            </button>
          </CanDo>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/65 bg-white/82 p-4 shadow-[0_16px_40px_rgba(18,33,23,0.06)] backdrop-blur-xl">
        <div className="flex flex-wrap gap-3">
          <label className="relative min-w-[220px] flex-1 md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                updateFilters({ search: event.target.value });
              }}
              placeholder="Search classes, arms, short codes..."
              className="h-11 w-full rounded-2xl border border-ink/10 bg-white/80 pl-10 pr-4 text-sm text-ink outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
            />
          </label>
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              updateFilters({ category: event.target.value });
            }}
            className="h-11 rounded-2xl border border-ink/10 bg-white/80 px-4 text-sm font-medium text-ink/70 outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
          >
            <option value="">All categories</option>
            {categoryOrder.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            value={hasTeacher}
            onChange={(event) => {
              setHasTeacher(event.target.value);
              updateFilters({ has_teacher: event.target.value });
            }}
            className="h-11 rounded-2xl border border-ink/10 bg-white/80 px-4 text-sm font-medium text-ink/70 outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
          >
            <option value="">All teacher assignments</option>
            <option value="yes">Has form teacher</option>
            <option value="no">No form teacher</option>
          </select>
        </div>
      </section>

      {isLoading ? <ClassesSkeleton /> : null}
      {!isLoading && error ? <EmptyState title="Unable to load classes" message={error} /> : null}
      {!isLoading && !error && classes.length === 0 ? <EmptyState title="No classes found" message="No classes match your current filters." /> : null}

      {!isLoading && !error
        ? grouped.map(([group, items]) => {
            let start = (currentPage - 1) * pageSize + 1;
            for (const [previousGroup, previousItems] of grouped) {
              if (previousGroup === group) break;
              start += previousItems.length;
            }
            return (
              <section key={group} className="grid gap-3">
                <div className="flex items-center gap-3">
                  <span className={cn("rounded-full border px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.22em]", categoryStyles[group])}>
                    {group}
                  </span>
                  <span className="h-px flex-1 bg-ink/8" />
                  <span className="text-xs font-medium text-ink/45">{items.length} classes</span>
                </div>
                <div className="overflow-hidden rounded-[1.65rem] border border-white/70 bg-white/86 shadow-[0_14px_36px_rgba(18,33,23,0.06)]">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-sm">
                      <thead className="bg-sand/70 text-left text-[0.67rem] font-black uppercase tracking-[0.18em] text-ink/42">
                        <tr>
                          <th className="px-4 py-3">S/N</th>
                          <th className="px-4 py-3">Class</th>
                          <th className="px-4 py-3">Form Teacher</th>
                          <th className="px-4 py-3">Assistant</th>
                          <th className="px-4 py-3">Arm</th>
                          <th className="px-4 py-3">Students</th>
                          <th className="px-4 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink/6">
                        {items.map((item, index) => (
                          <ClassRow
                            key={item.id}
                            item={item}
                            serial={start + index}
                            onView={() => router.push(`/classes/${item.id}` as Route)}
                            onAssign={() => setAssigningClass(item)}
                            canAssign={hasPermission("classes.assign_teacher")}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            );
          })
        : null}

      {totalItems > pageSize ? (
        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[100, 200]}
        />
      ) : null}

      {assigningClass ? <AssignTeacherModal classItem={assigningClass} onClose={() => setAssigningClass(null)} onSaved={() => { setAssigningClass(null); refresh(); }} /> : null}
      {creatingClass ? <CreateClassModal onClose={() => setCreatingClass(false)} onSaved={() => { setCreatingClass(false); refresh(); }} /> : null}
    </div>
  );
}

function CreateClassModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const level = String(form.get("level") ?? "");
    const section = String(form.get("section") ?? "");
    const category = String(form.get("category") ?? categoryFromLevel(level));
    setSaving(true);
    setError(null);
    try {
      await apiJson("/api/v1/classes", {
        method: "POST",
        body: JSON.stringify({
          name: `${level} ${section}`.trim(),
          level,
          section,
          category,
          shortName: String(form.get("shortName") ?? ""),
          capacity: Number(form.get("capacity") ?? 40),
          room: String(form.get("room") ?? ""),
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create class.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/55 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_30px_90px_rgba(18,33,23,0.28)]">
        <div className="flex items-start justify-between gap-4 border-b border-ink/8 bg-sand/50 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-700">New Nigerian class</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-3xl font-black text-ink">Create Class Arm</h2>
            <p className="mt-1 text-sm text-ink/58">Create a class such as JSS 1 A, Primary 4 B, or SS 2 Science.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-ink/10 bg-white p-3 text-ink/55 transition hover:bg-white/70">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-4 p-6">
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-ink/70">
              Level
              <select name="level" required className="h-11 rounded-2xl border border-ink/10 bg-white px-3 text-sm outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100">
                {["Nursery 1", "Nursery 2", "KG 1", "KG 2", "KG / Reception", "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6", "JSS 1", "JSS 2", "JSS 3", "SSS 1", "SSS 2", "SSS 3"].map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink/70">
              Arm / Section
              <input name="section" required placeholder="A, B, Science, Arts" className="h-11 rounded-2xl border border-ink/10 bg-white px-3 text-sm outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink/70">
              Category
              <select name="category" className="h-11 rounded-2xl border border-ink/10 bg-white px-3 text-sm outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100">
                {categoryOrder.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink/70">
              Short name
              <input name="shortName" placeholder="J1A" className="h-11 rounded-2xl border border-ink/10 bg-white px-3 text-sm outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink/70">
              Capacity
              <input name="capacity" type="number" min={1} max={250} defaultValue={40} className="h-11 rounded-2xl border border-ink/10 bg-white px-3 text-sm outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink/70">
              Room
              <input name="room" placeholder="Block B Room 3" className="h-11 rounded-2xl border border-ink/10 bg-white px-3 text-sm outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100" />
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-ink/8 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-full px-5 py-2 text-sm font-semibold text-ink/60 transition hover:bg-sand">Cancel</button>
          <button disabled={saving} className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-50">
            {saving ? "Creating..." : "Create Class"}
          </button>
        </div>
      </form>
    </div>
  );
}

function categoryFromLevel(level: string) {
  if (/nursery|kg|reception/i.test(level)) return "Early Years";
  if (/primary/i.test(level)) return "Primary";
  if (/jss/i.test(level)) return "Junior Secondary";
  return "Senior Secondary";
}

function AssignTeacherModal({
  classItem,
  onClose,
  onSaved,
}: {
  classItem: ClassListItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [teachers, setTeachers] = useState<Array<{ id: string; firstName: string; lastName: string; email: string; currentClassName?: string | null }>>([]);
  const [search, setSearch] = useState("");
  const [teacherId, setTeacherId] = useState((classItem.classTeacher ?? classItem.class_teacher)?.id ?? "");
  const [assistantId, setAssistantId] = useState((classItem.assistantClassTeacher ?? classItem.assistant_class_teacher)?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiJson<Array<{ id: string; firstName: string; lastName: string; email: string; currentClassName?: string | null }>>("/api/v1/classes/teacher-options")
      .then(setTeachers)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load teachers."));
  }, []);

  const filteredTeachers = teachers.filter((teacher) => `${teacher.firstName} ${teacher.lastName} ${teacher.email}`.toLowerCase().includes(search.toLowerCase()));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiJson(`/api/v1/classes/${classItem.id}/assign-teacher`, {
        method: "PATCH",
        body: JSON.stringify({ classTeacherId: teacherId || null, assistantClassTeacherId: assistantId || null }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save teacher assignment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_30px_90px_rgba(18,33,23,0.28)]">
        <div className="flex items-start justify-between gap-4 border-b border-ink/8 bg-sand/50 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-700">Form teacher assignment</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-3xl font-black text-ink">{classItem.name}</h2>
            <p className="mt-1 text-sm text-ink/58">Assign the Nigerian form teacher and optional assistant form teacher.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-ink/10 bg-white p-3 text-ink/55 transition hover:bg-white/70">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid max-h-[70vh] gap-5 overflow-y-auto p-6">
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search teaching staff..."
              className="h-11 w-full rounded-2xl border border-ink/10 bg-white pl-10 pr-4 text-sm outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
            />
          </label>
          <TeacherSelect label="Form Teacher" teachers={filteredTeachers} value={teacherId} onChange={(value) => { setTeacherId(value); if (assistantId === value) setAssistantId(""); }} />
          <TeacherSelect label="Assistant Form Teacher" optional teachers={filteredTeachers.filter((teacher) => teacher.id !== teacherId)} value={assistantId} onChange={setAssistantId} />
        </div>
        <div className="flex justify-end gap-3 border-t border-ink/8 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-full px-5 py-2 text-sm font-semibold text-ink/60 transition hover:bg-sand">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Assignment"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TeacherSelect({
  label,
  teachers,
  value,
  onChange,
  optional,
}: {
  label: string;
  teachers: Array<{ id: string; firstName: string; lastName: string; email: string; currentClassName?: string | null }>;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-ink/45">
        {label} {optional ? <span className="font-medium normal-case tracking-normal text-ink/35">(optional)</span> : null}
      </p>
      <div className="grid max-h-56 gap-1 overflow-y-auto rounded-[1.25rem] border border-ink/8 bg-sand/30 p-2">
        <button
          type="button"
          onClick={() => onChange("")}
          className={cn("rounded-2xl px-3 py-2 text-left text-sm font-semibold transition", value === "" ? "bg-white text-brand-800 shadow-sm" : "text-ink/55 hover:bg-white/70")}
        >
          No {label.toLowerCase()}
        </button>
        {teachers.map((teacher) => (
          <button
            key={teacher.id}
            type="button"
            onClick={() => onChange(teacher.id)}
            className={cn("flex items-center gap-3 rounded-2xl px-3 py-2 text-left transition", value === teacher.id ? "bg-white text-brand-800 shadow-sm" : "hover:bg-white/70")}
          >
            <Avatar name={`${teacher.firstName} ${teacher.lastName}`} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{teacher.firstName} {teacher.lastName}</span>
              <span className="block truncate text-xs text-ink/45">{teacher.email}</span>
            </span>
            {teacher.currentClassName ? <span className="rounded-full bg-amber-50 px-2 py-1 text-[0.65rem] font-bold text-amber-700">{teacher.currentClassName}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
