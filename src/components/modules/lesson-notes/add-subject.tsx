"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Btn, CARD_BORDER, Confirm, Empty, INK, MUTED, inputClass, toBase64, useToast, useWrite } from "@/components/modules/lesson-notes/kit";
import { apiRaw } from "@/lib/api/client";
import { LN_API, type AddOptions } from "@/lib/modules/lesson-notes-types";

/** One week of the plan as the teacher is typing it: sub-topics are one line, separated by semicolons, as in the scheme they would paste from. */
type Row = { topic: string; subs: string; periods: number | null; assessment: string | null; kind: "teach" | "rev" };
type Outline = { id: string; label: string; source: string; weeks: Array<{ week: number; topic: string; subtopics: string[]; assessment: string | null }> };
type Mode = "standard" | "build" | "import";

const blank = (): Row => ({ topic: "", subs: "", periods: null, assessment: null, kind: "teach" });
const REVISION: Array<Pick<Row, "topic" | "subs" | "assessment">> = [
  { topic: "Revision", subs: "The term in review; Past questions, timed", assessment: "Quiz" },
  { topic: "End-of-term review", subs: "Going over the examination; Targets for next term", assessment: "Quiz" },
];
const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
/** "PRIMARY_4" and "Primary 4" are the same level; the senior school is "SS" in one place and "SSS" in another. */
const levelKey = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]+/g, "").replace(/^SSS/, "SS");
const pretty = (code: string) => code.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()).replace(/^(jss|ss|sss)\b/i, (m) => m.toUpperCase());
/** Where a subject is taught, for telling apart the subjects the school lists once for each stage. */
const stageOf = (levels: string[], section: string) => {
  if (!levels.length) return section.replace(/_/g, " ").toLowerCase();
  const first = pretty(levels[0]!);
  const last = levels.length > 1 ? levels[levels.length - 1]!.match(/(\d+)$/)?.[1] : null;
  return last ? `${first}–${last}` : first;
};
const fmtTime = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours} h${rest ? ` ${rest} min` : ""}` : `${rest} min`;
};
const DAY = 86_400_000;
const dayText = (date: Date, month: boolean) => date.toLocaleDateString("en-GB", { day: "numeric", ...(month ? { month: "short" } : {}), timeZone: "Africa/Lagos" });
/** Monday to Friday of a week of the term, as "7 – 11 Jul". */
const span = (startsOn: string, week: number) => {
  const from = new Date(new Date(startsOn).getTime() + (week - 1) * 7 * DAY);
  const to = new Date(from.getTime() + 4 * DAY);
  const sameMonth = from.toLocaleDateString("en-GB", { month: "short", timeZone: "Africa/Lagos" }) === to.toLocaleDateString("en-GB", { month: "short", timeZone: "Africa/Lagos" });
  return `${dayText(from, !sameMonth)} – ${dayText(to, true)}`;
};
const LENGTHS = [30, 35, 40, 45, 60, 80];

const LABEL = { color: MUTED } as const;
const STEP_TITLE = "whitespace-nowrap text-[13px] font-extrabold";

/** The numbered mark at the head of a step: dark while it is still to do, green with a tick once it is answered. */
function Step({ n, done, title, sub, children }: { n: number; done: boolean; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[9px]">
      <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] text-[10.5px] font-extrabold text-white" style={{ background: done ? "#12796A" : INK }} aria-hidden>{done ? "✓" : n}</span>
      <span className={STEP_TITLE} style={{ color: INK }}>{title}</span>
      {sub ? <span className="min-w-0 text-[11px]" style={LABEL}>{sub}</span> : null}
      {children ? <span className="ml-auto flex-none">{children}</span> : null}
    </div>
  );
}

const pill = (on: boolean) => ({ borderColor: on ? INK : "#DEE8E2", background: on ? INK : "#fff", color: on ? "#fff" : "#435048" });

/**
 * "Add a subject": a teacher plans a subject the school has not mapped to them. It lands on their Curriculum, carries what does not fit
 * this term into the next, and tells the school so it can go on the timetable — until then it has no register and no score sheet.
 *
 * Laid out as the Teachers mockup lays it out: four numbered steps beside a preview that fills in as they are answered, then one page
 * that shows the whole scheme exactly as it will be added before anything is saved.
 */
export function AddSubject({ options }: { options: AddOptions }) {
  const router = useRouter();
  const toast = useToast();
  const { busy, run } = useWrite(toast.show);
  /*
   * Why the add was refused, said where the asking happened — a toast at the top of a long page is not where the button that asked is.
   */
  const [refused, setRefused] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  // Going to the preview, or back from it, starts at the top of what is now on the page.
  useEffect(() => { top.current?.scrollIntoView({ block: "start" }); }, [previewing]);

  const [query, setQuery] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [curriculum, setCurriculum] = useState("");
  const [levelId, setLevelId] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [per, setPer] = useState(3);
  const [minutes, setMinutes] = useState(options.defaultLesson);
  const [mode, setMode] = useState<Mode>("build");
  const [outlineId, setOutlineId] = useState("");
  const [outline, setOutline] = useState<Outline | null>(null);
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: options.weeks }, blank));
  const [carry, setCarry] = useState<Row[]>([]);
  const [edited, setEdited] = useState(false);

  const subject = options.subjects.find((entry) => entry.id === subjectId) ?? null;
  const level = options.levels.find((entry) => entry.id === levelId) ?? null;
  const held = options.held.find((entry) => entry.subjectId === subjectId) ?? null;
  const clash = held ? held.classIds.filter((id) => classIds.includes(id)).length : 0;
  const atLevel = useMemo(() => {
    if (!level) return options.subjects;
    const fits = options.subjects.filter((entry) => entry.levels.some((code) => levelKey(code) === levelKey(level.name)));
    return fits.length ? fits : options.subjects;
  }, [options.subjects, level]);
  const shown = useMemo(() => atLevel.filter((entry) => norm(entry.name).includes(norm(query))), [atLevel, query]);
  const outlinesFor = (name: string, stage?: string) =>
    options.catalogue
      .filter((entry) => norm(entry.subject) === norm(name) || norm(entry.subject).includes(norm(name)) || norm(name).includes(norm(entry.subject)))
      .filter((entry) => (!stage || norm(entry.stage) === norm(stage)) && (!curriculum || entry.curriculum === curriculum));
  const matches = useMemo(() => (subject && level ? outlinesFor(subject.name, level.name) : []), [options.catalogue, subject, level, curriculum]); // eslint-disable-line react-hooks/exhaustive-deps
  const arms = level ? level.arms.filter((arm) => classIds.includes(arm.id)).map((arm) => arm.name) : [];

  const named = rows.filter((entry) => entry.topic.trim()).length;
  const revision = rows.filter((entry) => entry.kind === "rev").length;
  const total = rows.reduce((sum, entry) => sum + (entry.topic.trim() ? (entry.periods ?? per) : 0), 0);
  const time = total * minutes;
  const lastTwoRevision = rows.length >= 5 && rows.slice(-2).every((entry) => entry.kind === "rev");
  const ready = Boolean(subject) && arms.length > 0 && !clash && named > 0 && (mode !== "standard" || Boolean(outline));
  const problem = !subject ? "Choose the subject." : !level || !classIds.length ? "Choose the level and at least one arm." : clash ? "You already plan this subject for one of those arms." : mode === "standard" && !outline ? "Choose an outline." : !named ? "Plan at least one week." : "";
  const start = `Week 1 · ${span(options.term.startsOn, 1)}`;

  /** What the card says about a subject: only an outline for that very subject counts, not one for a subject whose name contains it. */
  const topicsOf = (name: string) => Math.max(0, ...options.catalogue.filter((entry) => norm(entry.subject) === norm(name) && (!curriculum || entry.curriculum === curriculum)).map((entry) => entry.topics));

  /** A standard outline laid into the weeks of this term; whatever does not fit goes on to the next. */
  function lay(chosen: Outline) {
    const next = Array.from({ length: options.weeks }, blank);
    const later: Row[] = [];
    for (const topic of chosen.weeks) {
      const row: Row = { topic: topic.topic, subs: topic.subtopics.join("; "), periods: null, assessment: topic.assessment, kind: "teach" };
      if (topic.week <= options.weeks) next[topic.week - 1] = row;
      else later.push(row);
    }
    setRows(next);
    setCarry(options.nextTerm ? later : []);
    setOutline(chosen);
    setEdited(false);
  }
  async function pickOutline(id: string) {
    setOutlineId(id);
    if (!id) { setOutline(null); return; }
    try {
      const reply = await apiRaw<{ data?: Outline } & Partial<Outline>>(`${LN_API}/curriculum/add/outline/${id}`);
      const found = (reply.data ?? reply) as Outline;
      if (found?.weeks) lay(found);
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : "That outline could not be read.", "bad");
    }
  }
  function choose(next: Mode) {
    if (next === "standard" && !matches.length) return;
    setMode(next);
    setEdited(false);
    if (next === "standard") { void pickOutline(outlineId || matches[0]!.id); return; }
    setOutline(null); setOutlineId(""); setCarry([]);
    setRows(Array.from({ length: options.weeks }, blank));
    if (next === "import") file.current?.click();
  }
  const setRow = (index: number, patch: Partial<Row>) => { setEdited(true); setRows((all) => all.map((row, at) => (at === index ? { ...row, ...patch } : row))); };
  const changePer = (value: number) => {
    if (value < 1 || value > 10) return;
    setRows((all) => all.map((row) => (row.periods === per ? { ...row, periods: value } : row)));
    setPer(value);
  };

  async function importFile(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;
    try {
      const data = await toBase64(chosen);
      const result = await run<{ weeks: Array<{ week: number; topic: string; subtopics: string[]; assessment: string | null; periods: number | null }>; found: number }>("import", `${LN_API}/curriculum/import`, "POST", { file: data });
      if (!result) return;
      const next = Array.from({ length: Math.max(options.weeks, ...result.weeks.map((item) => item.week)) }, blank);
      for (const item of result.weeks) next[item.week - 1] = { topic: item.topic, subs: item.subtopics.join("; "), periods: item.periods, assessment: item.assessment, kind: "teach" };
      setRows(next.slice(0, options.weeks));
      setCarry(options.nextTerm ? next.slice(options.weeks) : []);
      setMode("import");
      toast.show(`${result.found} week${result.found === 1 ? "" : "s"} read from ${chosen.name}. Check them before you add the subject.`);
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : "That file could not be read.", "bad");
    }
  }

  async function create() {
    if (!subject) return;
    const toWeek = (entry: Row) => ({ topic: entry.topic.trim(), subtopics: entry.subs.split(";").map((line) => line.trim()).filter(Boolean), assessment: entry.assessment, periods: entry.periods === per ? null : entry.periods, kind: entry.kind });
    setRefused(null);
    const made = await run<{ subjectId: string; subject: string; arms: string[]; told: number }>("create", `${LN_API}/curriculum/add`, "POST", {
      subjectId: subject.id, classIds, periodsPerWeek: per, lessonMinutes: minutes, curriculum: curriculum || undefined, source: outline?.source,
      weeks: rows.map(toWeek), nextTerm: carry.map((entry) => { const w = toWeek(entry); return { topic: w.topic, subtopics: w.subtopics, assessment: w.assessment, kind: w.kind }; }),
    }, undefined, (message) => setRefused(message));
    if (!made) { setConfirm(false); setPreviewing(false); return; }
    toast.show(`${made.subject} added.${made.told ? " The school has been told, so it can go on the timetable." : ""}`);
    router.push(`/lesson-notes/curriculum?subject=${made.subjectId}` as Route);
    router.refresh();
  }

  if (!options.levels.length || !options.subjects.length) {
    return <Empty title="There is nothing to add a subject from yet" body="The school has not set up its classes or its subject list. Ask the school office to finish Class & Timetable, then come back." />;
  }

  const signer = "your head of department, or the Deputy — Academic";
  const NEXT = [
    "It appears in Curriculum and Notes straight away, marked as added by you.",
    `Notes for it are vetted by ${signer}, like every other note.`,
    "The school office is told, so it can go on the timetable. Until then it has no register or score sheet.",
  ];
  const checks: Array<["ok" | "warn" | "", string]> = [
    [subject ? "ok" : "", subject ? `${subject.name} · ${outline ? "from the curriculum" : "your own plan"}` : "Choose a subject"],
    [arms.length ? "ok" : "", arms.length ? `${arms.length} ${arms.length === 1 ? "class" : "classes"} chosen` : "Choose at least one class"],
    [clash ? "warn" : subject && arms.length ? "ok" : "", clash && held ? `Already in your curriculum for ${held.arms.join(", ")}` : "Not already in your curriculum"],
    [!subject ? "" : named === rows.length ? "ok" : "warn", !subject ? "Plan the weeks" : named === rows.length ? "Every week has a topic" : `${rows.length - named} ${rows.length - named === 1 ? "week is" : "weeks are"} still empty · fine, name them later`],
  ];
  const ribbon = rows.map((entry, index) => ({ title: `Week ${index + 1}${entry.topic.trim() ? ` · ${entry.topic}` : " · not named yet"}`, color: entry.kind === "rev" && entry.topic.trim() ? "#C9B8E6" : entry.topic.trim() ? "#12796A" : "#F2E4C6" }));
  const statusOf = (entry: Row, index: number) => (!entry.topic.trim() ? "Free week" : options.term.current && index + 1 < options.term.current ? "Taught" : options.term.current === index + 1 ? "In progress" : entry.kind === "rev" ? "Revision" : "Planned");
  const STATUS: Record<string, { bg: string; fg: string }> = {
    Taught: { bg: "#EAF6F0", fg: "#17714F" }, "In progress": { bg: "#EBF1FA", fg: "#2A5A96" }, Planned: { bg: "#F2F5F3", fg: "#5C6A62" },
    Revision: { bg: "#F5F0FA", fg: "#6B4E9E" }, "Free week": { bg: "#FDF6E7", fg: "#8A6410" },
  };

  /* ───────────────────────────── the preview page ───────────────────────────── */
  if (previewing && ready && subject) {
    const kpis: Array<[string, string, string?, string?]> = [
      ["Classes", String(arms.length), level?.name],
      ["Weeks planned", String(named), `of ${rows.length}`, revision ? `${revision} revision weeks at the end` : "No revision weeks"],
      ["Each week", `${per} × ${minutes}`, "min", `${fmtTime(per * minutes)} in each class`],
      ["Teaching time", fmtTime(time), undefined, "Across the term"],
      ["Curriculum", outline ? (curriculum || "Standard") : "Your own", undefined, outline ? outline.source : "Built week by week by you"],
    ];
    return (
      <div className="grid gap-4">
        <div ref={top} aria-hidden className="-mb-4 h-0 scroll-mt-4" />
        <div className="empty:hidden">{toast.node}</div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border bg-white px-[18px] py-[14px]" style={{ borderColor: CARD_BORDER }}>
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold" style={{ color: INK }}>Preview · {subject.name}</p>
            <p className="mt-0.5 text-[11.5px]" style={LABEL}>The whole scheme, exactly as it will be added to {arms.join(", ")}. Nothing is saved until you confirm.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => setPreviewing(false)}>Back to editing</Btn>
            <Btn kind="primary" onClick={() => setConfirm(true)}>Add {subject.name} to my curriculum</Btn>
          </div>
        </div>
        {refused ? <p role="alert" className="rounded-[10px] px-3 py-2 text-[11.5px] font-semibold leading-[1.6]" style={{ background: "#FCECEC", color: "#B23B3B" }}>{refused}</p> : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {kpis.map(([label, value, unit, sub]) => (
            <div key={label} className="rounded-[14px] border bg-white px-[14px] py-[12px]" style={{ borderColor: CARD_BORDER }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.07em]" style={LABEL}>{label}</p>
              <p className="mt-1 text-[22px] font-extrabold leading-none" style={{ color: INK }}>{value}{unit ? <span className="ml-1 text-[11px] font-semibold" style={LABEL}>{unit}</span> : null}</p>
              {sub ? <p className="mt-1.5 text-[10.5px]" style={LABEL}>{sub}</p> : null}
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-[14px] border bg-white" style={{ borderColor: CARD_BORDER }}>
          <div className="flex flex-wrap items-center gap-2 px-[18px] pb-[10px] pt-[14px]">
            <p className="text-[13px] font-extrabold" style={{ color: INK }}>{options.term.name} · week by week</p>
            <span className="rounded-full px-[9px] py-[2px] text-[10.5px] font-bold" style={{ background: named === rows.length ? "#EAF6F0" : "#FDF6E7", color: named === rows.length ? "#17714F" : "#8A6410" }}>{named} of {rows.length} weeks named</span>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[48px_96px_1.3fr_2fr_56px_100px_88px] gap-3 border-y px-[18px] py-2 text-[10px] font-bold uppercase tracking-[0.07em]" style={{ borderColor: "#E6EEE9", background: "#F7FAF8", color: MUTED }}>
                <span>Week</span><span>Dates</span><span>Topic</span><span>Sub-topics</span><span>Periods</span><span>Assessment</span><span>Status</span>
              </div>
              {rows.map((entry, index) => {
                const status = statusOf(entry, index);
                const tone = STATUS[status]!;
                return (
                  <div key={index} className="grid grid-cols-[48px_96px_1.3fr_2fr_56px_100px_88px] items-center gap-3 border-b px-[18px] py-[9px] text-[11.5px]" style={{ borderColor: "#F2F7F4" }}>
                    <span className="font-extrabold" style={{ color: INK }}>W{index + 1}</span>
                    <span style={LABEL}>{span(options.term.startsOn, index + 1)}</span>
                    {entry.topic.trim() ? <span className="font-semibold" style={{ color: INK }}>{entry.topic}</span> : <span className="font-semibold" style={{ color: "#8A6410" }}>Not named yet</span>}
                    <span style={LABEL}>{entry.subs.split(";").map((part) => part.trim()).filter(Boolean).join(" · ") || "—"}</span>
                    <span className="font-semibold" style={{ color: INK }}>{entry.periods ?? per}</span>
                    <span style={{ color: INK }}>{entry.assessment ?? (entry.kind === "rev" ? "Quiz" : "Class exercise")}</span>
                    <span><span className="rounded-full px-[9px] py-[2px] text-[10.5px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{status}</span></span>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="px-[18px] py-[10px] text-[11px]" style={LABEL}>An empty week is kept as a free week.</p>
        </div>

        {carry.length ? (
          <div className="overflow-hidden rounded-[14px] border bg-white" style={{ borderColor: CARD_BORDER }}>
            <div className="px-[18px] pb-[8px] pt-[14px]">
              <p className="text-[13px] font-extrabold" style={{ color: INK }}>Carried into {options.nextTerm?.name ?? "your next term"}</p>
              <p className="mt-0.5 text-[11.5px]" style={LABEL}>The standard has more topics than fit in one term, so the rest continue in order next term.</p>
            </div>
            {carry.slice(0, 14).map((entry, index) => (
              <div key={index} className="grid grid-cols-[48px_1.3fr_2fr] gap-3 border-t px-[18px] py-[9px] text-[11.5px]" style={{ borderColor: "#F2F7F4" }}>
                <span className="font-extrabold" style={{ color: INK }}>W{index + 1}</span>
                <span className="font-semibold" style={{ color: INK }}>{entry.topic || "—"}</span>
                <span style={LABEL}>{entry.subs.split(";").map((part) => part.trim()).filter(Boolean).join(" · ") || "—"}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-[14px] border bg-white" style={{ borderColor: CARD_BORDER }}>
            <p className="px-[18px] pb-[8px] pt-[14px] text-[13px] font-extrabold" style={{ color: INK }}>What you are adding</p>
            {([["Subject", subject.name, outline ? "From the curriculum" : "Your own plan"], ["Classes", arms.join(", "), level?.name ?? ""], ["Curriculum", outline ? outline.label : "None — your own scheme", outline?.source ?? ""], ["Starts", start, "The full term, so every topic is in view"], ["Notes vetted by", signer, ""]] as const).map(([label, value, note]) => (
              <div key={label} className="border-t px-[18px] py-[9px]" style={{ borderColor: "#F2F7F4" }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.06em]" style={LABEL}>{label}</p>
                <p className="mt-0.5 text-[12px] font-semibold" style={{ color: INK }}>{value}</p>
                {note ? <p className="text-[10.5px]" style={LABEL}>{note}</p> : null}
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-[14px] border bg-white" style={{ borderColor: CARD_BORDER }}>
            <p className="px-[18px] pb-[8px] pt-[14px] text-[13px] font-extrabold" style={{ color: INK }}>When you confirm</p>
            {NEXT.map((line, index) => (
              <div key={line} className="border-t px-[18px] py-[9px]" style={{ borderColor: "#F2F7F4" }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.06em]" style={LABEL}>Step {index + 1}</p>
                <p className="mt-0.5 text-[12px] font-semibold" style={{ color: INK }}>{line}</p>
              </div>
            ))}
          </div>
        </div>

        {confirm ? (
          <Confirm title={`Add ${subject.name} to your curriculum?`} body="It appears in Curriculum and Notes straight away, and the school office is told so it can go on the timetable." confirm={`Add ${subject.name}`} busy={busy === "create"} onConfirm={create} onCancel={() => setConfirm(false)}>
            <dl className="mt-3 overflow-hidden rounded-[11px] border text-[12px]" style={{ borderColor: "#E6EEE9" }}>
              {([["Classes", arms.join(", ")], ["Curriculum", outline ? outline.label : "Your own scheme"], ["Weeks planned", `${named} of ${rows.length}`], ["Teaching time", `${fmtTime(time)} this term`]] as const).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-b px-3 py-[7px] last:border-b-0" style={{ borderColor: "#F2F7F4" }}>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.06em]" style={LABEL}>{label}</dt>
                  <dd className="text-right font-semibold" style={{ color: INK }}>{value}</dd>
                </div>
              ))}
            </dl>
          </Confirm>
        ) : null}
      </div>
    );
  }

  /* ───────────────────────────── the steps ───────────────────────────── */
  const modes: Array<{ id: Mode; label: string; tag: string; sub: string; off?: boolean }> = [
    { id: "standard", label: "Standard curriculum", tag: "Recommended", off: !matches.length,
      sub: matches.length ? `${outline?.label ?? matches[0]!.curriculum + " · " + matches[0]!.stage}. ${matches[0]!.topics} topics with their sub-topics, placed week by week.` : subject && level ? `There is no published outline for ${subject.name} at ${level.name} this term.` : "Choose the subject and the level first." },
    { id: "build", label: "Build it yourself", tag: "Full control", sub: "Every week starts empty. Name each topic, list what you will teach, and set the periods it takes." },
    { id: "import", label: "Import your scheme", tag: "Excel · CSV", sub: "Bring in the scheme your department already uses — Week, Topic, Sub-topics — and check every week here first." },
  ];
  const lead = "px-[20px] py-[18px] border-b";

  return (
    <div className="grid gap-4">
      <div ref={top} aria-hidden className="-mb-4 h-0 scroll-mt-4" />
        <div className="empty:hidden">{toast.node}</div>
      <input ref={file} type="file" accept=".xlsx,.csv" className="hidden" onChange={importFile} aria-label="Scheme file" />
      <div className="grid overflow-hidden rounded-[16px] border bg-white lg:grid-cols-[minmax(0,1fr)_300px]" style={{ borderColor: CARD_BORDER }}>
        <div className="min-w-0">
          {/* 1 · the subject */}
          <section className={lead} style={{ borderColor: "#EDF3EF" }}>
            <Step n={1} done={Boolean(subject)} title="Subject" sub={subject ? undefined : "Pick from the school’s subject list. You cannot add one that is not on it."}>
              {subject ? <Btn small onClick={() => { setSubjectId(""); setMode("build"); setOutline(null); setOutlineId(""); setRows(Array.from({ length: options.weeks }, blank)); setCarry([]); }}>Change</Btn> : null}
            </Step>
            {subject ? (
              <div className="mt-3 rounded-[12px] border px-[14px] py-[11px]" style={{ background: "#F1F8F4", borderColor: "#CFE4DB" }}>
                <p className="text-[13px] font-extrabold" style={{ color: INK }}>{subject.name}</p>
                <p className="mt-0.5 text-[11px]" style={LABEL}>{matches[0] ? `${matches[0].curriculum} · ${matches[0].topics} topics ready to use` : `${stageOf(subject.levels, subject.section)} · you plan each week yourself`}</p>
              </div>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[12px] border px-[14px] py-[10px]" style={{ borderColor: "#E6EEE9", background: "#FBFDFC" }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold uppercase tracking-[0.07em]" style={LABEL}>Curriculum</p>
                    <p className="text-[11.5px] font-semibold" style={{ color: INK }}>Your school’s curriculum</p>
                  </div>
                  <select className={`${inputClass} w-auto max-w-[320px]`} value={curriculum} onChange={(event) => { setCurriculum(event.target.value); setOutline(null); setOutlineId(""); }} aria-label="Curriculum">
                    <option value="">Not stated</option>{options.curricula.map((name) => <option key={name}>{name}</option>)}<option value="Own scheme">Own scheme</option>
                  </select>
                </div>
                <input className={`${inputClass} mt-3`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a subject by name" aria-label="Search subjects" />
                <div className="mt-3 grid max-h-[340px] gap-2 overflow-auto sm:grid-cols-2 xl:grid-cols-3">
                  {shown.length ? shown.map((entry) => {
                    const mine = options.held.find((item) => item.subjectId === entry.id);
                    const topics = topicsOf(entry.name);
                    return (
                      <button key={entry.id} type="button" onClick={() => { setSubjectId(entry.id); if (entry.periodsPerWeek) setPer(entry.periodsPerWeek); }} className="flex min-w-0 flex-col gap-1 rounded-[11px] border px-[12px] py-[10px] text-left hover:bg-[#F7FAF8]" style={{ borderColor: "#DEE8E2" }}>
                        <span className="flex items-center justify-between gap-2"><span className="truncate text-[12px] font-bold" style={{ color: INK }}>{entry.name}</span><span className="flex-none rounded-[6px] px-[6px] py-[1px] text-[9.5px] font-bold" style={{ background: "#F2F5F3", color: "#5C6A62" }}>{stageOf(entry.levels, entry.section)}</span></span>
                        <span className="truncate text-[10px]" style={{ color: mine ? "#8A6410" : MUTED }}>{mine ? `You plan it for ${mine.arms.join(", ")}` : `${topics ? `${topics} topics · ` : ""}${entry.periodsPerWeek} periods a week`}</span>
                      </button>
                    );
                  }) : <p className="py-2 text-[11.5px]" style={LABEL}>No subject matches “{query}”. If the school has not listed it, ask the school office to add it.</p>}
                </div>
              </>
            )}
          </section>

          {/* 2 · classes and time */}
          {subject ? (
            <section className={lead} style={{ borderColor: "#EDF3EF" }}>
              <Step n={2} done={arms.length > 0 && !clash} title="Classes and time" sub="Who will teach it, and how much time it gets." />
              <div className="mt-3 grid gap-4 md:grid-cols-[1fr_1.2fr_auto]">
                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.07em]" style={LABEL}>Level</span>
                  <select className={inputClass} value={levelId} onChange={(event) => { setLevelId(event.target.value); setClassIds([]); setOutline(null); setOutlineId(""); if (mode === "standard") { setMode("build"); setRows(Array.from({ length: options.weeks }, blank)); setCarry([]); } }} aria-label="Level">
                    <option value="">Choose a level</option>{options.levels.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                  </select>
                </label>
                <div>
                  <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.07em]" style={LABEL}>Classes</span>
                  {level ? (
                    <div className="flex flex-wrap gap-1.5">
                      {level.arms.map((arm) => {
                        const on = classIds.includes(arm.id);
                        return <button key={arm.id} type="button" role="checkbox" aria-checked={on} onClick={() => setClassIds(on ? classIds.filter((id) => id !== arm.id) : [...classIds, arm.id])} className="inline-flex min-h-[34px] items-center rounded-full border px-[13px] text-[11px] font-semibold" style={pill(on)}>{arm.name}</button>;
                      })}
                    </div>
                  ) : <p className="py-2 text-[11.5px]" style={LABEL}>Choose a level to see its arms.</p>}
                  <p className="mt-1.5 text-[10.5px]" style={LABEL}>{arms.length > 1 ? `${arms.length} classes · one scheme and one note serve them all` : arms.length ? "Add more if you teach it to another arm too" : "Pick every arm you will teach it to. They share one scheme and one note."}</p>
                </div>
                <div>
                  <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.07em]" style={LABEL}>Periods a week</span>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label="Fewer periods" onClick={() => changePer(per - 1)} className="flex h-[32px] w-[32px] items-center justify-center rounded-[9px] border text-[15px] font-bold" style={{ borderColor: "#DEE8E2", color: INK }}>−</button>
                    <span className="min-w-[26px] text-center text-[18px] font-extrabold" style={{ color: INK }} aria-label="Periods a week">{per}</span>
                    <button type="button" aria-label="More periods" onClick={() => changePer(per + 1)} className="flex h-[32px] w-[32px] items-center justify-center rounded-[9px] border text-[15px] font-bold" style={{ borderColor: "#DEE8E2", color: INK }}>+</button>
                    <span className="text-[10.5px]" style={LABEL}>{fmtTime(per * minutes)} a week</span>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.07em]" style={LABEL}>Each period</span>
                <div className="inline-flex flex-wrap gap-0.5 rounded-[10px] p-[3px]" style={{ background: "#F2F7F4" }} role="radiogroup" aria-label="Each period">
                  {Array.from(new Set([...LENGTHS, minutes])).sort((a, b) => a - b).map((length) => (
                    <button key={length} type="button" role="radio" aria-checked={length === minutes} onClick={() => setMinutes(length)} className="rounded-[7px] px-[10px] py-[5px] text-[10.5px] font-semibold" style={length === minutes ? { background: "#fff", color: INK, boxShadow: "0 1px 2px rgba(13,35,21,0.12)" } : { color: MUTED }}>{length} min</button>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {/* 3 · the starting point */}
          {subject ? (
            <section className={lead} style={{ borderColor: "#EDF3EF" }}>
              <Step n={3} done={Boolean(subject)} title="Starting point" sub="Everything stays editable after you add it." />
              <div className="mt-3 grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Starting point">
                {modes.map((item) => {
                  const on = item.id === mode;
                  return (
                    <div key={item.id} className="flex min-w-0 flex-col gap-1.5 rounded-[12px] px-[13px] py-[12px]" style={{ opacity: item.off ? 0.5 : 1, background: on ? "#F1F8F4" : "#fff", border: on ? "1.5px solid #12796A" : "1px solid #DEE8E2" }}>
                      <button type="button" role="radio" aria-checked={on} disabled={item.off} onClick={() => choose(item.id)} className="flex items-center gap-2 text-left disabled:cursor-not-allowed">
                        <span className="flex h-[15px] w-[15px] flex-none items-center justify-center rounded-full border-[1.5px] bg-white" style={{ borderColor: on ? "#12796A" : "#C2D2C8" }} aria-hidden><span className="h-[7px] w-[7px] rounded-full" style={{ background: on ? "#12796A" : "transparent" }} /></span>
                        <span className="min-w-0 flex-1 text-[12px] font-bold" style={{ color: INK }}>{item.label}</span>
                        <span className="flex-none rounded-[6px] px-[6px] py-[1px] text-[9.5px] font-bold" style={{ background: "#F2F5F3", color: "#5C6A62" }}>{item.tag}</span>
                      </button>
                      <p className="text-[10.5px] leading-[1.5]" style={LABEL}>{item.sub}</p>
                      {item.id === "standard" && on && matches.length > 1 ? (
                        <select className={inputClass} value={outlineId} onChange={(event) => void pickOutline(event.target.value)} aria-label="Outline">
                          {matches.map((entry) => <option key={entry.id} value={entry.id}>{entry.curriculum} · {entry.stage} — {entry.topics} topics</option>)}
                        </select>
                      ) : null}
                      {item.id === "import" && on ? <div><Btn small busy={busy === "import"} onClick={() => file.current?.click()}>Choose a file</Btn></div> : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* 4 · the weeks */}
          {subject ? (
            <section className="pb-[6px] pt-[18px]">
              <div className="px-[20px]">
                <Step n={4} done={named === rows.length && rows.length > 0} title="Your weeks" sub={`${rows.length} weeks, from ${start}. Type a topic, list what you will teach, and set the periods it takes.`}>
                  <span className="flex flex-wrap justify-end gap-1.5">
                    {mode === "standard" && outline && edited ? <Btn small onClick={() => lay(outline)}>Reset to the standard</Btn> : null}
                    {rows.length >= 5 && !lastTwoRevision ? <Btn small onClick={() => { setEdited(true); setRows((all) => all.map((row, at) => (at >= all.length - 2 ? { ...row, ...REVISION[at - (all.length - 2)]!, kind: "rev" as const } : row))); }}>End with two revision weeks</Btn> : null}
                    {named ? <Btn small onClick={() => { setEdited(true); setRows((all) => all.map((row) => ({ ...blank(), periods: row.periods }))); }}>Clear every week</Btn> : null}
                  </span>
                </Step>
              </div>
              <div className="mt-3 overflow-x-auto">
                <div className="min-w-[680px]">
                  <div className="grid grid-cols-[64px_minmax(0,1.2fr)_minmax(0,1.5fr)_72px_58px] gap-[10px] border-y px-[18px] py-2 text-[9px] font-bold uppercase tracking-[0.07em]" style={{ borderColor: "#E6EEE9", background: "#F7FAF8", color: MUTED }}>
                    <span>Week</span><span>Topic</span><span>Sub-topics</span><span>Periods</span><span />
                  </div>
                  {rows.map((entry, index) => {
                    const filled = Boolean(entry.topic.trim());
                    const before = index > 0 ? rows[index - 1]!.topic.trim() : "";
                    return (
                      <div key={index} className="grid grid-cols-[64px_minmax(0,1.2fr)_minmax(0,1.5fr)_72px_58px] items-center gap-[10px] border-b px-[18px] py-[7px]" style={{ borderColor: "#F2F7F4" }}>
                        <div className="leading-tight">
                          <span className="inline-flex h-[22px] min-w-[34px] items-center justify-center rounded-[7px] px-1.5 text-[10.5px] font-extrabold" style={entry.kind === "rev" ? { background: "#F5F0FA", color: "#6B4E9E" } : filled ? { background: "#EAF6F0", color: "#17714F" } : { background: "#F2F5F3", color: "#5C6A62" }}>W{index + 1}</span>
                          <span className="mt-0.5 block text-[9.5px]" style={LABEL}>{span(options.term.startsOn, index + 1)}</span>
                        </div>
                        <input className="min-h-[32px] w-full min-w-0 rounded-[8px] bg-white px-[9px] py-[7px] text-[11.5px] font-semibold outline-hidden" style={{ color: INK, border: filled ? "1px solid #DEE8E2" : "1.5px dashed #C2D2C8" }} value={entry.topic} onChange={(event) => setRow(index, { topic: event.target.value })} placeholder={entry.kind === "rev" ? "Revision" : index === 0 ? (outline ? `e.g. ${outline.weeks[0]?.topic ?? "Name the first topic"}` : "Name the first topic") : `Week ${index + 1} topic`} aria-label={`Week ${index + 1} topic`} />
                        <input className="min-h-[32px] w-full min-w-0 rounded-[8px] border bg-white px-[9px] py-[7px] text-[11px] outline-hidden" style={{ borderColor: "#DEE8E2", color: INK }} value={entry.subs} onChange={(event) => setRow(index, { subs: event.target.value })} placeholder={filled ? "What you will teach, separated by ;" : "Sub-topics, separated by ;"} aria-label={`Week ${index + 1} sub-topics`} />
                        <select className="min-h-[32px] w-full rounded-[8px] border bg-white px-1.5 text-[11.5px] font-semibold" style={{ borderColor: "#DEE8E2", color: INK }} value={String(entry.periods ?? per)} onChange={(event) => setRow(index, { periods: Number(event.target.value) })} aria-label={`Week ${index + 1} periods`}>
                          {Array.from({ length: 11 }, (_, n) => <option key={n} value={n}>{n || "None"}</option>)}
                        </select>
                        <div className="flex gap-1">
                          <button type="button" disabled={!before} aria-label={`Carry week ${index} on into week ${index + 1}`} title="Carry on — continue last week’s topic" onClick={() => setRow(index, { topic: `${before.replace(/ \(continued\)$/, "")} (continued)`, subs: "", kind: rows[index - 1]!.kind })} className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] border bg-white text-[12px] disabled:opacity-40" style={{ borderColor: "#DEE8E2", color: "#435048" }}>↳</button>
                          <button type="button" disabled={!filled && !entry.subs} aria-label={`Clear week ${index + 1}`} onClick={() => setRow(index, { topic: "", subs: "", kind: "teach" })} className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] border bg-white text-[13px] disabled:opacity-40" style={{ borderColor: "#DEE8E2", color: "#B23B3B" }}>×</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="px-[20px] py-[10px] text-[11px] leading-[1.55]" style={LABEL}>
                {named} of {rows.length} weeks named · {revision} revision · {total} periods, {fmtTime(time)} of teaching this term. Carry on (↳) splits a long topic over two weeks.
                {carry.length ? ` The outline has ${carry.length} more ${carry.length === 1 ? "topic" : "topics"} than fit this term; ${carry.length === 1 ? "it goes" : "they go"} into ${options.nextTerm?.name ?? "your next term"} in order.` : ""}
              </p>
            </section>
          ) : null}
        </div>

        {/* the preview, filling in as the steps are answered */}
        <aside className="min-w-0 border-t p-[16px] lg:border-l lg:border-t-0" style={{ borderColor: "#EDF3EF", background: "#FBFDFC" }} aria-label="Preview">
          <div className="grid gap-3 lg:sticky lg:top-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.08em]" style={LABEL}>Preview</p>
            <div className="rounded-[12px] border bg-white px-[13px] py-[12px]" style={{ borderColor: "#E6EEE9" }}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-[14px] font-extrabold" style={{ color: INK }}>{subject?.name ?? "Your new subject"}</p>
                <span className="flex-none rounded-full px-[8px] py-[2px] text-[9.5px] font-bold" style={{ background: "#EBF1FA", color: "#2A5A96" }}>Added by you</span>
              </div>
              <p className="mt-0.5 text-[10.5px]" style={LABEL}>{arms.length ? arms.join(", ") : "No arms chosen yet"} · {per} × {minutes} min a week</p>
              <div className="mt-2.5 flex gap-[3px]" aria-hidden>{ribbon.map((cell, index) => <span key={index} title={cell.title} className="h-[16px] flex-1 rounded-[3px]" style={{ background: cell.color }} />)}</div>
              <p className="mt-1.5 text-[9.5px]" style={LABEL}>{options.term.name} · weeks 1 – {rows.length} · the whole term</p>
            </div>
            <dl className="grid gap-1.5 text-[11px]">
              {([["Curriculum", outline ? (curriculum || "Standard") : subject ? "Your own" : curriculum || "Not stated"], ["Source", outline ? outline.source : subject ? "Your own scheme" : "—"], ["Starts", start], ["Weeks", `${named} of ${rows.length} named`], ["Teaching time", fmtTime(time)], ["Notes vetted by", "Your reviewer"]] as const).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3"><dt style={LABEL}>{label}</dt><dd className="text-right font-semibold" style={{ color: INK }}>{value}</dd></div>
              ))}
            </dl>
            {carry.length ? <p className="rounded-[10px] px-[11px] py-[8px] text-[10.5px] leading-[1.55]" style={{ background: "#F5F0FA", color: "#6B4E9E" }}>{carry.length} more {carry.length === 1 ? "topic" : "topics"} from the outline {carry.length === 1 ? "goes" : "go"} into {options.nextTerm?.name ?? "your next term"}, in order.</p> : null}
            <div>
              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.08em]" style={LABEL}>Before you add it</p>
              <ul className="grid gap-1.5">
                {checks.map(([state, label]) => (
                  <li key={label} className="flex items-start gap-2 text-[11px] leading-[1.4]" style={{ color: state ? INK : MUTED, fontWeight: state ? 600 : 500 }}>
                    <span className="mt-px flex h-[15px] w-[15px] flex-none items-center justify-center rounded-[4.5px] border-[1.5px] text-[9.5px] font-extrabold text-white" style={{ background: state === "ok" ? "#12796A" : state === "warn" ? "#D9952B" : "#fff", borderColor: state === "ok" ? "#12796A" : state === "warn" ? "#D9952B" : "#C2D2C8" }} aria-hidden>{state === "ok" ? "✓" : state === "warn" ? "!" : ""}</span>
                    {label}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.08em]" style={LABEL}>What happens next</p>
              <ul className="grid gap-1.5 text-[10.5px] leading-[1.5]" style={LABEL}>{NEXT.map((line) => <li key={line}>{line}</li>)}</ul>
            </div>
            {problem && subject ? <p className="text-[11px] font-semibold" style={{ color: "#B23B3B" }}>{problem}</p> : null}
            {refused ? <p role="alert" className="rounded-[10px] px-3 py-2 text-[11.5px] font-semibold leading-[1.6]" style={{ background: "#FCECEC", color: "#B23B3B" }}>{refused}</p> : null}
            <button type="button" disabled={!ready} onClick={() => setPreviewing(true)} className="flex items-center justify-center rounded-[9px] px-3 py-[10px] text-center text-[11.5px] font-semibold disabled:cursor-not-allowed" style={ready ? { background: INK, color: "#fff", boxShadow: "0 7px 16px -9px rgba(13,35,21,0.6)" } : { background: "#E6EEE9", color: "#8C9A92" }}>{subject ? `Preview and add ${subject.name}` : "Preview and add"}</button>
            <Link href={"/lesson-notes/curriculum" as Route} className="flex items-center justify-center rounded-[9px] border bg-white px-3 py-[9px] text-[11.5px] font-semibold" style={{ borderColor: "#DEE8E2", color: "#435048" }}>Cancel</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
