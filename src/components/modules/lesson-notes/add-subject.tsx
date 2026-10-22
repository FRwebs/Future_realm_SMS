"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { Btn, Card, CARD_BORDER, Confirm, Empty, INK, Label, MUTED, inputClass, toBase64, useToast, useWrite } from "@/components/modules/lesson-notes/kit";
import { LN_API, type AddOptions } from "@/lib/modules/lesson-notes-types";

type Row = { topic: string; subtopics: string; assessment: string | null; periods: number | null; kind: "teach" | "rev" };
const blank = (): Row => ({ topic: "", subtopics: "", assessment: null, periods: null, kind: "teach" });
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

/**
 * "Add a subject": a teacher plans a subject the school has not mapped to them. It lands on their Curriculum, carries what does not fit
 * this term into the next, and tells the school so it can go on the timetable — until then it has no register and no score sheet.
 */
export function AddSubject({ options }: { options: AddOptions }) {
  const router = useRouter();
  const toast = useToast();
  const { busy, run } = useWrite(toast.show);
  const file = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [curriculum, setCurriculum] = useState("");
  const [levelId, setLevelId] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [per, setPer] = useState(3);
  const [minutes, setMinutes] = useState(options.defaultLesson);
  const [mode, setMode] = useState<"standard" | "build" | "import">("build");
  const [outline, setOutline] = useState("");
  const [rows, setRows] = useState<Row[]>(Array.from({ length: 3 }, blank));
  const [confirm, setConfirm] = useState(false);

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
  const matches = useMemo(
    () => (subject && level ? options.catalogue.filter((entry) => norm(entry.subject) === norm(subject.name) || norm(entry.subject).includes(norm(subject.name)) || norm(subject.name).includes(norm(entry.subject))).filter((entry) => norm(entry.stage) === norm(level.name) && (!curriculum || entry.curriculum === curriculum)) : []),
    [options.catalogue, subject, level, curriculum],
  );

  const filled = rows.filter((entry) => entry.topic.trim());
  const overflow = Math.max(0, rows.length - options.weeks);
  const problem = !subject ? "Choose the subject." : !level || !classIds.length ? "Choose the level and at least one arm." : clash ? "You already plan this subject for one of those arms." : mode === "standard" ? (outline ? "" : "Choose an outline.") : !filled.length ? "Plan at least one week." : "";

  function patch(index: number, change: Partial<Row>) {
    setRows((current) => current.map((entry, at) => (at === index ? { ...entry, ...change } : entry)));
  }

  async function importFile(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;
    try {
      const data = await toBase64(chosen);
      const result = await run<{ weeks: Array<{ week: number; topic: string; subtopics: string[]; assessment: string | null; periods: number | null }>; found: number }>("import", `${LN_API}/curriculum/import`, "POST", { file: data });
      if (!result) return;
      const next: Row[] = [];
      for (const item of result.weeks) next[item.week - 1] = { topic: item.topic, subtopics: item.subtopics.join("\n"), assessment: item.assessment, periods: item.periods, kind: "teach" };
      setRows(Array.from({ length: Math.max(next.length, 1) }, (_, at) => next[at] ?? blank()));
      toast.show(`${result.found} week${result.found === 1 ? "" : "s"} read from ${chosen.name}. Check them before you add the subject.`);
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : "That file could not be read.", "bad");
    }
  }

  async function create() {
    if (!subject) return;
    const toWeek = (entry: Row) => ({ topic: entry.topic.trim(), subtopics: entry.subtopics.split("\n").map((line) => line.trim()).filter(Boolean), assessment: entry.assessment, periods: entry.periods, kind: entry.kind });
    const all = mode === "standard" ? [{ topic: "", subtopics: "", assessment: null, periods: null, kind: "teach" as const }] : rows;
    const here = all.slice(0, options.weeks).map(toWeek);
    const later = options.nextTerm ? all.slice(options.weeks).map((entry) => { const w = toWeek(entry); return { topic: w.topic, subtopics: w.subtopics, assessment: w.assessment, kind: w.kind }; }) : [];
    const made = await run<{ subjectId: string; subject: string; arms: string[]; told: number }>("create", `${LN_API}/curriculum/add`, "POST", {
      subjectId: subject.id, classIds, periodsPerWeek: per, lessonMinutes: minutes, curriculum: curriculum || undefined, weeks: here.length ? here : [toWeek(blank())], nextTerm: later,
    });
    if (!made) return;
    if (mode === "standard" && outline) await run("outline", `${LN_API}/curriculum/${made.subjectId}/catalogue/apply`, "POST", { entryId: outline, replace: true });
    toast.show(`${made.subject} added.${made.told ? " The school has been told, so it can go on the timetable." : ""}`);
    router.push(`/lesson-notes/curriculum?subject=${made.subjectId}` as Route);
    router.refresh();
  }

  if (!options.levels.length || !options.subjects.length) {
    return <Empty title="There is nothing to add a subject from yet" body="The school has not set up its classes or its subject list. Ask the school office to finish Class & Timetable, then come back." />;
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      {toast.node}
      <div className="grid gap-4">
        <Card>
          <p className="text-[13px] font-extrabold" style={{ color: INK }}>1 · The subject</p>
          <p className="mt-0.5 text-[11.5px]" style={{ color: MUTED }}>Search the school’s subject list — choose a level below to narrow it to the subjects taught there. You cannot add one that is not on it.</p>
          <input className={`${inputClass} mt-3`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subjects" aria-label="Search subjects" />
          <div className="mt-2 flex max-h-[168px] flex-wrap gap-1.5 overflow-auto">
            {shown.length ? shown.map((entry) => (
              <button key={entry.id} type="button" onClick={() => { setSubjectId(entry.id); if (entry.periodsPerWeek) setPer(entry.periodsPerWeek); }} className="rounded-full border px-[11px] py-[5px] text-[11.5px] font-semibold" style={{ borderColor: subjectId === entry.id ? INK : "#CFDDD5", background: subjectId === entry.id ? INK : "#fff", color: subjectId === entry.id ? "#fff" : INK }}>{entry.name}<span className="ml-1.5 text-[10px] font-medium opacity-70">{stageOf(entry.levels, entry.section)}</span></button>
            )) : <p className="py-2 text-[11.5px]" style={{ color: MUTED }}>No subject matches “{query}”.</p>}
          </div>
          {held ? <p className="mt-2 text-[11.5px] font-semibold" style={{ color: "#8A6410" }}>You already plan {held.subject} for {held.arms.join(", ")}.</p> : null}
        </Card>

        <Card>
          <p className="text-[13px] font-extrabold" style={{ color: INK }}>2 · Level and arms</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block"><Label>Curriculum</Label><select className={inputClass} value={curriculum} onChange={(event) => setCurriculum(event.target.value)}><option value="">Not stated</option>{options.curricula.map((name) => <option key={name}>{name}</option>)}<option value="Own scheme">Own scheme</option></select></label>
            <label className="block"><Label>Level</Label><select className={inputClass} value={levelId} onChange={(event) => { setLevelId(event.target.value); setClassIds([]); }}><option value="">Choose a level</option>{options.levels.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
          </div>
          {level ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {level.arms.map((arm) => {
                const on = classIds.includes(arm.id);
                return <button key={arm.id} type="button" role="checkbox" aria-checked={on} onClick={() => setClassIds(on ? classIds.filter((id) => id !== arm.id) : [...classIds, arm.id])} className="rounded-full border px-[11px] py-[5px] text-[11.5px] font-semibold" style={{ borderColor: on ? INK : "#CFDDD5", background: on ? "#F1F8F4" : "#fff", color: INK }}>{on ? "✓ " : ""}{arm.name}</button>;
              })}
            </div>
          ) : <p className="mt-2 text-[11.5px]" style={{ color: MUTED }}>Choose a level to see its arms.</p>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block"><Label>Periods a week</Label><input type="number" min={1} max={14} className={inputClass} value={per} onChange={(event) => setPer(Math.max(1, Math.min(14, Number(event.target.value) || 1)))} /></label>
            <label className="block"><Label>Length of a lesson (minutes)</Label><input type="number" min={20} max={120} className={inputClass} value={minutes} onChange={(event) => setMinutes(Math.max(20, Math.min(120, Number(event.target.value) || 40)))} /></label>
          </div>
        </Card>

        <Card>
          <p className="text-[13px] font-extrabold" style={{ color: INK }}>3 · The weeks</p>
          <div className="mt-2 inline-flex rounded-[10px] border p-[3px]" style={{ borderColor: CARD_BORDER, background: "#F6F9F7" }}>
            {([["standard", "Standard outline"], ["build", "Build it"], ["import", "Import a file"]] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setMode(key)} className="rounded-[8px] px-[12px] py-[5px] text-[11.5px] font-bold" style={mode === key ? { background: INK, color: "#fff" } : { color: MUTED }}>{label}</button>)}
          </div>

          {mode === "standard" ? (
            <div className="mt-3">
              {!subject || !level ? <p className="text-[11.5px]" style={{ color: MUTED }}>Choose the subject and level first.</p> : matches.length ? (
                <select className={inputClass} value={outline} onChange={(event) => setOutline(event.target.value)} aria-label="Outline"><option value="">Choose an outline</option>{matches.map((entry) => <option key={entry.id} value={entry.id}>{entry.curriculum} · {entry.stage} — {entry.topics} topics</option>)}</select>
              ) : <p className="rounded-[10px] px-3 py-2 text-[11.5px] leading-[1.6]" style={{ background: "#FDF6E7", color: "#8A6410" }}>No published outline matches {subject.name} at {level.name} this term. Build the weeks yourself, or import a file.</p>}
            </div>
          ) : null}

          {mode === "import" ? (
            <div className="mt-3">
              <p className="text-[11.5px] leading-[1.6]" style={{ color: MUTED }}>An Excel or CSV file: Week, Topic, Sub-topics (separated by semicolons), and optionally Assessment and Periods.</p>
              <input ref={file} type="file" accept=".xlsx,.csv" className="hidden" onChange={importFile} />
              <div className="mt-2"><Btn busy={busy === "import"} onClick={() => file.current?.click()}>Choose a file</Btn></div>
            </div>
          ) : null}

          {mode !== "standard" ? (
            <div className="mt-3 grid gap-2.5">
              {rows.map((entry, index) => (
                <div key={index} className="rounded-[12px] border p-3" style={{ borderColor: CARD_BORDER, background: index >= options.weeks ? "#FBF9F2" : "#fff" }}>
                  <div className="flex items-center gap-2">
                    <span className="w-[54px] flex-none text-[11.5px] font-extrabold" style={{ color: INK }}>Wk {index + 1}</span>
                    <input className={inputClass} value={entry.topic} onChange={(event) => patch(index, { topic: event.target.value })} placeholder="Topic" aria-label={`Week ${index + 1} topic`} />
                    <button type="button" aria-label={`Remove week ${index + 1}`} onClick={() => setRows((current) => (current.length > 1 ? current.filter((_, at) => at !== index) : current))} className="flex-none text-[14px]" style={{ color: "#B23B3B" }}>×</button>
                  </div>
                  <textarea className={`${inputClass} mt-2 min-h-[58px]`} value={entry.subtopics} onChange={(event) => patch(index, { subtopics: event.target.value })} placeholder="Sub-topics, one per line" aria-label={`Week ${index + 1} sub-topics`} />
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <select className={inputClass} value={entry.kind} onChange={(event) => patch(index, { kind: event.target.value as "teach" | "rev" })} aria-label="Kind"><option value="teach">Teaching</option><option value="rev">Revision</option></select>
                    <select className={inputClass} value={entry.assessment ?? ""} onChange={(event) => patch(index, { assessment: event.target.value || null })} aria-label="Assessment"><option value="">No assessment</option>{options.assessments.map((name) => <option key={name}>{name}</option>)}</select>
                    <select className={inputClass} value={entry.periods ?? ""} onChange={(event) => patch(index, { periods: event.target.value === "" ? null : Number(event.target.value) })} aria-label="Periods"><option value="">Usual periods</option>{Array.from({ length: per + 3 }, (_, n) => <option key={n} value={n}>{n}</option>)}</select>
                  </div>
                  {index >= options.weeks ? <p className="mt-1.5 text-[10.5px] font-semibold" style={{ color: "#8A6410" }}>{options.nextTerm ? `Carried into ${options.nextTerm.name}` : "Beyond this term and there is no next term to carry it into"}</p> : null}
                </div>
              ))}
              <div><Btn small onClick={() => setRows((current) => [...current, blank()])}>Add a week</Btn></div>
            </div>
          ) : null}
        </Card>
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 lg:sticky lg:top-4">
        <Card>
          <p className="text-[13px] font-extrabold" style={{ color: INK }}>Preview</p>
          <dl className="mt-3 grid gap-2.5 text-[12px]">
            <div><dt className="text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>Subject</dt><dd className="font-semibold" style={{ color: INK }}>{subject?.name ?? "—"}</dd></div>
            <div><dt className="text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>Arms</dt><dd className="font-semibold" style={{ color: INK }}>{level && classIds.length ? level.arms.filter((arm) => classIds.includes(arm.id)).map((arm) => arm.name).join(", ") : "—"}</dd></div>
            <div><dt className="text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>Time</dt><dd className="font-semibold" style={{ color: INK }}>{per} period{per === 1 ? "" : "s"} a week · {minutes} minutes</dd></div>
            <div><dt className="text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>Weeks</dt><dd className="font-semibold" style={{ color: INK }}>{mode === "standard" ? (outline ? "From the outline you chose" : "—") : `${filled.length} planned · ${options.term.name} has ${options.weeks}`}</dd></div>
            {overflow && mode !== "standard" ? <div><dt className="text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>Carried over</dt><dd className="font-semibold" style={{ color: INK }}>{options.nextTerm ? `${overflow} week${overflow === 1 ? "" : "s"} into ${options.nextTerm.name}` : `${overflow} week${overflow === 1 ? "" : "s"} have nowhere to go`}</dd></div> : null}
          </dl>
          <p className="mt-4 rounded-[10px] px-3 py-2 text-[11.5px] leading-[1.6]" style={{ background: "#FDF6E7", color: "#8A6410" }}>The school office is told you added this, so it can be put on the timetable. Until then it has no register and no score sheet.</p>
          {problem ? <p className="mt-3 text-[11.5px] font-semibold" style={{ color: "#B23B3B" }}>{problem}</p> : null}
          <div className="mt-4 flex gap-2">
            <Link href={"/lesson-notes/curriculum" as Route} className="inline-flex rounded-[10px] border px-[13px] py-[8px] text-[11.5px] font-semibold" style={{ borderColor: "#CFDDD5", color: "#435048" }}>Cancel</Link>
            <Btn kind="primary" disabled={Boolean(problem)} onClick={() => setConfirm(true)}>Add the subject</Btn>
          </div>
        </Card>
      </div>

      {confirm ? <Confirm title={`Add ${subject?.name ?? "this subject"}?`} body="It joins your Curriculum straight away, and the school is told so it can be mapped to you on the timetable." confirm="Add it" busy={busy === "create" || busy === "outline"} onConfirm={create} onCancel={() => setConfirm(false)} /> : null}
    </div>
  );
}
