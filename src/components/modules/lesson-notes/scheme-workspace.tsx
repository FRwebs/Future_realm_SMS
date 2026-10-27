"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { Btn, Card, Chip, CARD_BORDER, Confirm, Empty, INK, Label, MUTED, esc, inputClass, printSheet, statusTone, toBase64, useToast, useWrite } from "@/components/modules/lesson-notes/kit";
import { LN_API, emptyDraft, stateLabel, stateTone, type DraftWeek, type Overview, type SchemeData, type SchemeWeek, type SubjectCard } from "@/lib/modules/lesson-notes-types";
import { toneOf } from "@/lib/modules/tones";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { focusOnMount } from "@/lib/ui/focus";

const noteHref = (scheme: SchemeData, week: number) => `/lesson-notes/notes/${scheme.subjectId}/${week}?term=${scheme.term.id}`;
const toDraft = (week: SchemeWeek): DraftWeek => ({
  from: week.kind === "pre" || (week.kind === "free" && !week.topic) ? null : week.week, kind: week.kind === "pre" ? "free" : week.kind,
  topic: week.topic, subtopics: [...week.subtopics], covered: [...week.covered], assessment: week.assessment, periods: week.periods, resources: week.resources.map((r) => ({ ...r })), status: week.override,
});
const sameDraft = (a: DraftWeek, b: DraftWeek) => JSON.stringify({ ...a, from: 0 }) === JSON.stringify({ ...b, from: 0 });
const hasNote = (week: SchemeWeek) => week.note.state !== "" && week.note.state !== "Not started";

/* ───────────────────────── the panel's parts ───────────────────────── */

const LABEL = "text-[9px] font-bold uppercase tracking-[0.07em]";
const RULE = "#EDF3EF";
const BAR: Record<string, string> = { Taught: "#22A06B", "In progress": "#12796A", "Partly taught": "#E2B655", Postponed: "#C9A08A", Planned: "#DCE7E1", Revision: "#C9B8E6", "Free week": "#F2E4C6", "Not planned": "#EEF2EF" };

/** A header action, in the panel's own two faces: ink for the main one, outlined for the rest. */
function Act({ children, onClick, href, primary, danger, disabled, busy }: { children: React.ReactNode; onClick?: () => void; href?: string; primary?: boolean; danger?: boolean; disabled?: boolean; busy?: boolean }) {
  const className = `inline-flex items-center whitespace-nowrap rounded-[8px] text-[10.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${primary ? "bg-[#0D2315] px-[11px] py-[6.5px] text-white hover:bg-[#1B3A28]" : danger ? "border border-[#F0CFCF] bg-white px-[10px] py-[5.5px] text-[#B23B3B] hover:bg-[#FDF3F3]" : "border border-[#DEE8E2] bg-white px-[10px] py-[5.5px] text-[#435048] hover:border-[#BFDCD1] hover:bg-[#F1F8F4]"}`;
  return href ? <Link href={href as Route} className={className}>{children}</Link> : <button type="button" onClick={onClick} disabled={disabled || busy} className={className}>{busy ? "Working…" : children}</button>;
}

function Strip({ tone, children }: { tone: "plain" | "purple" | "amber" | "red" | "blue"; children: React.ReactNode }) {
  const look = { plain: ["#FBFDFC", "#435048"], purple: ["#F5F0FA", "#6B4E9E"], amber: ["#FDF6E7", "#8A6410"], red: ["#FDF3F3", "#B23B3B"], blue: ["#EBF1FA", "#2A5A96"] }[tone];
  return <div className="border-b px-[18px] py-[9px] text-[11px] leading-[1.6]" style={{ borderColor: RULE, background: look[0], color: look[1] }}>{children}</div>;
}

function SubjectCards({ overview, selected, termId, locked, onBlocked, terms, current, editing, onTerm }: { overview: Overview; selected: string | null; termId: string; locked?: boolean; onBlocked?: () => void; terms?: SchemeData["terms"]; current?: string; editing?: boolean; onTerm?: () => void }) {
  return (
    // One strip of subject cards above the scheme, as the mockup has it. The mockup's
    // teacher holds one subject; a real one can hold fourteen, and fourteen cards wrap
    // into four rows that push the scheme itself off the screen. Past two rows the strip
    // scrolls instead of growing, so the panel stays about the plan rather than the menu.
    <div
      className={`flex flex-wrap items-stretch gap-[10px] border-b px-[18px] py-[13px] ${overview.subjects.length > 6 ? "max-h-[186px] overflow-y-auto" : ""}`}
      style={{ borderColor: RULE, background: "#FBFDFC" }}
    >
      {overview.subjects.map((card: SubjectCard) => {
        const pct = card.teachTotal ? Math.round((card.taught / card.teachTotal) * 100) : 0;
        const tone = card.status === "Read only" ? "withheld" : card.status === "Added by you" ? "progress" : card.status === "Behind" ? "attention" : card.status === "Not planned" ? "neutral" : "positive";
        const on = selected === card.subjectId;
        const note = card.awaitingTimetable
          ? `${card.planned} topics · awaiting the timetable`
          : card.planned ? `${card.taught} of ${card.teachTotal} topics taught · ${card.signed} notes signed` : "Nothing planned yet";
        return (
          <Link key={card.subjectId} href={`/lesson-notes/curriculum?subject=${card.subjectId}&term=${termId}` as Route} onClick={(event) => { if (locked) { event.preventDefault(); onBlocked?.(); } }}
            className="block min-w-0 flex-[1_1_240px] rounded-[12px] border bg-white transition-[border-color]" style={{ maxWidth: 380, borderWidth: on ? 1.5 : 1, borderColor: on ? INK : CARD_BORDER, padding: on ? "10.5px 12.5px" : "11px 13px", boxShadow: on ? "0 10px 24px -18px rgba(13,35,21,0.55)" : undefined }}>
            <div className="flex items-center justify-between gap-[10px]">
              <p className="min-w-0 truncate text-[12px] font-bold leading-[1.3]" style={{ color: INK }}>{card.subject}</p>
              <Chip tone={tone}>{card.status}</Chip>
            </div>
            <p className="mt-0.5 truncate text-[10.5px]" style={{ color: MUTED }}>{card.arms.join(", ")}{card.earlyYears ? " · daily sessions" : card.per ? ` · ${card.per} periods a week` : ""}</p>
            <div className="mt-[9px] h-[4px] overflow-hidden rounded-full" style={{ background: "#E6EEE9" }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#22A06B" }} /></div>
            <p className="mt-[5px] truncate text-[10px] tabular-nums" style={{ color: MUTED }}>{note}</p>
          </Link>
        );
      })}
      {overview.canAdd ? (
        <Link href={"/lesson-notes/curriculum/add" as Route} onClick={(event) => { if (locked) { event.preventDefault(); onBlocked?.(); } }} className="flex min-w-[176px] flex-[0_1_210px] items-center gap-[10px] rounded-[12px] border-[1.5px] border-dashed bg-white px-[13px] py-[11px] transition hover:border-[#12796A] hover:bg-[#F6FAF8]" style={{ borderColor: "#C2D2C8" }}>
          <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-white" style={{ background: INK }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d="M12 5.5v13M5.5 12h13" /></svg></span>
          <span className="min-w-0"><span className="block text-[12px] font-bold" style={{ color: INK }}>Add a subject</span><span className="mt-0.5 block text-[10px] leading-[1.35]" style={{ color: MUTED }}>From the standard curriculum, or built your way</span></span>
        </Link>
      ) : null}
      {terms && terms.length > 1 ? (
        <div className="ml-auto flex flex-none flex-col justify-center gap-[6px]">
          <span className={LABEL} style={{ color: MUTED }}>Term</span>
          <div className="flex items-center gap-[3px] rounded-[9px] border p-[2.5px]" style={{ background: "#F2F7F4", borderColor: "#E3ECE6" }} role="tablist" aria-label="Term">
            {terms.map((term) => (
              <Link key={term.id} role="tab" aria-selected={term.id === current} href={`/lesson-notes/curriculum?subject=${selected}&term=${term.id}` as Route} onClick={(event) => { if (editing) { event.preventDefault(); onTerm?.(); } }}
                className="whitespace-nowrap rounded-[7px] px-[11px] py-[5px] text-[10.5px] font-semibold" style={term.id === current ? { background: "#fff", color: INK, boxShadow: "0 1px 2px rgba(13,35,21,0.12)" } : { color: MUTED }}>{term.name}</Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The term as a strip of week bars — colour says how a week stands, a stripe marks the short week. */
function Ribbon({ weeks, selected, onPick, current }: { weeks: SchemeWeek[]; selected: number; onPick: (week: number) => void; current: number | null }) {
  return (
    <div className="grid gap-[4px]" style={{ gridTemplateColumns: `repeat(${Math.max(14, weeks.length)}, minmax(0, 1fr))` }} role="group" aria-label="The term, week by week">
      {weeks.map((week) => {
        const colour = BAR[week.status] ?? BAR["Free week"]!;
        const on = selected === week.week;
        return (
          <button key={week.week} type="button" disabled={week.kind === "pre"} onClick={() => onPick(week.week)} title={`Week ${week.week} · ${week.dates}${week.topic ? ` · ${week.topic}` : ""}${week.short ? " · short week" : ""}`} className="flex min-w-0 cursor-pointer flex-col gap-[5px] disabled:cursor-default">
            <span className="block h-[9px] rounded-[3px]" style={{ backgroundColor: colour, backgroundImage: week.short ? `repeating-linear-gradient(135deg, ${colour} 0 4px, #fff 4px 6px)` : undefined, boxShadow: on ? "0 0 0 2px #fff, 0 0 0 3.5px #0D2315" : undefined }} />
            <span className="text-center text-[9.5px] tabular-nums" style={{ fontWeight: on ? 800 : 600, color: on ? INK : current === week.week ? "#12796A" : "#5E6D64" }}>W{week.week}</span>
          </button>
        );
      })}
    </div>
  );
}

const noteCell = (week: SchemeWeek) => {
  if (week.kind === "free" || week.kind === "pre") return { text: "—", colour: "#C2D2C8" };
  switch (week.note.state) {
    case "Approved": return { text: "Signed", colour: "#17714F" };
    case "Submitted": return { text: "With reviewer", colour: "#4A44A0" };
    case "Draft": return { text: `Draft · ${week.note.done}/${week.note.of}`, colour: "#2A5A96" };
    case "Returned": return { text: "Returned", colour: "#B23B3B" };
    default: return { text: "Not written", colour: "#5F6E65" };
  }
};

/* ───────────────────────── main ───────────────────────── */

type WorkspaceProps = { overview: Overview; scheme: SchemeData | null; initialWeek?: number };

/** Keyed by subject and term, so a draft can never be carried from one subject's scheme onto another's. */
export function SchemeWorkspace(props: WorkspaceProps) {
  return <Workspace key={`${props.scheme?.subjectId ?? "none"}:${props.scheme?.term.id ?? ""}`} {...props} />;
}

function Workspace({ overview, scheme, initialWeek }: WorkspaceProps) {
  const router = useRouter();
  const toast = useToast();
  const { busy, run } = useWrite(toast.show);
  // The term's current week is the right landing spot while the term runs. Once it is
  // over there is no current week, and the last week of a term is very often free — so
  // landing there shows a reader an empty pane and nothing about what was taught.
  const landing = (() => {
    if (initialWeek) return initialWeek;
    const focus = scheme?.focus ?? 1;
    if (!scheme || scheme.term.current) return focus;
    const taught = [...scheme.weeks].reverse().find((entry) => entry.kind !== "free" && entry.kind !== "pre");
    return taught?.week ?? focus;
  })();
  const [selected, setSelected] = useState<number>(landing);
  const [draft, setDraft] = useState<DraftWeek[] | null>(null);
  /** The scheme's version when this draft was begun; the server refuses the save if it has moved since. */
  const [base, setBase] = useState<number>(scheme?.updatedAt ?? 0);
  const [stale, setStale] = useState(false);
  const [menu, setMenu] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<null | "save" | "discard" | "remove" | "submit">(null);
  const [replace, setReplace] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const weeks = useMemo(() => scheme?.weeks ?? [], [scheme]);
  const planned = weeks.filter((week) => week.kind === "teach" || week.kind === "rev");
  const editing = draft !== null;
  const original = useMemo(() => weeks.map(toDraft), [weeks]);
  const changed = useMemo(() => (draft ? draft.map((entry, index) => !original[index] || !sameDraft(entry, original[index]!) || (entry.from !== null && entry.from !== index + 1)) : []), [draft, original]);
  const changedCount = changed.filter(Boolean).length;
  const orphaned = useMemo(() => {
    if (!draft) return [] as number[];
    const kept = new Set(draft.map((entry) => entry.from).filter((value): value is number => value !== null));
    return weeks.filter((week) => hasNote(week) && week.kind !== "pre" && !kept.has(week.week)).map((week) => week.week);
  }, [draft, weeks]);

  if (!scheme) {
    return (
      <div className="grid gap-4">
        {overview.subjects.length ? <SubjectCards overview={overview} selected={null} termId={overview.term.id} /> : null}
        {!overview.subjects.length ? (
          <Empty title="No subject on your scheme of work yet" body="A scheme of work belongs to a subject you teach in an arm. When the school names you on one, it appears here — or add a subject yourself if the school has not mapped it yet." icon="M5 4.5h9.5A2.5 2.5 0 0 1 17 7v12.5H7.5A2.5 2.5 0 0 1 5 17zM9 8.5h5M9 12h5">
            {overview.canAdd ? <Link href={"/lesson-notes/curriculum/add" as Route} className="inline-flex rounded-[10px] px-[14px] py-[8px] text-[11.5px] font-bold text-white" style={{ background: INK }}>Add a subject</Link> : null}
          </Empty>
        ) : null}
      </div>
    );
  }

  const week = weeks.find((entry) => entry.week === selected) ?? weeks[0]!;
  const readOnly = scheme.readOnly;
  const frozen = (entry: SchemeWeek) => scheme.term.isCurrent && scheme.term.current !== null && entry.week < scheme.term.current;
  const view = editing ? weeks.map((entry, index) => ({ ...entry, topic: draft![index]?.topic ?? "", kind: (draft![index]?.kind ?? "free") as SchemeWeek["kind"] })) : weeks;

  /* coverage on the day */
  async function mark(body: Record<string, unknown>, done?: string) {
    const result = await run("mark", `${LN_API}/curriculum/${scheme!.subjectId}/weeks/${week.week}/coverage`, "POST", { termId: scheme!.term.id, ...body }, done);
    if (result) router.refresh();
    setMenu(null);
  }
  const tick = (index: number) => mark({ covered: week.covered.includes(index) ? week.covered.filter((value) => value !== index) : [...week.covered, index] });

  /* editing */
  function startEdit(seed?: DraftWeek[]) {
    setBase(scheme!.updatedAt);
    setStale(false);
    setDraft(seed ?? weeks.map(toDraft));
    setMenu(null);
  }
  const patch = (index: number, change: Partial<DraftWeek>) => setDraft((current) => current!.map((entry, at) => (at === index ? { ...entry, ...change, kind: change.kind ?? (change.topic !== undefined || change.subtopics ? (entry.kind === "free" ? "teach" : entry.kind) : entry.kind) } : entry)));
  function swap(index: number, by: -1 | 1) {
    const target = index + by;
    if (!draft || target < 0 || target >= draft.length) return;
    if (frozen(weeks[index]!) || frozen(weeks[target]!)) return toast.show("A week that is already behind you cannot be moved.", "bad");
    const next = [...draft];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setDraft(next);
    setSelected(target + 1);
  }
  async function save() {
    const payload = draft!.map((entry) => ({ from: entry.from, kind: entry.topic.trim() ? (entry.kind === "free" ? "teach" : entry.kind) : "free", topic: entry.topic.trim(), subtopics: entry.subtopics.map((s) => s.trim()).filter(Boolean), covered: entry.covered, assessment: entry.assessment, periods: entry.periods, resources: entry.resources.filter((r) => r.label.trim()), status: entry.status }));
    const result = await run("save", `${LN_API}/curriculum/${scheme!.subjectId}`, "PUT", { termId: scheme!.term.id, baseVersion: base, weeks: payload, discardNotes: orphaned.length > 0 }, "Scheme saved.", (message) => { if (/changed after you opened/i.test(message)) setStale(true); });
    if (result) { setDraft(null); setConfirm(null); router.refresh(); }
    else setConfirm(null);
  }

  /* starting */
  async function applyOutline(id: string) {
    const result = await run<{ filled: number; kept: number; from: string }>("outline-solid", `${LN_API}/curriculum/${scheme!.subjectId}/catalogue/apply`, "POST", { entryId: id, replace: true, termId: scheme!.term.id }, (data) => `Filled ${data.filled} week${data.filled === 1 ? "" : "s"} from ${data.from}.`);
    if (result) router.refresh();
  }
  async function importFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const data = await toBase64(file);
      const result = await run<{ weeks: Array<{ week: number; topic: string; subtopics: string[]; assessment: string | null; periods: number | null }>; found: number }>("import", `${LN_API}/curriculum/import`, "POST", { file: data });
      if (!result) return;
      const seed = weeks.map(toDraft);
      for (const item of result.weeks) if (item.week >= 1 && item.week <= seed.length) seed[item.week - 1] = { ...emptyDraft(), kind: "teach", topic: item.topic, subtopics: item.subtopics, assessment: item.assessment, periods: item.periods };
      startEdit(seed);
      toast.show(`${result.found} week${result.found === 1 ? "" : "s"} read from ${file.name}. Check them, then save.`);
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : "That file could not be read.", "bad");
    }
  }
  async function removeSubject() {
    const result = await run("remove", `${LN_API}/curriculum/${scheme!.subjectId}`, "DELETE", {}, `${scheme!.subject} removed from your subjects.`);
    if (result) { setConfirm(null); router.push("/lesson-notes/curriculum" as Route); router.refresh(); }
  }
  async function submitScheme() {
    const result = await run("submit", `${LN_API}/curriculum/${scheme!.subjectId}/submit`, "POST", { termId: scheme!.term.id }, "Scheme submitted — your head of department has it.");
    if (result) { setConfirm(null); router.refresh(); }
  }
  function printScheme() {
    const body = `<table><tr><th>Wk</th><th>Dates</th><th>Topic and sub-topics</th><th>Assessment</th><th>Periods</th><th>Status</th></tr>${weeks.filter((entry) => entry.kind === "teach" || entry.kind === "rev").map((entry) => `<tr><td>${entry.week}</td><td>${esc(entry.dates)}</td><td><b>${esc(entry.topic)}</b>${entry.subtopics.length ? `<br>${entry.subtopics.map((sub, i) => `${entry.covered.includes(i) ? "✓" : "○"} ${esc(sub)}`).join("<br>")}` : ""}${entry.resources.length ? `<br><i>${entry.resources.map((r) => esc(`${r.kind}: ${r.label}`)).join("; ")}</i>` : ""}</td><td>${esc(entry.assessment ?? "")}</td><td>${entry.periods ?? scheme!.per}</td><td>${esc(entry.status)}</td></tr>`).join("")}</table>`;
    const printed = printSheet({ letterhead: scheme!.letterhead, kicker: scheme!.earlyYears ? "Weekly plan" : "Scheme of work", title: `${scheme!.subject} · ${scheme!.arms.join(", ")}`, sub: `${scheme!.term.name}, ${scheme!.term.session}${scheme!.source ? ` · from ${scheme!.source}` : ""}`, body });
    if (!printed) toast.show("Allow pop-ups to print the scheme.", "bad");
  }

  const per = scheme.per;
  const thisWeekNote = planned.find((entry) => entry.week === (scheme.term.current ?? scheme.focus)) ?? planned.find((entry) => entry.note.state === "Not started");

  const legend: Array<[string, string, boolean]> = [["Taught", "Taught", false], ["In progress", "In progress", false], ...(weeks.some((w) => w.status === "Partly taught") ? [["Partly taught", "Partly taught", false] as [string, string, boolean]] : []), ...(weeks.some((w) => w.status === "Postponed") ? [["Postponed", "Postponed", false] as [string, string, boolean]] : []), ["Planned", "Planned", false], ["Revision", "Revision", false], ...(weeks.some((w) => w.short) ? [["Short week", "Planned", true] as [string, string, boolean]] : [])];
  const teachN = weeks.filter((w) => w.kind === "teach");
  const taughtN = teachN.filter((w) => w.status === "Taught").length;
  const signedN = planned.filter((w) => w.note.state === "Approved").length;
  const toWrite = planned.filter((w) => w.note.state === "Not started").length;
  const freeN = weeks.filter((w) => w.kind === "free").length;
  const headline = scheme.term.current ? `${scheme.subject} · week ${scheme.term.current} of ${scheme.term.weeks}` : `${scheme.subject} · ${scheme.term.name}`;
  const headSub = scheme.custom
    ? `Added by you · ${teachN.length} topics planned · ${per} × ${scheme.lessonMinutes} min a week · not on the timetable yet`
    : scheme.term.phase === "before" || !teachN.length
      ? `${teachN.length} topics planned · ${freeN} ${freeN === 1 ? "week" : "weeks"} still free · notes are written as the term comes`
      : `${taughtN} of ${teachN.length} topics taught · ${signedN} notes signed, ${toWrite} still to write${scheme.source ? ` · from ${scheme.source}` : ""}`;
  const tag = editing ? `Editing · ${changedCount ? `${changedCount} unsaved change${changedCount === 1 ? "" : "s"}` : "nothing changed yet"}` : readOnly ? "Read only" : scheme.custom ? "Added by you" : scheme.source ?? scheme.curriculum ?? "";
  const tagTone = editing ? (changedCount ? "attention" : "progress") : readOnly ? "withheld" : scheme.custom ? "progress" : "neutral";
  const shown = view.filter((w) => w.kind !== "pre");
  const cols = "30px minmax(150px,1fr) 124px 92px";

  return (
    <div>
      {toast.node}
      <section className="min-w-0 overflow-hidden rounded-[14px] border bg-white" style={{ borderColor: CARD_BORDER }}>
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-[14px] border-b px-[18px] pb-[12px] pt-[14px]" style={{ borderColor: RULE }}>
          <div className="min-w-0 flex-[1_1_260px]">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-pretty text-[12.5px] font-semibold leading-[1.3]" style={{ color: INK }}>{readOnly ? `${scheme.owner ?? "The owner"}’s ${scheme.earlyYears ? "weekly plan" : "scheme of work"}` : scheme.earlyYears ? "Weekly plan" : "Scheme of work"} · {scheme.subject}</h3>
              {tag ? <Chip tone={tagTone}>{tag}</Chip> : null}
            </div>
            <p className="mt-[3.5px] text-[10.5px] leading-normal" style={{ color: MUTED }}>{scheme.arms.join(", ")} · {scheme.term.name}, {scheme.term.session}{scheme.schemeStatus !== "None" ? ` · scheme ${scheme.schemeStatus.toLowerCase()}` : ""}</p>
          </div>
          <div className="flex flex-none flex-wrap items-center justify-end gap-[7px]">
            {editing ? (
              <>
                <Act onClick={() => (changedCount ? setConfirm("discard") : setDraft(null))}>Discard changes</Act>
                <Act primary busy={busy === "save"} disabled={!changedCount} onClick={() => setConfirm("save")}>Save changes</Act>
              </>
            ) : (
              <>
                {!readOnly && planned.length ? <Act onClick={() => startEdit()}>Edit the scheme</Act> : null}
                {planned.length ? <Act onClick={printScheme}>Print the scheme</Act> : null}
                {!readOnly && planned.length ? <Act disabled={scheme.schemeStatus === "Submitted" || scheme.schemeStatus === "Approved"} onClick={() => setConfirm("submit")}>Submit the scheme</Act> : null}
                {!readOnly && scheme.custom ? <Act danger onClick={() => setConfirm("remove")}>Remove the subject</Act> : null}
                {thisWeekNote ? <Act primary href={noteHref(scheme, thisWeekNote.week)}>{readOnly ? "Read this week’s note" : scheme.earlyYears ? `Write week ${thisWeekNote.week}’s plan` : thisWeekNote.note.state === "Not started" ? "Write this week’s note" : "Open this week’s note"}</Act> : null}
              </>
            )}
          </div>
        </div>

        {readOnly ? <Strip tone="purple">You hold this on cover{scheme.owner ? ` for ${scheme.owner}` : ""}. You read the scheme and teach from it — it is not yours to change.</Strip> : null}
        {scheme.custom ? <Strip tone="amber">You added this subject yourself. It has no register or score sheet until the school puts it on the timetable — they have been told.</Strip> : null}
        {scheme.returnReason ? <Strip tone="red"><b>Returned:</b> {scheme.returnReason}</Strip> : null}
        {stale ? <Strip tone="red"><span className="flex flex-wrap items-center justify-between gap-2"><span><b>Someone changed this scheme after you opened it</b> — in another tab or on another device. Your draft was not saved, so nothing of theirs was overwritten.</span><Act onClick={() => { setDraft(null); setStale(false); router.refresh(); }}>Discard mine and reload</Act></span></Strip> : null}
        {editing ? <Strip tone="blue">You are editing a draft. Nothing changes for anyone until you save. {changedCount ? `${changedCount} week${changedCount === 1 ? "" : "s"} changed.` : "Change a week to enable saving."}</Strip> : null}

        {/* subjects and term */}
        <SubjectCards overview={overview} selected={scheme.subjectId} termId={scheme.term.id} locked={editing} onBlocked={() => toast.show("Save or discard your changes first.", "bad")} terms={scheme.terms} current={scheme.term.id} editing={editing} onTerm={() => toast.show("Save or discard your changes first.", "bad")} />

        {/* nothing planned */}
        {!planned.length && !editing ? (
          <div className="px-[18px] pb-[26px] pt-[28px]">
            <div className="mx-auto mb-[18px] max-w-[540px] text-center">
              <p className="text-[16px] font-extrabold tracking-[-0.01em]" style={{ color: INK }}>{readOnly ? "The owner has not planned this term yet" : `Plan ${scheme.term.name.toLowerCase()} for ${scheme.subject}`}</p>
              <p className="mt-[5px] text-[11.5px] leading-[1.55]" style={{ color: MUTED }}>{readOnly ? "When they plan it, the weeks appear here and you can teach from them." : `${scheme.term.weeks} weeks. Start from the curriculum your school follows and change whatever you like, or build it from nothing. Nothing is submitted until you say so.`}</p>
            </div>
            {!readOnly ? (
              <div className="mx-auto grid max-w-[880px] gap-[11px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
                <div className="flex flex-col gap-2 rounded-[13px] border bg-white px-4 py-[15px]" style={{ borderColor: CARD_BORDER }}>
                  <p className="text-[12.5px] font-bold" style={{ color: INK }}>Start from the curriculum</p>
                  <p className="text-[10.5px] leading-normal" style={{ color: MUTED }}>The published outline for this subject, stage and term.</p>
                  {scheme.catalogue.length ? (
                    <div className="mt-auto grid gap-2">
                      <select className={inputClass} value={replace ?? scheme.catalogue[0]!.id} onChange={(event) => setReplace(event.target.value)} aria-label="Outline">
                        {scheme.catalogue.map((entry) => <option key={entry.id} value={entry.id}>{entry.curriculum} · {entry.stage}{entry.own ? " · your school’s" : ""} — {entry.topics} topics</option>)}
                      </select>
                      <Btn kind="primary" busy={busy === "outline-solid"} onClick={() => applyOutline(replace ?? scheme.catalogue[0]!.id)}>Fill the term</Btn>
                    </div>
                  ) : <p className="mt-auto text-[10.5px] font-semibold" style={{ color: "#8A6410" }}>No published outline matches {scheme.subject} at this stage in {scheme.term.name}. Your school can load one from Excel in Coverage.</p>}
                </div>
                <div className="flex flex-col gap-2 rounded-[13px] border bg-white px-4 py-[15px]" style={{ borderColor: CARD_BORDER }}>
                  <p className="text-[12.5px] font-bold" style={{ color: INK }}>Import your own scheme</p>
                  <p className="text-[10.5px] leading-normal" style={{ color: MUTED }}>An Excel or CSV file with Week, Topic and Sub-topics (separated by semicolons) — and, if you like, Assessment and Periods. You check every week before it is saved.</p>
                  <input ref={fileInput} type="file" accept=".xlsx,.csv" className="hidden" onChange={importFile} />
                  <div className="mt-auto"><Btn busy={busy === "import"} onClick={() => fileInput.current?.click()}>Choose a file</Btn></div>
                </div>
                <div className="flex flex-col gap-2 rounded-[13px] border bg-white px-4 py-[15px]" style={{ borderColor: CARD_BORDER }}>
                  <p className="text-[12.5px] font-bold" style={{ color: INK }}>Start blank</p>
                  <p className="text-[10.5px] leading-normal" style={{ color: MUTED }}>Add the weeks yourself, one topic at a time.</p>
                  <div className="mt-auto"><Btn onClick={() => { startEdit(); setSelected(1); }}>Plan the weeks</Btn></div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {(planned.length > 0 || editing) ? (
          <>
            {/* headline, legend and ribbon */}
            <div className="border-b px-[18px] pb-[13px] pt-[14px]" style={{ borderColor: RULE }}>
              <div className="mb-[10px] flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="text-[15px] font-extrabold leading-tight tracking-[-0.01em]" style={{ color: INK }}>{headline}</p>
                  <p className="mt-[3px] text-pretty text-[10.5px] leading-[1.45]" style={{ color: MUTED }}>{headSub}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {legend.map(([label, status, striped]) => (
                    <span key={label} className="flex items-center gap-[5px] whitespace-nowrap text-[10px]" style={{ color: "#5F6E65" }}>
                      <span className="h-[7px] w-[10px] flex-none rounded-[2px]" style={{ backgroundColor: BAR[status], backgroundImage: striped ? "repeating-linear-gradient(135deg, #5E6D64 0 3px, #fff 3px 5px)" : undefined }} />{label}
                    </span>
                  ))}
                </div>
              </div>
              <Ribbon weeks={view} selected={week.week} onPick={setSelected} current={scheme.term.current} />
            </div>

            {/* the weeks, and the one that is open */}
            <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,1fr)]">
              <div className="min-w-0">
                <div className="grid items-center gap-3 border-b px-[18px] py-[9px]" style={{ gridTemplateColumns: cols, background: "#F7FAF8", borderColor: "#E6EEE9" }}>
                  {["Wk", "Topic", "Status", editing ? "Move" : "Note"].map((head, i) => <span key={head} className={LABEL} style={{ color: MUTED, textAlign: i === 3 ? "right" : undefined }}>{head}</span>)}
                </div>
                <ul>
                  {shown.map((entry) => {
                    const index = entry.week - 1;
                    const marked = editing && changed[index];
                    const on = selected === entry.week;
                    const free = entry.kind === "free";
                    const here = scheme.term.current === entry.week;
                    const note = noteCell(entry);
                    const badge = here ? { background: INK, color: "#fff" } : entry.status === "Taught" ? { background: "#EAF6F0", color: "#17714F" } : entry.status === "Revision" ? { background: "#F5F0FA", color: "#6B4E9E" } : { background: "#F2F7F4", color: "#5F6E65" };
                    return (
                      <li key={entry.week} className="relative border-b" style={{ borderColor: "#F2F7F4", background: on ? "#F1F8F4" : marked ? "#FFFCF2" : "#fff", boxShadow: on ? "inset 3px 0 0 #12796A" : undefined }}>
                        {/* A click anywhere on the row opens the week for the mouse; the week-number button is the same action for the keyboard. */}
                        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                        <div className="grid cursor-pointer items-center gap-3 px-[18px]" style={{ gridTemplateColumns: cols, paddingTop: editing ? 7 : 9, paddingBottom: editing ? 7 : 9 }} onClick={() => setSelected(entry.week)}>
                          <button type="button" aria-label={`Open week ${entry.week}`} aria-current={on ? "true" : undefined} onClick={(event) => { event.stopPropagation(); setSelected(entry.week); }} className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] text-[10.5px] font-extrabold tabular-nums" style={badge}>{entry.week}</button>
                          <span className="min-w-0">
                            {editing ? (
                              <input className="min-h-[30px] w-full min-w-0 rounded-[8px] border bg-white px-[9px] py-[6px] text-[11.5px] font-semibold outline-hidden focus:border-[#12796A]" style={{ color: INK, borderColor: free && !entry.topic ? "#C2D2C8" : marked ? "#BFDCD1" : CARD_BORDER, borderStyle: free && !entry.topic ? "dashed" : "solid" }} value={entry.topic} placeholder={free ? `Name a topic for week ${entry.week}` : `Topic for week ${entry.week}`} onClick={(event) => event.stopPropagation()} onFocus={() => setSelected(entry.week)} onChange={(event) => patch(index, { topic: event.target.value })} aria-label={`Week ${entry.week} topic`} />
                            ) : (
                              <span className="block truncate text-[11.5px]" style={{ color: free ? "#5E6D64" : INK, fontWeight: free ? 500 : 600, fontStyle: free ? "italic" : undefined }}>{free ? "Free week · no topic yet" : entry.topic || "Untitled week"}</span>
                            )}
                            <span className="mt-0.5 block truncate text-[10px]" style={{ color: MUTED }}>{entry.dates}{entry.subtopics.length ? ` · ${entry.subtopics.length} sub-topic${entry.subtopics.length === 1 ? "" : "s"}` : ""}{entry.short ? " · short week" : ""}{entry.periods !== null && entry.periods !== per && !scheme.earlyYears ? ` · ${entry.periods} ${entry.periods === 1 ? "period" : "periods"}` : ""}{marked ? " · changed" : ""}</span>
                          </span>
                          <span className="relative min-w-0">
                            <DropdownMenu.Root open={menu === entry.week} onOpenChange={(open) => setMenu(open ? entry.week : null)}>
                              <DropdownMenu.Trigger asChild>
                              <button type="button" disabled={readOnly || free || editing} title={readOnly || free ? undefined : "Change the status of this week"} onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border px-[7px] py-[3px] text-[10px] font-bold" style={{ background: toneOf(statusTone(entry.status)).bg, color: toneOf(statusTone(entry.status)).fg, borderColor: menu === entry.week ? toneOf(statusTone(entry.status)).dot : toneOf(statusTone(entry.status)).bd, cursor: readOnly || free || editing ? "default" : "pointer" }}>
                                <span className="h-[6px] w-[6px] rounded-full" style={{ background: toneOf(statusTone(entry.status)).dot }} />{entry.status}{!readOnly && !free && !editing ? <span aria-hidden className="text-[8px] opacity-75">▾</span> : null}
                              </button>
                              </DropdownMenu.Trigger>
                              <DropdownMenu.Portal>
                                <DropdownMenu.Content side={shown.length > 6 && entry.week > shown.length - 5 ? "top" : "bottom"} align="start" sideOffset={5} collisionPadding={8} onClick={(event) => event.stopPropagation()} className="z-80 w-[226px] rounded-[11px] border bg-white p-[5px] shadow-[0_18px_40px_-16px_rgba(13,35,21,0.42)] outline-hidden" style={{ borderColor: CARD_BORDER }}>
                                  <DropdownMenu.Label asChild>
                                    <p className={`px-[9px] pb-[2px] pt-[6px] ${LABEL}`} style={{ color: MUTED }}>Status</p>
                                  </DropdownMenu.Label>
                                  <p className="mb-1 truncate border-b px-[9px] pb-[6px] text-[10.5px] font-semibold" style={{ color: INK, borderColor: RULE }}>Week {entry.week}{entry.topic ? ` · ${entry.topic}` : ""}</p>
                                  {[entry.auto, ...scheme.statuses.map(([name]) => name)].filter((name, i, all) => all.indexOf(name) === i).map((name) => {
                                    const auto = name === entry.auto;
                                    const hint = auto ? "From the term calendar" : scheme.statuses.find(([n]) => n === name)?.[1] ?? "";
                                    const current = (entry.override ?? entry.auto) === name;
                                    return (
                                      <DropdownMenu.Item key={name} className="flex w-full cursor-pointer items-center gap-[9px] rounded-[8px] px-[9px] py-[7px] text-left outline-hidden data-highlighted:bg-[#F7FAF8]" style={{ background: current ? "#F1F8F4" : "transparent" }} onSelect={() => { setSelected(entry.week); void (async () => { const result = await run("mark", `${LN_API}/curriculum/${scheme.subjectId}/weeks/${entry.week}/coverage`, "POST", { termId: scheme.term.id, status: auto ? null : name }, auto ? "Back to following the calendar." : `Week ${entry.week} marked ${name.toLowerCase()}.`); if (result) router.refresh(); })(); }}>
                                        <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: toneOf(statusTone(name)).dot }} />
                                        <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold leading-[1.3]" style={{ color: INK }}>{name}</span><span className="mt-px block text-[9.5px] leading-[1.35]" style={{ color: MUTED }}>{hint}</span></span>
                                        <span className="flex-none text-[11px] font-extrabold" style={{ color: "#12796A" }}>{current ? "✓" : ""}</span>
                                      </DropdownMenu.Item>
                                    );
                                  })}
                                </DropdownMenu.Content>
                              </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                          </span>
                          {editing ? (
                            <span role="presentation" className="flex flex-none justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                              {[["↑", -1, `Move week ${entry.week} up`], ["↓", 1, `Move week ${entry.week} down`]].map(([glyph, by, label]) => {
                                const target = index + (by as number);
                                const can = target >= 0 && target < view.length && !frozen(weeks[index]!) && !frozen(weeks[target]!) && weeks[target]!.kind !== "pre";
                                return <button key={label as string} type="button" aria-label={label as string} disabled={!can} onClick={() => swap(index, by as -1 | 1)} className="flex h-[24px] w-[24px] items-center justify-center rounded-[7px] border bg-white text-[11px] disabled:opacity-40" style={{ borderColor: can ? CARD_BORDER : "#EDF3EF", color: can ? "#435048" : "#C9D6CE" }}>{glyph}</button>;
                              })}
                              <button type="button" aria-label={`Clear week ${entry.week}`} disabled={frozen(weeks[index]!) || (free && !entry.topic)} onClick={() => setDraft((current) => current!.map((item, at) => (at === index ? { ...emptyDraft() } : item)))} className="flex h-[24px] w-[24px] items-center justify-center rounded-[7px] border bg-white text-[12px] disabled:opacity-40" style={{ borderColor: CARD_BORDER, color: "#B23B3B" }}>×</button>
                            </span>
                          ) : (
                            <span className="whitespace-nowrap text-right text-[10.5px] font-semibold" style={{ color: note.colour }}>{note.text}</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* the open week */}
              <div className="min-w-0 border-t px-[18px] pb-[18px] pt-[16px] lg:border-l lg:border-t-0" style={{ borderColor: RULE }}>
                {!editing ? (
                  <WeekDetail scheme={scheme} week={week} weeks={weeks} per={per} readOnly={readOnly} frozen={frozen(week)} busy={busy === "mark"} onTick={tick} onMark={mark} onPlan={() => startEdit()} />
                ) : (
                  <WeekEditor
                    scheme={scheme}
                    index={selected - 1}
                    value={draft![selected - 1] ?? emptyDraft()}
                    locked={frozen(week)}
                    noted={hasNote(week)}
                    onChange={(change) => patch(selected - 1, change)}
                    // Clearing empties the week back to a free one but keeps its place in
                    // the term, so the weeks after it do not all shift up by one.
                    onClear={() => setDraft((current) => current!.map((entry, at) => (at === selected - 1 ? { ...emptyDraft(), from: entry.from } : entry)))}
                  />
                )}
              </div>
            </div>
          </>
        ) : null}
      </section>

      {confirm === "save" ? (
        <Confirm title={`Save ${changedCount} changed week${changedCount === 1 ? "" : "s"}?`} body={`This changes the scheme for ${scheme.arms.join(", ")}. ${scheme.schemeStatus === "Approved" || scheme.schemeStatus === "Submitted" ? "The scheme goes back to draft so it can be signed again. " : ""}Notes follow their topics when you move them.`} confirm="Save the scheme" busy={busy === "save"} onConfirm={save} onCancel={() => setConfirm(null)}>
          {orphaned.length ? <p className="mt-3 rounded-[10px] px-3 py-2 text-[11.5px] leading-[1.6]" style={{ background: "#FDF3F3", color: "#B23B3B" }}>Week {orphaned.join(", ")} {orphaned.length === 1 ? "has a note that goes" : "have notes that go"} with {orphaned.length === 1 ? "its" : "their"} topic, because the topic is being removed.</p> : null}
          <ul className="mt-3 max-h-[160px] overflow-auto text-[11.5px]" style={{ color: INK }}>{draft!.map((entry, index) => (changed[index] ? <li key={index} className="py-0.5">Week {index + 1}: {entry.topic.trim() || "cleared"}{entry.from !== null && entry.from !== index + 1 ? ` (moved from week ${entry.from})` : ""}</li> : null))}</ul>
        </Confirm>
      ) : null}
      {confirm === "discard" ? <Confirm title="Discard your changes?" body={`${changedCount} changed week${changedCount === 1 ? "" : "s"} will be lost. The saved scheme is untouched.`} confirm="Discard" danger onConfirm={() => { setDraft(null); setConfirm(null); }} onCancel={() => setConfirm(null)} /> : null}
      {confirm === "remove" ? <Confirm title={`Remove ${scheme.subject}?`} body="Its scheme and any notes you wrote for it, this term and next, are deleted. A subject the school gave you can never be removed here." confirm="Remove it" danger busy={busy === "remove"} onConfirm={removeSubject} onCancel={() => setConfirm(null)} /> : null}
      {confirm === "submit" ? <Confirm title="Submit the scheme?" body="Your head of department is told. You can keep teaching from it while they read it." confirm="Submit" busy={busy === "submit"} onConfirm={submitScheme} onCancel={() => setConfirm(null)} /> : null}
    </div>
  );
}

/* ───────────────────────── the open week, read ───────────────────────── */

function WeekDetail({ scheme, week, weeks, per, readOnly, frozen, busy, onTick, onMark, onPlan }: { scheme: SchemeData; week: SchemeWeek; weeks: SchemeWeek[]; per: number; readOnly: boolean; frozen: boolean; busy: boolean; onTick: (index: number) => void; onMark: (body: Record<string, unknown>, done?: string) => void; onPlan: () => void }) {
  const free = week.kind === "free" || week.kind === "pre";
  const next = weeks[week.week];
  const left = week.subtopics.length - week.covered.length;
  const tickable = !readOnly && !free && ["Taught", "In progress", "Partly taught"].includes(week.status);
  const live = week.status === "In progress" || week.status === "Partly taught";
  /** Only the week actually running can count registers; any other week states intent. */
  const liveWeek = live && scheme.term.current === week.week;
  const periodLabel = liveWeek ? "Taught so far this week" : week.status === "Taught" ? "Periods taught" : "Periods it will take";
  const note = week.note;
  const mins = (week.periods ?? per) * scheme.lessonMinutes;
  const sw = toneOf(statusTone(week.status));
  const fact = (label: string, value: string) => <div key={label}><dt className={LABEL} style={{ color: MUTED }}>{label}</dt><dd className="mt-[3px] text-[11.5px] font-semibold" style={{ color: INK }}>{value}</dd></div>;
  return (
    <div>
      <div className="min-w-0">
        <p className={LABEL} style={{ color: MUTED }}>Week {week.week} · {week.dates}</p>
        <h4 className="mt-[5px] text-pretty text-[17px] font-extrabold leading-tight tracking-[-0.015em]" style={{ color: INK }}>{free ? (week.kind === "pre" ? "Before this subject starts" : "Free week") : week.topic}</h4>
        {/* Status and the week's shape read as one line, the way the mockup has it — the
            status belongs beside what it describes, not floated away in the corner. */}
        <div className="mt-[8px] flex flex-wrap items-center gap-[7px]">
          {!free ? <span className="inline-flex flex-none items-center gap-[5px] whitespace-nowrap rounded-full border px-[8px] py-[3px] text-[10px] font-bold" style={{ background: sw.bg, color: sw.fg, borderColor: sw.bd }}><span className="h-[6px] w-[6px] rounded-full" style={{ background: sw.dot }} />{week.status}</span> : null}
          <span className="text-[10.5px]" style={{ color: MUTED }}>{week.short ? "Short week · mid-term break" : scheme.custom ? "Added by you · not on the timetable yet" : scheme.earlyYears ? "Daily sessions across all seven areas" : `${per} periods a week in each arm`}</span>
        </div>
      </div>

      {free ? (
        <p className="mt-4 rounded-[10px] border border-dashed px-3 py-4 text-center text-[11.5px] leading-[1.6]" style={{ borderColor: "#CFDDD5", color: MUTED }}>
          {readOnly ? "Nothing is planned for this week." : "A free week — no topic yet. Name one with Edit the scheme, or leave it free for a test, a trip or a break."}
          {!readOnly && week.kind === "free" ? <span className="mt-2 block"><Btn small kind="soft" onClick={onPlan}>Plan this week</Btn></span> : null}
        </p>
      ) : (
        <>
          <div className="mt-4">
            <p className={LABEL} style={{ color: MUTED }}>Sub-topics{week.subtopics.length && tickable ? ` · ${week.covered.length} of ${week.subtopics.length} covered` : ""}</p>
            {week.subtopics.length ? (
              <ul className="mt-[7px] grid gap-[7px]">
                {week.subtopics.map((sub, index) => {
                  const done = week.covered.includes(index);
                  return (
                    <li key={index}>
                      <button type="button" disabled={!tickable || busy} onClick={() => onTick(index)} title={tickable ? (done ? "Mark as not covered" : "Mark as covered") : undefined} className="flex w-full items-start gap-[9px] text-left disabled:cursor-default">
                        <span className="mt-px flex h-[16px] w-[16px] flex-none items-center justify-center rounded-[5px] border-[1.5px] text-[10px] font-extrabold text-white" style={{ background: done ? "#12796A" : "#fff", borderColor: done ? "#12796A" : "#C2D2C8" }}>{done ? "✓" : ""}</span>
                        <span className="min-w-0 flex-1 text-[11.5px] leading-[1.45]" style={{ color: done ? "#435048" : INK, fontWeight: done ? 500 : 600 }}>{sub}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="mt-[7px] text-[11px]" style={{ color: MUTED }}>No sub-topics yet.{readOnly ? "" : " Add the two or three things you will actually teach, with Edit the scheme."}</p>}
          </div>

          {!readOnly && week.subtopics.length && (live || left > 0) ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {left > 0 && next && next.kind !== "free" && live ? <Btn small kind="primary" busy={busy} onClick={() => onMark({ action: "carry" }, `${left} carried to week ${week.week + 1}.`)}>Carry {left} to week {week.week + 1}</Btn> : null}
              {left > 0 ? <Btn small busy={busy} onClick={() => onMark({ action: "markAll" }, "Every sub-topic marked covered.")}>Mark all covered</Btn> : null}
              {next && !frozen ? <Btn small busy={busy} onClick={() => onMark({ action: "push" }, `Pushed to week ${week.week + 1}.`)}>Push to week {week.week + 1}</Btn> : null}
            </div>
          ) : null}

          {!scheme.earlyYears && scheme.periods.length ? (
            // One block per arm, a pip per timetabled period. It is shown for every
            // teaching week in the term, not only the current one: a week marked Taught
            // reads as all its periods done, a week still to come reads as none, and only
            // the week actually running counts the registers. Hiding it except on the
            // current week — which is what this used to do — meant that for most of the
            // term it was never on screen at all.
            <div className="mt-4">
              <p className={LABEL} style={{ color: MUTED }}>{periodLabel}</p>
              <ul className="mt-[7px] grid gap-[7px]">
                {scheme.periods.map((arm) => {
                  const total = arm.periods.length;
                  const doneN = week.status === "Taught" ? total : liveWeek ? arm.periods.filter((p) => p.done).length : 0;
                  const next = liveWeek ? arm.periods.find((p) => !p.done) : null;
                  return (
                    <li key={arm.arm}>
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="min-w-0 truncate font-semibold" style={{ color: INK }}>{arm.arm}</span>
                        <span className="flex-none tabular-nums" style={{ color: MUTED }}>{doneN} of {total}{next ? ` · next ${next.day} at ${next.time.slice(0, 5)}` : ""}</span>
                      </div>
                      <div className="mt-1 flex gap-[3px]">
                        {arm.periods.map((p, i) => (
                          <span key={i} title={`${p.day} · period ${p.period} · ${p.time}`} className="h-[8px] w-[18px] rounded-[3px]" style={{ background: i < doneN || (liveWeek && p.done) ? "#12796A" : "#E1EAE5" }} />
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3" style={{ borderColor: RULE }}>
            {fact("Status", week.override ? `${week.override} (set by you)` : `${week.status} (from the calendar)`)}
            {fact("Assessment", week.assessment ?? "None")}
            {!scheme.earlyYears ? fact("Time", `${week.periods ?? per} ${(week.periods ?? per) === 1 ? "period" : "periods"} · ${Math.floor(mins / 60) ? `${Math.floor(mins / 60)} h ` : ""}${mins % 60 ? `${mins % 60} min` : ""}`.trim()) : null}
          </dl>

          <div className="mt-4">
            <p className={LABEL} style={{ color: MUTED }}>Resources{week.resources.length > 1 ? ` · ${week.resources.length}` : ""}</p>
            {week.resources.length ? (
              <ul className="mt-[7px] grid gap-[7px]">{week.resources.map((resource, index) => <li key={index} className="flex items-center gap-[9px] text-[11.5px]"><span className="flex h-[26px] flex-none items-center rounded-[8px] border px-[7px] text-[9.5px] font-bold" style={{ background: "#F2F7F4", borderColor: "#E3ECE6", color: "#12796A" }}>{resource.kind}</span><span className="min-w-0 flex-1 truncate" style={{ color: INK }}>{resource.label}</span></li>)}</ul>
            ) : <p className="mt-[7px] text-[11px]" style={{ color: MUTED }}>None listed.{readOnly ? "" : " Add them with Edit the scheme."}</p>}
          </div>

          <div className="mt-4 rounded-[12px] border p-[12px]" style={{ borderColor: CARD_BORDER, background: "#FAFCFB" }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11.5px] font-bold" style={{ color: INK }}>{scheme.earlyYears ? "The week’s plan" : "The note"}</p>
              <Chip tone={stateTone(note.state || "Not started")}>{stateLabel(note.state === "Not started" || !note.state ? "Not written" : note.state)}</Chip>
            </div>
            <div className="mt-[9px] h-[4px] overflow-hidden rounded-full" style={{ background: "#E4EDE8" }}><div className="h-full rounded-full" style={{ width: `${note.of ? (note.done / note.of) * 100 : 0}%`, background: note.done === note.of ? "#22A06B" : "#4A83CE" }} /></div>
            <p className="mt-[6px] text-[10.5px] leading-normal" style={{ color: MUTED }}>
              {note.state === "Approved" ? `Signed · ${note.done} of ${note.of} sections` : note.state === "Submitted" ? "With the reviewer for signing" : note.state === "Returned" ? "Returned with a comment — open it to see what to change" : note.state === "Draft" ? `${note.done} of ${note.of} sections written` : readOnly ? "Not written yet by its owner." : "Nothing written yet. Reuse last session’s note, or draft it from these sub-topics."}
            </p>
            <div className="mt-[10px]"><Act primary={!readOnly && (!note.state || note.state === "Not started")} href={noteHref(scheme, week.week)}>{readOnly ? "Read the note" : !note.state || note.state === "Not started" ? (scheme.earlyYears ? "Write the plan" : "Write the note") : note.state === "Draft" ? "Continue the note" : note.state === "Returned" ? "Correct the note" : "Read the note"}</Act></div>
          </div>
        </>
      )}
    </div>
  );
}

/* ───────────────────────── the week editor ───────────────────────── */

function WeekEditor({ scheme, index, value, locked, noted, onChange, onClear }: { scheme: SchemeData; index: number; value: DraftWeek; locked: boolean; noted: boolean; onChange: (change: Partial<DraftWeek>) => void; onClear: () => void }) {
  const [resourceKind, setResourceKind] = useState(scheme.resourceKinds[0] ?? "Other");
  const [resourceLabel, setResourceLabel] = useState("");
  const periodOptions = Array.from({ length: Math.max(scheme.per + 3, 6) }, (_, n) => n);
  return (
    <Card>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: MUTED }}>Editing week {index + 1}</p>
      {locked ? <p className="mt-2 rounded-[10px] px-3 py-2 text-[11.5px]" style={{ background: "#FDF6E7", color: "#8A6410" }}>This week is behind you. You can correct what it says, but it cannot be moved.</p> : null}
      <div className="mt-3 grid gap-3">
        <label className="block"><Label>Topic</Label><input className={inputClass} value={value.topic} onChange={(event) => onChange({ topic: event.target.value, kind: value.kind === "free" ? "teach" : value.kind })} placeholder="e.g. Quadratic equations" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><Label>Kind of week</Label><select className={inputClass} value={value.kind === "rev" ? "rev" : "teach"} onChange={(event) => onChange({ kind: event.target.value as "teach" | "rev" })}><option value="teach">Teaching</option><option value="rev">Revision</option></select></label>
          <label className="block"><Label>Periods</Label><select className={inputClass} value={value.periods ?? ""} onChange={(event) => onChange({ periods: event.target.value === "" ? null : Number(event.target.value) })}><option value="">The usual ({scheme.per})</option>{periodOptions.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        </div>
        <label className="block"><Label>Assessment</Label><select className={inputClass} value={value.assessment ?? ""} onChange={(event) => onChange({ assessment: event.target.value || null })}><option value="">None set</option>{scheme.assessments.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>

        <div>
          <Label>Sub-topics</Label>
          <ul className="grid gap-1.5">
            {value.subtopics.map((sub, at) => (
              <li key={at} className="flex gap-1.5">
                <input className={inputClass} value={sub} ref={!sub && at === value.subtopics.length - 1 ? focusOnMount : undefined} aria-label={`Sub-topic ${at + 1}`} onChange={(event) => onChange({ subtopics: value.subtopics.map((s, i) => (i === at ? event.target.value : s)) })} />
                <button type="button" aria-label="Remove sub-topic" onClick={() => onChange({ subtopics: value.subtopics.filter((_, i) => i !== at), covered: value.covered.filter((i) => i !== at).map((i) => (i > at ? i - 1 : i)) })} className="flex-none rounded-[9px] border px-2.5 text-[12px]" style={{ borderColor: "#F0CFCF", color: "#B23B3B" }}>×</button>
              </li>
            ))}
          </ul>
          <div className="mt-2"><Btn small onClick={() => onChange({ subtopics: [...value.subtopics, ""], kind: value.kind === "free" ? "teach" : value.kind })}>Add a sub-topic</Btn></div>
        </div>

        <div>
          <Label>Resources</Label>
          {value.resources.length ? (
            <ul className="mb-2 grid gap-1.5">{value.resources.map((resource, at) => <li key={at} className="flex items-center gap-2 text-[12px]"><span className="rounded-[6px] px-[7px] py-[2px] text-[10px] font-bold" style={{ background: "#EEF4F0", color: MUTED }}>{resource.kind}</span><span className="min-w-0 flex-1 truncate" style={{ color: INK }}>{resource.label}</span><button type="button" aria-label="Remove resource" onClick={() => onChange({ resources: value.resources.filter((_, i) => i !== at) })} className="text-[13px]" style={{ color: "#B23B3B" }}>×</button></li>)}</ul>
          ) : null}
          <div className="flex gap-1.5">
            <select className={`${inputClass} w-[130px]! flex-none`} value={resourceKind} onChange={(event) => setResourceKind(event.target.value)} aria-label="Kind of resource">{scheme.resourceKinds.map((kind) => <option key={kind}>{kind}</option>)}</select>
            <input className={inputClass} value={resourceLabel} onChange={(event) => setResourceLabel(event.target.value)} placeholder="What it is, or a link" aria-label="Resource" />
            <Btn small disabled={!resourceLabel.trim()} onClick={() => { onChange({ resources: [...value.resources, { kind: resourceKind, label: resourceLabel.trim() }] }); setResourceLabel(""); }}>Add</Btn>
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-2 pt-1">
          <Btn small kind="danger" onClick={onClear}>Clear this week</Btn>
          {noted ? <p className="max-w-[240px] text-right text-[10.5px]" style={{ color: MUTED }}>A note is written for this week. Moving the topic carries it along.</p> : null}
        </div>
      </div>
    </Card>
  );
}
