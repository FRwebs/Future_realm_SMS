"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Award, CheckCircle2, ClipboardCheck, DoorOpen, Star, UserCheck, Users } from "lucide-react";

import { CanDo, usePermissions } from "@/components/auth/permission-provider";
import { Pagination } from "@/components/ui/pagination";
import { usePagination } from "@/hooks/use-pagination";
import { cn } from "@/lib/utils/cn";
import type { ClassListItem } from "./classes-list-client";

type ClassDetail = ClassListItem & {
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

function gradeClass(score?: number | null) {
  if (score === null || score === undefined) return "text-ink/30";
  if (score >= 70) return "text-emerald-700";
  if (score >= 50) return "text-amber-700";
  return "text-rose-700";
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
    <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-panel backdrop-blur-xl">
      <div className={cn("h-2 bg-gradient-to-r", categoryGradient)} />
      <div className="p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.5rem] bg-gradient-to-br text-sm font-black text-white shadow-lg", categoryGradient)}>
            {detail.shortName}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-700">{detail.category}</p>
                <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-black tracking-tight text-ink">{detail.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink/58">
                  <span>{detail.level}</span>
                  <span className="text-ink/20">/</span>
                  <span>{detail.arm ?? detail.section}</span>
                  {detail.room ? (
                    <>
                      <span className="text-ink/20">/</span>
                      <span className="inline-flex items-center gap-1"><DoorOpen className="h-3.5 w-3.5" /> {detail.room}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <CanDo permission="classes.edit">
                <button className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink/68 shadow-sm transition hover:bg-sand">
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
    <div className="rounded-[1.25rem] border border-ink/8 bg-sand/45 p-4">
      <Icon className="h-4 w-4 text-brand-700" />
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink/40">{label}</p>
      <p className="mt-1 truncate text-lg font-black text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink/45">{note}</p>
    </div>
  );
}

export function ClassDetailClient({ classId }: { classId: string }) {
  const { hasPermission } = usePermissions();
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("members");

  useEffect(() => {
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
  }, [classId]);

  if (loading) return <div className="h-96 animate-pulse rounded-[2rem] bg-white/70" />;
  if (error || !detail) return <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-8 text-rose-700">{error ?? "Class not found."}</div>;

  const tabs = [
    { id: "members", label: "Class Members", icon: Users },
    { id: "results", label: "Results", icon: Award, permission: "results.view" },
    ...(detail.category === "Early Years" ? [{ id: "skills", label: "Skills", icon: Star, permission: "results.view" }] : []),
    { id: "attendance", label: "Attendance", icon: ClipboardCheck, permission: "attendance.view" },
    { id: "teacher", label: "Form Teacher", icon: UserCheck },
  ];

  return (
    <div className="grid gap-6">
      <Link href="/classes" className="inline-flex w-fit items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-ink/65 shadow-sm transition hover:bg-white">
        <ArrowLeft className="h-4 w-4" />
        Back to classes
      </Link>
      <Hero detail={detail} />

      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/88 shadow-panel backdrop-blur-xl">
        <div className="flex gap-1 overflow-x-auto border-b border-ink/8 px-3 pt-3">
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
                  activeTab === tab.id ? "bg-sand text-ink" : "text-ink/48 hover:bg-sand/55 hover:text-ink/75",
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="p-5">
          {activeTab === "members" ? <MembersTab classId={classId} className={detail.name} /> : null}
          {activeTab === "results" ? <ResultsTab classId={classId} /> : null}
          {activeTab === "skills" ? <SkillsTab classId={classId} /> : null}
          {activeTab === "attendance" ? <AttendanceTab classId={classId} /> : null}
          {activeTab === "teacher" ? <TeacherTab detail={detail} /> : null}
        </div>
      </section>
    </div>
  );
}

function MembersTab({ classId, className }: { classId: string; className: string }) {
  const fetchMembers = useCallback(async (params: { page: number; pageSize: number }) => {
    const data = await apiJson<{ data: ClassMember[]; total: number }>(`/api/v1/classes/${classId}/members?page=${params.page}&pageSize=${params.pageSize}`);
    return { data: data.data, total: data.total };
  }, [classId]);
  const { data, totalItems, currentPage, pageSize, isLoading, setCurrentPage, setPageSize } = usePagination({ fetchFn: fetchMembers, defaultPageSize: 25, defaultFilters: {} });
  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-black text-ink">Class Members</h2>
        <p className="text-sm text-ink/50">{totalItems} students in {className}</p>
      </div>
      <div className="overflow-x-auto rounded-[1.5rem] border border-ink/8">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-sand/70 text-left text-xs font-black uppercase tracking-[0.16em] text-ink/42">
            <tr><th className="px-4 py-3">S/N</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Admission No.</th><th className="px-4 py-3">Gender</th><th className="px-4 py-3">Parent</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-ink/6">
            {isLoading ? <tr><td colSpan={6} className="px-4 py-8 text-center text-ink/45">Loading students...</td></tr> : null}
            {!isLoading && data.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-ink/45">No students enrolled in this class yet.</td></tr> : null}
            {!isLoading && data.map((student) => (
              <tr key={student.id} className="hover:bg-sand/35">
                <td className="px-4 py-3 text-ink/40">{student.sn}</td>
                <td className="px-4 py-3 font-semibold text-ink">{student.lastName ?? student.last_name}, {student.firstName ?? student.first_name}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink/55">{student.admissionNumber ?? student.admission_number}</td>
                <td className="px-4 py-3 text-ink/60">{student.gender}</td>
                <td className="px-4 py-3 text-ink/60">{student.parentName ?? student.parent_name ?? "-"}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{student.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={currentPage} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} pageSizeOptions={[10, 25, 50]} />
    </div>
  );
}

function ResultsTab({ classId }: { classId: string }) {
  const [data, setData] = useState<ResultData | null>(null);
  useEffect(() => { apiJson<ResultData>(`/api/v1/classes/${classId}/results`).then(setData).catch(() => setData({ students: [], subjects: [] })); }, [classId]);
  if (!data) return <div className="py-8 text-center text-ink/45">Loading result summary...</div>;
  return (
    <div className="grid gap-4">
      <div className="rounded-[1.5rem] border border-ink/8 bg-sand/45 p-4">
        <p className="text-sm font-bold text-ink">Result Broadsheet</p>
        <p className="mt-1 text-sm text-ink/55">{data.subjects.length} subjects configured for this class.</p>
      </div>
      <div className="overflow-auto rounded-[1.5rem] border border-ink/8">
        <table className="min-w-full text-xs">
          <thead className="bg-sand/70 text-left font-black uppercase tracking-[0.14em] text-ink/42">
            <tr><th className="sticky left-0 bg-sand px-4 py-3">Student</th>{data.subjects.map((subject) => <th key={subject.id} className="px-3 py-3 text-center">{subject.code}</th>)}<th className="px-3 py-3 text-center">Avg</th><th className="px-3 py-3 text-center">Grade</th><th className="px-3 py-3 text-center">Position</th></tr>
          </thead>
          <tbody className="divide-y divide-ink/6">
            {data.students.map((student) => (
              <tr key={student.studentId ?? student.student_id}>
                <td className="sticky left-0 bg-white px-4 py-3 font-semibold text-ink">{student.studentName ?? student.student_name}</td>
                {data.subjects.map((subject) => {
                  const subjectScore = student.subjects.find((item) => (item.subjectId ?? item.subject_id) === subject.id);
                  const score = subjectScore?.totalScore ?? subjectScore?.total_score ?? null;
                  return <td key={subject.id} className={cn("px-3 py-3 text-center font-bold", gradeClass(score))}>{score ?? "-"}</td>;
                })}
                <td className={cn("px-3 py-3 text-center font-bold", gradeClass(student.average))}>{student.average ?? "-"}</td>
                <td className="px-3 py-3 text-center font-bold text-ink">{student.grade ?? "-"}</td>
                <td className="px-3 py-3 text-center font-bold text-ink">{ordinal(student.position)}</td>
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
  if (!data) return <div className="py-8 text-center text-ink/45">Loading attendance...</div>;
  return (
    <div className="overflow-x-auto rounded-[1.5rem] border border-ink/8">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-sand/70 text-left text-xs font-black uppercase tracking-[0.16em] text-ink/42">
          <tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Days</th><th className="px-4 py-3">Present</th><th className="px-4 py-3">Late</th><th className="px-4 py-3">Absent</th><th className="px-4 py-3">Excused</th><th className="px-4 py-3">%</th></tr>
        </thead>
        <tbody className="divide-y divide-ink/6">
          {data.summary.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-ink/45">No attendance records yet.</td></tr> : null}
          {data.summary.map((item) => (
            <tr key={item.studentId ?? item.student_id}>
              <td className="px-4 py-3 font-semibold text-ink">{item.studentName ?? item.student_name}</td>
              <td className="px-4 py-3">{item.totalDays ?? item.total_days}</td>
              <td className="px-4 py-3 text-emerald-700">{item.present}</td>
              <td className="px-4 py-3 text-amber-700">{item.late}</td>
              <td className="px-4 py-3 text-rose-700">{item.absent}</td>
              <td className="px-4 py-3 text-blue-700">{item.excused}</td>
              <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-1 text-xs font-black", item.percentage >= 75 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>{item.percentage}%</span></td>
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
  if (!data) return <div className="py-8 text-center text-ink/45">Loading Early Years skills...</div>;
  const grouped = data.definitions.reduce<Record<string, SkillDefinitionView[]>>((acc, item) => ({ ...acc, [item.category]: [...(acc[item.category] ?? []), item] }), {});
  return (
    <div className="grid gap-4">
      <div className="rounded-[1.5rem] border border-ink/8 bg-sand/45 p-4 text-sm text-ink/60">
        Early Years ratings: D = Developing, AP = Approaching, M = Meeting, E = Exceeding.
      </div>
      {Object.entries(grouped).map(([category, skills]) => (
        <div key={category} className="rounded-[1.5rem] border border-ink/8 bg-white p-4">
          <h3 className="font-black text-ink">{category}</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((skill) => <div key={skill.id} className="rounded-2xl bg-sand/50 px-3 py-2 text-sm font-medium text-ink/70">{skill.name}</div>)}
          </div>
        </div>
      ))}
      {data.ratings.length === 0 ? <p className="text-sm text-ink/45">No skill ratings have been recorded for this class yet.</p> : null}
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
        <div key={label} className="rounded-[1.5rem] border border-ink/8 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-ink/42">{label}</p>
          {person ? (
            <div className="mt-4 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-xs font-black text-white">{person.name.slice(0, 2).toUpperCase()}</span>
              <div><p className="font-black text-ink">{person.name}</p><p className="text-sm text-ink/50">{person.email}</p></div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink/50">Not assigned yet.</p>
          )}
        </div>
      ))}
      <div className="rounded-[1.5rem] border border-ink/8 bg-sand/45 p-5 lg:col-span-2">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-ink/42">Form Teacher Duties</p>
        <ul className="mt-3 grid gap-2 text-sm text-ink/62 md:grid-cols-2">
          {["Take morning attendance daily", "Write form teacher comments on report cards", "Monitor welfare and conduct", "Communicate with parents", "Submit end-of-term class reports", "Coordinate support for struggling learners"].map((duty) => (
            <li key={duty} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-brand-700" /> {duty}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
