"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { sendJson, sendJsonForData } from "@/lib/modules/submit";
import type { TimetableDetail } from "@/lib/modules/live/m3-types";
import { DAY_CODES, DAY_NAMES } from "@/lib/modules/timetable-periods";
import { cn } from "@/lib/utils/cn";

const API = "/api/v1/class-structure/timetables";
const CARD = "min-w-0 rounded-[14px] border border-[#DEE8E2] bg-(--color-bg-surface)";

const STATE: Record<string, { label: string; dot: string; chip: string }> = {
  RUNNING: { label: "Running now", dot: "#17714F", chip: "border-[#CFE4DB] bg-[#F1F8F4] text-[#17714F]" },
  DRAFT: { label: "Draft", dot: "#2B5FA8", chip: "border-[#CCDCF0] bg-[#F1F6FC] text-[#2B5FA8]" },
  ARCHIVED: { label: "Archived", dot: "#67766D", chip: "border-[#DEE8E2] bg-[#F7FAF8] text-[#67766D]" },
};

const GHOST =
  "inline-flex items-center gap-[6px] whitespace-nowrap rounded-[9px] border border-[#CFDDD5] bg-white px-[14px] py-[9px] text-[11.5px] font-semibold text-[#435048] transition hover:bg-[#F7FAF8]";
const SOLID =
  "inline-flex items-center gap-[6px] whitespace-nowrap rounded-[9px] bg-[#0D2315] px-[16px] py-[9.5px] text-[11.5px] font-semibold text-white transition hover:bg-[#143a22] disabled:opacity-60";

type Panel = null | "publish" | "delete" | "copy";

/**
 * A saved timetable, read the way a teacher or a guardian reads it: one arm's
 * week at a time. From here a draft is printed, edited, published or deleted; the
 * running one can only be copied, because changing it in place would change what
 * families see before anybody has checked it.
 */
export function TimetablePreview({
  detail,
  initialArmId,
  initialTeacherId,
}: {
  detail: TimetableDetail;
  initialArmId?: string;
  initialTeacherId?: string;
}) {
  const router = useRouter();
  const { version, arms, subjects, grid, periods, clashes } = detail;
  const withPeriods = useMemo(() => arms.filter((arm) => Object.keys(grid[arm.id] ?? {}).length > 0), [arms, grid]);
  const pool = withPeriods.length ? withPeriods : arms;
  const [armId, setArmId] = useState(initialArmId && arms.some((arm) => arm.id === initialArmId) ? initialArmId : pool[0]?.id ?? "");
  const [panel, setPanel] = useState<Panel>(null);
  const [teacherId, setTeacherId] = useState(initialTeacherId ?? "");
  const byTeacher = Boolean(teacherId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tell, setTell] = useState<string[]>(["teachers-changed", "form-masters"]);
  const [takes, setTakes] = useState("Immediately");
  const [effective, setEffective] = useState("");
  const [note, setNote] = useState("");
  const [copyName, setCopyName] = useState(`${version.name} · copy`);

  const teachers = useMemo(() => {
    const found = new Map<string, string>();
    for (const cells of Object.values(grid)) {
      for (const cell of Object.values(cells)) {
        if (!cell.teacherId) continue;
        for (const list of Object.values(subjects)) {
          const match = list.find((item) => item.teacherId === cell.teacherId && item.teacher);
          if (match?.teacher) {
            found.set(cell.teacherId, match.teacher);
            break;
          }
        }
      }
    }
    return Array.from(found.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [grid, subjects]);
  const teacherName = teachers.find(([id]) => id === teacherId)?.[1];
  /** A teacher's week: wherever they are booked, with the arm they are in. */
  const teacherCell = (day: number, period: number) => {
    for (const [classId, cells] of Object.entries(grid)) {
      const cell = cells[`${day}|${period}`];
      if (cell?.teacherId === teacherId) {
        const subject = (subjects[classId] ?? []).find((item) => item.subjectId === cell.subjectId);
        return { subject: subject?.name ?? "A subject", arm: arms.find((item) => item.id === classId)?.name ?? "An arm" };
      }
    }
    return null;
  };
  const arm = arms.find((item) => item.id === armId);
  const days = version.schoolDays
    .map((code) => DAY_CODES.indexOf(code) + 1)
    .filter((day) => day >= 1)
    .sort((a, b) => a - b);
  const state = STATE[version.state] ?? STATE.DRAFT;
  const placed = Object.keys(grid[armId] ?? {}).length;
  const lessonPeriods = periods.filter((period) => period.n !== "break").length;
  const armClashes = clashes.filter((clash) => clash.classIds.includes(armId));
  const armsOnIt = withPeriods.length;
  const canEdit = version.state !== "RUNNING";

  async function run(action: () => Promise<void>) {
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not go through.");
    } finally {
      setPending(false);
    }
  }

  const publish = () =>
    run(async () => {
      const result = await sendJsonForData<{
        periodsMoved: number;
        teachersTold: number;
        arms: number;
        announced: boolean;
        scheduled?: boolean;
        scheduledFor?: string;
      }>(`${API}/${version.id}/publish`, "POST", { notify: tell, note, takesEffect: takes, effectiveDate: effective });
      setPanel(null);
      if (result.scheduled && result.scheduledFor) {
        setNotice(
          `Scheduled. It will publish itself on ${new Date(result.scheduledFor).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}, after the same checks run again. Nothing changes for anyone until then.`,
        );
        router.refresh();
        return;
      }
      setNotice(
        `Published. ${result.periodsMoved} period${result.periodsMoved === 1 ? "" : "s"} moved across ${result.arms} arm${result.arms === 1 ? "" : "s"}; ${result.teachersTold} teacher${result.teachersTold === 1 ? "'s" : "s'"} week changed${result.announced ? " and staff were told in-app" : ""}.`,
      );
      router.refresh();
    });

  const unschedule = () =>
    run(async () => {
      await sendJson(`${API}/${version.id}/unschedule`, "POST", {});
      setNotice("Taken off its schedule. It stays a draft.");
      router.refresh();
    });

  const remove = () =>
    run(async () => {
      await sendJson(`${API}/${version.id}`, "DELETE", {});
      router.push("/class-timetable/timetable" as Route);
      router.refresh();
    });

  const copy = () =>
    run(async () => {
      const created = await sendJsonForData<{ id: string }>(API, "POST", {
        name: copyName,
        termId: version.termId ?? "",
        startFrom: "A copy of another timetable",
        copyFromId: version.id,
        periodsPerDay: version.periodsPerDay,
        periodMinutes: version.periodMinutes,
        firstStarts: version.firstStarts,
        breakAfter: version.breakAfter ?? "",
        schoolDays: version.schoolDays,
        appliesTo: "Every arm",
        checkClashes: true,
      });
      router.push(`/class-timetable/timetable/${created.id}/build` as Route);
    });

  return (
    <div className="grid min-w-0 gap-[14px]">
      <Link href={"/class-timetable/timetable" as Route} className="inline-flex w-fit items-center gap-[6px] text-[11.5px] font-semibold text-[#12796A] hover:underline print:hidden">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 12H6M11 6.5 5.5 12l5.5 5.5" />
        </svg>
        Back to all timetables
      </Link>

      <section className="relative overflow-hidden rounded-[15px] bg-[#0D2315] px-[19px] py-[15px] print:hidden">
        <div className="relative flex flex-wrap items-center justify-between gap-x-5 gap-y-2.5">
          <div className="min-w-0 max-w-[640px]">
            <div className="mb-[5px] flex items-center gap-[7px]">
              <span className="h-[4.5px] w-[4.5px] rounded-full bg-[#5FD6B4]" />
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/50">Class &amp; Timetable · Preview</span>
            </div>
            <h1 className="font-(family-name:--font-heading) text-[19px] font-extrabold leading-[1.15] tracking-[-0.024em] text-white">{version.name}</h1>
            <p className="mt-1 text-[11px] leading-[1.45] text-white/60">
              {version.term ?? "No term"} · {armsOnIt} arm{armsOnIt === 1 ? "" : "s"} · {lessonPeriods} periods a day ·{" "}
              {clashes.length ? `${clashes.length} clash${clashes.length === 1 ? "" : "es"}` : "no clashes"}
              {version.publishedAt ? ` · published ${new Date(version.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}` : ""}
            </p>
          </div>
          <span className={cn("inline-flex items-center gap-[6px] rounded-full border px-[11px] py-[4px] text-[10.5px] font-semibold", state.chip)}>
            <span className="h-[5px] w-[5px] rounded-full" style={{ background: state.dot }} />
            {state.label}
          </span>
        </div>
      </section>

      {version.scheduledFor ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[11px] border border-[#E7D9B4] bg-[#FBF6E8] px-[14px] py-[10px] print:hidden">
          <p className="text-[11.5px] font-medium text-[#8A6410]">
            Scheduled to publish on {new Date(version.scheduledFor).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}. It becomes the running timetable that morning.
          </p>
          <button type="button" className={GHOST} disabled={pending} onClick={unschedule}>Take it off the schedule</button>
        </div>
      ) : null}
      {notice ? <p className="rounded-[11px] border border-[#CFE4DB] bg-[#F1F8F4] px-[14px] py-[10px] text-[11.5px] font-medium text-[#17714F] print:hidden">{notice}</p> : null}
      {error ? <p className="rounded-[11px] border border-[#E4B9B9] bg-[#FBF2F2] px-[14px] py-[10px] text-[11.5px] font-medium text-[#B23B3B] print:hidden">{error}</p> : null}

      <section className={cn(CARD, "p-[18px]")}>
        <div className="mb-[13px] flex flex-wrap items-start justify-between gap-3 border-b border-[#EDF3EF] pb-[12px]">
          <div>
            <h2 className="font-(family-name:--font-heading) text-[14px] font-extrabold tracking-[-0.018em] text-[#0D2315]">{byTeacher ? teacherName ?? "A teacher" : arm?.name ?? "Choose an arm"}</h2>
            <p className="mt-[3px] text-[11px] text-[#67766D]">
              {byTeacher ? `Every period ${teacherName ?? "they"} teach${teacherName ? "es" : ""}, across all arms.` : arm ? `${arm.level}${arm.formMaster ? ` · form master ${arm.formMaster}` : ""}${arm.room ? ` · ${arm.room}` : ""} · ${placed} of ${days.length * lessonPeriods} periods placed` : "No arm has a week in this timetable yet."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button type="button" className={GHOST} onClick={() => window.print()}>Print</button>
            <button type="button" className={GHOST} onClick={() => window.print()} title="Choose “Save as PDF” as the destination">Download as PDF</button>
            {canEdit ? (
              <Link href={`/class-timetable/timetable/${version.id}/build` as Route} className={GHOST}>Edit</Link>
            ) : (
              <button type="button" className={GHOST} onClick={() => setPanel(panel === "copy" ? null : "copy")}>Make an editable draft</button>
            )}
            {version.state !== "RUNNING" ? (
              <button type="button" className={SOLID} onClick={() => setPanel(panel === "publish" ? null : "publish")}>Publish this timetable</button>
            ) : null}
          </div>
        </div>

        <div className="mb-[10px] flex flex-wrap items-center gap-[6px] print:hidden">
          <span className="mr-[4px] text-[9.5px] font-bold uppercase tracking-[0.06em] text-[#67766D]">Read by</span>
          {[["Arm", false], ["Teacher", true]].map(([label, teacher]) => {
            const on = byTeacher === teacher;
            return (
              <button
                key={String(label)}
                type="button"
                onClick={() => setTeacherId(teacher ? teachers[0]?.[0] ?? "" : "")}
                className={cn("rounded-full border px-[11px] py-[5.5px] text-[10.5px] font-semibold", on ? "border-[#0D2315] bg-[#0D2315] text-white" : "border-[#DEE8E2] bg-white text-[#5F6E65]")}
              >
                {String(label)}
              </button>
            );
          })}
        </div>
        <div className="mb-[13px] flex flex-wrap gap-[6px] print:hidden">
          {byTeacher
            ? teachers.map(([id, name]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTeacherId(id)}
                  className={cn("rounded-full border px-[11px] py-[5.5px] text-[10.5px] font-semibold", id === teacherId ? "border-[#0D2315] bg-[#0D2315] text-white" : "border-[#DEE8E2] bg-white text-[#5F6E65] hover:bg-[#F7FAF8]")}
                >
                  {name}
                </button>
              ))
            : null}
          {byTeacher ? null : pool.map((item) => {
            const on = item.id === armId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setArmId(item.id)}
                className={cn(
                  "rounded-full border px-[11px] py-[5.5px] text-[10.5px] font-semibold",
                  on ? "border-[#0D2315] bg-[#0D2315] text-white" : "border-[#DEE8E2] bg-white text-[#5F6E65] hover:bg-[#F7FAF8]",
                )}
              >
                {item.name}
              </button>
            );
          })}
        </div>

        {!pool.length ? (
          <p className="rounded-[11px] border border-dashed border-[#DEE8E2] px-[14px] py-[22px] text-center text-[11.5px] text-[#67766D]">
            No periods are placed in any arm yet. Open the builder to start the week.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px] overflow-hidden rounded-[11px] border border-[#E6EEE9]">
              <div className="grid gap-px bg-[#E6EEE9]" style={{ gridTemplateColumns: `58px 92px repeat(${days.length}, minmax(0, 1fr))` }}>
                {["Period", "Time", ...days.map((day) => DAY_NAMES[day - 1])].map((label, index) => (
                  <div key={label} className={cn("bg-[#F7FAF8] px-[10px] py-[9px] text-[9.5px] font-bold uppercase tracking-[0.06em] text-[#67766D]", index > 1 && "text-center")}>
                    {label}
                  </div>
                ))}
                {periods.map((period) =>
                  period.n === "break" ? (
                    <div key={`break-${period.start}`} className="contents">
                      <div className="bg-[#F7FAF8] px-[10px] py-[7px] text-[10.5px] font-semibold text-[#67766D]">—</div>
                      <div className="bg-[#F7FAF8] px-[10px] py-[7px] text-[10px] tabular-nums text-[#67766D]">{period.start}–{period.end}</div>
                      <div className="bg-[#F7FAF8] px-[10px] py-[7px] text-center text-[10.5px] text-[#67766D]" style={{ gridColumn: `span ${days.length}` }}>Break</div>
                    </div>
                  ) : (
                    <div key={`p-${period.n}`} className="contents">
                      <div className="bg-white px-[10px] py-[10px] text-[10.5px] font-semibold text-[#0D2315]">{period.n}</div>
                      <div className="bg-white px-[10px] py-[10px] text-[10px] tabular-nums text-[#67766D]">{period.start}–{period.end}</div>
                      {days.map((day) => {
                        if (byTeacher) {
                          const there = teacherCell(day, period.n as number);
                          return (
                            <div key={day} className="min-w-0 bg-white px-[8px] py-[9px] text-center">
                              {there ? (
                                <>
                                  <p className="truncate text-[11px] font-semibold text-[#243B2E]">{there.subject}</p>
                                  <p className="mt-px truncate text-[9.5px] text-[#67766D]">{there.arm}</p>
                                </>
                              ) : (
                                <span className="text-[11px] text-[#C2D2C8]">—</span>
                              )}
                            </div>
                          );
                        }
                        const cell = grid[armId]?.[`${day}|${period.n}`];
                        const subject = cell ? (subjects[armId] ?? []).find((item) => item.subjectId === cell.subjectId) : undefined;
                        const clash = Boolean(cell?.teacherId && clashes.some((item) => item.teacherId === cell.teacherId && item.day === day && item.period === period.n));
                        return (
                          <div key={day} className={cn("min-w-0 px-[8px] py-[9px] text-center", clash ? "bg-[#FDF3F3]" : "bg-white")}>
                            {cell ? (
                              <>
                                <p className={cn("truncate text-[11px] font-semibold", clash ? "text-[#B23B3B]" : "text-[#243B2E]")}>{subject?.name ?? "A subject"}</p>
                                <p className="mt-px truncate text-[9.5px] text-[#67766D]">{subject?.teacher ?? "No teacher"}</p>
                              </>
                            ) : (
                              <span className="text-[11px] text-[#C2D2C8]">—</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        )}

        {armClashes.length ? (
          <p className="mt-[12px] rounded-[10px] border border-[#E4B9B9] bg-[#FBF2F2] px-[12px] py-[9px] text-[11px] font-medium text-[#B23B3B]">
            {armClashes.map((clash) => `${clash.teacher} is also in ${clash.classNames.filter((name) => name !== arm?.name).join(", ")} on ${clash.dayName}, period ${clash.period}`).join(" · ")}
          </p>
        ) : null}
      </section>

      {panel === "publish" ? (
        <section className={cn(CARD, "p-[18px] print:hidden")}>
          <h3 className="text-[12.5px] font-semibold text-[#0D2315]">Publish {version.name}?</h3>
          <p className="mt-[4px] text-[11px] leading-normal text-[#67766D]">
            It replaces the running timetable when it takes effect. The one it replaces is archived and can be published again. A timetable with a teacher in two rooms in one period is refused, and the answer names who.
          </p>
          <div className="mt-[12px] grid gap-[10px] sm:grid-cols-2">
            <label className="grid gap-[4px] text-[10.5px] font-semibold text-[#435048]">
              Takes effect
              <select
                value={takes}
                onChange={(event) => setTakes(event.target.value)}
                className="rounded-[8px] border-[1.5px] border-[#E4EDE8] bg-white px-[9px] py-[7px] text-[11.5px] font-medium text-[#0D2315]"
              >
                {["Immediately", "From tomorrow", "From next Monday", "On a date I choose"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-[4px] text-[10.5px] font-semibold text-[#435048]">
              Effective date
              <input
                type="date"
                value={effective}
                disabled={takes !== "On a date I choose"}
                onChange={(event) => setEffective(event.target.value)}
                className="rounded-[8px] border-[1.5px] border-[#E4EDE8] bg-white px-[9px] py-[7px] text-[11.5px] font-medium text-[#0D2315] disabled:opacity-50"
              />
            </label>
          </div>
          <p className="mt-[12px] text-[10.5px] font-semibold text-[#435048]">Notify, in the app</p>
          <div className="mt-[6px] flex flex-wrap gap-[14px] text-[11.5px] text-[#243B2E]">
            {[
              ["teachers-changed", "Teachers whose periods changed"],
              ["teachers-all", "All teaching staff"],
              ["form-masters", "Form masters"],
              ["students", "Students"],
              ["guardians", "Guardians"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-[7px]">
                <input
                  type="checkbox"
                  checked={tell.includes(key)}
                  onChange={(event) => setTell((current) => (event.target.checked ? [...current, key] : current.filter((item) => item !== key)))}
                />
                {label}
              </label>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="A note to staff (optional)"
            rows={2}
            className="mt-[10px] w-full rounded-[9px] border-[1.5px] border-[#E4EDE8] bg-white px-[10px] py-[8px] text-[11.5px] outline-hidden focus:border-[#12796A]"
          />
          <div className="mt-[12px] flex gap-2">
            <button type="button" className={SOLID} disabled={pending} onClick={publish}>{pending ? "Publishing…" : "Publish it"}</button>
            <button type="button" className={GHOST} onClick={() => setPanel(null)}>Cancel</button>
          </div>
        </section>
      ) : null}

      {panel === "copy" ? (
        <section className={cn(CARD, "p-[18px] print:hidden")}>
          <h3 className="text-[12.5px] font-semibold text-[#0D2315]">Make an editable draft from {version.name}</h3>
          <p className="mt-[4px] text-[11px] leading-normal text-[#67766D]">The running timetable is not changed. The draft is yours to edit and publish when it is ready.</p>
          <input
            value={copyName}
            onChange={(event) => setCopyName(event.target.value)}
            className="mt-[10px] w-full rounded-[9px] border-[1.5px] border-[#E4EDE8] bg-white px-[10px] py-[8px] text-[11.5px] outline-hidden focus:border-[#12796A]"
          />
          <div className="mt-[12px] flex gap-2">
            <button type="button" className={SOLID} disabled={pending} onClick={copy}>{pending ? "Creating…" : "Create the draft"}</button>
            <button type="button" className={GHOST} onClick={() => setPanel(null)}>Cancel</button>
          </div>
        </section>
      ) : null}

      {version.state !== "RUNNING" ? (
        <section className={cn(CARD, "flex flex-wrap items-center justify-between gap-3 p-[14px] print:hidden")}>
          <p className="text-[11px] text-[#67766D]">Not the running timetable — safe to delete. The record that it existed stays in the publish history.</p>
          {panel === "delete" ? (
            <div className="flex items-center gap-2">
              <button type="button" className="rounded-[9px] bg-[#B23B3B] px-[14px] py-[9px] text-[11.5px] font-semibold text-white disabled:opacity-60" disabled={pending} onClick={remove}>
                {pending ? "Deleting…" : "Yes, delete it"}
              </button>
              <button type="button" className={GHOST} onClick={() => setPanel(null)}>Keep it</button>
            </div>
          ) : (
            <button type="button" className="inline-flex items-center rounded-[9px] border border-[#F0D9D9] bg-white px-[13px] py-[9px] text-[11.5px] font-semibold text-[#B23B3B]" onClick={() => setPanel("delete")}>
              Delete this timetable
            </button>
          )}
        </section>
      ) : (
        <p className="text-[11px] text-[#67766D] print:hidden">The running timetable cannot be deleted. Publish another one first.</p>
      )}
    </div>
  );
}
