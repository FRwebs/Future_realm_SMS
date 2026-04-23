"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleHelp, Loader2, UserCheck } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { Popover } from "@/components/ui/popover";
import { useToast } from "@/components/ui/toast-provider";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

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

  function openDialog() {
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
      ? "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:bg-brand-800"
      : triggerVariant === "menu"
        ? "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-slate-700 transition hover:bg-primary-50 hover:text-primary-700"
        : "inline-flex h-9 items-center justify-center gap-2 rounded-full border border-ink/10 bg-white px-4 text-sm font-semibold text-ink transition hover:bg-sand/60";

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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="md"
        title="Assign teacher"
        subtitle={`Update the teaching owner for ${subjectName} in a specific class, or apply the same teacher across every arm of that class level.`}
      >
          <form onSubmit={handleSubmit} className="grid gap-5">
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

            <label className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                checked={applyToAllArms}
                onChange={(event) => setApplyToAllArms(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-300"
              />
              <span className="text-[13px] leading-6 text-slate-600">
                <span className="inline-flex items-center gap-2">
                  <span>Apply to all arms of this class level.</span>
                  <Popover
                    align="left"
                    panelClassName="max-w-[280px]"
                    trigger={({ toggle }) => (
                      <button
                        type="button"
                        onClick={toggle}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-white hover:text-primary-600"
                        aria-label="Explain apply to all arms"
                      >
                        <CircleHelp className="h-4 w-4" />
                      </button>
                    )}
                  >
                    {() => (
                      <div className="space-y-2">
                        <p className="text-[12px] font-semibold text-slate-800">
                          Apply to all arms
                        </p>
                        <p className="text-[12px] leading-5 text-slate-500">
                          Use this when the same teacher should handle every arm for the selected level, for example JSS 1 A, JSS 1 B, and JSS 1 C.
                        </p>
                      </div>
                    )}
                  </Popover>
                </span>
                <span className="block text-[12px] text-slate-500">
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
              <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-[13px] text-slate-600">
                Current teacher: <span className="font-semibold text-slate-900">{activeAssignment.teacherName ?? "Not assigned"}</span>
              </div>
            ) : null}

            {message ? (
              <div
                className={cn(
                  "rounded-2xl border px-4 py-3 text-[13px] font-medium",
                  tone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700",
                )}
              >
                {message}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-secondary px-5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || assignments.length === 0}
                className="btn-primary px-5"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                <span>{pending ? "Saving..." : "Save assignment"}</span>
              </button>
            </div>
          </form>
      </Modal>
    </>
  );
}
