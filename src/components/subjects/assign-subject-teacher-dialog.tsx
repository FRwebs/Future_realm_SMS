"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserCheck, X } from "lucide-react";

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
  triggerVariant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const defaultClassId = initialClassId ?? assignments[0]?.classId ?? "";
  const initialAssignment = assignments.find((assignment) => assignment.classId === defaultClassId) ?? assignments[0];
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
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
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
      setMessage(body.message ?? "Subject teacher assignment saved.");
      router.refresh();
      window.setTimeout(() => {
        closeDialog();
      }, 350);
    } catch (error) {
      setTone("danger");
      setMessage(error instanceof Error ? error.message : "Unable to save subject teacher assignment.");
    } finally {
      setPending(false);
    }
  }

  const triggerClassName =
    triggerVariant === "primary"
      ? "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:bg-brand-800"
      : "inline-flex h-9 items-center justify-center gap-2 rounded-full border border-ink/10 bg-white px-4 text-sm font-semibold text-ink transition hover:bg-sand/60";

  return (
    <>
      <button type="button" onClick={openDialog} className={triggerClassName}>
        <UserCheck className="h-4 w-4" />
        <span>{triggerLabel}</span>
      </button>

      <dialog
        ref={dialogRef}
        className="w-[min(42rem,calc(100vw-2rem))] rounded-[2rem] border border-white/60 bg-white p-0 text-ink shadow-[0_30px_80px_rgba(15,23,42,0.25)] backdrop:bg-ink/55 backdrop:backdrop-blur-[3px]"
      >
        <div className="rounded-[2rem]">
          <div className="flex items-start justify-between gap-4 border-b border-ink/6 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.98),rgba(255,255,255,0.95),rgba(250,245,235,0.95))] px-6 py-5">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-brand-700">Subject assignment</p>
              <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-ink">Assign teacher</h2>
              <p className="mt-2 text-sm leading-6 text-ink/62">
                Update the teaching owner for <span className="font-semibold text-ink">{subjectName}</span> in a specific class, or apply the same teacher across every arm of that class level.
              </p>
            </div>

            <button
              type="button"
              onClick={closeDialog}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-ink/8 bg-white text-ink shadow-sm transition hover:bg-sand/70"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-5 px-6 py-6">
            <label>
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ink/45">Class</span>
              <select
                value={classId}
                onChange={(event) => {
                  const nextClassId = event.target.value;
                  setClassId(nextClassId);
                  const nextAssignment = assignments.find((assignment) => assignment.classId === nextClassId);
                  setTeacherId(nextAssignment?.teacherId ?? "");
                }}
                className="mt-2 h-12 w-full rounded-2xl border border-ink/10 bg-white px-4 text-sm font-medium text-ink shadow-sm outline-none transition duration-200 hover:border-ink/15 focus:border-brand-500 focus:ring-4 focus:ring-brand-100/70"
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
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ink/45">Teacher</span>
              <select
                value={teacherId}
                onChange={(event) => setTeacherId(event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-ink/10 bg-white px-4 text-sm font-medium text-ink shadow-sm outline-none transition duration-200 hover:border-ink/15 focus:border-brand-500 focus:ring-4 focus:ring-brand-100/70"
              >
                <option value="">Unassign teacher</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}{teacher.role ? ` · ${teacher.role.replaceAll("_", " ")}` : ""}{teacher.email ? ` · ${teacher.email}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-start gap-3 rounded-[1.4rem] border border-ink/8 bg-sand/45 px-4 py-3">
              <input
                type="checkbox"
                checked={applyToAllArms}
                onChange={(event) => setApplyToAllArms(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-ink/20 text-brand-700 focus:ring-brand-400"
              />
              <span className="text-sm leading-6 text-ink/72">
                Apply to all arms of this class level.
                <span className="block text-xs text-ink/52">
                  Example: assign the same teacher across JSS 1 A, JSS 1 B, and JSS 1 C.
                </span>
              </span>
            </label>

            <label>
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ink/45">Reason</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                placeholder="Optional note for the audit trail, for example: subject load balancing for the new term."
                className="mt-2 min-h-[100px] w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm font-medium text-ink shadow-sm outline-none transition duration-200 placeholder:text-ink/35 hover:border-ink/15 focus:border-brand-500 focus:ring-4 focus:ring-brand-100/70"
              />
            </label>

            {activeAssignment ? (
              <div className="rounded-[1.4rem] border border-ink/8 bg-white px-4 py-3 text-sm text-ink/65">
                Current teacher: <span className="font-semibold text-ink">{activeAssignment.teacherName ?? "Not assigned"}</span>
              </div>
            ) : null}

            {message ? (
              <div
                className={cn(
                  "rounded-[1.4rem] border px-4 py-3 text-sm font-medium",
                  tone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800",
                )}
              >
                {message}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-3 border-t border-ink/6 pt-4">
              <button
                type="button"
                onClick={closeDialog}
                className="inline-flex h-11 items-center justify-center rounded-full border border-ink/10 bg-white px-5 text-sm font-semibold text-ink transition hover:bg-sand/60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || assignments.length === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-ink/40"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                <span>{pending ? "Saving..." : "Save assignment"}</span>
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
