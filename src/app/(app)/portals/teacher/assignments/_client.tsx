"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ClipboardList, Clock3, FileText, Link2, Megaphone, NotebookPen, Search, Sparkles } from "lucide-react";

import { ActionMenu, ActionMenuButton, ActionMenuLink } from "@/components/ui/action-menu";
import { SidePanel } from "@/components/ui/side-panel";
import { useToast } from "@/components/ui/toast-provider";
import { TeacherAssignmentTaskView, TeacherClassPortalView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

type TeacherAssignmentsClientProps = {
  portal: { assignedClasses: TeacherClassPortalView[] };
  tasks: TeacherAssignmentTaskView[];
  initialClassId?: string;
};

type TaskType = "HOMEWORK" | "PROJECT" | "REVISION" | "READING" | "PRACTICE" | "PRESENTATION";
type SubmissionMode = "EXERCISE_BOOK" | "GOOGLE_CLASSROOM" | "PRINTED_SHEET" | "IN_CLASS_PRESENTATION" | "LAB_NOTEBOOK";

const taskTypeOptions: Array<{ label: string; value: TaskType }> = [
  { label: "Homework", value: "HOMEWORK" },
  { label: "Project", value: "PROJECT" },
  { label: "Revision task", value: "REVISION" },
  { label: "Reading", value: "READING" },
  { label: "Practice set", value: "PRACTICE" },
  { label: "Presentation", value: "PRESENTATION" },
];

const submissionModeOptions: Array<{ label: string; value: SubmissionMode }> = [
  { label: "Submit in exercise book", value: "EXERCISE_BOOK" },
  { label: "Google Classroom / LMS", value: "GOOGLE_CLASSROOM" },
  { label: "Printed worksheet", value: "PRINTED_SHEET" },
  { label: "Present in class", value: "IN_CLASS_PRESENTATION" },
  { label: "Lab notebook", value: "LAB_NOTEBOOK" },
];

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

function humanizeStatus(status: TeacherAssignmentTaskView["status"]) {
  return status === "PUBLISHED" ? "Published" : status === "DRAFT" ? "Draft" : "Closed";
}

function statusTone(status: TeacherAssignmentTaskView["status"]) {
  if (status === "PUBLISHED") return { background: "var(--color-success-dim)", color: "var(--color-success)" };
  if (status === "DRAFT") return { background: "var(--color-warning-dim)", color: "var(--color-warning)" };
  return { background: "var(--color-bg-subtle)", color: "var(--color-text-secondary)" };
}

function taskTypeLabel(value: TaskType) {
  return taskTypeOptions.find((item) => item.value === value)?.label ?? value;
}

function submissionModeLabel(value: SubmissionMode) {
  return submissionModeOptions.find((item) => item.value === value)?.label ?? value;
}

function buildDescription(input: {
  taskType: TaskType;
  submissionMode: SubmissionMode;
  estimatedMinutes: string;
  instructions: string;
}) {
  const details = [
    `Task type: ${taskTypeLabel(input.taskType)}`,
    `Submission: ${submissionModeLabel(input.submissionMode)}`,
    input.estimatedMinutes ? `Estimated effort: ${input.estimatedMinutes} minutes` : undefined,
    "",
    "Instructions:",
    input.instructions.trim(),
  ].filter(Boolean);

  return details.join("\n");
}

export function TeacherAssignmentsClient({ portal, tasks: initialTasks, initialClassId = "" }: TeacherAssignmentsClientProps) {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState(initialTasks);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTask, setActiveTask] = useState<TeacherAssignmentTaskView | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filterClassId, setFilterClassId] = useState(initialClassId);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("HOMEWORK");
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>("EXERCISE_BOOK");
  const [estimatedMinutes, setEstimatedMinutes] = useState("25");
  const [dueAt, setDueAt] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [status, setStatus] = useState<TeacherAssignmentTaskView["status"]>("PUBLISHED");
  const [instructions, setInstructions] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TeacherAssignmentTaskView["status"]>("ALL");

  const classOptions = useMemo(
    () =>
      Array.from(
        new Map(
          portal.assignedClasses
            .filter((item) => item.classId)
            .map((item) => [item.classId as string, { value: item.classId as string, label: formatNigeriaClassName(item.className) }]),
        ).values(),
      ),
    [portal.assignedClasses],
  );

  const subjectOptions = useMemo(() => {
    return portal.assignedClasses
      .filter((item) => item.classId && item.subjectId)
      .filter((item) => !classId || item.classId === classId)
      .map((item) => ({
        value: item.subjectId as string,
        label: `${item.subject} · ${formatNigeriaClassName(item.className)}`,
        classId: item.classId as string,
      }));
  }, [classId, portal.assignedClasses]);

  const stats = useMemo(() => {
    const drafts = tasks.filter((task) => task.status === "DRAFT").length;
    const published = tasks.filter((task) => task.status === "PUBLISHED").length;
    const dueThisWeek = tasks.filter((task) => {
      const dueTime = new Date(task.dueAt).getTime();
      const now = Date.now();
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      return dueTime >= now && dueTime <= now + oneWeek;
    }).length;
    const totalSubmissions = tasks.reduce((sum, task) => sum + task.submissionsCount, 0);
    return { drafts, published, dueThisWeek, totalSubmissions };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesClass = !filterClassId || task.classId === filterClassId;
      const matchesStatus = statusFilter === "ALL" || task.status === statusFilter;
      const matchesSearch =
        !search ||
        task.title.toLowerCase().includes(search.toLowerCase()) ||
        task.subject.toLowerCase().includes(search.toLowerCase()) ||
        task.className.toLowerCase().includes(search.toLowerCase());

      return matchesClass && matchesStatus && matchesSearch;
    });
  }, [filterClassId, search, statusFilter, tasks]);

  function resetForm() {
    setClassId("");
    setSubjectId("");
    setTitle("");
    setTaskType("HOMEWORK");
    setSubmissionMode("EXERCISE_BOOK");
    setEstimatedMinutes("25");
    setDueAt("");
    setAttachmentUrl("");
    setStatus("PUBLISHED");
    setInstructions("");
    setError(null);
  }

  function openCreatePanel() {
    if (filterClassId && !classId) {
      setClassId(filterClassId);
    }
    setShowCreate(true);
  }

  function submitTask() {
    if (!classId || !subjectId || !title.trim() || !dueAt || !instructions.trim()) {
      setError("Class, subject, title, due date, and instructions are required.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/v1/teacher-portal/tasks", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": getCookie("fr_csrf") ?? "",
          },
          body: JSON.stringify({
            classId,
            subjectId,
            title: title.trim(),
            dueAt,
            status,
            attachmentUrl: attachmentUrl.trim(),
            description: buildDescription({ taskType, submissionMode, estimatedMinutes, instructions }),
          }),
        });

        const body = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          data?: TeacherAssignmentTaskView;
        };

        if (!response.ok || body.ok === false || !body.data) {
          setError(body.error ?? "Unable to create assignment.");
          return;
        }

        const createdTask = body.data;
        setTasks((current) =>
          [...current, createdTask].sort((left, right) => new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime()),
        );
        showToast({
          variant: "success",
          title: status === "PUBLISHED" ? "Assignment published" : "Assignment saved",
          description: `${createdTask.title} is now available in your teacher workspace.`,
        });
        resetForm();
        setShowCreate(false);
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href="/portals/teacher" className="text-[13px] font-semibold text-[var(--color-text-accent)]">
          Back to teacher portal
        </Link>
        <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Teacher assignment desk</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Assignments and study tasks</h1>
            <p className="mt-3 text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Create realistic classroom tasks for the subjects assigned to you, keep drafts separate from published work, and track which tasks are due soon without leaving the teacher portal.
            </p>
          </div>
          <button type="button" onClick={openCreatePanel} className="btn-primary px-5">
            <NotebookPen className="h-4 w-4" />
            Create assignment
          </button>
        </div>
      </section>

      <section className="surface-card p-4">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <label className="grid gap-2">
            <span className="field-label">Search tasks</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by title, subject, or class"
                className="field-control h-11 w-full pl-10"
              />
            </div>
          </label>

          <label className="grid gap-2">
            <span className="field-label">Class</span>
            <select value={filterClassId} onChange={(event) => setFilterClassId(event.target.value)} className="field-select h-11">
              <option value="">All classes</option>
              {classOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="field-label">Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "ALL" | TeacherAssignmentTaskView["status"])} className="field-select h-11">
              <option value="ALL">All statuses</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="CLOSED">Closed</option>
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="surface-card p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Published</p>
          <p className="mt-2 text-[22px] font-black text-[var(--color-text-primary)]">{stats.published}</p>
          <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">Live class tasks currently visible to learners.</p>
        </article>
        <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-warning-dim)] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-warning)]">Drafts</p>
          <p className="mt-2 text-[22px] font-black text-[var(--color-text-primary)]">{stats.drafts}</p>
          <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">Tasks still being prepared before release.</p>
        </article>
        <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-success-dim)] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-success)]">Due this week</p>
          <p className="mt-2 text-[22px] font-black text-[var(--color-text-primary)]">{stats.dueThisWeek}</p>
          <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">Tasks requiring quick classroom follow-up.</p>
        </article>
        <article className="surface-card p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Submissions</p>
          <p className="mt-2 text-[22px] font-black text-[var(--color-text-primary)]">{stats.totalSubmissions}</p>
          <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">Total submission activity across your current tasks.</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {filteredTasks.length === 0 ? (
          <div className="surface-card col-span-full flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
            <ClipboardList className="h-10 w-10 text-[var(--color-text-muted)]" />
            <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
              {tasks.length === 0 ? "No assignments created yet" : "No assignments match the current filters"}
            </h2>
            <p className="max-w-md text-[13px] leading-6 text-[var(--color-text-secondary)]">
              {tasks.length === 0
                ? "Start with one realistic task for an assigned class. Drafts are useful when you want to prepare instructions first and publish later."
                : "Try another class, status, or search term to bring the right task back into view."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button type="button" onClick={openCreatePanel} className="btn-primary px-5">
                Create assignment
              </button>
              {tasks.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setFilterClassId("");
                    setStatusFilter("ALL");
                  }}
                  className="btn-secondary px-5"
                >
                  Reset filters
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <article key={task.id} className="surface-card p-5 transition hover:border-[var(--color-border-strong)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-accent)]">{formatNigeriaClassName(task.className)}</p>
                  <h2 className="mt-2 text-[18px] font-bold text-[var(--color-text-primary)]">{task.title}</h2>
                  <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">{task.subject}</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold" style={statusTone(task.status)}>
                    {humanizeStatus(task.status)}
                  </span>
                  <ActionMenu triggerLabel={`Quick actions for ${task.title}`}>
                    <ActionMenuButton onClick={() => setActiveTask(task)}>
                      <span className="inline-flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        View details
                      </span>
                    </ActionMenuButton>
                    <ActionMenuLink href={`/portals/teacher/scores?classId=${task.classId}&subjectId=${task.subjectId}`}>
                      <span className="inline-flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" />
                        Open score entry
                      </span>
                    </ActionMenuLink>
                  </ActionMenu>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Due</p>
                  <p className="mt-2 text-[13px] font-semibold text-[var(--color-text-primary)]">{formatDate(task.dueAt)}</p>
                </div>
                <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Submissions</p>
                  <p className="mt-2 text-[13px] font-semibold text-[var(--color-text-primary)]">{task.submissionsCount}</p>
                </div>
                <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Attachment</p>
                  <p className="mt-2 text-[13px] font-semibold text-[var(--color-text-primary)]">{task.attachmentUrl ? "Added" : "None"}</p>
                </div>
              </div>

              {task.description ? (
                <p className="mt-4 line-clamp-3 text-[13px] leading-6 text-[var(--color-text-secondary)] whitespace-pre-line">{task.description}</p>
              ) : null}

              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
                  <Clock3 className="h-4 w-4" />
                  <span>{new Date(task.dueAt).getTime() < Date.now() ? "Due date has passed" : "Still active for follow-up"}</span>
                </div>
                <button type="button" onClick={() => setActiveTask(task)} className="btn-secondary h-10 px-4">
                  View details
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      <SidePanel
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          resetForm();
        }}
        title="Create teacher assignment"
        subtitle="Build a realistic task for an assigned class. Use this drawer for homework, revision, reading, or project work without leaving the assignments board."
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                resetForm();
              }}
              className="btn-secondary px-4"
            >
              Cancel
            </button>
            <button type="button" onClick={submitTask} disabled={isPending} className="btn-primary px-5">
              {isPending ? "Saving..." : status === "PUBLISHED" ? "Publish assignment" : "Save draft"}
            </button>
          </div>
        }
      >
        <div className="grid gap-5">
          <section className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="field-label">Class</span>
              <select value={classId} onChange={(event) => {
                setClassId(event.target.value);
                setSubjectId("");
              }} className="field-select h-11">
                <option value="">Select class</option>
                {classOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="field-label">Subject</span>
              <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="field-select h-11">
                <option value="">Select subject</option>
                {subjectOptions.map((option) => (
                  <option key={`${option.classId}-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 md:col-span-2">
              <span className="field-label">Assignment title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="field-control h-11"
                placeholder="Example: Fractions revision worksheet"
              />
            </label>

            <label className="grid gap-2">
              <span className="field-label">Task type</span>
              <select value={taskType} onChange={(event) => setTaskType(event.target.value as TaskType)} className="field-select h-11">
                {taskTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="field-label">Submission method</span>
              <select value={submissionMode} onChange={(event) => setSubmissionMode(event.target.value as SubmissionMode)} className="field-select h-11">
                {submissionModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2">
              <span className="field-label">Due date</span>
              <input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="field-control h-11" />
            </label>

            <label className="grid gap-2">
              <span className="field-label">Estimated effort (minutes)</span>
              <input
                type="number"
                min={5}
                max={240}
                value={estimatedMinutes}
                onChange={(event) => setEstimatedMinutes(event.target.value)}
                className="field-control h-11"
              />
            </label>

            <label className="grid gap-2">
              <span className="field-label">Status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value as TeacherAssignmentTaskView["status"])} className="field-select h-11">
                <option value="PUBLISHED">Publish now</option>
                <option value="DRAFT">Save draft</option>
                <option value="CLOSED">Closed</option>
              </select>
            </label>
          </section>

          <label className="grid gap-2">
            <span className="field-label">Resource link</span>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                value={attachmentUrl}
                onChange={(event) => setAttachmentUrl(event.target.value)}
                className="field-control h-11 w-full pl-10"
                placeholder="https://example.com/worksheet.pdf"
              />
            </div>
          </label>

          <label className="grid gap-2">
            <span className="field-label">Instructions</span>
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              rows={6}
              className="field-textarea min-h-[180px]"
              placeholder="Tell learners exactly what to do, what to bring, and how the work will be marked."
            />
          </label>

          <section className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-accent)]">Assignment preview</p>
            <div className="mt-3 space-y-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
              <p><span className="font-semibold text-[var(--color-text-primary)]">Type:</span> {taskTypeLabel(taskType)}</p>
              <p><span className="font-semibold text-[var(--color-text-primary)]">Submission:</span> {submissionModeLabel(submissionMode)}</p>
              <p><span className="font-semibold text-[var(--color-text-primary)]">Effort:</span> {estimatedMinutes || "—"} minutes</p>
              <p><span className="font-semibold text-[var(--color-text-primary)]">Outcome:</span> {status === "PUBLISHED" ? "Learners can see this immediately." : status === "DRAFT" ? "Only teachers can see this until you publish it." : "This task will be saved as closed."}</p>
            </div>
          </section>

          {error ? <div className="rounded-[10px] px-4 py-3 text-[13px]" style={{ background: "var(--color-danger-dim)", color: "var(--color-danger)" }}>{error}</div> : null}
        </div>
      </SidePanel>

      <SidePanel
        open={Boolean(activeTask)}
        onClose={() => setActiveTask(null)}
        title={activeTask?.title ?? "Assignment details"}
        subtitle={activeTask ? `${formatNigeriaClassName(activeTask.className)} · ${activeTask.subject}` : undefined}
        size="md"
      >
        {activeTask ? (
          <div className="space-y-5">
            <section className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Status</p>
                <p className="mt-2 text-[13px] font-semibold text-[var(--color-text-primary)]">{humanizeStatus(activeTask.status)}</p>
              </div>
              <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Due date</p>
                <p className="mt-2 text-[13px] font-semibold text-[var(--color-text-primary)]">{formatDate(activeTask.dueAt)}</p>
              </div>
              <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Submissions</p>
                <p className="mt-2 text-[13px] font-semibold text-[var(--color-text-primary)]">{activeTask.submissionsCount}</p>
              </div>
              <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Attachment</p>
                <p className="mt-2 text-[13px] font-semibold text-[var(--color-text-primary)]">{activeTask.attachmentUrl ? "Available" : "Not attached"}</p>
              </div>
            </section>

            {activeTask.description ? (
              <section className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Instructions</p>
                <p className="mt-3 whitespace-pre-line text-[13px] leading-6 text-[var(--color-text-secondary)]">{activeTask.description}</p>
              </section>
            ) : null}

            {activeTask.attachmentUrl ? (
              <a
                href={activeTask.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text-accent)]"
              >
                <FileText className="h-4 w-4" />
                Open attached resource
              </a>
            ) : null}

            <section className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-success-dim)] p-4 text-[13px] leading-6" style={{ color: "var(--color-success)" }}>
              <div className="flex items-start gap-3">
                <Megaphone className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Use this detail drawer to confirm what learners can already see, the due date in context, and how many submissions have started coming in. Editing and grading can be added next once those backend endpoints are exposed.
                </p>
              </div>
            </section>
          </div>
        ) : null}
      </SidePanel>
    </div>
  );
}
