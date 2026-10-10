"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { RosterPanel } from "@/lib/modules/panels";
import { sendJson } from "@/lib/modules/submit";
import { CARD_BORDER, INK, MUTED } from "@/lib/modules/tones";
import { cn } from "@/lib/utils/cn";

/**
 * Taking a register.
 *
 * The first interaction in the module vocabulary that a trigger cannot
 * express: one status per child, submitted together. The panel supplies the
 * roll and the endpoint; everything below is how a register is actually taken.
 *
 * Marking everyone present first and correcting the exceptions is how a
 * teacher does this on paper, so "all present" is one button and the rest is
 * four taps per child who is not.
 */

type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

const CHOICES: Array<{ value: Status; label: string; short: string; tone: string; bg: string }> = [
  { value: "PRESENT", label: "Present", short: "P", tone: "#17714F", bg: "#E7F5EE" },
  { value: "LATE", label: "Late", short: "L", tone: "#8A6314", bg: "#FBF2DC" },
  { value: "EXCUSED", label: "Excused", short: "E", tone: "#435048", bg: "#EEF2F0" },
  { value: "ABSENT", label: "Absent", short: "A", tone: "#A32B2B", bg: "#FBEAEA" },
];

export function AttendanceGrid({ panel }: { panel: RosterPanel }) {
  const router = useRouter();
  const [marks, setMarks] = useState<Record<string, Status>>(() =>
    Object.fromEntries(
      panel.students
        .filter((student) => student.status)
        .map((student) => [student.id, student.status as Status]),
    ),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const counts = useMemo(() => {
    const tally: Record<string, number> = { PRESENT: 0, LATE: 0, EXCUSED: 0, ABSENT: 0 };
    for (const value of Object.values(marks)) tally[value] = (tally[value] ?? 0) + 1;
    return tally;
  }, [marks]);

  const unmarked = panel.students.length - Object.keys(marks).length;

  function setAll(status: Status) {
    setMarks(Object.fromEntries(panel.students.map((student) => [student.id, status])));
    setDone(null);
  }

  function setOne(studentId: string, status: Status) {
    setMarks((current) => ({ ...current, [studentId]: status }));
    setDone(null);
  }

  async function save() {
    const entries = Object.entries(marks).map(([studentId, status]) => ({ studentId, status }));
    if (!entries.length) {
      setError("Mark at least one child before saving.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await sendJson(panel.endpoint, "POST", {
        classId: panel.classId,
        date: panel.date,
        entries,
      });
      setDone(panel.done);
      // The register feeds the figures above it and on the Command Center, so
      // the page is re-read rather than patched.
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
          {panel.emptyNote ?? "Nobody is on this class's roll, so there is no register to take."}
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
          {CHOICES.map((choice) => (
            <span
              key={choice.value}
              className="rounded-full px-[9px] py-[3px] text-[10.5px] font-semibold tabular-nums"
              style={{ background: choice.bg, color: choice.tone }}
            >
              {counts[choice.value] ?? 0} {choice.label.toLowerCase()}
            </span>
          ))}
          {unmarked > 0 ? (
            <span
              className="rounded-full border px-[9px] py-[3px] text-[10.5px] font-semibold tabular-nums"
              style={{ borderColor: "#DEE8E2", color: MUTED }}
            >
              {unmarked} unmarked
            </span>
          ) : null}
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-[8px] px-[18px] py-[10px]"
        style={{ borderBottom: "1px solid #F2F7F4", background: "#FBFDFC" }}
      >
        <span className="text-[10.5px] font-semibold" style={{ color: MUTED }}>
          Start from
        </span>
        <button
          type="button"
          onClick={() => setAll("PRESENT")}
          className="rounded-[8px] border bg-white px-[10px] py-[5px] text-[10.5px] font-semibold"
          style={{ borderColor: "#DEE8E2", color: "#17714F" }}
        >
          Everyone present
        </button>
        <button
          type="button"
          onClick={() => {
            setMarks({});
            setDone(null);
          }}
          className="rounded-[8px] border bg-white px-[10px] py-[5px] text-[10.5px] font-semibold"
          style={{ borderColor: "#DEE8E2", color: "#435048" }}
        >
          Clear
        </button>
        <span className="ml-auto text-[10.5px] tabular-nums" style={{ color: MUTED }}>
          {panel.date}
        </span>
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

      <ul className="px-[18px]">
        {panel.students.map((student) => {
          const current = marks[student.id];
          return (
            <li
              key={student.id}
              className="flex flex-wrap items-center gap-x-[12px] gap-y-[8px] border-b py-[9px]"
              style={{ borderColor: "#F2F7F4" }}
            >
              <span className="min-w-0 flex-1">
                <span
                  className="block text-[11.5px] font-semibold leading-[1.35]"
                  style={{ color: INK }}
                >
                  {student.name}
                </span>
                {student.admissionNumber ? (
                  <span className="block text-[10px] leading-[1.4]" style={{ color: MUTED }}>
                    {student.admissionNumber}
                  </span>
                ) : null}
              </span>

              <span className="flex flex-none items-center gap-[4px]" role="group" aria-label={`Attendance for ${student.name}`}>
                {CHOICES.map((choice) => {
                  const active = current === choice.value;
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      aria-pressed={active}
                      title={choice.label}
                      onClick={() => setOne(student.id, choice.value)}
                      className={cn(
                        "h-[26px] w-[28px] rounded-[7px] border text-[11px] font-bold transition",
                        active ? "" : "bg-white hover:bg-[#F7FAF8]",
                      )}
                      style={
                        active
                          ? { background: choice.bg, borderColor: choice.tone, color: choice.tone }
                          : { borderColor: "#DEE8E2", color: "#8B9A91" }
                      }
                    >
                      {choice.short}
                    </button>
                  );
                })}
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
          {unmarked > 0
            ? `${unmarked} child${unmarked === 1 ? "" : "ren"} still unmarked — only the marked ones are saved.`
            : "Every child on this roll has a mark."}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-[9px] px-[16px] py-[9px] text-[11.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: INK, boxShadow: "0 7px 16px -9px rgba(13,35,21,0.6)" }}
        >
          {pending ? "Saving…" : "Save the register"}
        </button>
      </div>
    </section>
  );
}
