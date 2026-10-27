"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PANEL_SHELL } from "@/components/modules/panel-renderer";
import { sendJsonForData } from "@/lib/modules/submit";
import { CARD_BORDER, INK, MUTED } from "@/lib/modules/tones";

/**
 * A lesson as the teacher mockup draws it: the reading, a task to try in the classroom, one question answered on the spot, and the
 * course's outline beside it. The answer is checked on the server — it is never sent to this page — and a right answer is what finishes
 * the lesson. A wrong one says so and lets you try another, as many times as you like.
 */

export type LessonPlayerProps = {
  course: { id: string; title: string; task: string | null; hours: number; certificateName: string; provider: string; required: { by: string | null; note: string | null } | null; lessonsTotal: number; done: number };
  outline: Array<{ position: number; title: string; minutes: number; done: boolean }>;
  lesson: { position: number; title: string; minutes: number; body: string; question: string; options: string[]; done: boolean };
  /** Pre-formatted by the server so the page and the card agree on how a length reads. */
  progressLabel: string;
  requiredLabel: string;
  /** The free first lesson of a course not yet paid for: it can be read, not answered. */
  preview?: boolean;
  endpoint: string;
  hrefs: { course: string; lessons: string; certificates: string };
};

type Answered = { choice: number; correct: boolean; message: string };

export function LessonPlayer({ course, outline, lesson, progressLabel, requiredLabel, endpoint, hrefs, preview }: LessonPlayerProps) {
  const router = useRouter();
  const [chosen, setChosen] = useState<Answered | null>(null);
  const [wrong, setWrong] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(lesson.done);
  const [finished, setFinished] = useState<{ code: string | null } | null>(null);
  const last = lesson.position === course.lessonsTotal;
  const next = outline.find((entry) => entry.position > lesson.position) ?? null;
  const doneCount = Math.max(course.done, outline.filter((entry) => entry.done).length) + (done && !lesson.done ? 1 : 0);

  async function answer(index: number) {
    if (busy || done) return;
    setBusy(true);
    try {
      const result = await sendJsonForData<{ correct: boolean; finished?: boolean; certificate?: { code: string } | null; explanation?: string }>(endpoint, "POST", { choice: index });
      setChosen({ choice: index, correct: true, message: `Correct. ${result.explanation ?? ""}`.trim() });
      setDone(true);
      if (result.finished) setFinished({ code: result.certificate?.code ?? null });
      router.refresh();
    } catch (cause) {
      setWrong((current) => [...new Set([...current, index])]);
      setChosen({ choice: index, correct: false, message: cause instanceof Error ? cause.message : "That could not be checked." });
    } finally {
      setBusy(false);
    }
  }

  const mark = (index: number) => (done && chosen?.choice === index ? "✓" : wrong.includes(index) ? "×" : String.fromCharCode(65 + index));
  const style = (index: number) => {
    const ok = done && chosen?.choice === index;
    const bad = wrong.includes(index);
    return { background: ok ? "#EAF6F0" : bad ? "#FDF3F3" : "#fff", borderColor: ok ? "#22A06B" : bad ? "#E8B4B4" : "#E3ECE6" };
  };

  return (
    <section className={`${PANEL_SHELL} p-0!`} style={{ borderColor: CARD_BORDER }}>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 px-[18px] pb-[20px] pt-[16px]">
          <p className="text-[9px] font-bold uppercase tracking-[0.07em]" style={{ color: MUTED }}>Lesson {lesson.position} of {course.lessonsTotal}</p>
          <h2 className="mt-[4px] text-[17px] font-extrabold leading-tight tracking-[-0.01em]" style={{ color: INK }}>{lesson.title}</h2>
          <p className="mt-[3px] text-[10.5px]" style={{ color: MUTED }}>{lesson.minutes} minutes · {course.provider}</p>

          <div className="mt-[14px] whitespace-pre-line text-pretty text-[12.5px] leading-[1.75]" style={{ color: "#2A3A31" }}>{lesson.body}</div>

          {course.task ? (
            <div className="mt-[14px] rounded-[11px] border px-[13px] py-[10px]" style={{ background: "#F5F0FA", borderColor: "#E7DDF2" }}>
              <p className="text-[9px] font-bold uppercase tracking-[0.07em]" style={{ color: "#6B4E9E" }}>Try it in your own classroom</p>
              <p className="mt-[3px] text-[11.5px] leading-[1.55]" style={{ color: "#4A3470" }}>{course.task}</p>
            </div>
          ) : null}

          {preview ? (
            <div className="mt-[18px] rounded-[11px] border px-[14px] py-[12px]" style={{ background: "#EEF7F3", borderColor: "#D3E8DE" }}>
              <p className="text-[12px] font-extrabold" style={{ color: "#17604F" }}>This is the free lesson</p>
              <p className="mt-[3px] text-pretty text-[11.5px] leading-[1.55]" style={{ color: "#17604F" }}>Buy the course to answer the check, open the other {course.lessonsTotal - 1} lessons and earn the {course.certificateName} certificate.</p>
              <Link href={hrefs.course as Route} className="mt-[9px] inline-flex rounded-[9px] px-[14px] py-[9px] text-[11.5px] font-semibold text-white" style={{ background: INK }}>Back to the course</Link>
            </div>
          ) : null}

          <div className={preview ? "hidden" : "mt-[18px] border-t pt-[16px]"} style={{ borderColor: "#EDF3EF" }}>
            <p className="text-[9px] font-bold uppercase tracking-[0.07em]" style={{ color: MUTED }}>Check your understanding</p>
            <p className="mt-[5px] text-pretty text-[13px] font-bold leading-[1.45]" style={{ color: INK }}>{lesson.question}</p>
            <div className="mt-[10px] grid gap-[8px]" role="radiogroup" aria-label={lesson.question}>
              {lesson.options.map((option, index) => (
                <button key={option} type="button" role="radio" aria-checked={chosen?.choice === index} disabled={busy || done} onClick={() => answer(index)} className="flex items-start gap-[10px] rounded-[10px] border-[1.5px] px-[12px] py-[10px] text-left transition enabled:hover:border-[#BFDCD1] disabled:cursor-default" style={style(index)}>
                  <span className="flex h-[20px] w-[20px] flex-none items-center justify-center rounded-full text-[10px] font-extrabold" style={done && chosen?.choice === index ? { background: "#22A06B", color: "#fff" } : wrong.includes(index) ? { background: "#DB5555", color: "#fff" } : { background: "#F2F7F4", color: "#5F6E65" }}>{mark(index)}</span>
                  <span className="min-w-0 flex-1 text-[12px] leading-normal" style={{ color: INK }}>{option}</span>
                </button>
              ))}
            </div>
            {chosen ? <p role="status" className="mt-[10px] rounded-[9px] px-[11px] py-[9px] text-[11.5px] leading-[1.55]" style={chosen.correct ? { background: "#EAF6F0", color: "#17604F" } : { background: "#FDF6EA", color: "#6B4A12" }}>{chosen.message}</p> : done ? <p className="mt-[10px] rounded-[9px] px-[11px] py-[9px] text-[11.5px]" style={{ background: "#EAF6F0", color: "#17604F" }}>You have answered this one correctly.</p> : null}
            {finished ? (
              <div className="mt-[10px] rounded-[11px] border px-[13px] py-[11px]" style={{ background: "#EAF6F0", borderColor: "#CFE4DB" }}>
                <p className="text-[12px] font-extrabold" style={{ color: "#17604F" }}>Course complete — {course.certificateName}</p>
                <p className="mt-[3px] text-[11px] leading-[1.55]" style={{ color: "#17604F" }}>{finished.code ? `Certificate ${finished.code} is ` : "Your certificate is "}on your staff record, and {course.hours} {course.hours === 1 ? "hour is" : "hours are"} added to your CPD this year.{course.required ? " The school can see that it is done." : ""}</p>
              </div>
            ) : null}
          </div>

          <div className={preview ? "hidden" : "mt-[16px] flex flex-wrap gap-[8px]"}>
            {done ? (
              finished || last ? (
                <Link href={(finished ? hrefs.certificates : hrefs.course) as Route} className="inline-flex rounded-[9px] px-[14px] py-[9.5px] text-[11.5px] font-semibold text-white" style={{ background: INK }}>{finished ? "View the certificate" : "Back to the course"}</Link>
              ) : next ? (
                <Link href={`${hrefs.lessons}/${next.position}` as Route} className="inline-flex rounded-[9px] px-[14px] py-[9.5px] text-[11.5px] font-semibold text-white" style={{ background: INK }}>Next lesson</Link>
              ) : null
            ) : (
              <span className="inline-flex cursor-default rounded-[9px] px-[14px] py-[9.5px] text-[11.5px] font-semibold" style={{ background: "#E6EEE9", color: "#5f6e65" }}>{last ? "Answer to finish the course" : "Answer to continue"}</span>
            )}
            <Link href={hrefs.course as Route} className="inline-flex rounded-[9px] border bg-white px-[13px] py-[9px] text-[11.5px] font-semibold" style={{ borderColor: "#CFDDD5", color: "#435048" }}>Save and leave</Link>
          </div>
        </div>

        <aside className="min-w-0 border-t px-[16px] pb-[18px] pt-[16px] lg:border-l lg:border-t-0" style={{ borderColor: "#EDF3EF", background: "#FBFDFC" }}>
          <p className="text-[9px] font-bold uppercase tracking-[0.07em]" style={{ color: MUTED }}>In this course</p>
          <p className="mt-[4px] text-pretty text-[12px] font-bold leading-[1.4]" style={{ color: INK }}>{course.title}</p>
          <div className="mt-[10px] h-[4px] overflow-hidden rounded-full" style={{ background: "#E6EEE9" }}><div className="h-full rounded-full" style={{ width: `${Math.round((doneCount / Math.max(1, course.lessonsTotal)) * 100)}%`, background: "#22A06B" }} /></div>
          <p className="mt-[5px] text-[10px] tabular-nums" style={{ color: MUTED }}>{doneCount} of {course.lessonsTotal} lessons · {progressLabel}</p>
          <ul className="mt-[10px]">
            {outline.map((entry) => {
              const ok = entry.done || (done && entry.position === lesson.position);
              const here = entry.position === lesson.position;
              const reachable = ok || entry.position <= (outline.find((candidate) => !candidate.done)?.position ?? outline.length + 1);
              const body = (
                <>
                  <span className="flex h-[20px] w-[20px] flex-none items-center justify-center rounded-[6px] text-[10px] font-extrabold" style={ok ? { background: "#12796A", color: "#fff" } : here ? { background: INK, color: "#fff" } : { background: "#F2F7F4", color: "#5f6e65" }}>{ok ? "✓" : entry.position}</span>
                  <span className="min-w-0 flex-1"><span className="block text-[11px] leading-[1.35]" style={{ color: INK, fontWeight: here ? 700 : 500 }}>{entry.title}</span><span className="block text-[9.5px]" style={{ color: MUTED }}>{entry.minutes} min</span></span>
                </>
              );
              return (
                <li key={entry.position} className="border-b last:border-b-0" style={{ borderColor: "#F2F7F4" }}>
                  {reachable ? <Link href={`${hrefs.lessons}/${entry.position}` as Route} className="flex items-center gap-[9px] rounded-[7px] px-[6px] py-[8px]" style={{ background: here ? "#EAF6F0" : "transparent" }}>{body}</Link> : <span className="flex items-center gap-[9px] px-[6px] py-[8px] opacity-60">{body}</span>}
                </li>
              );
            })}
          </ul>
          <dl className="mt-[12px] grid gap-[10px] border-t pt-[12px]" style={{ borderColor: "#EDF3EF" }}>
            <div><dt className="text-[9px] font-bold uppercase tracking-[0.07em]" style={{ color: MUTED }}>Earns</dt><dd className="mt-[2px] text-[11.5px] font-semibold" style={{ color: INK }}>{course.certificateName}</dd></div>
            <div><dt className="text-[9px] font-bold uppercase tracking-[0.07em]" style={{ color: MUTED }}>Required by</dt><dd className="mt-[2px] text-[11.5px] font-semibold" style={{ color: INK }}>{requiredLabel}</dd></div>
            <div><dt className="text-[9px] font-bold uppercase tracking-[0.07em]" style={{ color: MUTED }}>Your school sees</dt><dd className="mt-[2px] text-[11.5px] font-semibold" style={{ color: INK }}>That you finished — not your answers</dd></div>
          </dl>
        </aside>
      </div>
    </section>
  );
}
