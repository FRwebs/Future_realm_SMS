"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Filter,
  History,
  Mic,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UserMinus,
  UserX,
  Users,
  X,
} from "lucide-react";

import { useToast } from "@/components/ui/toast-provider";
import type {
  TeacherAttendanceEntryView,
  TeacherAttendanceWorkspaceView,
  TeacherPortalView,
} from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";

// ─── Types ────────────────────────────────────────────────────────────────────

type TeacherAttendanceClientProps = {
  portal: TeacherPortalView;
  attendance: TeacherAttendanceWorkspaceView;
  initialTab?: TabId;
};

type AttendanceStatus = TeacherAttendanceEntryView["status"];
type TabId = "register" | "history" | "insights";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  AttendanceStatus,
  {
    label: string;
    shortLabel: string;
    icon: React.ElementType;
    tone: string;
    dim: string;
  }
> = {
  PRESENT: {
    label: "Present",
    shortLabel: "P",
    icon: UserCheck,
    tone: "var(--color-success)",
    dim: "var(--color-success-dim)",
  },
  LATE: {
    label: "Late",
    shortLabel: "L",
    icon: Clock,
    tone: "var(--color-warning)",
    dim: "var(--color-warning-dim)",
  },
  ABSENT: {
    label: "Absent",
    shortLabel: "A",
    icon: UserX,
    tone: "var(--color-danger)",
    dim: "var(--color-danger-dim)",
  },
  EXCUSED: {
    label: "Excused",
    shortLabel: "E",
    icon: UserMinus,
    tone: "var(--color-info)",
    dim: "var(--color-info-dim)",
  },
};

const ALL_STATUSES: AttendanceStatus[] = ["PRESENT", "LATE", "ABSENT", "EXCUSED"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

function normalizeDay(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function attendanceKey(params: {
  studentId: string;
  classId: string;
  subjectId?: string;
  date: string;
}) {
  return `${params.studentId}:${params.classId}:${params.subjectId ?? "morning"}:${params.date}`;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function toMinutes(value?: string) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function statusChipStyle(status: AttendanceStatus) {
  const cfg = STATUS_CONFIG[status];
  return { background: cfg.dim, color: cfg.tone };
}

function statusButtonStyle(status: AttendanceStatus, active: boolean) {
  const cfg = STATUS_CONFIG[status];
  return active
    ? { background: cfg.tone, borderColor: cfg.tone, color: "var(--color-text-inverse)" }
    : { borderColor: cfg.dim, color: cfg.tone };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function paginate<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    totalPages,
    items: items.slice(start, start + pageSize),
  };
}

function UnmarkedBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-black"
      style={{ background: "var(--color-danger)", color: "var(--color-text-inverse)" }}
    >
      {count}
    </span>
  );
}

function PaginationControls({
  page,
  totalPages,
  onPageChange,
  label,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border-default)] px-4 py-3 text-sm">
      <p className="text-[var(--color-text-secondary)]">{label}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex h-9 items-center gap-1 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>
        <span className="rounded-xl bg-[var(--color-bg-subtle)] px-3 py-2 text-xs font-bold text-[var(--color-text-secondary)]">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex h-9 items-center gap-1 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TeacherAttendanceClient({
  portal,
  attendance,
  initialTab = "register",
}: TeacherAttendanceClientProps) {
  const { showToast } = useToast();
  const searchParams = useSearchParams();

  // ── State ──
  const [history, setHistory] = useState(attendance.records);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [search, setSearch] = useState("");
  const [classQuery, setClassQuery] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [marks, setMarks] = useState<Record<string, AttendanceStatus | undefined>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [setupExpanded, setSetupExpanded] = useState(false);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | "ALL" | "UNMARKED">("ALL");
  const [historyClassFilter, setHistoryClassFilter] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<AttendanceStatus | "ALL">("ALL");
  const [historyStudentId, setHistoryStudentId] = useState("");
  const [registerPage, setRegisterPage] = useState(1);
  const [classSummaryPage, setClassSummaryPage] = useState(1);
  const [studentSummaryPage, setStudentSummaryPage] = useState(1);
  const [historyLogPage, setHistoryLogPage] = useState(1);

  // ── Derived data ──
  const students = portal.students ?? [];

  const classRegisterAssignments = useMemo(
    () => portal.assignedClasses.filter((item) => item.classId && !item.subjectId),
    [portal.assignedClasses],
  );

  const teachingAssignments = useMemo(
    () => portal.assignedClasses.filter((item) => item.classId && item.subjectId),
    [portal.assignedClasses],
  );

  const classOptions = useMemo(() => {
    const seen = new Set<string>();
    return [...classRegisterAssignments, ...teachingAssignments]
      .filter((item) => item.classId)
      .filter((item) => {
        if (!item.classId || seen.has(item.classId)) return false;
        seen.add(item.classId);
        return true;
      })
      .map((item) => ({
        value: item.classId as string,
        label: formatNigeriaClassName(item.className),
        learners: item.learners,
      }));
  }, [classRegisterAssignments, teachingAssignments]);

  const registerOptions = useMemo(() => {
    const morningOptions = classRegisterAssignments.map((item) => ({
      key: `class:${item.classId}`,
      classId: item.classId as string,
      subjectId: "",
      label: formatNigeriaClassName(item.className),
      description: "Morning register",
      learners: item.learners,
      chipTone: "border-[var(--color-border-default)] bg-[var(--color-info-dim)] text-[var(--color-info)]",
    }));

    const subjectOptions = teachingAssignments.map((item) => ({
      key: `subject:${item.classId}:${item.subjectId}`,
      classId: item.classId as string,
      subjectId: item.subjectId as string,
      label: `${item.subject} · ${formatNigeriaClassName(item.className)}`,
      description: "Subject period",
      learners: item.learners,
      chipTone: "border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]",
    }));

    return [...subjectOptions, ...morningOptions];
  }, [classRegisterAssignments, teachingAssignments]);

  const smartContextOption = useMemo(() => {
    const todayName = new Intl.DateTimeFormat("en-NG", { weekday: "long" }).format(new Date());
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const todaySlots = portal.weeklyTimetable
      .filter((entry) => entry.day.toLowerCase() === todayName.toLowerCase())
      .map((entry) => {
        const start = toMinutes(entry.startsAt);
        const end = toMinutes(entry.endsAt);
        const option = registerOptions.find(
          (item) =>
            item.classId === entry.classId &&
            item.subjectId === (entry.subjectId ?? ""),
        );
        return option
          ? {
              option,
              start,
              end,
              delta:
                start === null
                  ? Number.MAX_SAFE_INTEGER
                  : Math.min(
                      Math.abs(nowMinutes - start),
                      end === null ? Number.MAX_SAFE_INTEGER : Math.abs(nowMinutes - end),
                    ),
            }
          : null;
      })
      .filter(Boolean) as Array<{
      option: (typeof registerOptions)[number];
      start: number | null;
      end: number | null;
      delta: number;
    }>;

    const current = todaySlots.find(
      (slot) =>
        slot.start !== null &&
        slot.end !== null &&
        nowMinutes >= slot.start &&
        nowMinutes <= slot.end,
    );
    if (current) return current.option;

    const justFinished = todaySlots
      .filter((slot) => slot.end !== null && nowMinutes >= slot.end && nowMinutes - slot.end <= 90)
      .sort((left, right) => left.delta - right.delta)[0];
    if (justFinished) return justFinished.option;

    return registerOptions[0] ?? null;
  }, [portal.weeklyTimetable, registerOptions]);

  useEffect(() => {
    if (!smartContextOption) return;
    if (selectedClassId || selectedSubjectId) return;
    setSelectedClassId(smartContextOption.classId);
    setSelectedSubjectId(smartContextOption.subjectId);
  }, [selectedClassId, selectedSubjectId, smartContextOption]);

  useEffect(() => {
    if (!selectedClassId && !selectedSubjectId) return;
    const exists = registerOptions.some(
      (item) => item.classId === selectedClassId && item.subjectId === selectedSubjectId,
    );
    if (exists) return;
    const fallback = smartContextOption ?? registerOptions[0];
    setSelectedClassId(fallback?.classId ?? "");
    setSelectedSubjectId(fallback?.subjectId ?? "");
  }, [registerOptions, selectedClassId, selectedSubjectId, smartContextOption]);

  const selectedRegisterOption = useMemo(
    () =>
      registerOptions.find(
        (item) => item.classId === selectedClassId && item.subjectId === selectedSubjectId,
      ) ?? null,
    [registerOptions, selectedClassId, selectedSubjectId],
  );

  const selectedClassRegisterOptions = useMemo(
    () => registerOptions.filter((item) => item.classId === selectedClassId),
    [registerOptions, selectedClassId],
  );

  const selectedClassMeta = useMemo(
    () => classOptions.find((item) => item.value === selectedClassId) ?? null,
    [classOptions, selectedClassId],
  );

  const filteredClassOptions = useMemo(() => {
    const query = classQuery.trim().toLowerCase();
    if (!query) return classOptions;
    return classOptions.filter((item) => item.label.toLowerCase().includes(query));
  }, [classOptions, classQuery]);

  useEffect(() => {
    const requestedClassId = searchParams.get("classId");
    const requestedSubjectId = searchParams.get("subjectId") ?? "";
    const requestedTab = searchParams.get("tab");

    if (
      requestedClassId &&
      registerOptions.some(
        (item) =>
          item.classId === requestedClassId && item.subjectId === requestedSubjectId,
      )
    ) {
      setSelectedClassId(requestedClassId);
      setSelectedSubjectId(requestedSubjectId);
    }

    if (
      requestedTab === "register" ||
      requestedTab === "history" ||
      requestedTab === "insights"
    ) {
      setActiveTab(requestedTab);
    }
  }, [registerOptions, searchParams]);

  const classStudents = useMemo(
    () => students.filter((s) => !selectedClassId || s.classId === selectedClassId),
    [selectedClassId, students],
  );

  const visibleStudents = useMemo(() => {
    return classStudents.filter((s) => {
      const matchSearch =
        !search ||
        s.studentName.toLowerCase().includes(search.toLowerCase()) ||
        s.admissionNumber.toLowerCase().includes(search.toLowerCase());

      const mark = marks[s.studentId];
      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "UNMARKED" ? !mark : mark === statusFilter);

      return matchSearch && matchStatus;
    });
  }, [classStudents, search, marks, statusFilter]);

  const registerPagination = useMemo(
    () => paginate(visibleStudents, registerPage, 12),
    [registerPage, visibleStudents],
  );

  // Sync marks from history when class/date changes
  useEffect(() => {
    const nextMarks: Record<string, AttendanceStatus | undefined> = {};
    const nextNotes: Record<string, string> = {};
    const normalizedDate = normalizeDay(date);

    for (const item of history) {
      if (item.classId !== selectedClassId) continue;
      if ((item.subjectId ?? "") !== selectedSubjectId) continue;
      if (normalizeDay(item.date) !== normalizedDate) continue;
      nextMarks[item.studentId] = item.status;
      nextNotes[item.studentId] = item.reason ?? "";
    }

    setMarks(nextMarks);
    setNotes(nextNotes);
  }, [date, history, selectedClassId, selectedSubjectId]);

  const stats = useMemo(() => {
    const values = classStudents.map((s) => marks[s.studentId]);
    return {
      total: classStudents.length,
      present: values.filter((v) => v === "PRESENT").length,
      late: values.filter((v) => v === "LATE").length,
      absent: values.filter((v) => v === "ABSENT").length,
      excused: values.filter((v) => v === "EXCUSED").length,
      unmarked: values.filter((v) => !v).length,
    };
  }, [marks, classStudents]);

  const completionPct =
    stats.total === 0 ? 0 : Math.round(((stats.total - stats.unmarked) / stats.total) * 100);

  const selectedClassLabel =
    classOptions.find((c) => c.value === selectedClassId)?.label ?? "No class";
  const selectedRegisterLabel = selectedRegisterOption?.label ?? selectedClassLabel;
  const selectedContextKey = selectedRegisterOption?.key ?? "";

  const currentAcademicContext = `${attendance.currentTerm} · ${attendance.currentSession}`;

  const classTermSummaries = useMemo(() => {
    return classOptions.map((classOption) => {
      const classRecords = history.filter((item) => item.classId === classOption.value);
      const schoolDays = new Set(classRecords.map((item) => normalizeDay(item.date)));
      const accounted = classRecords.filter((item) => item.status !== "ABSENT").length;
      const rate =
        classRecords.length === 0 ? 0 : Math.round((accounted / classRecords.length) * 100);

      return {
        classId: classOption.value,
        className: classOption.label,
        learners: classOption.learners,
        schoolDays: schoolDays.size,
        records: classRecords.length,
        rate,
        absent: classRecords.filter((item) => item.status === "ABSENT").length,
        late: classRecords.filter((item) => item.status === "LATE").length,
        lastMarkedAt: classRecords[0]?.date,
      };
    });
  }, [classOptions, history]);

  const filteredClassTermSummaries = useMemo(() => {
    return classTermSummaries.filter((item) => {
      const matchClass = !historyClassFilter || item.classId === historyClassFilter;
      const matchSearch =
        !historySearch || item.className.toLowerCase().includes(historySearch.toLowerCase());
      return matchClass && matchSearch;
    });
  }, [classTermSummaries, historyClassFilter, historySearch]);

  const studentTermSummaries = useMemo(() => {
    const relevantStudents = students.filter(
      (student) => !historyClassFilter || student.classId === historyClassFilter,
    );

    return relevantStudents
      .map((student) => {
        const studentRecords = history.filter((item) => item.studentId === student.studentId);
        const presentCount = studentRecords.filter((item) => item.status === "PRESENT").length;
        const lateCount = studentRecords.filter((item) => item.status === "LATE").length;
        const absentCount = studentRecords.filter((item) => item.status === "ABSENT").length;
        const excusedCount = studentRecords.filter((item) => item.status === "EXCUSED").length;
        const rate =
          studentRecords.length === 0
            ? 0
            : Math.round(
                ((presentCount + lateCount + excusedCount) / studentRecords.length) * 100,
              );

        return {
          studentId: student.studentId,
          studentName: student.studentName,
          classId: student.classId,
          className: student.className,
          admissionNumber: student.admissionNumber,
          rate,
          totalMarked: studentRecords.length,
          presentCount,
          lateCount,
          absentCount,
          excusedCount,
          recent: studentRecords.slice(0, 6),
        };
      })
      .filter((item) => item.totalMarked > 0)
      .sort((left, right) => {
        if (right.absentCount !== left.absentCount) return right.absentCount - left.absentCount;
        return left.studentName.localeCompare(right.studentName);
      });
  }, [history, historyClassFilter, students]);

  const filteredStudentTermSummaries = useMemo(() => {
    return studentTermSummaries.filter((item) => {
      const matchSearch =
        !historySearch ||
        item.studentName.toLowerCase().includes(historySearch.toLowerCase()) ||
        item.admissionNumber.toLowerCase().includes(historySearch.toLowerCase()) ||
        item.className.toLowerCase().includes(historySearch.toLowerCase());

      const matchStatus =
        historyStatusFilter === "ALL" ||
        (historyStatusFilter === "PRESENT" && item.presentCount > 0) ||
        (historyStatusFilter === "LATE" && item.lateCount > 0) ||
        (historyStatusFilter === "ABSENT" && item.absentCount > 0) ||
        (historyStatusFilter === "EXCUSED" && item.excusedCount > 0);

      return matchSearch && matchStatus;
    });
  }, [historySearch, historyStatusFilter, studentTermSummaries]);

  const filteredHistoryRows = useMemo(() => {
    return history
      .filter((item) => !historyClassFilter || item.classId === historyClassFilter)
      .filter((item) => historyStatusFilter === "ALL" || item.status === historyStatusFilter)
      .filter((item) => {
        if (!historySearch) return true;
        const query = historySearch.toLowerCase();
        return [
          item.studentName,
          item.admissionNumber ?? "",
          item.className,
          item.reason ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [history, historyClassFilter, historySearch, historyStatusFilter]);

  const classSummaryPagination = useMemo(
    () => paginate(filteredClassTermSummaries, classSummaryPage, 6),
    [classSummaryPage, filteredClassTermSummaries],
  );
  const studentSummaryPagination = useMemo(
    () => paginate(filteredStudentTermSummaries, studentSummaryPage, 8),
    [filteredStudentTermSummaries, studentSummaryPage],
  );
  const historyLogPagination = useMemo(
    () => paginate(filteredHistoryRows, historyLogPage, 12),
    [filteredHistoryRows, historyLogPage],
  );

  useEffect(() => {
    if (
      historyStudentId &&
      filteredStudentTermSummaries.some((item) => item.studentId === historyStudentId)
    ) {
      return;
    }
    setHistoryStudentId(filteredStudentTermSummaries[0]?.studentId ?? "");
  }, [filteredStudentTermSummaries, historyStudentId]);

  const selectedStudentHistory = useMemo(
    () => filteredStudentTermSummaries.find((item) => item.studentId === historyStudentId) ?? null,
    [filteredStudentTermSummaries, historyStudentId],
  );

  useEffect(() => {
    setRegisterPage(1);
  }, [search, selectedClassId, statusFilter]);

  useEffect(() => {
    setClassSummaryPage(1);
    setStudentSummaryPage(1);
    setHistoryLogPage(1);
  }, [historyClassFilter, historySearch, historyStatusFilter]);

  const levelYearSummaries = useMemo(() => {
    const grouped = new Map<
      string,
      {
        label: string;
        records: number;
        presentEquivalent: number;
        absent: number;
        late: number;
        excused: number;
        classes: Set<string>;
        students: Set<string>;
      }
    >();

    for (const item of history) {
      const label = item.classLevel ?? item.className;
      const bucket =
        grouped.get(label) ??
        {
          label,
          records: 0,
          presentEquivalent: 0,
          absent: 0,
          late: 0,
          excused: 0,
          classes: new Set<string>(),
          students: new Set<string>(),
        };

      bucket.records += 1;
      bucket.classes.add(item.classId);
      bucket.students.add(item.studentId);
      if (item.status !== "ABSENT") bucket.presentEquivalent += 1;
      if (item.status === "ABSENT") bucket.absent += 1;
      if (item.status === "LATE") bucket.late += 1;
      if (item.status === "EXCUSED") bucket.excused += 1;
      grouped.set(label, bucket);
    }

    return Array.from(grouped.values())
      .map((item) => ({
        label: item.label,
        classCount: item.classes.size,
        studentCount: item.students.size,
        attendanceRate: item.records === 0 ? 0 : Math.round((item.presentEquivalent / item.records) * 100),
        absent: item.absent,
        late: item.late,
        excused: item.excused,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [history]);

  // Attendance trend (last 7 days)
  const trend = useMemo(() => {
    const dailyMap = new Map<string, { date: string; presentEquivalent: number; total: number }>();
    for (const item of history) {
      const iso = normalizeDay(item.date);
      const bucket = dailyMap.get(iso) ?? { date: iso, presentEquivalent: 0, total: 0 };
      bucket.total += 1;
      if (item.status !== "ABSENT") bucket.presentEquivalent += 1;
      dailyMap.set(iso, bucket);
    }

    return Array.from(dailyMap.values())
      .sort((left, right) => left.date.localeCompare(right.date))
      .slice(-10)
      .map((item) => ({ date: item.date, present: item.presentEquivalent, total: item.total }));
  }, [history]);

  // ── Handlers ──
  function handleMark(studentId: string, status: AttendanceStatus) {
    setMarks((cur) => ({
      ...cur,
      [studentId]: cur[studentId] === status ? undefined : status,
    }));
  }

  function handleNote(studentId: string, value: string) {
    setNotes((cur) => ({ ...cur, [studentId]: value }));
  }

  function handleSelectClass(nextClassId: string) {
    const optionsForClass = registerOptions.filter((item) => item.classId === nextClassId);
    const preferred =
      optionsForClass.find((item) => item.subjectId === "") ??
      optionsForClass[0] ??
      null;

    setSelectedClassId(nextClassId);
    setSelectedSubjectId(preferred?.subjectId ?? "");
  }

  function handleSelectContext(classId: string, subjectId: string) {
    setSelectedClassId(classId);
    setSelectedSubjectId(subjectId);
    setSetupExpanded(false);
  }

  function bulkMark(status: AttendanceStatus) {
    setMarks((cur) => {
      const next = { ...cur };
      for (const s of visibleStudents) next[s.studentId] = status;
      return next;
    });
    showToast({
      variant: "success",
      title: `All visible learners marked ${STATUS_CONFIG[status].label.toLowerCase()}`,
      description: `${visibleStudents.length} learners updated.`,
    });
  }

  function markUnmarked(status: AttendanceStatus) {
    setMarks((cur) => {
      const next = { ...cur };
      for (const s of classStudents) {
        if (!next[s.studentId]) next[s.studentId] = status;
      }
      return next;
    });
  }

  function clearCurrentView() {
    setMarks({});
    setNotes({});
  }

  function mergeHistory(records: TeacherAttendanceEntryView[]) {
    setHistory((cur) => {
      const map = new Map(
        cur.map((item) => [
          attendanceKey({
            studentId: item.studentId,
            classId: item.classId,
            subjectId: item.subjectId,
            date: normalizeDay(item.date),
          }),
          item,
        ]),
      );
      for (const item of records) {
        map.set(
          attendanceKey({
            studentId: item.studentId,
            classId: item.classId,
            subjectId: item.subjectId,
            date: normalizeDay(item.date),
          }),
          item,
        );
      }
      return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
    });
  }

  async function saveAttendance() {
    if (!selectedClassId) {
      showToast({
        variant: "warning",
        title: "Choose an attendance context first",
        description: "Select the class register or subject period you want to submit.",
      });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    if (date > today) {
      showToast({
        variant: "warning",
        title: "Future attendance is blocked",
        description: "Attendance can only be marked for today or an earlier school day.",
      });
      return;
    }

    const entries = classStudents.reduce<
      Array<{ studentId: string; status: AttendanceStatus; reason?: string }>
    >((acc, s) => {
      const status = marks[s.studentId];
      if (!status) return acc;
      acc.push({
        studentId: s.studentId,
        status,
        reason: notes[s.studentId]?.trim() || undefined,
      });
      return acc;
    }, []);

    if (!entries.length) {
      showToast({
        variant: "info",
        title: "Nothing to save",
        description: "Mark at least one learner before submitting attendance.",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/v1/teacher-portal/attendance/register", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCookie("fr_csrf") ?? "",
        },
        body: JSON.stringify({
          classId: selectedClassId,
          subjectId: selectedSubjectId || undefined,
          date,
          entries,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        data?: TeacherAttendanceEntryView[];
      };

      if (!response.ok || body.ok === false || !body.data) {
        throw new Error(body.error ?? "Unable to submit the attendance register.");
      }

      mergeHistory(body.data);
      showToast({
        variant: "success",
        title: "Attendance saved",
        description: `${body.data.length} record${body.data.length === 1 ? "" : "s"} saved for ${selectedRegisterLabel}.`,
      });
    } catch (error) {
      showToast({
        variant: "error",
        title: "Attendance could not be saved",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  // ── Empty state ──
  if (registerOptions.length === 0) {
    return (
      <div className="portal-page">
        <section className="surface-hero p-6 md:p-7">
          <Link
            href="/portals/teacher"
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text-accent)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to teacher portal
          </Link>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            Teacher portal
          </p>
          <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">
            Attendance register
          </h1>
        </section>
        <section className="surface-card border-dashed p-10 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-[var(--color-text-accent)]" />
          <h2 className="mt-4 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">
            No attendance contexts assigned yet
          </h2>
          <p className="mt-3 text-[13px] leading-6 text-[var(--color-text-secondary)]">
            Once timetable or homeroom assignments are connected to your account, your class registers
            and subject-period attendance workspaces will appear here automatically.
          </p>
        </section>
      </div>
    );
  }

  // ── Full render ──
  return (
    <div className="portal-page">
      {/* ── Header ── */}
      <section className="surface-hero p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl min-w-0">
            <Link
              href="/portals/teacher"
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text-accent)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to teacher portal
            </Link>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              Attendance workspace
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
              <h1 className="font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">
                Attendance register
              </h1>
              {stats.unmarked > 0 ? (
                <span
                  className="rounded-full px-3 py-1 text-[11px] font-bold"
                  style={{ background: "var(--color-danger-dim)", color: "var(--color-danger)" }}
                >
                  {stats.unmarked} pending
                </span>
              ) : (
                <span
                  className="rounded-full px-3 py-1 text-[11px] font-bold"
                  style={{ background: "var(--color-success-dim)", color: "var(--color-success)" }}
                >
                  Register complete
                </span>
              )}
            </div>
            <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
              {selectedRegisterLabel} ·{" "}
              {new Date(date).toLocaleDateString("en-NG", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}{" "}
              · {currentAcademicContext}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 xl:max-w-[32rem] xl:justify-end">
            <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
              {completionPct}% complete
            </span>
            <span
              className="rounded-full border px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: "var(--color-success-dim)", background: "var(--color-success-dim)", color: "var(--color-success)" }}
            >
              {stats.present} present
            </span>
            <span
              className="rounded-full border px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: "var(--color-warning-dim)", background: "var(--color-warning-dim)", color: "var(--color-warning)" }}
            >
              {stats.late} late
            </span>
            <span
              className="rounded-full border px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: "var(--color-danger-dim)", background: "var(--color-danger-dim)", color: "var(--color-danger)" }}
            >
              {stats.absent} absent
            </span>
            <span
              className="rounded-full border px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: "var(--color-info-dim)", background: "var(--color-info-dim)", color: "var(--color-info)" }}
            >
              {stats.excused} excused
            </span>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="mt-4 flex items-center border-t border-[var(--color-border-default)] pt-2">
          {(
            [
              { id: "register" as TabId, label: "Register", icon: ClipboardList },
              { id: "history" as TabId, label: "History", icon: History },
              { id: "insights" as TabId, label: "Insights", icon: TrendingUp },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`relative flex h-12 items-center gap-2 px-4 text-sm font-semibold transition ${
                activeTab === id
                  ? "text-[var(--color-text-accent)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {id === "register" && stats.unmarked > 0 && (
                <UnmarkedBadge count={stats.unmarked} />
              )}
              {activeTab === id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-[var(--color-accent-primary)]" />
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ══ TAB: REGISTER ══ */}
      {activeTab === "register" && (
        <div className="grid gap-5">
          <section className="surface-card p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-accent)]">
                    Register setup
                  </p>
                  <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
                    Open only when you need to switch class, register lane, or filter the working list.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                    {classOptions.length} classes
                  </span>
                  <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                    {selectedClassRegisterOptions.length} lane{selectedClassRegisterOptions.length === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSetupExpanded((current) => !current)}
                    className="btn-secondary h-9 rounded-full px-3"
                  >
                    <Filter className="h-4 w-4" />
                    {setupExpanded ? "Hide setup" : "Change setup"}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${setupExpanded ? "rotate-180" : ""}`} />
                  </button>
                </div>
                </div>
              </div>

              {setupExpanded ? (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-accent)]">
                        Class
                      </p>
                      <h3 className="mt-1 text-sm font-bold text-[var(--color-text-primary)]">Choose class</h3>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        Search, then tap a compact class chip.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                        {filteredClassOptions.length} shown
                      </span>
                      <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                        {classOptions.length} total
                      </span>
                    </div>
                  </div>
                  <label className="relative mt-4 block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                    <input
                      value={classQuery}
                      onChange={(e) => setClassQuery(e.target.value)}
                      placeholder="Search class e.g. SS2A"
                      className="field-control h-11 w-full pl-10 pr-10"
                    />
                    {classQuery && (
                      <button
                        type="button"
                        onClick={() => setClassQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </label>
                  <div className="mt-3 flex max-h-[9rem] gap-2 overflow-x-auto overflow-y-auto pb-1 pr-1 sm:max-h-[12rem] sm:flex-wrap sm:overflow-x-visible">
                    {filteredClassOptions.map((option) => {
                      const active = option.value === selectedClassId;
                      const contextsForClass = registerOptions.filter(
                        (item) => item.classId === option.value,
                      );
                      const morningCount = contextsForClass.filter((item) => item.subjectId === "").length;
                      const subjectCount = contextsForClass.filter((item) => item.subjectId !== "").length;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleSelectClass(option.value)}
                          className={
                            active
                              ? "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-left text-[var(--color-text-inverse)]"
                              : "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-left text-[var(--color-text-primary)] transition hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary-dim)]"
                          }
                          style={active ? { borderColor: "var(--color-accent-primary)", background: "var(--color-accent-primary)" } : undefined}
                        >
                          <span className="text-sm font-bold">{option.label}</span>
                          <span
                            className={
                              active
                                ? "rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white"
                                : "rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-text-secondary)]"
                            }
                          >
                            {option.learners}
                          </span>
                          {morningCount > 0 ? (
                            <span
                              className={
                                active
                                  ? "rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white"
                                  : "rounded-full border border-[var(--color-border-default)] bg-[var(--color-info-dim)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-info)]"
                              }
                            >
                              AM
                            </span>
                          ) : null}
                          {subjectCount > 0 ? (
                            <span
                              className={
                                active
                                  ? "rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white"
                                  : "rounded-full border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-text-accent)]"
                              }
                            >
                              {subjectCount} subj
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                    {filteredClassOptions.length === 0 ? (
                      <div className="w-full rounded-[10px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                        No class matches that search yet.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-accent)]">
                        Register lane
                      </p>
                      <h3 className="mt-1 text-sm font-bold text-[var(--color-text-primary)]">
                        Choose register context
                      </h3>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        Use a compact switcher here since only one lane can be active at a time.
                      </p>
                    </div>
                    {selectedClassMeta ? (
                      <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                        {selectedClassMeta.label}
                      </span>
                    ) : null}
                  </div>

                  {selectedClassRegisterOptions.length ? (
                    <div className="mt-3 grid gap-3">
                      <label className="grid gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                          Active lane
                        </span>
                        <select
                          value={selectedContextKey}
                          onChange={(e) => {
                            const next = selectedClassRegisterOptions.find((option) => option.key === e.target.value);
                            if (next) handleSelectContext(next.classId, next.subjectId);
                          }}
                          className="field-select h-11"
                        >
                          {selectedClassRegisterOptions.map((option) => {
                            const optionStudents = students.filter((s) => s.classId === option.classId);
                            const optionMarked = optionStudents.filter((s) => marks[s.studentId]).length;
                            const laneLabel = option.subjectId
                              ? option.label.split("·")[0]?.trim() ?? option.label
                              : "Morning register";

                            return (
                              <option key={option.key} value={option.key}>
                                {laneLabel} · {optionMarked}/{optionStudents.length} marked
                              </option>
                            );
                          })}
                        </select>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className="rounded-full border px-2.5 py-1 text-[10px] font-bold"
                          style={
                            selectedSubjectId
                              ? { borderColor: "var(--color-border-default)", background: "var(--color-accent-primary-dim)", color: "var(--color-text-accent)" }
                              : { borderColor: "var(--color-border-default)", background: "var(--color-info-dim)", color: "var(--color-info)" }
                          }
                        >
                          {selectedSubjectId ? "Subject period" : "Homeroom"}
                        </span>
                        <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2.5 py-1 text-[10px] font-bold text-[var(--color-text-secondary)]">
                          {stats.total} learners
                        </span>
                        {smartContextOption?.key === selectedContextKey ? (
                          <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] px-2.5 py-1 text-[10px] font-bold text-[var(--color-text-accent)]">
                            Smart pick
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-[10px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                      Pick a class first to reveal its morning and subject attendance contexts.
                    </div>
                  )}
                </div>
              </div>
              ) : null}

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px_180px] 2xl:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search learner or admission number"
                    className="field-control h-11 w-full pl-10 pr-10"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </label>

                <input
                  type="date"
                  value={date}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDate(e.target.value)}
                  className="field-control h-11"
                />

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as AttendanceStatus | "ALL" | "UNMARKED")}
                  className="field-select h-11"
                >
                  <option value="ALL">All learners ({classStudents.length})</option>
                  <option value="UNMARKED">Unmarked ({stats.unmarked})</option>
                  {ALL_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_CONFIG[status].label}
                    </option>
                  ))}
                </select>

                <div className="flex flex-wrap gap-2 xl:col-span-full 2xl:col-span-1">
                  <button
                    type="button"
                    onClick={() => bulkMark("PRESENT")}
                    className="btn-primary h-11 px-4"
                  >
                    <CheckCheck className="h-4 w-4" />
                    Mark visible present
                  </button>
                  <button
                    type="button"
                    onClick={() => markUnmarked("PRESENT")}
                    className="btn-secondary h-11 px-4"
                  >
                    <UserCheck className="h-4 w-4" />
                    Fill unmarked
                  </button>
                </div>
              </div>

              {selectedSubjectId ? (
                <div
                  className="rounded-[10px] border px-4 py-3 text-sm"
                  style={{ borderColor: "var(--color-border-default)", background: "var(--color-accent-primary-dim)", color: "var(--color-text-primary)" }}
                >
                  This register is attached to a subject period. Saved records stay separate from
                  morning homeroom attendance for{" "}
                  <span className="font-semibold">{selectedClassLabel}</span>.
                </div>
              ) : (
                <div
                  className="rounded-[10px] border px-4 py-3 text-sm"
                  style={{ borderColor: "var(--color-border-default)", background: "var(--color-info-dim)", color: "var(--color-text-primary)" }}
                >
                  This is the morning / homeroom register for{" "}
                  <span className="font-semibold">{selectedClassLabel}</span>.
                </div>
              )}
            </div>
          </section>

          <section className="surface-card overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-default)] px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {visibleStudents.length} learner{visibleStudents.length === 1 ? "" : "s"} in view
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Page {registerPagination.page} of {registerPagination.totalPages} · {stats.total - stats.unmarked} marked today
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={clearCurrentView}
                  className="btn-secondary h-9 px-4"
                >
                  <RotateCcw className="h-4 w-4" />
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("history")}
                  className="btn-secondary h-9 px-4"
                >
                  <History className="h-4 w-4" />
                  History
                </button>
              </div>
            </div>

            <div className="max-h-[58vh] overflow-y-auto overscroll-contain p-5">
              {visibleStudents.length === 0 ? (
                <div className="grid place-items-center rounded-[10px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] py-12 text-center">
                  <Users className="mx-auto h-8 w-8 text-[var(--color-text-muted)]" />
                  <p className="mt-3 text-sm font-semibold text-[var(--color-text-secondary)]">
                    No learners match the current filter
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Reset the search or attendance state filter to see the class register again.
                  </p>
                </div>
              ) : (
                <div className="grid gap-2.5">
                  {registerPagination.items.map((student, index) => {
                    const status = marks[student.studentId];
                    const isExpanded = expandedStudentId === student.studentId;
                    const cfg = status ? STATUS_CONFIG[status] : null;
                    const absoluteIndex = (registerPagination.page - 1) * 12 + index + 1;

                    return (
                      <article
                        key={student.studentId}
                        className={`group rounded-[10px] border bg-[var(--color-bg-surface)] transition-all duration-200 ${
                          cfg ? "" : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)]"
                        }`}
                        style={cfg ? { borderColor: cfg.tone, background: cfg.dim } : undefined}
                      >
                        <div className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-sm font-black transition ${
                                cfg ? "bg-[var(--color-bg-surface)]/70" : "bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]"
                              }`}
                              style={cfg ? { color: cfg.tone } : undefined}
                            >
                              {initials(student.studentName)}
                              <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-[var(--color-bg-subtle)] text-[8px] font-black text-[var(--color-text-secondary)]">
                                {absoluteIndex}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[var(--color-text-primary)]">{student.studentName}</p>
                              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                                {student.admissionNumber} · {formatNigeriaClassName(student.className)}
                              </p>
                            </div>
                          </div>

                          <div className="w-full xl:w-auto">
                            <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-[var(--color-bg-subtle)] p-1 sm:flex sm:flex-wrap sm:items-center sm:gap-1.5 sm:bg-transparent sm:p-0">
                            {ALL_STATUSES.map((opt) => {
                              const active = status === opt;
                              const optCfg = STATUS_CONFIG[opt];
                              const Icon = optCfg.icon;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => handleMark(student.studentId, opt)}
                                  title={optCfg.label}
                                  aria-pressed={active}
                                  className={`flex h-10 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-semibold transition sm:h-9 sm:rounded-full sm:px-3 sm:text-xs ${
                                    active ? "" : "bg-[var(--color-bg-surface)] hover:border-[var(--color-border-strong)]"
                                  }`}
                                  style={statusButtonStyle(opt, active)}
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                  <span className="font-bold sm:hidden">{optCfg.shortLabel}</span>
                                  <span className="hidden md:inline">{optCfg.label}</span>
                                </button>
                              );
                            })}
                            </div>
                            {status && status !== "PRESENT" && (
                              <button
                                type="button"
                                onClick={() => setExpandedStudentId(isExpanded ? null : student.studentId)}
                                className="btn-secondary mt-2 h-9 rounded-full px-3 text-xs"
                              >
                                <Mic className="h-3.5 w-3.5" />
                                <span>{notes[student.studentId] ? "Edit note" : "Add note"}</span>
                                <ChevronDown
                                  className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                />
                              </button>
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-[var(--color-border-default)] px-4 pb-4 pt-3">
                            <label className="grid gap-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                                Reason / follow-up note
                              </span>
                              <textarea
                                value={notes[student.studentId] ?? ""}
                                onChange={(e) => handleNote(student.studentId, e.target.value)}
                                placeholder="e.g. Parent called — sick with fever. Doctor's note expected tomorrow."
                                rows={2}
                                className="field-control min-h-[84px] resize-none px-3 py-2.5 text-sm"
                              />
                            </label>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <PaginationControls
              page={registerPagination.page}
              totalPages={registerPagination.totalPages}
              onPageChange={setRegisterPage}
              label={`${visibleStudents.length} learners filtered`}
            />
          </section>
        </div>
      )}

      {/* ══ TAB: HISTORY ══ */}
      {activeTab === "history" && (
        <div className="grid gap-5">
          <section className="surface-card p-5">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_220px_220px_auto]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search learner, class, admission number, or note"
                  className="field-control h-11 w-full pl-10 pr-10"
                />
                {historySearch && (
                  <button
                    type="button"
                    onClick={() => setHistorySearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </label>

              <select
                value={historyClassFilter}
                onChange={(e) => setHistoryClassFilter(e.target.value)}
                className="field-select h-11"
              >
                <option value="">All classes</option>
                {classOptions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>

              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value as AttendanceStatus | "ALL")}
                className="field-select h-11"
              >
                <option value="ALL">All statuses</option>
                {ALL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_CONFIG[status].label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  setHistorySearch("");
                  setHistoryClassFilter("");
                  setHistoryStatusFilter("ALL");
                }}
                className="btn-secondary h-11 px-4"
              >
                Reset filters
              </button>
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="surface-card overflow-hidden p-0">
              <div className="border-b border-[var(--color-border-default)] px-5 py-4">
                <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">
                  Class summary
                </h2>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Term attendance performance across your assigned class arms
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="bg-[var(--color-bg-subtle)]">
                    <tr>
                      {["Class", "Learners", "Recorded days", "Attendance", "Absences", "Last mark"].map((heading) => (
                        <th
                          key={heading}
                          className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {classSummaryPagination.items.map((item) => (
                      <tr key={item.classId} className="border-t border-[var(--color-border-default)] hover:bg-[var(--color-bg-subtle)]">
                        <td className="px-4 py-3 font-semibold text-[var(--color-text-primary)]">{item.className}</td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)]">{item.learners}</td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)]">{item.schoolDays}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-text-accent)]">
                            {item.rate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold" style={{ color: "var(--color-danger)" }}>{item.absent}</td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                          {item.lastMarkedAt ? formatShortDate(item.lastMarkedAt) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                page={classSummaryPagination.page}
                totalPages={classSummaryPagination.totalPages}
                onPageChange={setClassSummaryPage}
                label={`${filteredClassTermSummaries.length} class summaries`}
              />
            </section>

            <section className="surface-card overflow-hidden p-0">
              <div className="border-b border-[var(--color-border-default)] px-5 py-4">
                <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">
                  Student patterns
                </h2>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Focus on learners who need follow-up, then open their recent attendance trail.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="bg-[var(--color-bg-subtle)]">
                    <tr>
                      {["Learner", "Class", "Attendance", "Absent", "Late", "Recent history"].map((heading) => (
                        <th
                          key={heading}
                          className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {studentSummaryPagination.items.map((student) => (
                      <tr
                        key={student.studentId}
                        className={`border-t border-[var(--color-border-default)] transition hover:bg-[var(--color-bg-subtle)] ${
                          historyStudentId === student.studentId ? "bg-[var(--color-accent-primary-dim)]" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setHistoryStudentId(student.studentId)}
                            className="text-left"
                          >
                            <p className="font-semibold text-[var(--color-text-primary)]">{student.studentName}</p>
                            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{student.admissionNumber}</p>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)]">{formatNigeriaClassName(student.className)}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-text-accent)]">
                            {student.rate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold" style={{ color: "var(--color-danger)" }}>{student.absentCount}</td>
                        <td className="px-4 py-3 font-semibold" style={{ color: "var(--color-warning)" }}>{student.lateCount}</td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)]">{student.totalMarked} marked day(s)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                page={studentSummaryPagination.page}
                totalPages={studentSummaryPagination.totalPages}
                onPageChange={setStudentSummaryPage}
                label={`${filteredStudentTermSummaries.length} learner summaries`}
              />
            </section>
          </div>

          {selectedStudentHistory ? (
            <section className="surface-card overflow-hidden p-0">
              <div className="flex flex-col gap-4 border-b border-[var(--color-border-default)] px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">
                    {selectedStudentHistory.studentName}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {selectedStudentHistory.admissionNumber} · {formatNigeriaClassName(selectedStudentHistory.className)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl px-3 py-2 text-center" style={{ background: "var(--color-success-dim)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-success)" }}>Present</p>
                    <p className="mt-1 text-lg font-black" style={{ color: "var(--color-success)" }}>{selectedStudentHistory.presentCount}</p>
                  </div>
                  <div className="rounded-xl px-3 py-2 text-center" style={{ background: "var(--color-warning-dim)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-warning)" }}>Late</p>
                    <p className="mt-1 text-lg font-black" style={{ color: "var(--color-warning)" }}>{selectedStudentHistory.lateCount}</p>
                  </div>
                  <div className="rounded-xl px-3 py-2 text-center" style={{ background: "var(--color-danger-dim)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-danger)" }}>Absent</p>
                    <p className="mt-1 text-lg font-black" style={{ color: "var(--color-danger)" }}>{selectedStudentHistory.absentCount}</p>
                  </div>
                  <div className="rounded-xl px-3 py-2 text-center" style={{ background: "var(--color-info-dim)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-info)" }}>Excused</p>
                    <p className="mt-1 text-lg font-black" style={{ color: "var(--color-info)" }}>{selectedStudentHistory.excusedCount}</p>
                  </div>
                </div>
              </div>
              <div className="grid gap-2 p-5 md:grid-cols-2 xl:grid-cols-3">
                {selectedStudentHistory.recent.map((entry) => (
                  <div
                    key={`${entry.studentId}-${entry.date}`}
                    className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{formatShortDate(entry.date)}</p>
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                        style={statusChipStyle(entry.status)}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_CONFIG[entry.status].tone }} />
                        {STATUS_CONFIG[entry.status].label}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                      {entry.reason ?? "No follow-up note recorded for this day."}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="surface-card overflow-hidden p-0">
            <div className="border-b border-[var(--color-border-default)] px-5 py-4">
              <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">
                Attendance log
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Filtered term register entries for quick audit and follow-up.
              </p>
            </div>

            {filteredHistoryRows.length === 0 ? (
              <div className="grid place-items-center rounded-[10px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-5 py-12 m-5 text-center">
                <History className="mx-auto h-8 w-8 text-[var(--color-text-muted)]" />
                <p className="mt-3 text-sm font-semibold text-[var(--color-text-secondary)]">No history matches the current filter</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">Try another class, status, or search term.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[880px] text-sm">
                    <thead className="bg-[var(--color-bg-subtle)]">
                      <tr>
                        {["Date", "Learner", "Admission no.", "Class", "Status", "Note"].map((heading) => (
                          <th
                            key={heading}
                            className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historyLogPagination.items.map((entry) => (
                        <tr
                          key={`${entry.studentId}-${entry.classId}-${entry.date}`}
                          className="border-t border-[var(--color-border-default)] hover:bg-[var(--color-bg-subtle)]"
                        >
                          <td className="px-4 py-3 font-semibold text-[var(--color-text-primary)]">{formatShortDate(entry.date)}</td>
                          <td className="px-4 py-3 font-semibold text-[var(--color-text-primary)]">{entry.studentName}</td>
                          <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-secondary)]">{entry.admissionNumber ?? "—"}</td>
                          <td className="px-4 py-3 text-[var(--color-text-secondary)]">{formatNigeriaClassName(entry.className)}</td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                              style={statusChipStyle(entry.status)}
                            >
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_CONFIG[entry.status].tone }} />
                              {STATUS_CONFIG[entry.status].label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{entry.reason ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  page={historyLogPagination.page}
                  totalPages={historyLogPagination.totalPages}
                  onPageChange={setHistoryLogPage}
                  label={`${filteredHistoryRows.length} attendance log record${filteredHistoryRows.length === 1 ? "" : "s"}`}
                />
              </>
            )}
          </section>
        </div>
      )}

      {/* ══ TAB: INSIGHTS ══ */}
      {activeTab === "insights" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="surface-card p-6 lg:col-span-2">
            <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">
              Level / year attendance summary
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Term attendance performance across JSS and SS year groups you oversee
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {levelYearSummaries.map((item) => (
                <article key={item.label} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-[var(--color-text-primary)]">{item.label}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        {item.classCount} class arm{item.classCount === 1 ? "" : "s"} · {item.studentCount} learners
                      </p>
                    </div>
                    <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] px-3 py-1 text-[11px] font-bold text-[var(--color-text-accent)]">
                      {item.attendanceRate}%
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-[var(--color-bg-surface)] px-3 py-2 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Absent</p>
                      <p className="mt-1 text-lg font-black" style={{ color: "var(--color-danger)" }}>{item.absent}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--color-bg-surface)] px-3 py-2 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Late</p>
                      <p className="mt-1 text-lg font-black" style={{ color: "var(--color-warning)" }}>{item.late}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--color-bg-surface)] px-3 py-2 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Excused</p>
                      <p className="mt-1 text-lg font-black" style={{ color: "var(--color-info)" }}>{item.excused}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* 7-day trend */}
          <div className="surface-card p-6">
            <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">
              Recent attendance trend
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Latest marked attendance days across your classes for {attendance.currentTerm}
            </p>
            <div className="mt-6 flex items-end gap-2">
              {trend.map(({ date: d, present, total }) => {
                const rate = total === 0 ? 0 : Math.round((present / total) * 100);
                const isToday = d === new Date().toISOString().slice(0, 10);
                const barColor = rate > 80 ? "var(--color-success)" : rate > 50 ? "var(--color-warning)" : "var(--color-danger)";
                return (
                  <div
                    key={d}
                    className="group relative flex flex-1 flex-col items-center gap-1"
                  >
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute -top-10 left-1/2 hidden -translate-x-1/2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2 py-1 text-center text-[10px] shadow-lg group-hover:block">
                      <span className="font-bold text-[var(--color-text-primary)]">{rate}%</span>
                      <br />
                      <span className="text-[var(--color-text-muted)]">
                        {present}/{total}
                      </span>
                    </div>
                    <div className="relative h-28 w-full overflow-hidden rounded-xl bg-[var(--color-bg-subtle)]">
                      <div
                        className={`absolute bottom-0 left-0 right-0 rounded-xl transition-[height] duration-500 ${
                          isToday ? "opacity-100" : "opacity-60"
                        }`}
                        style={{ height: `${Math.max(rate, 4)}%`, background: barColor }}
                      />
                    </div>
                    <span
                      className="text-[9px] font-bold"
                      style={{ color: isToday ? "var(--color-text-accent)" : "var(--color-text-muted)" }}
                    >
                      {new Date(d).toLocaleDateString("en-NG", { weekday: "short" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Frequent absentees */}
          <div className="surface-card p-6">
            <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">
              Attention needed
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Learners with the most absences this period
            </p>
            <div className="mt-4 grid gap-2">
              {(() => {
                const absentMap: Record<string, { name: string; count: number }> = {};
                for (const item of history) {
                  if (item.status === "ABSENT" || item.status === "LATE") {
                    if (!absentMap[item.studentId]) {
                      absentMap[item.studentId] = { name: item.studentName, count: 0 };
                    }
                    absentMap[item.studentId].count++;
                  }
                }
                const sorted = Object.entries(absentMap)
                  .sort(([, a], [, b]) => b.count - a.count)
                  .slice(0, 6);

                if (sorted.length === 0) {
                  return (
                    <div className="rounded-2xl border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] py-8 text-center">
                      <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
                        No patterns detected yet
                      </p>
                    </div>
                  );
                }

                const maxCount = sorted[0]?.[1].count ?? 1;
                return sorted.map(([id, { name, count }]) => (
                  <div
                    key={id}
                    className="flex items-center gap-3 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3"
                  >
                    <div
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-black"
                      style={{ background: "var(--color-danger-dim)", color: "var(--color-danger)" }}
                    >
                      {initials(name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-border-default)]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${(count / maxCount) * 100}%`, background: "var(--color-danger)" }}
                          />
                        </div>
                        <span className="text-[10px] font-bold" style={{ color: "var(--color-danger)" }}>
                          {count}×
                        </span>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Overall summary card */}
          <div className="surface-card p-6 lg:col-span-2">
            <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">
              Active term totals
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ALL_STATUSES.map((s) => {
                const total = history.filter((h) => h.status === s).length;
                const cfg = STATUS_CONFIG[s];
                return (
                  <div
                    key={s}
                    className="rounded-2xl border px-4 py-4"
                    style={{ borderColor: cfg.dim, background: cfg.dim, color: cfg.tone }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">
                      {cfg.label}
                    </p>
                    <p className="mt-1 text-3xl font-black">{total}</p>
                    <p className="mt-0.5 text-[11px] opacity-60">{attendance.currentTerm} records</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Sticky save bar ── */}
      {activeTab === "register" && (
        <section className="sticky bottom-4 z-20">
          <div className="flex flex-col gap-3 rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]/95 px-5 py-4 shadow-[var(--shadow-lg)] backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
            {/* Status summary */}
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <span className="text-sm font-bold text-[var(--color-text-primary)]">{selectedClassLabel}</span>
                <span className="ml-2 text-sm text-[var(--color-text-muted)]">·</span>
                <span className="ml-2 text-sm text-[var(--color-text-secondary)]">
                  {stats.total - stats.unmarked}/{stats.total} marked
                </span>
              </div>
              {stats.unmarked > 0 && (
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ background: "var(--color-danger-dim)", color: "var(--color-danger)" }}
                >
                  {stats.unmarked} still pending
                </span>
              )}
              {completionPct === 100 && (
                <span
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ background: "var(--color-success-dim)", color: "var(--color-success)" }}
                >
                  <CheckCheck className="h-3 w-3" /> Register complete
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={clearCurrentView}
                className="btn-secondary h-10 px-4"
              >
                <RotateCcw className="h-4 w-4" />
                Clear
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className="btn-secondary h-10 px-4"
              >
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">View history</span>
              </button>
              <button
                type="button"
                onClick={() => void saveAttendance()}
                disabled={saving}
                className="btn-primary h-10 px-5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save register"}
                {!saving && stats.total - stats.unmarked > 0 && (
                  <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-black">
                    {stats.total - stats.unmarked}
                  </span>
                )}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
