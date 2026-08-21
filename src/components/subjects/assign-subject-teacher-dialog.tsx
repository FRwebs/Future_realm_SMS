"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleHelp, Loader2, UserCheck } from "lucide-react";

import { Popover } from "@/components/ui/popover";
import { SidePanel } from "@/components/ui/side-panel";
import { useToast } from "@/components/ui/toast-provider";
import { Tooltip } from "@/components/ui/tooltip";

type SubjectAssignmentOption = {
  classId: string;
  className: string;
  teacherId?: string | null;
  teacherName?: string | null;
};

type TeacherOption = {
  id: string;
  name: string;
  email?: string | null;
  role?: string;
};

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

export function AssignSubjectTeacherDialog({
  subjectId,
  subjectName,
  assignments,
  teachers,
  initialClassId,
  triggerLabel = "Assign teacher",
  triggerVariant = "secondary",
}: {
  subjectId: string;
  subjectName: string;
  assignments: SubjectAssignmentOption[];
  teachers: TeacherOption[];
  initialClassId?: string;
  triggerLabel?: string;
  triggerVariant?: "primary" | "secondary" | "menu";
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const defaultClassId = initialClassId ?? assignments[0]?.classId ?? "";
  const initialAssignment = assignments.find((assignment) => assignment.classId === defaultClassId) ?? assignments[0];
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState(defaultClassId);
  const [teacherId, setTeacherId] = useState(initialAssignment?.teacherId ?? "");
  const [applyToAllArms, setApplyToAllArms] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"danger" | "success">("success");

  const activeAssignment = assignments.find((assignment) => assignment.classId === classId);
  const formId = `assign-subject-teacher-${subjectId}`;

  function openDialog() {
    if (assignments.length === 0) {
      showToast({
        variant: "warning",
        title: "No classes available",
        description: "This subject is not linked to any class yet, so there is nowhere to assign a teacher.",
      });
      return;
    }
    setClassId(initialClassId ?? assignments[0]?.classId ?? "");
    setTeacherId((assignments.find((assignment) => assignment.classId === (initialClassId ?? assignments[0]?.classId))?.teacherId ?? ""));
    setApplyToAllArms(false);
    setReason("");
    setMessage(null);
    setOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classId) {
      setTone("danger");
      setMessage("Select a class before saving this assignment.");
      return;
    }

    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/academics/subjects/${subjectId}/assign-teacher`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCookie("fr_csrf") ?? "",
        },
        body: JSON.stringify({
          classId,
          teacherId: teacherId || null,
          applyToAllArms,
          reason: reason.trim() || null,
        }),
      });

      const body = (await response.json()) as { ok?: boolean; error?: string; message?: string };
      if (!response.ok || body.ok === false) {
        throw new Error(body.error ?? body.message ?? "Unable to save subject teacher assignment.");
      }

      setTone("success");
      const successMessage = body.message ?? "Subject teacher assignment saved.";
      setMessage(successMessage);
      showToast({
        variant: "success",
        title: "Teacher assigned",
        description: successMessage,
      });
      router.refresh();
      window.setTimeout(() => {
        setOpen(false);
      }, 350);
    } catch (error) {
      setTone("danger");
      const nextMessage =
        error instanceof Error ? error.message : "Unable to save subject teacher assignment.";
      setMessage(nextMessage);
      showToast({
        variant: "error",
        title: "Unable to assign teacher",
        description: nextMessage,
      });
    } finally {
      setPending(false);
    }
  }

  const triggerClassName =
    triggerVariant === "primary"
      ? "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--color-text-primary)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-primary-hover)]"
      : triggerVariant === "menu"
        ? "flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-accent-primary-dim)] hover:text-[var(--color-text-accent)]"
        : "inline-flex h-9 items-center justify-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 text-sm font-semibold text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-subtle)]";

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        data-popover-close={triggerVariant === "menu" ? "true" : undefined}
        className={triggerClassName}
      >
        <Tooltip content="Assign or change the teacher handling this subject in a class.">
          <span className="inline-flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            <span>{triggerLabel}</span>
          </span>
        </Tooltip>
      </button>

      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title="Assign teacher"
        subtitle={`Update the teaching owner for ${subjectName} in a specific class, or apply the same teacher across every arm of that class level.`}
        size="md"
        footer={(
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary px-5"
            >
              Cancel
            </button>
            <button
              type="submit"
              form={formId}
              disabled={pending}
              className="btn-primary px-5"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
              <span>{pending ? "Saving..." : "Save assignment"}</span>
            </button>
          </div>
        )}
      >
          <form id={formId} onSubmit={handleSubmit} className="grid gap-5">
            <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] p-4 text-[13px] text-[var(--color-text-secondary)]">
              <p className="font-semibold text-[var(--color-text-primary)]">Assignment context</p>
              <p className="mt-1">
                Use this panel to place the right subject teacher against a class stream without leaving the subject page.
              </p>
            </div>
            <label>
              <span className="field-label">Class</span>
              <select
                value={classId}
                onChange={(event) => {
                  const nextClassId = event.target.value;
                  setClassId(nextClassId);
                  const nextAssignment = assignments.find((assignment) => assignment.classId === nextClassId);
                  setTeacherId(nextAssignment?.teacherId ?? "");
                }}
                className="field-select mt-2 h-11 rounded-2xl"
              >
                <option value="">Select class</option>
                {assignments.map((assignment) => (
                  <option key={assignment.classId} value={assignment.classId}>
                    {assignment.className}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="field-label">Teacher</span>
              <select
                value={teacherId}
                onChange={(event) => setTeacherId(event.target.value)}
                className="field-select mt-2 h-11 rounded-2xl"
              >
                <option value="">Unassign teacher</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}{teacher.role ? ` · ${teacher.role.replaceAll("_", " ")}` : ""}{teacher.email ? ` · ${teacher.email}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-start gap-3 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3">
              <input
                type="checkbox"
                checked={applyToAllArms}
                onChange={(event) => setApplyToAllArms(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[var(--color-border-strong)] text-[var(--color-text-accent)] focus:ring-[var(--color-accent-primary-glow)]"
              />
              <span className="text-[13px] leading-6 text-[var(--color-text-secondary)]">
                <span className="inline-flex items-center gap-2">
                  <span>Apply to all arms of this class level.</span>
                  <Popover
                    align="left"
                    panelClassName="max-w-[280px]"
                    trigger={({ toggle }) => (
                      <button
                        type="button"
                        onClick={toggle}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-accent)]"
                        aria-label="Explain apply to all arms"
                      >
                        <CircleHelp className="h-4 w-4" />
                      </button>
                    )}
                  >
                    {() => (
                      <div className="space-y-2">
                        <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">
                          Apply to all arms
                        </p>
                        <p className="text-[12px] leading-5 text-[var(--color-text-muted)]">
                          Use this when the same teacher should handle every arm for the selected level, for example JSS 1 A, JSS 1 B, and JSS 1 C.
                        </p>
                      </div>
                    )}
                  </Popover>
                </span>
                <span className="block text-[12px] text-[var(--color-text-muted)]">
                  Example: assign the same teacher across JSS 1 A, JSS 1 B, and JSS 1 C.
                </span>
              </span>
            </label>

            <label>
              <span className="field-label">Reason</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                placeholder="Optional note for the audit trail, for example: subject load balancing for the new term."
                className="field-textarea mt-2 min-h-[100px] rounded-2xl"
              />
            </label>

            {activeAssignment ? (
              <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3 text-[13px] text-[var(--color-text-secondary)]">
                Current teacher: <span className="font-semibold text-[var(--color-text-primary)]">{activeAssignment.teacherName ?? "Not assigned"}</span>
              </div>
            ) : null}

            {message ? (
              <div
                className="rounded-[10px] border px-4 py-3 text-[13px] font-medium"
                style={
                  tone === "success"
                    ? { borderColor: "var(--color-success)", background: "var(--color-success-dim)", color: "var(--color-success)" }
                    : { borderColor: "var(--color-danger)", background: "var(--color-danger-dim)", color: "var(--color-danger)" }
                }
              >
                {message}
              </div>
            ) : null}
          </form>
      </SidePanel>
    </>
  );
}
