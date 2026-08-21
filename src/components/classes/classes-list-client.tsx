"use client";

import type { Route } from "next";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BookOpen, Plus, Search } from "lucide-react";

import { CanDo, usePermissions } from "@/components/auth/permission-provider";
import { ActionMenu, ActionMenuButton } from "@/components/ui/action-menu";
import { Pagination } from "@/components/ui/pagination";
import { SidePanel } from "@/components/ui/side-panel";
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

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
};

const categoryOrder = ["Early Years", "Primary", "Junior Secondary", "Senior Secondary", "Other"] as const;
const categoryTone: Record<(typeof categoryOrder)[number], CSSProperties> = {
  "Early Years": {
    borderColor: "rgb(var(--color-violet-rgb) / 0.35)",
    background: "rgb(var(--color-violet-rgb) / 0.12)",
    color: "rgb(var(--color-violet-rgb) / 1)",
  },
  Primary: {
    borderColor: "rgb(var(--color-blue-rgb) / 0.35)",
    background: "rgb(var(--color-blue-rgb) / 0.12)",
    color: "rgb(var(--color-blue-rgb) / 1)",
  },
  "Junior Secondary": {
    borderColor: "var(--color-accent-primary)",
    background: "var(--color-accent-primary-dim)",
    color: "var(--color-accent-primary)",
  },
  "Senior Secondary": {
    borderColor: "rgb(var(--color-orange-rgb) / 0.35)",
    background: "rgb(var(--color-orange-rgb) / 0.12)",
    color: "rgb(var(--color-orange-rgb) / 1)",
  },
  Other: {
    borderColor: "var(--color-border-default)",
    background: "var(--color-bg-subtle)",
    color: "var(--color-text-secondary)",
  },
};

function capacityTone(percent: number): CSSProperties {
  if (percent >= 90) return { background: "var(--color-danger)" };
  if (percent >= 70) return { background: "var(--color-warning)" };
  return { background: "var(--color-success)" };
}

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
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-primary)] text-[0.65rem] font-bold text-[var(--color-text-inverse)]">
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
    <tr className="group transition hover:bg-[var(--color-bg-subtle)]">
      <td className="px-4 py-3 text-xs font-medium text-[var(--color-text-muted)]">{serial}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-accent-primary-dim)] bg-[var(--color-accent-primary-dim)] text-[0.68rem] font-black text-[var(--color-text-accent)]">
            {item.shortName}
          </div>
          <div>
            <p className="font-semibold text-[var(--color-text-primary)]">{item.name}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{item.level}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {classTeacher ? (
          <div className="flex items-center gap-2">
            <Avatar name={classTeacher.name} />
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-primary)]">{classTeacher.name}</p>
              <p className="text-[0.68rem] text-[var(--color-text-muted)]">{classTeacher.email}</p>
            </div>
          </div>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold"
            style={{ background: "var(--color-warning-dim)", color: "var(--color-warning)" }}
          >
            <AlertCircle className="h-3 w-3" />
            Not assigned
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">
        {assistant ? (
          <div className="flex items-center gap-2">
            <Avatar name={assistant.name} />
            <span className="font-medium text-[var(--color-text-secondary)]">{assistant.name}</span>
          </div>
        ) : (
          "None"
        )}
      </td>
      <td className="px-4 py-3">
        <span className="rounded-full bg-[var(--color-bg-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">{item.arm ?? item.section ?? "Section"}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[var(--color-text-primary)]">{studentCount}</span>
          <span className="text-xs text-[var(--color-text-muted)]">/ {item.capacity}</span>
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
            <span className="block h-full rounded-full" style={{ width: `${capacityPercent}%`, ...capacityTone(capacityPercent) }} />
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <ActionMenu triggerLabel={`Actions for ${item.name}`}>
          <ActionMenuButton onClick={onView}>View class</ActionMenuButton>
          {canAssign ? <ActionMenuButton onClick={onAssign}>Assign teachers</ActionMenuButton> : null}
        </ActionMenu>
      </td>
    </tr>
  );
}

function ClassesSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-[14px] bg-[var(--color-bg-subtle)]" />
      ))}
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-[14px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-10 text-center">
      <BookOpen className="mx-auto h-8 w-8 text-[var(--color-text-muted)]" />
      <h3 className="mt-4 font-[var(--font-heading)] text-2xl font-bold text-[var(--color-text-primary)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{message}</p>
    </div>
  );
}

export function ClassesListClient({ initialResult }: { initialResult?: PaginatedResponse<ClassListItem> }) {
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
    initialResult,
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
    <div className="portal-page">
      <section className="surface-hero overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-[var(--color-accent-primary)] via-[var(--color-gold)] to-[#0d2315]" />
        <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[var(--color-text-accent)]">Academic Structure</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black tracking-tight text-[var(--color-text-primary)]">Classes</h1>
            <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Manage Nigerian class levels and arms from Nursery through Primary, JSS, and SS, including form teacher
              assignments, capacity, rooms, students, attendance, results, and Early Years skills.
            </p>
          </div>
          <CanDo permission="classes.create">
            <button type="button" onClick={() => setCreatingClass(true)} className="btn-primary px-5">
              <Plus className="h-4 w-4" />
              Add Class
            </button>
          </CanDo>
        </div>
      </section>

      <section className="surface-card p-4">
        <div className="flex flex-wrap gap-3">
          <label className="relative min-w-[220px] flex-1 md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                updateFilters({ search: event.target.value });
              }}
              placeholder="Search classes, arms, short codes..."
              className="field-control pl-10"
            />
          </label>
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              updateFilters({ category: event.target.value });
            }}
            className="field-select"
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
            className="field-select"
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
                  <span
                    className="rounded-full border px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.22em]"
                    style={categoryTone[group]}
                  >
                    {group}
                  </span>
                  <span className="h-px flex-1 bg-[var(--color-border-default)]" />
                  <span className="text-xs font-medium text-[var(--color-text-muted)]">{items.length} classes</span>
                </div>
                <div className="surface-card overflow-hidden p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-sm">
                      <thead className="bg-[var(--color-bg-subtle)] text-left text-[0.67rem] font-black uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
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
                      <tbody className="divide-y divide-[var(--color-border-default)]">
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
  const formId = "create-class-form";

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
    <SidePanel
      open
      onClose={onClose}
      size="md"
      title="Create class arm"
      subtitle="Set up a class such as JSS 1 A, Primary 4 B, or SS 2 Science without leaving the class registry."
      footer={(
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary px-5">
            Cancel
          </button>
          <button form={formId} disabled={saving} className="btn-primary px-5">
            {saving ? "Creating..." : "Create class"}
          </button>
        </div>
      )}
    >
      <form id={formId} onSubmit={submit} className="grid gap-4">
        <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] p-4 text-[13px] text-[var(--color-text-secondary)]">
          <p className="font-semibold text-[var(--color-text-primary)]">Class setup</p>
          <p className="mt-1">Create the class identity first, then assign teachers and timetable ownership from the class workspace.</p>
        </div>
          {error ? (
            <div
              className="rounded-2xl border px-4 py-3 text-sm font-medium"
              style={{ borderColor: "var(--color-danger)", background: "var(--color-danger-dim)", color: "var(--color-danger)" }}
            >
              {error}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)]">
              Level
              <select name="level" required className="field-select">
                {["Nursery 1", "Nursery 2", "KG 1", "KG 2", "KG / Reception", "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6", "JSS 1", "JSS 2", "JSS 3", "SSS 1", "SSS 2", "SSS 3"].map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)]">
              Arm / Section
              <input name="section" required placeholder="A, B, Science, Arts" className="field-control" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)]">
              Category
              <select name="category" className="field-select">
                {categoryOrder.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)]">
              Short name
              <input name="shortName" placeholder="J1A" className="field-control" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)]">
              Capacity
              <input name="capacity" type="number" min={1} max={250} defaultValue={40} className="field-control" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)]">
              Room
              <input name="room" placeholder="Block B Room 3" className="field-control" />
            </label>
          </div>
      </form>
    </SidePanel>
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
  const formId = `assign-class-teacher-${classItem.id}`;

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
    <SidePanel
      open
      onClose={onClose}
      size="lg"
      title={classItem.name}
      subtitle="Assign the form teacher and assistant without losing your place in the class list."
      footer={(
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary px-5">
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            disabled={saving}
            className="btn-primary px-5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save assignment"}
          </button>
        </div>
      )}
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="grid gap-5"
      >
          <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] p-4 text-[13px] text-[var(--color-text-secondary)]">
            <p className="font-semibold text-[var(--color-text-primary)]">Class ownership</p>
            <p className="mt-1">Form teachers own morning attendance, parent follow-up, and class welfare. Assistant teachers provide continuity when the class teacher is unavailable.</p>
          </div>
          {error ? (
            <div
              className="rounded-2xl border px-4 py-3 text-sm font-medium"
              style={{ borderColor: "var(--color-danger)", background: "var(--color-danger-dim)", color: "var(--color-danger)" }}
            >
              {error}
            </div>
          ) : null}
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search teaching staff..."
              className="field-control pl-10"
            />
          </label>
          <TeacherSelect label="Form Teacher" teachers={filteredTeachers} value={teacherId} onChange={(value) => { setTeacherId(value); if (assistantId === value) setAssistantId(""); }} />
          <TeacherSelect label="Assistant Form Teacher" optional teachers={filteredTeachers.filter((teacher) => teacher.id !== teacherId)} value={assistantId} onChange={setAssistantId} />
      </form>
    </SidePanel>
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
      <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        {label} {optional ? <span className="font-medium normal-case tracking-normal text-[var(--color-text-muted)]">(optional)</span> : null}
      </p>
      <div className="grid max-h-56 gap-1 overflow-y-auto rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-2">
        <button
          type="button"
          onClick={() => onChange("")}
          className={cn(
            "rounded-2xl px-3 py-2 text-left text-sm font-semibold transition",
            value === ""
              ? "bg-[var(--color-bg-surface)] text-[var(--color-text-accent)] shadow-sm"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)]",
          )}
        >
          No {label.toLowerCase()}
        </button>
        {teachers.map((teacher) => (
          <button
            key={teacher.id}
            type="button"
            onClick={() => onChange(teacher.id)}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-2 text-left transition",
              value === teacher.id
                ? "bg-[var(--color-bg-surface)] text-[var(--color-text-accent)] shadow-sm"
                : "hover:bg-[var(--color-bg-surface)]",
            )}
          >
            <Avatar name={`${teacher.firstName} ${teacher.lastName}`} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{teacher.firstName} {teacher.lastName}</span>
              <span className="block truncate text-xs text-[var(--color-text-muted)]">{teacher.email}</span>
            </span>
            {teacher.currentClassName ? (
              <span
                className="rounded-full px-2 py-1 text-[0.65rem] font-bold"
                style={{ background: "var(--color-warning-dim)", color: "var(--color-warning)" }}
              >
                {teacher.currentClassName}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
