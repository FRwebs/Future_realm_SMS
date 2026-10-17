"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { sendJsonForData } from "@/lib/modules/submit";
import type { Grid, TimetableDetail } from "@/lib/modules/live/m3-types";
import { buildPeriods, clashesIn, DAY_CODES, DAY_NAMES } from "@/lib/modules/timetable-periods";
import { cn } from "@/lib/utils/cn";

const API = "/api/v1/class-structure/timetables";
const CARD = "min-w-0 rounded-[14px] border border-[#DEE8E2] bg-[var(--color-bg-surface)] p-[18px]";
const INPUT =
  "w-full min-w-0 rounded-[8px] border-[1.5px] border-[#E4EDE8] bg-white px-[9px] py-[7px] text-[11.5px] font-medium text-[#0D2315] outline-none focus:border-[#12796A]";
const GHOST =
  "inline-flex items-center gap-[6px] whitespace-nowrap rounded-[9px] border border-[#CFDDD5] bg-white px-[14px] py-[9px] text-[11.5px] font-semibold text-[#435048] transition hover:bg-[#F7FAF8] disabled:opacity-60";
const SOLID =
  "inline-flex items-center gap-[6px] whitespace-nowrap rounded-[9px] bg-[#0D2315] px-[16px] py-[9.5px] text-[11.5px] font-semibold text-white transition hover:bg-[#143a22] disabled:opacity-60";

type Scope = "One arm" | "A whole class" | "Every arm in the school";
const SCOPES: Scope[] = ["One arm", "A whole class", "Every arm in the school"];

const cellId = (day: number, period: number | string) => `${day}|${period}`;

/**
 * The week, built by hand.
 *
 * Pick a subject, then tap the periods it runs in. A teacher is never typed: each
 * cell takes whoever the school has mapped to that subject in that arm, so a
 * timetable cannot name somebody who was not made responsible for it. A clash — one
 * teacher in two arms in one period — is marked the moment it is made, with the same
 * test the server applies when it refuses to publish one.
 *
 * Nothing here touches what families see. It saves a draft; publishing is a
 * separate act on the preview page.
 */
export function TimetableBuilder({
  detail,
  runningId,
}: {
  detail: TimetableDetail;
  /** The timetable currently running, if any — what "fill from the running timetable" copies. */
  runningId: string | null;
}) {
  const router = useRouter();
  const { version, arms, subjects } = detail;
  const editable = version.state !== "RUNNING";

  const [name, setName] = useState(version.name);
  const [periodsPerDay, setPeriodsPerDay] = useState(String(version.periodsPerDay));
  const [periodMinutes, setPeriodMinutes] = useState(String(version.periodMinutes));
  const [firstStarts, setFirstStarts] = useState(version.firstStarts);
  const [breakAfter, setBreakAfter] = useState(version.breakAfter ? String(version.breakAfter) : "");
  const [days, setDays] = useState<string[]>(version.schoolDays);
  const [checkClashes, setCheckClashes] = useState(version.checkClashes);

  const [grid, setGrid] = useState<Grid>(() => JSON.parse(JSON.stringify(detail.grid)) as Grid);
  const [saved, setSaved] = useState<Grid>(() => JSON.parse(JSON.stringify(detail.grid)) as Grid);
  const [scope, setScope] = useState<Scope>("One arm");
  const [armId, setArmId] = useState(arms.find((arm) => Object.keys(detail.grid[arm.id] ?? {}).length > 0)?.id ?? arms[0]?.id ?? "");
  const [selected, setSelected] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const primary = arms.find((arm) => arm.id === armId);
  const periods = useMemo(
    () =>
      buildPeriods({
        periodsPerDay: Math.max(1, Math.min(16, Number(periodsPerDay) || 8)),
        periodMinutes: Math.max(20, Number(periodMinutes) || 40),
        firstStarts: /^\d{2}:\d{2}$/.test(firstStarts) ? firstStarts : "08:00",
        breakAfter: breakAfter ? Number(breakAfter) || null : null,
      }),
    [periodsPerDay, periodMinutes, firstStarts, breakAfter],
  );
  const dayNumbers = days.map((code) => DAY_CODES.indexOf(code) + 1).filter((day) => day >= 1).sort((a, b) => a - b);
  const lessonPeriods = periods.filter((period) => period.n !== "break");

  const targets = useMemo(() => {
    if (!primary) return [];
    if (scope === "One arm") return [primary];
    if (scope === "A whole class") return arms.filter((arm) => arm.levelId === primary.levelId);
    return arms;
  }, [scope, primary, arms]);

  const offered = (arm: string, subjectId: string) => (subjects[arm] ?? []).find((item) => item.subjectId === subjectId);

  // Chips: what the targeted arms offer, with the count placed in the lead arm.
  const chips = useMemo(() => {
    const byId = new Map<string, { subjectId: string; name: string; code: string; teachers: Set<string>; quota: number }>();
    for (const arm of targets) {
      for (const subject of subjects[arm.id] ?? []) {
        const entry = byId.get(subject.subjectId) ?? {
          subjectId: subject.subjectId,
          name: subject.name,
          code: subject.code,
          teachers: new Set<string>(),
          quota: subject.periods,
        };
        if (subject.teacher) entry.teachers.add(subject.teacher);
        byId.set(subject.subjectId, entry);
      }
    }
    const cells = grid[armId] ?? {};
    const used = new Map<string, number>();
    for (const [key, cell] of Object.entries(cells)) {
      const [day, period] = key.split("|").map(Number);
      if (!dayNumbers.includes(day) || period > lessonPeriods.length) continue;
      used.set(cell.subjectId, (used.get(cell.subjectId) ?? 0) + 1);
    }
    return Array.from(byId.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((chip) => ({
        ...chip,
        used: used.get(chip.subjectId) ?? 0,
        teacher: chip.teachers.size === 1 ? Array.from(chip.teachers)[0] : chip.teachers.size ? `${chip.teachers.size} teachers` : "No teacher",
      }));
  }, [targets, subjects, grid, armId, dayNumbers, lessonPeriods.length]);

  const clashes = useMemo(() => clashesIn(grid), [grid]);
  const clashAt = (arm: string, day: number, period: number) => {
    const cell = grid[arm]?.[cellId(day, period)];
    return Boolean(cell?.teacherId && clashes.some((item) => item.teacherId === cell.teacherId && item.day === day && item.period === period));
  };

  const total = dayNumbers.length * lessonPeriods.length;
  const filled = Object.keys(grid[armId] ?? {}).filter((key) => {
    const [day, period] = key.split("|").map(Number);
    return dayNumbers.includes(day) && period <= lessonPeriods.length;
  }).length;
  const short = chips.filter((chip) => chip.used < chip.quota);
  const scopeLabel = scope === "One arm" ? primary?.name ?? "—" : scope === "A whole class" ? `${primary?.level ?? ""} · every arm` : `Every arm · ${arms.length}`;

  function place(day: number, period: number) {
    if (!editable || !primary) return;
    const key = cellId(day, period);
    setGrid((current) => {
      const next: Grid = { ...current };
      const lead = current[primary.id]?.[key];
      const clearing = !selected || lead?.subjectId === selected;
      for (const arm of targets) {
        const cells = { ...(next[arm.id] ?? {}) };
        if (clearing) delete cells[key];
        else {
          const mapped = offered(arm.id, selected);
          if (!mapped) continue;
          cells[key] = { subjectId: selected, teacherId: mapped.teacherId };
        }
        if (Object.keys(cells).length) next[arm.id] = cells;
        else delete next[arm.id];
      }
      return next;
    });
    setMessage(null);
  }

  function clearWeek() {
    if (!editable) return;
    setGrid((current) => {
      const next = { ...current };
      for (const arm of targets) delete next[arm.id];
      return next;
    });
  }

  async function fillFromRunning() {
    if (!runningId || !editable) return;
    setPending(true);
    try {
      const running = await fetchDetail(runningId);
      setGrid((current) => {
        const next = { ...current };
        for (const arm of targets) {
          if (running.grid[arm.id]) next[arm.id] = JSON.parse(JSON.stringify(running.grid[arm.id]));
        }
        return next;
      });
      setMessage({ tone: "ok", text: `Copied the running week into ${targets.length} arm${targets.length === 1 ? "" : "s"}. Nothing is saved until you save the draft.` });
    } catch (cause) {
      setMessage({ tone: "bad", text: cause instanceof Error ? cause.message : "Could not read the running timetable." });
    } finally {
      setPending(false);
    }
  }

  async function save() {
    setPending(true);
    setMessage(null);
    try {
      const edits: Array<{ classIds: string[]; cells: Record<string, string | null> }> = [];
      const touched = new Set([...Object.keys(grid), ...Object.keys(saved)]);
      for (const arm of touched) {
        const cells: Record<string, string | null> = {};
        const now = grid[arm] ?? {};
        const before = saved[arm] ?? {};
        for (const key of new Set([...Object.keys(now), ...Object.keys(before)])) {
          if (now[key]?.subjectId !== before[key]?.subjectId) cells[key] = now[key]?.subjectId ?? null;
        }
        if (Object.keys(cells).length) edits.push({ classIds: [arm], cells });
      }
      const result = await sendJsonForData<{ clashes: number; placed: number; skipped: number }>(`${API}/${version.id}`, "PATCH", {
        settings: {
          name,
          periodsPerDay: Number(periodsPerDay),
          periodMinutes: Number(periodMinutes),
          firstStarts,
          breakAfter: breakAfter || "",
          schoolDays: days,
          checkClashes,
        },
        edits,
      });
      setSaved(JSON.parse(JSON.stringify(grid)) as Grid);
      setMessage({
        tone: "ok",
        text: `Saved as a draft · ${result.placed} periods placed · ${result.clashes ? `${result.clashes} clash${result.clashes === 1 ? "" : "es"} to resolve before it can be published` : "no clashes"}.`,
      });
      router.refresh();
    } catch (cause) {
      setMessage({ tone: "bad", text: cause instanceof Error ? cause.message : "That did not save." });
    } finally {
      setPending(false);
    }
  }

  const dirty = JSON.stringify(grid) !== JSON.stringify(saved);

  return (
    <div className="grid min-w-0 gap-[14px]">
      <Link href={"/class-timetable/timetable" as Route} className="inline-flex w-fit items-center gap-[6px] text-[11.5px] font-semibold text-[#12796A] hover:underline">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 12H6M11 6.5 5.5 12l5.5 5.5" />
        </svg>
        Back to all timetables
      </Link>

      <section className="relative overflow-hidden rounded-[15px] bg-[#0D2315] px-[19px] py-[15px]">
        <div className="relative flex flex-wrap items-center justify-between gap-x-5 gap-y-2.5">
          <div className="min-w-0 max-w-[620px]">
            <div className="mb-[5px] flex items-center gap-[7px]">
              <span className="h-[4.5px] w-[4.5px] rounded-full bg-[#5FD6B4]" />
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/50">Class &amp; Timetable · Builder</span>
            </div>
            <h1 className="font-[family-name:var(--font-heading)] text-[19px] font-extrabold leading-[1.15] tracking-[-0.024em] text-white">Edit {version.name}</h1>
            <p className="mt-1 text-[11px] text-white/60">Pick a subject, then tap the periods it runs in.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/class-timetable/timetable/${version.id}${armId ? `?arm=${armId}` : ""}` as Route} className="inline-flex items-center rounded-full border border-white/[0.18] bg-white/10 px-[12px] py-[7px] text-[11px] font-semibold text-white hover:bg-white/20">
              Preview the full week
            </Link>
            {editable ? (
              <button type="button" disabled={pending} onClick={save} className="inline-flex items-center rounded-full bg-white px-[15px] py-[8px] text-[11.5px] font-semibold text-[#0D2315] shadow-[0_9px_20px_-11px_rgba(0,0,0,0.65)] hover:bg-[#EAF3EE] disabled:opacity-70">
                {pending ? "Saving…" : "Save draft"}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {!editable ? (
        <p className="rounded-[11px] border border-[#CFE4DB] bg-[#F1F8F4] px-[14px] py-[10px] text-[11.5px] text-[#17714F]">
          This is the running timetable, so it is shown but cannot be edited in place. Open the preview and choose “Make an editable draft”.
        </p>
      ) : null}
      {message ? (
        <p className={cn("rounded-[11px] border px-[14px] py-[10px] text-[11.5px] font-medium", message.tone === "ok" ? "border-[#CFE4DB] bg-[#F1F8F4] text-[#17714F]" : "border-[#E4B9B9] bg-[#FBF2F2] text-[#B23B3B]")}>
          {message.text}
        </p>
      ) : null}

      <section className={CARD}>
        <div className="mb-[13px] border-b border-[#EDF3EF] pb-[11px]">
          <h2 className="font-[family-name:var(--font-heading)] text-[14px] font-extrabold tracking-[-0.018em] text-[#0D2315]">Timetable details</h2>
          <p className="mt-[3px] text-[11px] text-[#67766D]">
            What this timetable is, and how its day is shaped. {version.term ? `For ${version.term}.` : ""}
          </p>
        </div>
        <div className="grid gap-x-[14px] gap-y-[13px] [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          <Labelled label="Timetable name" wide>
            <input className={INPUT} value={name} disabled={!editable} onChange={(event) => setName(event.target.value)} />
          </Labelled>
          <Labelled label="Periods a day">
            <input className={INPUT} value={periodsPerDay} disabled={!editable} onChange={(event) => setPeriodsPerDay(event.target.value)} inputMode="numeric" />
          </Labelled>
          <Labelled label="Period length (minutes)">
            <input className={INPUT} value={periodMinutes} disabled={!editable} onChange={(event) => setPeriodMinutes(event.target.value)} inputMode="numeric" />
          </Labelled>
          <Labelled label="First period starts">
            <input className={INPUT} value={firstStarts} disabled={!editable} onChange={(event) => setFirstStarts(event.target.value)} placeholder="08:00" />
          </Labelled>
          <Labelled label="Break after period">
            <input className={INPUT} value={breakAfter} disabled={!editable} onChange={(event) => setBreakAfter(event.target.value)} placeholder="No break" inputMode="numeric" />
          </Labelled>
          <Labelled label="School days" wide>
            <div className="flex flex-wrap gap-[6px]">
              {DAY_CODES.map((code, index) => {
                const on = days.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    disabled={!editable}
                    onClick={() => setDays((current) => (on ? current.filter((item) => item !== code) : [...current, code]))}
                    className={cn("rounded-[8px] border px-[11px] py-[6px] text-[11px] font-semibold", on ? "border-[#0D2315] bg-[#0D2315] text-white" : "border-[#DEE8E2] bg-white text-[#5F6E65]")}
                  >
                    {DAY_NAMES[index].slice(0, 3)}
                  </button>
                );
              })}
            </div>
            {days.includes("SAT") ? <span className="mt-[5px] block text-[10px] text-[#8A6410]">Saturday is saved in the draft, but only Monday to Friday are written to the live week when it is published.</span> : null}
          </Labelled>
          <Labelled label="Check clashes as I build">
            <label className="flex items-center gap-[8px] text-[11.5px] text-[#243B2E]">
              <input type="checkbox" checked={checkClashes} disabled={!editable} onChange={(event) => setCheckClashes(event.target.checked)} />
              {checkClashes ? "Checked on every tap" : "Only checked when I save"}
            </label>
          </Labelled>
        </div>
      </section>

      <section className={CARD}>
        <div className="mb-[13px] flex flex-wrap items-start justify-between gap-3 border-b border-[#EDF3EF] pb-[11px]">
          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-[14px] font-extrabold tracking-[-0.018em] text-[#0D2315]">Build the week</h2>
            <p className="mt-[3px] text-[11px] text-[#67766D]">Pick a subject, then tap the periods it runs in. Tap a filled period with nothing selected to clear it.</p>
          </div>
          <p className="text-[11px] text-[#67766D]">{scopeLabel} · {filled} of {total} periods placed</p>
        </div>

        <div className="mb-[12px] flex flex-wrap items-center gap-[6px]">
          <span className="mr-[4px] text-[9.5px] font-bold uppercase tracking-[0.06em] text-[#67766D]">Apply to</span>
          {SCOPES.map((item) => (
            <button key={item} type="button" onClick={() => setScope(item)} className={cn("rounded-full border px-[11px] py-[5.5px] text-[10.5px] font-semibold", item === scope ? "border-[#0D2315] bg-[#0D2315] text-white" : "border-[#DEE8E2] bg-white text-[#5F6E65]")}>
              {item}
            </button>
          ))}
        </div>
        <p className="mb-[12px] text-[10.5px] text-[#67766D]">
          {scope === "One arm"
            ? `Applies to ${primary?.name ?? "—"} only.`
            : scope === "A whole class"
              ? `Written to every arm of ${primary?.level ?? "the class"} that offers the subject — you can adjust one arm afterwards.`
              : `Written to every arm that offers the subject (${arms.length} arms). Arms that do not offer it are left alone.`}
        </p>

        {scope !== "Every arm in the school" ? (
          <div className="mb-[12px] flex flex-wrap items-center gap-[6px]">
            <span className="mr-[4px] text-[9.5px] font-bold uppercase tracking-[0.06em] text-[#67766D]">{scope === "A whole class" ? "Class" : "Arm"}</span>
            {(scope === "A whole class"
              ? Array.from(new Map(arms.map((arm) => [arm.levelId, arm])).values())
              : arms
            ).map((arm) => {
              const on = scope === "A whole class" ? arm.levelId === primary?.levelId : arm.id === armId;
              return (
                <button key={arm.id} type="button" onClick={() => { setArmId(arm.id); setSelected(""); }} className={cn("rounded-full border px-[11px] py-[5.5px] text-[10.5px] font-semibold", on ? "border-[#0D2315] bg-[#0D2315] text-white" : "border-[#DEE8E2] bg-white text-[#5F6E65]")}>
                  {scope === "A whole class" ? arm.level : arm.name}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mb-[12px] flex flex-wrap items-center gap-[6px]">
            <span className="mr-[4px] text-[9.5px] font-bold uppercase tracking-[0.06em] text-[#67766D]">Counting in</span>
            {arms.slice(0, 40).map((arm) => (
              <button key={arm.id} type="button" onClick={() => setArmId(arm.id)} className={cn("rounded-full border px-[11px] py-[5.5px] text-[10.5px] font-semibold", arm.id === armId ? "border-[#0D2315] bg-[#0D2315] text-white" : "border-[#DEE8E2] bg-white text-[#5F6E65]")}>
                {arm.name}
              </button>
            ))}
          </div>
        )}

        <p className="mb-[8px] text-[11px] font-semibold text-[#243B2E]">
          {selected ? `${chips.find((chip) => chip.subjectId === selected)?.name ?? ""} selected` : "No subject selected — tapping a period will clear it."}
        </p>
        <div className="mb-[14px] flex flex-wrap gap-[7px]">
          {chips.length ? (
            chips.map((chip) => {
              const on = chip.subjectId === selected;
              const over = chip.used > chip.quota;
              const full = chip.used >= chip.quota;
              return (
                <button
                  key={chip.subjectId}
                  type="button"
                  disabled={!editable}
                  onClick={() => setSelected(on ? "" : chip.subjectId)}
                  className={cn(
                    "flex items-center gap-[8px] whitespace-nowrap rounded-full border px-[11px] py-[7px] text-[11px] font-semibold",
                    on ? "border-[#0D2315] bg-[#0D2315] text-white" : over ? "border-[#E7C9C9] bg-[#FDF3F3] text-[#243B2E]" : full ? "border-[#CFE4DB] bg-[#F1F8F4] text-[#243B2E]" : "border-[#DEE8E2] bg-white text-[#243B2E]",
                  )}
                  title={chip.teacher}
                >
                  {chip.name}
                  <span className={cn("rounded-full px-[6px] py-[1.5px] text-[9.5px] font-bold tabular-nums", on ? "bg-white/15 text-white" : over ? "bg-[#F6E3E3] text-[#B23B3B]" : full ? "bg-[#DCEDE4] text-[#17714F]" : "bg-[#F2F7F4] text-[#67766D]")}>
                    {chip.used}/{chip.quota}
                  </span>
                </button>
              );
            })
          ) : (
            <span className="text-[11px] text-[#67766D]">The arms in this scope offer no subjects yet. Map subjects to teachers in the Subjects tab first.</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[680px] overflow-hidden rounded-[11px] border border-[#E6EEE9]">
            <div className="grid gap-px bg-[#E6EEE9]" style={{ gridTemplateColumns: `62px 92px repeat(${Math.max(dayNumbers.length, 1)}, minmax(0, 1fr))` }}>
              {["Period", "Time", ...dayNumbers.map((day) => DAY_NAMES[day - 1])].map((label, index) => (
                <div key={label} className={cn("bg-[#F7FAF8] px-[10px] py-[9px] text-[9.5px] font-bold uppercase tracking-[0.06em] text-[#67766D]", index > 1 && "text-center")}>
                  {label}
                </div>
              ))}
              {periods.map((period) =>
                period.n === "break" ? (
                  <div key={`b-${period.start}`} className="contents">
                    <div className="bg-[#F7FAF8] px-[10px] py-[8px] text-[10.5px] font-semibold text-[#67766D]">—</div>
                    <div className="bg-[#F7FAF8] px-[10px] py-[8px] text-[10px] tabular-nums text-[#67766D]">{period.start}–{period.end}</div>
                    <div className="bg-[#F7FAF8] px-[10px] py-[8px] text-center text-[10px] text-[#67766D]" style={{ gridColumn: `span ${Math.max(dayNumbers.length, 1)}` }}>Break</div>
                  </div>
                ) : (
                  <div key={`p-${period.n}`} className="contents">
                    <div className="bg-white px-[10px] py-[9px] text-[10.5px] font-semibold tabular-nums text-[#0D2315]">{period.n}</div>
                    <div className="bg-white px-[10px] py-[9px] text-[10px] tabular-nums text-[#67766D]">{period.start}–{period.end}</div>
                    {dayNumbers.map((day) => {
                      const cell = grid[armId]?.[cellId(day, period.n as number)];
                      const subject = cell ? offered(armId, cell.subjectId) : undefined;
                      const clash = cell ? clashAt(armId, day, period.n as number) : false;
                      return (
                        <button
                          key={day}
                          type="button"
                          disabled={!editable}
                          onClick={() => place(day, period.n as number)}
                          className={cn(
                            "flex min-h-[44px] min-w-0 flex-col items-center justify-center gap-[2px] border px-[6px] py-[7px] text-center transition-colors",
                            clash ? "border-[#E7C9C9] bg-[#FDF3F3]" : cell ? "border-[#CFE4DB] bg-[#F1F8F4]" : "border-transparent bg-white hover:bg-[#F7FAF8]",
                          )}
                        >
                          <span className={cn("max-w-full truncate text-[11px] font-bold leading-[1.1]", clash ? "text-[#B23B3B]" : cell ? "text-[#17714F]" : "text-[#B4C4BB]")}>
                            {cell ? subject?.code ?? "?" : selected ? "+" : ""}
                          </span>
                          {cell ? <span className="max-w-full truncate text-[8.5px] leading-[1.1] text-[#67766D]">{(subject?.teacher ?? "No teacher").replace(/^(Mrs|Mr|Miss|Dr)\s/, "")}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                ),
              )}
            </div>
          </div>
        </div>

        <dl className="mt-[14px] grid gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
          <Stat label="Periods placed" value={`${filled} of ${total}`} tone={filled === total && total > 0 ? "ok" : "warn"} />
          <Stat label="Clashes (whole school)" value={String(clashes.length)} tone={clashes.length ? "bad" : "ok"} />
          <Stat label="Subjects short" value={String(short.length)} tone={short.length ? "warn" : "ok"} />
          <Stat label="Applies to" value={scopeLabel} tone="neutral" />
        </dl>
        {clashes.length && checkClashes ? (
          <p className="mt-[12px] rounded-[10px] border border-[#E4B9B9] bg-[#FBF2F2] px-[12px] py-[9px] text-[11px] font-medium text-[#B23B3B]">
            {clashes.length} clash{clashes.length === 1 ? "" : "es"} — a teacher is booked into more than one arm at the same time. Move them before this can be published.
          </p>
        ) : null}

        {editable ? (
          <div className="mt-[14px] flex flex-wrap items-center gap-2">
            <button type="button" className={GHOST} onClick={clearWeek}>Clear the week</button>
            {runningId ? <button type="button" className={GHOST} disabled={pending} onClick={fillFromRunning}>Fill from the running timetable</button> : null}
            <button type="button" className={SOLID} disabled={pending} onClick={save}>{pending ? "Saving…" : dirty ? "Save draft" : "Saved"}</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Labelled({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("min-w-0", wide && "[grid-column:span_2]")}>
      <span className="mb-[5px] block text-[10px] font-semibold text-[#435048]">{label}</span>
      {children}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "bad" | "neutral" }) {
  const color = tone === "ok" ? "#17714F" : tone === "bad" ? "#B23B3B" : tone === "warn" ? "#8A6410" : "#243B2E";
  return (
    <div className="flex min-w-0 flex-col gap-[3px]">
      <dt className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-[#67766D]">{label}</dt>
      <dd className="truncate text-[13px] font-bold tabular-nums" style={{ color }}>{value}</dd>
    </div>
  );
}

async function fetchDetail(id: string): Promise<TimetableDetail> {
  const response = await fetch(`${API}/${id}`, { credentials: "include" });
  const body = (await response.json().catch(() => ({}))) as { data?: TimetableDetail; error?: string };
  if (!response.ok || !body.data) throw new Error(body.error ?? "Could not read that timetable.");
  return body.data;
}
