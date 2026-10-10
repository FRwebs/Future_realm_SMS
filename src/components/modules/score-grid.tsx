"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { ScoreSheetPanel } from "@/lib/modules/panels";
import { sendJson } from "@/lib/modules/submit";
import { CARD_BORDER, INK, MUTED } from "@/lib/modules/tones";

/**
 * Entering a class's scores for one subject.
 *
 * Two bounded numbers per child, totalled as they are typed, submitted
 * together. The total is shown because it is the number a teacher is actually
 * reasoning about — CA and exam are how it is composed, not what it means.
 *
 * A locked row is rendered read-only rather than hidden: a teacher looking for
 * a child they cannot score needs to see why, not wonder where the name went.
 */
type Draft = { ca: string; exam: string };

function clampNumber(raw: string, max: number): string {
  if (raw === "") return "";
  const value = Number(raw);
  if (Number.isNaN(value)) return "";
  if (value < 0) return "0";
  if (value > max) return String(max);
  return raw;
}

export function ScoreGrid({ panel }: { panel: ScoreSheetPanel }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      panel.students.map((student) => [
        student.id,
        {
          ca: student.continuousAssessment === null ? "" : String(student.continuousAssessment),
          exam: student.exam === null ? "" : String(student.exam),
        },
      ]),
    ),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [refused, setRefused] = useState<Array<{ studentId: string; reason: string }>>([]);

  const editable = panel.students.filter((student) => !student.locked);
  const lockedCount = panel.students.length - editable.length;

  const complete = useMemo(
    () =>
      editable.filter((student) => {
        const draft = drafts[student.id];
        return draft && draft.ca !== "" && draft.exam !== "";
      }).length,
    [drafts, editable],
  );

  function setField(studentId: string, field: keyof Draft, value: string) {
    const max = field === "ca" ? panel.maxCa : panel.maxExam;
    setDrafts((current) => ({
      ...current,
      [studentId]: { ...(current[studentId] ?? { ca: "", exam: "" }), [field]: clampNumber(value, max) },
    }));
    setDone(null);
  }

  async function save() {
    // Only children with both halves are sent. A CA with no exam is a total
    // that would read as a fail, and saving it would be worse than skipping it.
    const entries = editable
      .map((student) => ({ student, draft: drafts[student.id] }))
      .filter(({ draft }) => draft && draft.ca !== "" && draft.exam !== "")
      .map(({ student, draft }) => ({
        studentId: student.id,
        continuousAssessment: Number(draft!.ca),
        exam: Number(draft!.exam),
      }));

    if (!entries.length) {
      setError("Enter both a CA and an exam mark for at least one student.");
      return;
    }

    setPending(true);
    setError(null);
    setRefused([]);
    try {
      await sendJson(panel.endpoint, "POST", {
        classId: panel.classId,
        subjectId: panel.subjectId,
        entries,
      });
      setDone(panel.done);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not save.");
    } finally {
      setPending(false);
    }
  }

  if (!panel.students.length) {
    return (
      <section
        className="min-w-0 overflow-hidden rounded-[14px] border bg-[var(--color-bg-surface)] px-[18px] py-[16px]"
        style={{ borderColor: CARD_BORDER }}
      >
        <h3 className="text-[12.5px] font-semibold" style={{ color: INK }}>
          {panel.title}
        </h3>
        <p className="mt-[6px] text-[11px] leading-[1.55]" style={{ color: MUTED }}>
          {panel.emptyNote ?? "Nobody is on this class's roll, so there is nothing to score."}
        </p>
      </section>
    );
  }

  return (
    <section
      className="min-w-0 overflow-hidden rounded-[14px] border bg-[var(--color-bg-surface)]"
      style={{ borderColor: CARD_BORDER }}
    >
      <div
        className="flex flex-wrap items-start justify-between gap-[12px] px-[18px] pb-[12px] pt-[14px]"
        style={{ borderBottom: "1px solid #EDF3EF" }}
      >
        <div className="min-w-0">
          <h3 className="text-[12.5px] font-semibold leading-[1.3]" style={{ color: INK }}>
            {panel.title}
          </h3>
          {panel.sub ? (
            <p className="mt-[3px] text-[10.5px] leading-[1.5]" style={{ color: MUTED }}>
              {panel.sub}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-[6px]">
          <span
            className="rounded-full px-[9px] py-[3px] text-[10.5px] font-semibold tabular-nums"
            style={{ background: "#E7F5EE", color: "#17714F" }}
          >
            {complete} of {editable.length} complete
          </span>
          {lockedCount ? (
            <span
              className="rounded-full px-[9px] py-[3px] text-[10.5px] font-semibold tabular-nums"
              style={{ background: "#EEF2F0", color: "#435048" }}
            >
              {lockedCount} locked
            </span>
          ) : null}
        </div>
      </div>

      {done ? (
        <div className="px-[18px] pt-[12px]">
          <div
            className="rounded-[12px] border px-[13px] py-[10px]"
            style={{ background: "#EAF6F0", borderColor: "#CFE4DB" }}
          >
            <p className="text-[11.5px] font-bold" style={{ color: "#17714F" }}>
              {done}
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="px-[18px] pt-[12px]">
          <div
            className="rounded-[12px] border px-[13px] py-[10px]"
            style={{ background: "#FDF2F2", borderColor: "#F3D2D2" }}
          >
            <p className="text-[11.5px] font-semibold" style={{ color: "#A32B2B" }}>
              {error}
            </p>
          </div>
        </div>
      ) : null}

      {refused.length ? (
        <div className="px-[18px] pt-[12px]">
          <div
            className="rounded-[12px] border px-[13px] py-[10px]"
            style={{ background: "#FBF2DC", borderColor: "#EBD9A8" }}
          >
            <p className="text-[11.5px] font-semibold" style={{ color: "#8A6314" }}>
              {refused.length} could not be saved. The rest were.
            </p>
          </div>
        </div>
      ) : null}

      <div
        className="hidden items-center gap-[12px] px-[18px] py-[8px] md:flex"
        style={{ background: "#F7FAF8", borderBottom: "1px solid #E6EEE9" }}
      >
        <span className="flex-1 text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>
          Student
        </span>
        <span className="w-[72px] text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>
          CA /{panel.maxCa}
        </span>
        <span className="w-[72px] text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>
          Exam /{panel.maxExam}
        </span>
        <span className="w-[56px] text-right text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>
          Total
        </span>
      </div>

      <ul className="px-[18px]">
        {panel.students.map((student) => {
          const draft = drafts[student.id] ?? { ca: "", exam: "" };
          const total =
            draft.ca === "" && draft.exam === ""
              ? null
              : (Number(draft.ca) || 0) + (Number(draft.exam) || 0);

          return (
            <li
              key={student.id}
              className="flex flex-wrap items-center gap-x-[12px] gap-y-[6px] border-b py-[8px]"
              style={{ borderColor: "#F2F7F4" }}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[11.5px] font-semibold leading-[1.35]" style={{ color: INK }}>
                  {student.name}
                </span>
                <span className="block text-[10px] leading-[1.4]" style={{ color: MUTED }}>
                  {student.locked
                    ? `Locked — ${student.sheetStatus?.toLowerCase() ?? "already decided"}`
                    : (student.admissionNumber ?? "")}
                </span>
              </span>

              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={panel.maxCa}
                value={draft.ca}
                disabled={student.locked}
                aria-label={`Continuous assessment for ${student.name}`}
                onChange={(event) => setField(student.id, "ca", event.target.value)}
                className="w-[72px] rounded-[8px] border px-[8px] py-[6px] text-[11.5px] tabular-nums outline-none focus:border-[#BFDCD1] disabled:bg-[#F7FAF8] disabled:text-[#8B9A91]"
                style={{ borderColor: "#DEE8E2", color: INK }}
              />
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={panel.maxExam}
                value={draft.exam}
                disabled={student.locked}
                aria-label={`Exam mark for ${student.name}`}
                onChange={(event) => setField(student.id, "exam", event.target.value)}
                className="w-[72px] rounded-[8px] border px-[8px] py-[6px] text-[11.5px] tabular-nums outline-none focus:border-[#BFDCD1] disabled:bg-[#F7FAF8] disabled:text-[#8B9A91]"
                style={{ borderColor: "#DEE8E2", color: INK }}
              />
              <span
                className="w-[56px] text-right text-[12px] font-bold tabular-nums"
                style={{ color: total === null ? MUTED : total >= 50 ? "#17714F" : "#A32B2B" }}
              >
                {total === null ? "—" : total}
              </span>
            </li>
          );
        })}
      </ul>

      <div
        className="flex flex-wrap items-center justify-between gap-[10px] px-[18px] py-[12px]"
        style={{ background: "#FBFDFC", borderTop: "1px solid #EDF3EF" }}
      >
        <p className="text-[10.5px] leading-[1.45]" style={{ color: MUTED }}>
          Only students with both a CA and an exam mark are saved. Scores are kept as a draft until
          the sheet is submitted for review.
        </p>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-[9px] px-[16px] py-[9px] text-[11.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: INK, boxShadow: "0 7px 16px -9px rgba(13,35,21,0.6)" }}
        >
          {pending ? "Saving…" : "Save scores"}
        </button>
      </div>
    </section>
  );
}
