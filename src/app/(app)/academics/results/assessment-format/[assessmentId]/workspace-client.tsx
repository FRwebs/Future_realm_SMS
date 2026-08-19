"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, ClipboardCheck, ShieldCheck } from "lucide-react";

import { SidePanel } from "@/components/ui/side-panel";
import { useToast } from "@/components/ui/toast-provider";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { AcademicAssessmentView, AssessmentCandidateView, Role } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

type AssessmentWorkspaceClientProps = {
  assessment: AcademicAssessmentView;
  canManageScores: boolean;
  sessionRole: Role;
};

type AssessmentCandidateEditorProps = {
  assessmentId: string;
  maxScore: number;
  candidate: AssessmentCandidateView | null;
  canManageScores: boolean;
  onClose: () => void;
  onSaved: (assessment: AcademicAssessmentView) => void;
};

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

function isTeachingRole(role: Role) {
  return role === "TEACHER" || role === "CLASS_TEACHER" || role === "SUBJECT_TEACHER";
}

function AssessmentCandidateEditor({
  assessmentId,
  maxScore,
  candidate,
  canManageScores,
  onClose,
  onSaved,
}: AssessmentCandidateEditorProps) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [attendanceState, setAttendanceState] = useState<AssessmentCandidateView["attendanceState"]>("PRESENT");
  const [score, setScore] = useState("");
  const [scoreFlag, setScoreFlag] = useState<AssessmentCandidateView["scoreFlag"]>("NONE");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAttendanceState(candidate?.attendanceState ?? "PRESENT");
    setScore(candidate?.score != null ? String(candidate.score) : "");
    setScoreFlag(candidate?.scoreFlag ?? "NONE");
    setComment(candidate?.comment ?? "");
    setError(null);
  }, [candidate]);

  const isEditable = canManageScores;
  const numericScore = score === "" ? undefined : Number(score);

  function handleSave() {
    if (!candidate || !isEditable) return;

    if (attendanceState === "PRESENT") {
      if (numericScore == null || Number.isNaN(numericScore) || numericScore < 0 || numericScore > maxScore) {
        setError(`Score must be between 0 and ${maxScore}.`);
        return;
      }
    }

    setError(null);
    startTransition(async () => {
      try {
        const payload = {
          assessmentId,
          scores: [
            {
              studentId: candidate.studentId,
              score: attendanceState === "PRESENT" ? numericScore : undefined,
              attendanceState,
              scoreFlag,
              comment: comment.trim() || undefined,
            },
          ],
        };

        const response = await fetch("/api/v1/academics/academic-assessments/scores", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": getCookie("fr_csrf") ?? "",
          },
          body: JSON.stringify(payload),
        });

        const body = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          data?: AcademicAssessmentView;
        };

        if (!response.ok || body.ok === false || !body.data) {
          setError(body.error ?? "Unable to update assessment score.");
          return;
        }

        onSaved(body.data);
        showToast({
          variant: "success",
          title: "Assessment updated",
          description: `${candidate.studentName}'s assessment result has been saved.`,
        });
        onClose();
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  return (
    <SidePanel
      open={Boolean(candidate)}
      onClose={onClose}
      title={candidate ? `Update result for ${candidate.studentName}` : "Update assessment result"}
      subtitle={
        candidate
          ? "Use this drawer to manage attendance status, score, and any moderation note for a single learner without leaving the assessment workspace."
          : undefined
      }
      size="md"
      footer={
        isEditable ? (
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary px-4">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={isPending} className="btn-primary px-5">
              {isPending ? "Saving..." : "Save assessment result"}
            </button>
          </div>
        ) : null
      }
    >
      {candidate ? (
        <div className="space-y-5">
          <section className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">Candidate</p>
                <p className="mt-2 text-[18px] font-bold text-[var(--color-text-primary)]">{candidate.studentName}</p>
                <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">{candidate.admissionNumber ?? "No admission number"}</p>
              </div>
              <StatusBadge status={candidate.scoreFlag} />
            </div>
          </section>

          {!isEditable ? (
            <section className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4 text-[13px] leading-6 text-[var(--color-text-secondary)]">
              This role can review the assessment workspace but cannot edit scores from here.
            </section>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="field-label">Attendance state</span>
              <select
                value={attendanceState}
                onChange={(event) => setAttendanceState(event.target.value as AssessmentCandidateView["attendanceState"])}
                disabled={!isEditable}
                className="field-select h-11"
              >
                <option value="PRESENT">Present</option>
                <option value="ABSENT">Absent</option>
                <option value="EXCUSED">Excused</option>
                <option value="MALPRACTICE">Malpractice</option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="field-label">Score flag</span>
              <select
                value={scoreFlag}
                onChange={(event) => setScoreFlag(event.target.value as AssessmentCandidateView["scoreFlag"])}
                disabled={!isEditable}
                className="field-select h-11"
              >
                <option value="NONE">No flag</option>
                <option value="ABSENT">Absent</option>
                <option value="MALPRACTICE">Malpractice</option>
                <option value="WITHHELD">Withheld</option>
                <option value="LATE_ENTRY">Late entry</option>
              </select>
            </label>
          </section>

          <label className="grid gap-2">
            <span className="field-label">Score</span>
            <input
              type="number"
              min={0}
              max={maxScore}
              value={score}
              onChange={(event) => setScore(event.target.value)}
              disabled={!isEditable || attendanceState !== "PRESENT"}
              className="field-control h-11"
              placeholder={attendanceState === "PRESENT" ? `0 to ${maxScore}` : "No score needed for this attendance state"}
            />
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {attendanceState === "PRESENT"
                ? `This assessment is scored over ${maxScore}.`
                : "When the learner is not marked present, the stored score will be treated as zero in the result sheet."}
            </span>
          </label>

          <label className="grid gap-2">
            <span className="field-label">Moderation note</span>
            <textarea
              rows={5}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              disabled={!isEditable}
              className="field-textarea min-h-[140px]"
              placeholder="Explain a withheld score, malpractice case, or any moderation note that needs future review."
            />
          </label>

          {error ? (
            <div
              className="rounded-[14px] border px-4 py-3 text-[13px]"
              style={{ borderColor: "var(--color-danger)", background: "var(--color-danger-dim)", color: "var(--color-danger)" }}
            >
              {error}
            </div>
          ) : null}
        </div>
      ) : null}
    </SidePanel>
  );
}

function SummaryCard({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <article className="surface-card overflow-hidden p-0">
      <div className="h-1.5" style={{ background: "var(--color-accent-primary)" }} />
      <div className="p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
        <p className="mt-3 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{value}</p>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">{note}</p>
      </div>
    </article>
  );
}

export default function AssessmentWorkspaceClient({
  assessment,
  canManageScores,
  sessionRole,
}: AssessmentWorkspaceClientProps) {
  const [currentAssessment, setCurrentAssessment] = useState(assessment);
  const [selectedCandidate, setSelectedCandidate] = useState<AssessmentCandidateView | null>(null);

  const completionRate =
    currentAssessment.candidateCount === 0 ? 0 : Math.round((currentAssessment.enteredCount / currentAssessment.candidateCount) * 100);
  const pendingCandidates = (currentAssessment.candidates ?? []).filter((candidate) => candidate.score == null && candidate.attendanceState === "PRESENT").length;
  const flaggedCandidates = (currentAssessment.candidates ?? []).filter((candidate) => candidate.scoreFlag !== "NONE").length;
  const attendanceExceptions = (currentAssessment.candidates ?? []).filter((candidate) => candidate.attendanceState !== "PRESENT").length;
  const highlightCandidates = (currentAssessment.candidates ?? [])
    .filter((candidate) => candidate.score == null || candidate.scoreFlag !== "NONE" || candidate.attendanceState !== "PRESENT")
    .slice(0, 6);
  const teacherFocusedCopy = isTeachingRole(sessionRole);

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href={"/academics/results/assessment-format" as Route} className="text-[13px] font-semibold text-[var(--color-text-accent)]">
          Back to assessment format
        </Link>
        <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="section-eyebrow">
              {currentAssessment.term}
              {currentAssessment.session ? ` · ${currentAssessment.session}` : ""}
            </p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">{currentAssessment.title}</h1>
            <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
              {currentAssessment.className} · {currentAssessment.subject} · {currentAssessment.assessmentType.replaceAll("_", " ")} · {formatDate(currentAssessment.assessmentDate)}
            </p>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              {teacherFocusedCopy
                ? "Teachers should only focus on candidate readiness, missing scores, and moderation notes here. Approval and publishing decisions remain with academic oversight roles."
                : "Review candidate readiness, missing marks, attendance exceptions, and moderation flags from one assessment workspace."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={currentAssessment.status} />
            {teacherFocusedCopy && canManageScores ? (
              <span
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                style={{ borderColor: "var(--color-success)", background: "var(--color-success-dim)", color: "var(--color-success)" }}
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                Teacher scoring enabled
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Candidates" value={currentAssessment.candidateCount} note="Generated from the current class list for this assessment." />
        <SummaryCard label="Scores entered" value={currentAssessment.enteredCount} note="Learners who already have marks recorded." />
        <SummaryCard label="Pending entry" value={pendingCandidates} note="Candidates still waiting for a score or attendance decision." />
        <SummaryCard label="Weight / max score" value={`${currentAssessment.weight}% / ${currentAssessment.maxScore}`} note="How this assessment contributes to final results." />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="surface-card p-6">
            <p className="section-eyebrow">Assessment readiness</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">What still needs teacher attention</h2>
            <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Focus on the learners still missing marks, attendance decisions, or moderation notes before this assessment moves forward.
            </p>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
              <span
                className="block h-full rounded-full"
                style={{ width: `${completionRate}%`, background: "var(--color-accent-primary)" }}
              />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Pending scores</p>
                <p className="mt-3 text-[22px] font-bold text-[var(--color-text-primary)]">{pendingCandidates}</p>
              </div>
              <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Flags</p>
                <p className="mt-3 text-[22px] font-bold text-[var(--color-text-primary)]">{flaggedCandidates}</p>
              </div>
              <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Attendance issues</p>
                <p className="mt-3 text-[22px] font-bold text-[var(--color-text-primary)]">{attendanceExceptions}</p>
              </div>
            </div>
        </section>

        <section className="surface-card p-6">
            <p className="section-eyebrow">Teacher risk review</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Quick intervention list</h2>
            <div className="mt-5 grid gap-3">
              {highlightCandidates.length === 0 ? (
                <div
                  className="rounded-[10px] border p-4 text-sm font-semibold"
                  style={{ borderColor: "var(--color-success)", background: "var(--color-success-dim)", color: "var(--color-success)" }}
                >
                  This assessment is clean right now. No missing scores, flags, or attendance exceptions need teacher action.
                </div>
              ) : (
                highlightCandidates.map((candidate) => (
                  <article key={candidate.id} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                    <p className="font-semibold text-[var(--color-text-primary)]">{candidate.studentName}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">{candidate.admissionNumber ?? "No admission number"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {candidate.score == null ? (
                        <span
                          className="rounded-full border px-3 py-1 text-xs font-semibold"
                          style={{ borderColor: "var(--color-warning)", background: "var(--color-warning-dim)", color: "var(--color-warning)" }}
                        >
                          Score pending
                        </span>
                      ) : null}
                      {candidate.scoreFlag !== "NONE" ? (
                        <span
                          className="rounded-full border px-3 py-1 text-xs font-semibold"
                          style={{ borderColor: "var(--color-danger)", background: "var(--color-danger-dim)", color: "var(--color-danger)" }}
                        >
                          {candidate.scoreFlag.replaceAll("_", " ")}
                        </span>
                      ) : null}
                      {candidate.attendanceState !== "PRESENT" ? (
                        <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                          {candidate.attendanceState.replaceAll("_", " ")}
                        </span>
                      ) : null}
                    </div>
                  </article>
                ))
              )}
            </div>
        </section>
      </section>

      <div>
        <TableCard<AssessmentCandidateView>
          title="Candidate score sheet"
          description={
            teacherFocusedCopy
              ? "Open a learner to update score, attendance state, or moderation notes from the side drawer."
              : "Review each candidate record, flags, and audit-ready scoring details."
          }
          items={currentAssessment.candidates ?? []}
          emptyState="No candidates have been generated yet. Use the assessment setup action to generate the class candidate list."
          columns={[
            {
              key: "student",
              header: "Student",
              render: (item) => (
                <div>
                  <Link className="font-semibold text-[var(--color-text-accent)]" href={`/students/${item.studentId}` as Route}>
                    {item.studentName}
                  </Link>
                  <p className="text-xs text-[var(--color-text-muted)]">{item.admissionNumber ?? "No admission number"}</p>
                </div>
              ),
            },
            { key: "attendance", header: "Attendance", render: (item) => <StatusBadge status={item.attendanceState} /> },
            { key: "score", header: "Score", render: (item) => item.score ?? "Not entered" },
            { key: "flag", header: "Flag", render: (item) => <StatusBadge status={item.scoreFlag} /> },
            { key: "entered", header: "Entered by", render: (item) => item.enteredBy ?? "Pending" },
            {
              key: "action",
              header: "Action",
              render: (item) =>
                canManageScores ? (
                  <button type="button" onClick={() => setSelectedCandidate(item)} className="btn-secondary h-9 px-4 text-[12px]">
                    {item.score == null ? "Enter result" : "Update"}
                  </button>
                ) : (
                  <button type="button" onClick={() => setSelectedCandidate(item)} className="btn-secondary h-9 px-4 text-[12px]">
                    Review
                  </button>
                ),
            },
          ]}
        />
      </div>

      {teacherFocusedCopy && flaggedCandidates > 0 ? (
        <section
          className="rounded-[14px] border p-4 text-[13px] leading-6"
          style={{ borderColor: "var(--color-warning)", background: "var(--color-warning-dim)", color: "var(--color-warning)" }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Teachers can resolve score-entry gaps and candidate-level flags here, but approval and publication still belong to the academic review workflow. That keeps the teacher view focused and reduces accidental cross-role actions.
            </p>
          </div>
        </section>
      ) : null}

      {!teacherFocusedCopy && currentAssessment.status === "PUBLISHED" ? (
        <section className="rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4 text-[13px] leading-6 text-[var(--color-text-secondary)]">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Published assessments should only be edited through the controlled correction flow. This workspace remains available for review so academic leaders can trace what was entered and by whom.
            </p>
          </div>
        </section>
      ) : null}

      <AssessmentCandidateEditor
        assessmentId={currentAssessment.id}
        maxScore={currentAssessment.maxScore}
        candidate={selectedCandidate}
        canManageScores={canManageScores}
        onClose={() => setSelectedCandidate(null)}
        onSaved={(nextAssessment) => {
          setCurrentAssessment(nextAssessment);
          if (selectedCandidate) {
            const refreshedCandidate = nextAssessment.candidates?.find((item) => item.studentId === selectedCandidate.studentId) ?? null;
            setSelectedCandidate(refreshedCandidate);
          }
        }}
      />
    </div>
  );
}
