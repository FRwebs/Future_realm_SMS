"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowLeft, Award, CheckCircle2, ClipboardCheck, DoorOpen, Star, UserCheck, Users } from "lucide-react";

import { CanDo, usePermissions } from "@/components/auth/permission-provider";
import { ActionMenu, ActionMenuButton, ActionMenuLink } from "@/components/ui/action-menu";
import { Pagination } from "@/components/ui/pagination";
import { StudentQuickViewPanel } from "@/components/students/student-quick-view-panel";
import { usePagination } from "@/hooks/use-pagination";
import { cn } from "@/lib/utils/cn";
import type { ClassListItem } from "./classes-list-client";

export type ClassDetail = ClassListItem & {
  academicYear?: { name: string } | null;
  academic_year?: { name: string } | null;
  currentTerm?: { name: string } | null;
  current_term?: { name: string } | null;
  subjects: Array<{ id: string; name: string; code: string; teacherName?: string | null; teacher_name?: string | null }>;
  timetable: { totalSlots: number; total_slots: number; isSetUp: boolean; is_set_up: boolean; isPublished: boolean; is_published: boolean };
  results: { totalSubjects: number; total_subjects: number; submittedSubjects: number; submitted_subjects: number; progressPercent: number; progress_percent: number };
  attendance: { averagePercent: number | null; average_percent: number | null; totalRecords: number; total_records: number };
};

type ClassMember = {
  id: string;
  sn: number;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  admissionNumber?: string;
  admission_number?: string;
  gender: string;
  parentName?: string | null;
  parent_name?: string | null;
  status: string;
};
export type ClassMembersResponse = {
  data: ClassMember[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type ResultSubject = { id: string; name: string; code: string };
type ResultSubjectScore = { subjectId?: string; subject_id?: string; totalScore?: number | null; total_score?: number | null };
type ResultStudent = {
  studentId?: string;
  student_id?: string;
  studentName?: string;
  student_name?: string;
  subjects: ResultSubjectScore[];
  average?: number | null;
  grade?: string | null;
  position?: number;
};
type ResultData = { students: ResultStudent[]; subjects: ResultSubject[] };

type AttendanceSummary = {
  studentId?: string;
  student_id?: string;
  studentName?: string;
  student_name?: string;
  totalDays?: number;
  total_days?: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  percentage: number;
};

type SkillDefinitionView = { id: string; name: string; category: string };
type SkillsData = { definitions: SkillDefinitionView[]; ratings: Array<{ studentId: string }> };

async function apiJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "include", headers: { Accept: "application/json" } });
  const body = await response.json();
  if (!response.ok || body.ok === false || body.success === false) throw new Error(body.error ?? body.message ?? "Request failed.");
  return body.data as T;
}

function gradeStyle(score?: number | null): CSSProperties {
  if (score === null || score === undefined) return { color: "var(--color-text-muted)" };
  if (score >= 70) return { color: "var(--color-success)" };
  if (score >= 50) return { color: "var(--color-warning)" };
  return { color: "var(--color-danger)" };
}

function ordinal(value?: number) {
  if (!value) return "-";
  const suffix = value % 100 >= 11 && value % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][value % 10] ?? "th";
  return `${value}${suffix}`;
}

function Hero({ detail }: { detail: ClassDetail }) {
  const gradients: Record<string, string> = {
    "Early Years": "from-violet-600 via-purple-600 to-fuchsia-500",
    Primary: "from-blue-700 via-sky-600 to-cyan-500",
    "Junior Secondary": "from-teal-700 via-emerald-600 to-green-500",
    "Senior Secondary": "from-orange-700 via-amber-600 to-rose-500",
  };
  const categoryGradient = gradients[detail.category] ?? "from-ink via-brand-800 to-brand-600";
  const studentCount = detail.studentCount ?? detail.student_count ?? 0;
  const fullness = detail.capacity ? Math.round((studentCount / detail.capacity) * 100) : 0;

  return (
    <section className="surface-hero">
      <div className={cn("h-2 bg-gradient-to-r", categoryGradient)} />
      <div className="p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.5rem] bg-gradient-to-br text-sm font-black text-white shadow-lg", categoryGradient)}>
            {detail.shortName}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--color-text-accent)]">{detail.category}</p>
                <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black tracking-tight text-[var(--color-text-primary)]">{detail.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
                  <span>{detail.level}</span>
                  <span>/</span>
                  <span>{detail.arm ?? detail.section}</span>
                  {detail.room ? (
                    <>
                      <span>/</span>
                      <span className="inline-flex items-center gap-1"><DoorOpen className="h-3.5 w-3.5" /> {detail.room}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <CanDo permission="classes.edit">
                <button className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] shadow-sm transition hover:bg-[var(--color-bg-subtle)]">
                  Edit Class
                </button>
              </CanDo>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat label="Students" value={`${studentCount}/${detail.capacity}`} note={`${fullness}% full`} icon={Users} />
              <MiniStat label="Form Teacher" value={(detail.classTeacher ?? detail.class_teacher)?.name ?? "Not assigned"} note="Morning attendance owner" icon={UserCheck} />
              <MiniStat label="Attendance" value={`${detail.attendance.averagePercent ?? detail.attendance.average_percent ?? 0}%`} note="Current term average" icon={ClipboardCheck} />
              <MiniStat label="Results" value={`${detail.results.progressPercent ?? detail.results.progress_percent}%`} note="Entry progress" icon={Award} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniStat({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Users }) {
  return (
    <div className="surface-card p-4">
      <Icon className="h-4 w-4 text-[var(--color-text-accent)]" />
      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 truncate text-[22px] font-bold text-[var(--color-text-primary)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">{note}</p>
    </div>
  );
}

export function ClassDetailClient({
  classId,
  initialDetail,
  initialMembers,
}: {
  classId: string;
  initialDetail?: ClassDetail | null;
  initialMembers?: ClassMembersResponse | null;
}) {
  const { hasPermission } = usePermissions();
  const [detail, setDetail] = useState<ClassDetail | null>(initialDetail ?? null);
  const [loading, setLoading] = useState(!initialDetail);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("members");

  useEffect(() => {
    if (initialDetail && initialDetail.id === classId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiJson<ClassDetail>(`/api/v1/classes/${classId}`)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load class.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [classId, initialDetail]);

  if (loading) return <div className="h-96 animate-pulse rounded-[14px] bg-[var(--color-bg-subtle)]" />;
  if (error || !detail)
    return (
      <div className="rounded-[14px] p-8" style={{ background: "var(--color-danger-dim)", color: "var(--color-danger)" }}>
        {error ?? "Class not found."}
      </div>
    );

  const tabs = [
    { id: "members", label: "Class Members", icon: Users },
    { id: "results", label: "Results", icon: Award, permission: "results.view" },
    ...(detail.category === "Early Years" ? [{ id: "skills", label: "Skills", icon: Star, permission: "results.view" }] : []),
    { id: "attendance", label: "Attendance", icon: ClipboardCheck, permission: "attendance.view" },
    { id: "teacher", label: "Form Teacher", icon: UserCheck },
  ];

  return (
    <div className="portal-page">
      <Link href="/classes" className="inline-flex w-fit items-center gap-2 text-[13px] font-semibold text-[var(--color-text-accent)]">
        <ArrowLeft className="h-4 w-4" />
        Back to classes
      </Link>
      <Hero detail={detail} />

      <section className="surface-card overflow-hidden p-0">
        <div className="flex gap-1 overflow-x-auto border-b border-[var(--color-border-default)] px-3 pt-3">
          {tabs.map((tab) => {
            if (tab.permission && !hasPermission(tab.permission)) return null;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-t-2xl px-4 py-3 text-sm font-semibold transition",
                  activeTab === tab.id
                    ? "bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-secondary)]",
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="p-5">
          {activeTab === "members" ? <MembersTab classId={classId} className={detail.name} initialMembers={initialMembers} /> : null}
          {activeTab === "results" ? <ResultsTab classId={classId} /> : null}
          {activeTab === "skills" ? <SkillsTab classId={classId} /> : null}
          {activeTab === "attendance" ? <AttendanceTab classId={classId} /> : null}
          {activeTab === "teacher" ? <TeacherTab detail={detail} /> : null}
        </div>
      </section>
    </div>
  );
}

function MembersTab({
  classId,
  className,
  initialMembers,
}: {
  classId: string;
  className: string;
  initialMembers?: ClassMembersResponse | null;
}) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const fetchMembers = useCallback(async (params: { page: number; pageSize: number }) => {
    const data = await apiJson<ClassMembersResponse>(`/api/v1/classes/${classId}/members?page=${params.page}&pageSize=${params.pageSize}`);
    return { data: data.data, total: data.total };
  }, [classId]);
  const { data, totalItems, currentPage, pageSize, isLoading, setCurrentPage, setPageSize } = usePagination({
    fetchFn: fetchMembers,
    defaultPageSize: 25,
    defaultFilters: {},
    initialResult: initialMembers ? { data: initialMembers.data, total: initialMembers.total } : undefined,
  });
  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-black text-[var(--color-text-primary)]">Class Members</h2>
        <p className="text-sm text-[var(--color-text-muted)]">{totalItems} students in {className}</p>
      </div>
      <div className="overflow-x-auto rounded-[10px] border border-[var(--color-border-default)]">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-[var(--color-bg-subtle)] text-left text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            <tr><th className="px-4 py-3">S/N</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Admission No.</th><th className="px-4 py-3">Gender</th><th className="px-4 py-3">Parent</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-default)]">
            {isLoading ? <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--color-text-muted)]">Loading students...</td></tr> : null}
            {!isLoading && data.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--color-text-muted)]">No students enrolled in this class yet.</td></tr> : null}
            {!isLoading && data.map((student) => (
              <tr key={student.id} className="hover:bg-[var(--color-bg-subtle)]">
                <td className="px-4 py-3 text-[var(--color-text-muted)]">{student.sn}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setSelectedStudentId(student.id)}
                    className="font-semibold text-[var(--color-text-primary)] transition hover:text-[var(--color-text-accent)]"
                  >
                    {student.lastName ?? student.last_name}, {student.firstName ?? student.first_name}
                  </button>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">{student.admissionNumber ?? student.admission_number}</td>
                <td className="px-4 py-3 text-[var(--color-text-muted)]">{student.gender}</td>
                <td className="px-4 py-3 text-[var(--color-text-muted)]">{student.parentName ?? student.parent_name ?? "-"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full px-2 py-1 text-xs font-bold" style={{ background: "var(--color-success-dim)", color: "var(--color-success)" }}>
                    {student.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <ActionMenu triggerLabel={`Actions for ${(student.firstName ?? student.first_name) ?? "student"}`}>
                    <ActionMenuButton onClick={() => setSelectedStudentId(student.id)}>
                      Quick view
                    </ActionMenuButton>
                    <ActionMenuLink href={`/students/${student.id}`}>
                      Open full profile
                    </ActionMenuLink>
                  </ActionMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={currentPage} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} pageSizeOptions={[10, 25, 50]} />
      <StudentQuickViewPanel studentId={selectedStudentId} open={Boolean(selectedStudentId)} onClose={() => setSelectedStudentId(null)} />
    </div>
  );
}

function ResultsTab({ classId }: { classId: string }) {
  const [data, setData] = useState<ResultData | null>(null);
  useEffect(() => { apiJson<ResultData>(`/api/v1/classes/${classId}/results`).then(setData).catch(() => setData({ students: [], subjects: [] })); }, [classId]);
  if (!data) return <div className="py-8 text-center text-[var(--color-text-muted)]">Loading result summary...</div>;
  return (
    <div className="grid gap-4">
      <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
        <p className="text-sm font-bold text-[var(--color-text-primary)]">Result Broadsheet</p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{data.subjects.length} subjects configured for this class.</p>
      </div>
      <div className="overflow-auto rounded-[10px] border border-[var(--color-border-default)]">
        <table className="min-w-full text-xs">
          <thead className="bg-[var(--color-bg-subtle)] text-left font-black uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
            <tr><th className="sticky left-0 bg-[var(--color-bg-subtle)] px-4 py-3">Student</th>{data.subjects.map((subject) => <th key={subject.id} className="px-3 py-3 text-center">{subject.code}</th>)}<th className="px-3 py-3 text-center">Avg</th><th className="px-3 py-3 text-center">Grade</th><th className="px-3 py-3 text-center">Position</th></tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-default)]">
            {data.students.map((student) => (
              <tr key={student.studentId ?? student.student_id}>
                <td className="sticky left-0 bg-[var(--color-bg-surface)] px-4 py-3 font-semibold text-[var(--color-text-primary)]">{student.studentName ?? student.student_name}</td>
                {data.subjects.map((subject) => {
                  const subjectScore = student.subjects.find((item) => (item.subjectId ?? item.subject_id) === subject.id);
                  const score = subjectScore?.totalScore ?? subjectScore?.total_score ?? null;
                  return <td key={subject.id} className="px-3 py-3 text-center font-bold" style={gradeStyle(score)}>{score ?? "-"}</td>;
                })}
                <td className="px-3 py-3 text-center font-bold" style={gradeStyle(student.average)}>{student.average ?? "-"}</td>
                <td className="px-3 py-3 text-center font-bold text-[var(--color-text-primary)]">{student.grade ?? "-"}</td>
                <td className="px-3 py-3 text-center font-bold text-[var(--color-text-primary)]">{ordinal(student.position)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AttendanceTab({ classId }: { classId: string }) {
  const [data, setData] = useState<{ summary: AttendanceSummary[] } | null>(null);
  useEffect(() => { apiJson<{ summary: AttendanceSummary[] }>(`/api/v1/classes/${classId}/attendance`).then(setData).catch(() => setData({ summary: [] })); }, [classId]);
  if (!data) return <div className="py-8 text-center text-[var(--color-text-muted)]">Loading attendance...</div>;
  return (
    <div className="overflow-x-auto rounded-[10px] border border-[var(--color-border-default)]">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-[var(--color-bg-subtle)] text-left text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
          <tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Days</th><th className="px-4 py-3">Present</th><th className="px-4 py-3">Late</th><th className="px-4 py-3">Absent</th><th className="px-4 py-3">Excused</th><th className="px-4 py-3">%</th></tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-default)]">
          {data.summary.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--color-text-muted)]">No attendance records yet.</td></tr> : null}
          {data.summary.map((item) => (
            <tr key={item.studentId ?? item.student_id}>
              <td className="px-4 py-3 font-semibold text-[var(--color-text-primary)]">{item.studentName ?? item.student_name}</td>
              <td className="px-4 py-3">{item.totalDays ?? item.total_days}</td>
              <td className="px-4 py-3 text-[var(--color-success)]">{item.present}</td>
              <td className="px-4 py-3 text-[var(--color-warning)]">{item.late}</td>
              <td className="px-4 py-3 text-[var(--color-danger)]">{item.absent}</td>
              <td className="px-4 py-3 text-[var(--color-info)]">{item.excused}</td>
              <td className="px-4 py-3">
                <span
                  className="rounded-full px-2 py-1 text-xs font-black"
                  style={
                    item.percentage >= 75
                      ? { background: "var(--color-success-dim)", color: "var(--color-success)" }
                      : { background: "var(--color-danger-dim)", color: "var(--color-danger)" }
                  }
                >
                  {item.percentage}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SkillsTab({ classId }: { classId: string }) {
  const [data, setData] = useState<SkillsData | null>(null);
  useEffect(() => { apiJson<SkillsData>(`/api/v1/classes/${classId}/skills`).then(setData).catch(() => setData({ definitions: [], ratings: [] })); }, [classId]);
  if (!data) return <div className="py-8 text-center text-[var(--color-text-muted)]">Loading Early Years skills...</div>;
  const grouped = data.definitions.reduce<Record<string, SkillDefinitionView[]>>((acc, item) => ({ ...acc, [item.category]: [...(acc[item.category] ?? []), item] }), {});
  return (
    <div className="grid gap-4">
      <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4 text-sm text-[var(--color-text-muted)]">
        Early Years ratings: D = Developing, AP = Approaching, M = Meeting, E = Exceeding.
      </div>
      {Object.entries(grouped).map(([category, skills]) => (
        <div key={category} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
          <h3 className="font-black text-[var(--color-text-primary)]">{category}</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((skill) => <div key={skill.id} className="rounded-[10px] bg-[var(--color-bg-subtle)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)]">{skill.name}</div>)}
          </div>
        </div>
      ))}
      {data.ratings.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">No skill ratings have been recorded for this class yet.</p> : null}
    </div>
  );
}

function TeacherTab({ detail }: { detail: ClassDetail }) {
  const teacher = detail.classTeacher ?? detail.class_teacher;
  const assistant = detail.assistantClassTeacher ?? detail.assistant_class_teacher;
  const teacherCards = [
    { label: "Form Teacher", person: teacher },
    { label: "Assistant Form Teacher", person: assistant },
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      {teacherCards.map(({ label, person }) => (
        <div key={label} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">{label}</p>
          {person ? (
            <div className="mt-4 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-[var(--color-text-primary)] text-xs font-black text-[var(--color-bg-surface)]">{person.name.slice(0, 2).toUpperCase()}</span>
              <div><p className="font-black text-[var(--color-text-primary)]">{person.name}</p><p className="text-sm text-[var(--color-text-muted)]">{person.email}</p></div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--color-text-muted)]">Not assigned yet.</p>
          )}
        </div>
      ))}
      <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-5 lg:col-span-2">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Form Teacher Duties</p>
        <ul className="mt-3 grid gap-2 text-sm text-[var(--color-text-muted)] md:grid-cols-2">
          {["Take morning attendance daily", "Write form teacher comments on report cards", "Monitor welfare and conduct", "Communicate with parents", "Submit end-of-term class reports", "Coordinate support for struggling learners"].map((duty) => (
            <li key={duty} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--color-text-accent)]" /> {duty}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
