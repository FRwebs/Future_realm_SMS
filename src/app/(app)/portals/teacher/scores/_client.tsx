"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpen, FileCheck2, Save, Search, ShieldCheck, UserRound } from "lucide-react";

import { useToast } from "@/components/ui/toast-provider";
import { TeacherClassPortalView, TeacherClassStudentView, TeacherScoreEntryView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";

type TeacherScoresClientProps = {
  portal: { assignedClasses: TeacherClassPortalView[]; students?: TeacherClassStudentView[] };
  scores: TeacherScoreEntryView[];
};

type DraftRow = {
  continuousAssessment: string;
  exam: string;
  teacherComment: string;
};

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

function rowKey(item: Pick<TeacherScoreEntryView, "studentId" | "subjectId" | "classId">) {
  return `${item.studentId}:${item.classId}:${item.subjectId}`;
}

function resolveGrade(total: number) {
  if (total >= 75) return "A1";
  if (total >= 70) return "B2";
  if (total >= 65) return "B3";
  if (total >= 60) return "C4";
  if (total >= 55) return "C5";
  if (total >= 50) return "C6";
  if (total >= 45) return "D7";
  if (total >= 40) return "E8";
  return "F9";
}

function gradeTone(total: number) {
  if (total >= 70) return { background: "var(--color-success-dim)", color: "var(--color-success)" };
  if (total >= 50) return { background: "var(--color-warning-dim)", color: "var(--color-warning)" };
  return { background: "var(--color-danger-dim)", color: "var(--color-danger)" };
}

function toDraft(item: TeacherScoreEntryView): DraftRow {
  return {
    continuousAssessment: String(item.continuousAssessment ?? 0),
    exam: String(item.exam ?? 0),
    teacherComment: item.teacherComment ?? "",
  };
}

function validateDraft(draft: DraftRow) {
  const ca = Number(draft.continuousAssessment || 0);
  const exam = Number(draft.exam || 0);
  if (Number.isNaN(ca) || ca < 0 || ca > 40) return "CA must be between 0 and 40.";
  if (Number.isNaN(exam) || exam < 0 || exam > 60) return "Exam must be between 0 and 60.";
  return null;
}

export function TeacherScoresClient({ portal, scores: initialScores }: TeacherScoresClientProps) {
  const { showToast } = useToast();
  const [scores, setScores] = useState(initialScores);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>(
    () =>
      initialScores.reduce<Record<string, DraftRow>>((acc, item) => {
        acc[rowKey(item)] = toDraft(item);
        return acc;
      }, {}),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savingRow, setSavingRow] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [filterClass, setFilterClass] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [search, setSearch] = useState("");

  const teachingAssignments = useMemo(
    () => portal.assignedClasses.filter((item) => item.subjectId && item.classId),
    [portal.assignedClasses],
  );

  const classOptions = useMemo(() => {
    const seen = new Set<string>();
    return [
      { label: "All classes", value: "" },
      ...teachingAssignments
        .filter((item) => {
          if (!item.classId || seen.has(item.classId)) return false;
          seen.add(item.classId);
          return true;
        })
        .map((item) => ({
          label: formatNigeriaClassName(item.className),
          value: item.classId as string,
        })),
    ];
  }, [teachingAssignments]);

  const subjectOptions = useMemo(() => {
    const seen = new Set<string>();
    const options = teachingAssignments
      .filter((item) => !filterClass || item.classId === filterClass)
      .filter((item) => {
        if (!item.subjectId || seen.has(item.subjectId)) return false;
        seen.add(item.subjectId);
        return true;
      })
      .map((item) => ({
        label: filterClass
          ? item.subject
          : `${item.subject} (${formatNigeriaClassName(item.className)})`,
        value: item.subjectId as string,
      }));

    return [{ label: "All subjects", value: "" }, ...options];
  }, [filterClass, teachingAssignments]);

  useEffect(() => {
    if (!filterSubject) return;
    if (!subjectOptions.some((option) => option.value === filterSubject)) {
      setFilterSubject("");
    }
  }, [filterSubject, subjectOptions]);

  const selectedAssignment = useMemo(
    () =>
      teachingAssignments.find(
        (item) =>
          (!filterClass || item.classId === filterClass) &&
          (!filterSubject || item.subjectId === filterSubject),
      ) ?? null,
    [filterClass, filterSubject, teachingAssignments],
  );

  const filtered = useMemo(() => {
    return [...scores]
      .filter((score) => {
      const matchClass = !filterClass || score.classId === filterClass;
      const matchSubject = !filterSubject || score.subjectId === filterSubject;
      const matchSearch =
        !search ||
        score.studentName.toLowerCase().includes(search.toLowerCase()) ||
        score.subject.toLowerCase().includes(search.toLowerCase()) ||
        formatNigeriaClassName(score.className).toLowerCase().includes(search.toLowerCase());
        return matchClass && matchSubject && matchSearch;
      })
      .sort(
        (left, right) =>
          left.className.localeCompare(right.className) ||
          left.subject.localeCompare(right.subject) ||
          left.studentName.localeCompare(right.studentName),
      );
  }, [filterClass, filterSubject, scores, search]);

  const dirtyKeys = useMemo(() => {
    const next = new Set<string>();
    for (const item of filtered) {
      const key = rowKey(item);
      const draft = drafts[key];
      if (!draft) continue;
      if (
        draft.continuousAssessment !== String(item.continuousAssessment ?? 0) ||
        draft.exam !== String(item.exam ?? 0) ||
        draft.teacherComment !== (item.teacherComment ?? "")
      ) {
        next.add(key);
      }
    }
    return next;
  }, [drafts, filtered]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const locked = filtered.filter((item) => item.published).length;
    const entered = filtered.filter((item) => item.total > 0 || item.continuousAssessment > 0 || item.exam > 0).length;
    const pending = total - entered;
    const average = entered === 0 ? 0 : Math.round(filtered.reduce((sum, item) => sum + item.total, 0) / entered);
    return { total, entered, pending, locked, average, dirty: dirtyKeys.size };
  }, [dirtyKeys.size, filtered]);

  const rosterCount = useMemo(() => {
    if (!filterClass) return new Set(filtered.map((item) => item.studentId)).size;
    return new Set(
      portal.students?.filter((student) => student.classId === filterClass).map((student) => student.studentId) ?? [],
    ).size;
  }, [filterClass, filtered, portal.students]);

  const selectedClassLabel = useMemo(
    () => classOptions.find((item) => item.value === filterClass)?.label ?? "All assigned classes",
    [classOptions, filterClass],
  );

  function updateDraft(item: TeacherScoreEntryView, field: keyof DraftRow, value: string) {
    const key = rowKey(item);
    setDrafts((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? toDraft(item)),
        [field]: value,
      },
    }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function persistRow(item: TeacherScoreEntryView) {
    const key = rowKey(item);
    const draft = drafts[key] ?? toDraft(item);
    const dirty =
      draft.continuousAssessment !== String(item.continuousAssessment ?? 0) ||
      draft.exam !== String(item.exam ?? 0) ||
      draft.teacherComment !== (item.teacherComment ?? "");

    if (!dirty) {
      showToast({
        variant: "info",
        title: "No changes to save",
        description: `Update ${item.studentName}'s scores or comment before saving this row.`,
      });
      return false;
    }

    const validation = validateDraft(draft);
    if (validation) {
      setErrors((current) => ({ ...current, [key]: validation }));
      showToast({
        variant: "warning",
        title: "Score entry needs attention",
        description: validation,
      });
      return false;
    }
    if (item.published) {
      setErrors((current) => ({ ...current, [key]: "Published rows are locked for teachers." }));
      showToast({
        variant: "warning",
        title: "Row is locked",
        description: "Published results can no longer be changed from the teacher score sheet.",
      });
      return false;
    }

    setSavingRow(key);
    try {
      const response = await fetch("/api/v1/teacher-portal/scores", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCookie("fr_csrf") ?? "",
        },
        body: JSON.stringify({
          studentId: item.studentId,
          classId: item.classId,
          subjectId: item.subjectId,
          continuousAssessment: Number(draft.continuousAssessment || 0),
          exam: Number(draft.exam || 0),
          teacherComment: draft.teacherComment,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        data?: TeacherScoreEntryView;
      };

      if (!response.ok || body.ok === false || !body.data) {
        setErrors((current) => ({ ...current, [key]: body.error ?? "Unable to save score entry." }));
        return false;
      }

      setScores((current) =>
        current.map((entry) =>
          rowKey(entry) === key ? body.data! : entry,
        ),
      );
      setDrafts((current) => ({ ...current, [key]: toDraft(body.data!) }));
      setErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return true;
    } catch {
      setErrors((current) => ({ ...current, [key]: "Network error. Please try again." }));
      return false;
    } finally {
      setSavingRow((current) => (current === key ? null : current));
    }
  }

  async function handleSaveAll() {
    const editableRows = filtered.filter((item) => !item.published && dirtyKeys.has(rowKey(item)));
    if (editableRows.length === 0) {
      showToast({
        variant: "info",
        title: "No changes to save",
        description: "Edit a row first, then use Save all.",
      });
      return;
    }

    setSavingAll(true);
    let saved = 0;
    for (const item of editableRows) {
      const ok = await persistRow(item);
      if (ok) saved += 1;
    }
    setSavingAll(false);

    if (saved === editableRows.length) {
      showToast({
        variant: "success",
        title: "All score rows saved",
        description: `${saved} learner result row${saved === 1 ? "" : "s"} updated successfully.`,
      });
    } else {
      showToast({
        variant: "warning",
        title: "Some rows still need attention",
        description: `${saved} of ${editableRows.length} edited row${editableRows.length === 1 ? "" : "s"} saved successfully.`,
      });
    }
  }

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href="/portals/teacher" className="text-[13px] font-semibold text-[var(--color-text-accent)]">
          Back to teacher portal
        </Link>
        <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Assessment workspace</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Teacher score sheet</h1>
            <p className="mt-3 text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Enter results the way teachers actually work: one grid, all visible learners, editable score cells, and row-by-row or save-all control.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Rows</p>
              <p className="mt-2 text-[19px] font-black text-[var(--color-text-primary)]">{stats.total}</p>
            </article>
            <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-success-dim)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-success)]">Entered</p>
              <p className="mt-2 text-[19px] font-black text-[var(--color-text-primary)]">{stats.entered}</p>
            </article>
            <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-warning-dim)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-warning)]">Pending</p>
              <p className="mt-2 text-[19px] font-black text-[var(--color-text-primary)]">{stats.pending}</p>
            </article>
            <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-info-dim)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-info)]">Unsaved edits</p>
              <p className="mt-2 text-[19px] font-black text-[var(--color-text-primary)]">{stats.dirty}</p>
            </article>
            <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Average</p>
              <p className="mt-2 text-[19px] font-black text-[var(--color-text-primary)]">{stats.average || "—"}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Current class</p>
          <p className="mt-2 text-[15px] font-black text-[var(--color-text-primary)]">{selectedClassLabel}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Current subject</p>
          <p className="mt-2 text-[15px] font-black text-[var(--color-text-primary)]">{selectedAssignment?.subject ?? "All assigned subjects"}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Class roster</p>
          <p className="mt-2 text-[15px] font-black text-[var(--color-text-primary)]">{rosterCount}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Assignment scope</p>
          <p className="mt-2 text-[13px] font-semibold text-[var(--color-text-primary)]">
            {selectedAssignment
              ? `${formatNigeriaClassName(selectedAssignment.className)} · ${selectedAssignment.subject}`
              : "Use filters to focus one teaching register"}
          </p>
        </article>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.2fr_0.5fr_0.5fr_auto_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search learner, class, or subject"
            className="field-control h-11 w-full pl-10"
          />
        </label>

        <select value={filterClass} onChange={(event) => setFilterClass(event.target.value)} className="field-select h-11">
          {classOptions.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select value={filterSubject} onChange={(event) => setFilterSubject(event.target.value)} className="field-select h-11">
          {subjectOptions.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => {
            setSearch("");
            setFilterClass("");
            setFilterSubject("");
          }}
          className="btn-secondary h-11 px-4"
        >
          Reset
        </button>

        <button
          type="button"
          onClick={handleSaveAll}
          disabled={savingAll}
          className="btn-primary h-11 px-5 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {savingAll ? "Saving..." : "Save all"}
        </button>
      </section>

      <section className="surface-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
            <FileCheck2 className="h-10 w-10 text-[var(--color-text-muted)]" />
            <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">No result rows match the current filter</h2>
            <p className="max-w-md text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Try another class, subject, or learner search. Only the score sheets linked to your assigned classes are shown here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1260px] w-full text-sm">
              <thead className="bg-[var(--color-bg-subtle)]">
                <tr className="border-b border-[var(--color-border-default)]">
                  <th className="sticky left-0 z-10 bg-[var(--color-bg-subtle)] px-6 py-4 text-left text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Learner</th>
                  <th className="px-4 py-4 text-left text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Subject</th>
                  <th className="px-4 py-4 text-center text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">CA / 40</th>
                  <th className="px-4 py-4 text-center text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Exam / 60</th>
                  <th className="px-4 py-4 text-left text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Comment</th>
                  <th className="px-4 py-4 text-left text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Preview</th>
                  <th className="px-4 py-4 text-left text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">State</th>
                  <th className="px-4 py-4 text-right text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-muted)]">
                {filtered.map((student) => {
                  const key = rowKey(student);
                  const draft = drafts[key] ?? toDraft(student);
                  const caValue = Number(draft.continuousAssessment || 0);
                  const examValue = Number(draft.exam || 0);
                  const total = caValue + examValue;
                  const grade = resolveGrade(total);
                  const dirty = dirtyKeys.has(key);
                  const validation = errors[key];

                  return (
                    <tr key={key} className="align-top transition hover:bg-[var(--color-bg-subtle)]">
                      <td className="sticky left-0 z-[1] bg-[var(--color-bg-surface)] px-6 py-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
                            <UserRound className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--color-text-primary)]">{student.studentName}</p>
                            <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{formatNigeriaClassName(student.className)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                          <BookOpen className="h-4 w-4 text-[var(--color-text-muted)]" />
                          <span>{student.subject}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <input
                          type="number"
                          min={0}
                          max={40}
                          value={draft.continuousAssessment}
                          disabled={student.published}
                          onChange={(event) => updateDraft(student, "continuousAssessment", event.target.value)}
                          className="field-control h-10 w-24 text-center"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <input
                          type="number"
                          min={0}
                          max={60}
                          value={draft.exam}
                          disabled={student.published}
                          onChange={(event) => updateDraft(student, "exam", event.target.value)}
                          className="field-control h-10 w-24 text-center"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <textarea
                          rows={2}
                          value={draft.teacherComment}
                          disabled={student.published}
                          onChange={(event) => updateDraft(student, "teacherComment", event.target.value)}
                          className="field-textarea min-h-[74px] min-w-[280px]"
                          placeholder="Teacher note for report sheet"
                        />
                        {validation ? (
                          <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: "var(--color-danger)" }}>
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {validation}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={gradeTone(total)}>
                          <span>{total}</span>
                          <span className="opacity-50">·</span>
                          <span>{grade}</span>
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {student.published ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Locked
                          </span>
                        ) : dirty ? (
                          <span className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--color-info-dim)", color: "var(--color-info)" }}>
                            Edited
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--color-success-dim)", color: "var(--color-success)" }}>
                            Ready
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => void persistRow(student)}
                          disabled={savingAll || savingRow === key}
                          className={dirty ? "btn-primary h-9 px-4 text-[12px] disabled:opacity-50" : "btn-secondary h-9 px-4 text-[12px] disabled:opacity-50"}
                        >
                          {savingRow === key ? "Saving..." : "Save row"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
