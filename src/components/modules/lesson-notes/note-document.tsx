"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Btn, Card, Chip, CARD_BORDER, Confirm, INK, Label, MUTED, GRID_DAYS, GRID_SLOTS, composeGrid, inputClass, longDate, notesHtml, parseGrid, printSheet, useToast, useWrite } from "@/components/modules/lesson-notes/kit";
import { GRID_SUFFIX, LN_API, stateLabel, stateTone, type Letterhead, type NoteData, type Section, type ThreadEntry } from "@/lib/modules/lesson-notes-types";

const has = (value: string | undefined) => Boolean((value ?? "").trim());

function Thread({ thread }: { thread: ThreadEntry[] }) {
  if (!thread.length) return null;
  const tone = (kind: string) => (kind === "RETURN" ? { bg: "#FDF3F3", fg: "#B23B3B" } : kind === "SIGN" ? { bg: "#EAF6F0", fg: "#17714F" } : kind === "REPLY" ? { bg: "#EBF1FA", fg: "#2A5A96" } : { bg: "#F2F7F4", fg: "#5F6E65" });
  return (
    <Card>
      <p className="text-[12.5px] font-extrabold" style={{ color: INK }}>The conversation</p>
      <ul className="mt-3 grid gap-2.5">
        {thread.map((entry) => (
          <li key={entry.id} className="rounded-[10px] px-3 py-2" style={{ background: tone(entry.kind).bg }}>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.05em]" style={{ color: tone(entry.kind).fg }}>{entry.kind === "RETURN" ? "Returned" : entry.kind === "SIGN" ? "Signed" : entry.kind === "REPLY" ? "Reply" : "Note"} · {entry.author} · {longDate(entry.at)}{entry.section ? ` · ${entry.section}` : ""}</p>
            <p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-[1.6]" style={{ color: INK }}>{entry.body}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ───────────────────────── writing ───────────────────────── */

export function NoteDocument({ data }: { data: NoteData }) {
  const router = useRouter();
  const toast = useToast();
  const { busy, run } = useWrite(toast.show);
  const editableState = data.state === "Not started" || data.state === "Draft" || data.state === "Returned";
  const editable = !data.readOnly && editableState;
  const [text, setText] = useState<Record<string, string>>(data.text);
  const [view, setView] = useState<"write" | "read">(editable ? "write" : "read");
  const [dirty, setDirty] = useState(false);
  const [reply, setReply] = useState("");
  const [confirm, setConfirm] = useState<null | "submit" | "withdraw" | "revise">(null);
  const [started, setStarted] = useState(data.state !== "Not started");

  /** The note's version when this page last read it; the server refuses a save made against an older one. */
  const [version, setVersion] = useState<string | null>(data.updatedAt);
  const [stale, setStale] = useState(false);

  useEffect(() => { setText(data.text); setDirty(false); setVersion(data.updatedAt); setStale(false); }, [data.text, data.planId, data.state, data.updatedAt]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const sections = data.sections;
  const written = sections.filter((section) => has(text[section.key]));
  const missing = sections.filter((section) => section.required && !has(text[section.key]));
  const nothing = !written.length;
  const base = `/lesson-notes/notes/${data.subjectId}`;
  const termQuery = `?term=${data.term.id}`;

  function set(key: string, value: string) {
    setText((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }
  async function save(quiet = false) {
    const result = await run<{ id: string; state: string; written: number; updatedAt: string }>("save", `${LN_API}/notes/${data.subjectId}/${data.week}`, "POST", { sections: text, termId: data.term.id, base: version }, quiet ? undefined : "Saved.", (message) => { if (/changed after you opened/i.test(message)) setStale(true); });
    if (result) { setDirty(false); setVersion(result.updatedAt); router.refresh(); }
    return result;
  }
  async function submit() {
    if (dirty || !data.planId) { const saved = await save(true); if (!saved) { setConfirm(null); return; } }
    const result = await run<{ to: string }>("submit", `${LN_API}/notes/${data.subjectId}/${data.week}/submit`, "POST", { reply: reply.trim() || undefined, termId: data.term.id }, (r) => `Sent to ${r.to} for signing.`);
    setConfirm(null);
    if (result) router.refresh();
  }
  async function withdraw() {
    const result = await run("withdraw", `${LN_API}/notes/${data.subjectId}/${data.week}/withdraw`, "POST", { termId: data.term.id }, "Withdrawn. You can edit it again.");
    setConfirm(null);
    if (result) router.refresh();
  }
  async function revise() {
    const result = await run<{ version: number }>("revise", `${LN_API}/notes/${data.subjectId}/${data.week}/revise`, "POST", { termId: data.term.id }, (r) => `Opened as version ${r.version}.`);
    setConfirm(null);
    if (result) router.refresh();
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s" && editable) { event.preventDefault(); void save(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editable, text]);

  const assist = (section: Section) => {
    const suggestion = data.draft[section.key];
    if (!suggestion) return toast.show("The scheme has nothing to draft this from yet. Add sub-topics or resources to the week.", "bad");
    set(section.key, has(text[section.key]) ? `${text[section.key]}\n\n${suggestion}` : suggestion);
    toast.show("Drafted from the scheme — edit it freely.");
  };
  const fromScheme = () => {
    const next = { ...text };
    for (const section of sections) if (!has(next[section.key]) && data.draft[section.key]) next[section.key] = data.draft[section.key]!;
    setText(next); setDirty(true); setStarted(true);
  };
  const reuse = () => {
    if (!data.reuse) return;
    const earlier = data.reuse.sections;
    setText({ ...text, ...Object.fromEntries(sections.flatMap((s) => [[s.key, earlier[s.key] ?? ""], ...(s.kind === "week-grid" && earlier[`${s.key}${GRID_SUFFIX}`] ? [[`${s.key}${GRID_SUFFIX}`, earlier[`${s.key}${GRID_SUFFIX}`]!]] : [])])) });
    setDirty(true);
    setStarted(true);
  };
  const setGrid = (key: string, day: string, slot: string, value: string) => {
    const grid = parseGrid(text[`${key}${GRID_SUFFIX}`]);
    grid[day] = { ...(grid[day] ?? {}), [slot]: value };
    setText((current) => ({ ...current, [`${key}${GRID_SUFFIX}`]: JSON.stringify(grid), [key]: composeGrid(grid) }));
    setDirty(true);
  };
  const hasDraft = useMemo(() => Object.values(data.draft).some(has), [data.draft]);

  return (
    <div className="grid gap-4">
      {toast.node}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: MUTED }}>{data.subject} · {data.arms.join(", ")} · week {data.week} of {data.weeks} · {data.dates}</p>
            <h2 className="mt-0.5 text-[18px] font-extrabold" style={{ color: INK }}>{data.topic}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Chip tone={stateTone(data.state)}>{stateLabel(data.state)}</Chip>
              {data.version > 1 ? <span className="text-[11px] font-semibold" style={{ color: MUTED }}>Version {data.version}</span> : null}
              {data.signedBy ? <span className="text-[11px]" style={{ color: MUTED }}>Signed by {data.signedBy}{data.signedAt ? ` on ${longDate(data.signedAt)}` : ""}</span> : null}
              {data.submittedAt && data.state === "Submitted" ? <span className="text-[11px]" style={{ color: MUTED }}>With {data.signer?.name ?? "the reviewer"} since {longDate(data.submittedAt)}</span> : null}
              {dirty ? <span className="text-[11px] font-bold" style={{ color: "#8A6410" }}>Unsaved changes</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-[10px] border p-[3px]" style={{ borderColor: CARD_BORDER, background: "#F6F9F7" }}>
              {(["write", "read"] as const).map((mode) => <button key={mode} type="button" disabled={mode === "write" && !editable} onClick={() => setView(mode)} className="rounded-[8px] px-[12px] py-[5px] text-[11.5px] font-bold disabled:opacity-40" style={view === mode ? { background: INK, color: "#fff" } : { color: MUTED }}>{mode === "write" ? "Write" : "Read"}</button>)}
            </div>
            <Btn onClick={() => { if (!printSheet({ letterhead: data.letterhead, kicker: data.earlyYears ? "Weekly plan" : "Lesson note", title: `${data.subject} · week ${data.week} — ${data.topic}`, sub: `${data.arms.join(", ")} · ${data.dates} · ${data.term.name}, ${data.term.session} · ${stateLabel(data.state)}${data.version > 1 ? ` · version ${data.version}` : ""}`, body: notesHtml(sections, text), by: data.person })) toast.show("Allow pop-ups to print.", "bad"); }}>Print</Btn>
            {data.previous ? <Link href={`${base}/${data.previous.week}${termQuery}` as Route} title={data.previous.topic} className="rounded-[10px] border px-[11px] py-[8px] text-[11.5px] font-semibold" style={{ borderColor: "#CFDDD5", color: "#435048" }}>← Wk {data.previous.week}</Link> : null}
            {data.next ? <Link href={`${base}/${data.next.week}${termQuery}` as Route} title={data.next.topic} className="rounded-[10px] border px-[11px] py-[8px] text-[11.5px] font-semibold" style={{ borderColor: "#CFDDD5", color: "#435048" }}>Wk {data.next.week} →</Link> : null}
          </div>
        </div>
        {data.readOnly ? <p className="mt-3 rounded-[10px] px-3 py-2 text-[11.5px]" style={{ background: "#F5F0FA", color: "#6B4E9E" }}>You hold this class on cover, so you read the note and teach from it. It is not yours to change.</p> : null}
      </Card>

      {data.returned ? (
        <div className="rounded-[14px] border p-4" style={{ borderColor: "#F3E0E0", background: "#FDF3F3" }}>
          <p className="text-[12.5px] font-extrabold" style={{ color: "#B23B3B" }}>Returned for rework{data.returned.section ? ` · ${sections.find((s) => s.key === data.returned!.section)?.label ?? data.returned.section}` : ""}</p>
          <p className="mt-1 whitespace-pre-wrap text-[12px] leading-[1.65]" style={{ color: "#7A2A2A" }}>{data.returned.note || "No comment was left."}</p>
          {data.returned.at ? <p className="mt-1 text-[10.5px]" style={{ color: "#B23B3B" }}>{longDate(data.returned.at)}</p> : null}
        </div>
      ) : null}
      {data.state === "Submitted" && data.resubmitReply ? <div className="rounded-[14px] border p-4" style={{ borderColor: "#DCE7F5", background: "#EBF1FA" }}><p className="text-[12px] font-extrabold" style={{ color: "#2A5A96" }}>What you changed</p><p className="mt-1 text-[12px]" style={{ color: INK }}>{data.resubmitReply}</p></div> : null}

      {stale ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border p-4 text-[12px]" style={{ borderColor: "#F3E0E0", background: "#FDF3F3", color: "#B23B3B" }}><span><b>This note was changed after you opened it</b> — in another tab or on another device. Yours was not saved, so theirs was not overwritten. Copy what you want to keep, then reload.</span><Btn small onClick={() => { setStale(false); router.refresh(); }}>Reload the latest</Btn></div> : null}

      {editable && view === "write" && nothing && !started ? (
        <Card>
          <p className="text-[13px] font-extrabold" style={{ color: INK }}>How do you want to start?</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <button type="button" disabled={!data.reuse} onClick={reuse} className="rounded-[12px] border p-4 text-left disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: CARD_BORDER }}><span className="block text-[12.5px] font-extrabold" style={{ color: INK }}>Reuse last session’s note</span><span className="mt-1 block text-[11.5px] leading-[1.6]" style={{ color: MUTED }}>{data.reuse ? `You taught “${data.topic}” in ${data.reuse.term}${data.reuse.session ? `, ${data.reuse.session}` : ""}. Start from that signed note and change what has moved.` : "You have no signed note on this topic from an earlier term."}</span></button>
            <button type="button" disabled={!hasDraft} onClick={fromScheme} className="rounded-[12px] border p-4 text-left disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: CARD_BORDER }}><span className="block text-[12.5px] font-extrabold" style={{ color: INK }}>Draft from the scheme</span><span className="mt-1 block text-[11.5px] leading-[1.6]" style={{ color: MUTED }}>{hasDraft ? "Fills what the scheme already says — objectives from the sub-topics, resources, an assignment. Nothing is invented." : "The scheme has no sub-topics or resources for this week to draft from."}</span></button>
            <button type="button" onClick={() => setStarted(true)} className="rounded-[12px] border p-4 text-left" style={{ borderColor: CARD_BORDER }}><span className="block text-[12.5px] font-extrabold" style={{ color: INK }}>Start blank</span><span className="mt-1 block text-[11.5px] leading-[1.6]" style={{ color: MUTED }}>Write each section yourself.</span></button>
          </div>
        </Card>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
          {sections.map((section, index) => {
            const flagged = data.returned?.section === section.key;
            return (
              <Card key={section.key} className={flagged ? "!border-[#E9B8B8]" : ""}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12.5px] font-extrabold" style={{ color: INK }}><span className="mr-1.5 text-[11px]" style={{ color: MUTED }}>{index + 1}</span>{section.label}{section.required ? <span className="ml-2 rounded-full px-[7px] py-[1px] text-[9.5px] font-bold uppercase" style={{ background: "#FDF6E7", color: "#8A6410" }}>Required</span> : null}</p>
                  {editable && view === "write" && section.assist ? <button type="button" onClick={() => assist(section)} className="rounded-full border px-[10px] py-[3px] text-[10.5px] font-bold" style={{ borderColor: "#CFE4DB", color: "#17714F", background: "#F2FAF6" }}>✦ {section.assist}</button> : null}
                </div>
                {section.kind === "week-grid" ? (
                  <WeekGridView grid={parseGrid(text[`${section.key}${GRID_SUFFIX}`])} fallback={text[section.key]} hint={section.hint} editable={view === "write" && editable} onChange={(day, slot, value) => setGrid(section.key, day, slot, value)} required={section.required} />
                ) : view === "write" && editable ? (
                  <>
                    <p className="mt-1 text-[11px]" style={{ color: MUTED }}>{section.hint}</p>
                    <textarea className={`${inputClass} mt-2 min-h-[110px] leading-[1.65]`} value={text[section.key] ?? ""} onChange={(event) => set(section.key, event.target.value)} placeholder={section.placeholder} aria-label={section.label} />
                  </>
                ) : has(text[section.key]) ? (
                  <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-[1.75]" style={{ color: INK }}>{text[section.key]}</p>
                ) : (
                  <p className="mt-2 text-[12px] italic" style={{ color: MUTED }}>{section.required ? "Required, and not written." : "Not written."}</p>
                )}
              </Card>
            );
          })}
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 lg:sticky lg:top-4">
          {/* actions */}
          <Card>
            <p className="text-[12.5px] font-extrabold" style={{ color: INK }}>{data.state === "Approved" ? "Signed" : data.state === "Submitted" ? "With the reviewer" : "Before you submit"}</p>
            <ul className="mt-2 grid gap-1.5">
              {sections.filter((s) => s.required).map((section) => <li key={section.key} className="flex items-center gap-2 text-[12px]" style={{ color: has(text[section.key]) ? "#17714F" : "#8A6410" }}><span aria-hidden>{has(text[section.key]) ? "✓" : "○"}</span>{section.label}</li>)}
              <li className="text-[11px]" style={{ color: MUTED }}>{written.length} of {sections.length} sections written</li>
            </ul>
            <div className="mt-3 grid gap-2">
              {editable ? (
                <>
                  {data.state === "Returned" ? <label className="block"><Label>What you changed</Label><textarea className={`${inputClass} min-h-[70px]`} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="The reviewer reads this beside the note." /></label> : null}
                  <Btn busy={busy === "save"} disabled={!dirty} onClick={() => save()}>Save draft</Btn>
                  <Btn kind="primary" disabled={Boolean(missing.length) || (data.state === "Returned" && !reply.trim())} onClick={() => setConfirm("submit")} title={missing.length ? `Still required: ${missing.map((s) => s.label).join(", ")}` : undefined}>{data.state === "Returned" ? "Resubmit for signing" : "Submit for signing"}</Btn>
                  {data.signer ? <p className="text-[10.5px]" style={{ color: MUTED }}>{data.signer.name} signs it. They never edit it.</p> : <p className="text-[10.5px]" style={{ color: "#8A6410" }}>No one is named to sign notes yet, so a submitted note will wait.</p>}
                </>
              ) : null}
              {!data.readOnly && data.state === "Submitted" ? <Btn onClick={() => setConfirm("withdraw")}>Withdraw to edit</Btn> : null}
              {!data.readOnly && data.state === "Approved" ? <><Btn onClick={() => setConfirm("revise")}>Revise this note</Btn><p className="text-[10.5px]" style={{ color: MUTED }}>Revising makes version {data.version + 1}, which goes for signing again.</p></> : null}
            </div>
          </Card>

          {/* scheme */}
          <Card>
            <p className="text-[12.5px] font-extrabold" style={{ color: INK }}>From the scheme</p>
            {data.subtopics.length ? <ul className="mt-2 grid gap-1">{data.subtopics.map((sub) => <li key={sub.name} className="flex gap-2 text-[12px]" style={{ color: INK }}><span aria-hidden style={{ color: sub.covered ? "#17714F" : MUTED }}>{sub.covered ? "✓" : "○"}</span>{sub.name}</li>)}</ul> : <p className="mt-2 text-[11.5px]" style={{ color: MUTED }}>No sub-topics are listed for this week.</p>}
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 text-[12px]">
              <div><dt className="text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>Status</dt><dd className="font-semibold" style={{ color: INK }}>{data.schemeStatus}</dd></div>
              <div><dt className="text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>Assessment</dt><dd className="font-semibold" style={{ color: INK }}>{data.assessment ?? "None set"}</dd></div>
              <div><dt className="text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>Periods</dt><dd className="font-semibold" style={{ color: INK }}>{data.periods ?? "The usual"}</dd></div>
              <div><dt className="text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>Term</dt><dd className="font-semibold" style={{ color: INK }}>{data.term.name}</dd></div>
            </dl>
            {data.taughtTo.length ? (
              <div className="mt-3"><Label>Taught to</Label><ul className="grid gap-1">{data.taughtTo.map((arm) => <li key={arm.arm} className="flex items-center justify-between text-[12px]"><span style={{ color: INK }}>{arm.arm}</span><Chip tone={arm.taught ? "positive" : arm.covered ? "attention" : "neutral"}>{arm.taught ? "Taught" : arm.covered ? `${arm.covered} of ${arm.of}` : "Not yet"}</Chip></li>)}</ul></div>
            ) : null}
            {data.resources.length ? <div className="mt-3"><Label>Resources in the scheme</Label><ul className="grid gap-1 text-[12px]">{data.resources.map((resource, index) => <li key={index} style={{ color: INK }}><span className="mr-1.5 text-[10px] font-bold" style={{ color: MUTED }}>{resource.kind}</span>{resource.label}</li>)}</ul></div> : null}
            <p className="mt-3 text-[11px]"><Link href={`/lesson-notes/curriculum?subject=${data.subjectId}&term=${data.term.id}&week=${data.week}` as Route} className="font-semibold underline" style={{ color: INK }}>Open the scheme at this week</Link></p>
          </Card>

          <Thread thread={data.thread} />
        </div>
      </div>

      {confirm === "submit" ? <Confirm title={data.state === "Returned" ? "Resubmit this note?" : "Submit this note for signing?"} body={`${data.signer ? `${data.signer.name} is told.` : "It waits for a reviewer."} Once submitted it cannot be edited unless you withdraw it.`} confirm="Submit" busy={busy === "submit" || busy === "save"} onConfirm={submit} onCancel={() => setConfirm(null)} /> : null}
      {confirm === "withdraw" ? <Confirm title="Withdraw this note?" body="It comes back to you as a draft, and the reviewer no longer sees it." confirm="Withdraw" busy={busy === "withdraw"} onConfirm={withdraw} onCancel={() => setConfirm(null)} /> : null}
      {confirm === "revise" ? <Confirm title="Revise this signed note?" body={`It becomes version ${data.version + 1} and must be signed again. Until then the earlier signature is not shown.`} confirm="Open for revision" busy={busy === "revise"} onConfirm={revise} onCancel={() => setConfirm(null)} /> : null}
    </div>
  );
}

/* ───────────────────────── reading (history, review) ───────────────────────── */

export type ReaderData = {
  id: string; subject: string; topic: string; week: number; term: string; version: number; arms: string[]; teacher?: string; signedBy?: string | null; signedAt?: string | null;
  state: string; sections: Section[]; text: Record<string, string>; thread: ThreadEntry[]; letterhead: Letterhead;
  review?: { own: boolean; canSign: boolean; resubmitReply?: string | null };
  back: { label: string; href: string };
};

/** A note as a colleague or reviewer reads it. A reviewer may sign it or return it with what to change; nobody here edits. */
export function NoteReader({ data }: { data: ReaderData }) {
  const router = useRouter();
  const toast = useToast();
  const { busy, run } = useWrite(toast.show);
  const [panel, setPanel] = useState<null | "sign" | "return">(null);
  const [section, setSection] = useState("");
  const [comment, setComment] = useState("");

  async function decide(decision: "sign" | "return") {
    const result = await run(decision, `${LN_API}/notes/review/${data.id}/decide`, "POST", { decision, note: comment.trim() || undefined, section: section || undefined }, decision === "sign" ? "Signed. The teacher is told." : "Returned. The teacher is told.");
    setPanel(null);
    if (result) { router.push(data.back.href as Route); router.refresh(); }
  }

  return (
    <div className="grid gap-4">
      {toast.node}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: MUTED }}>{data.subject} · {data.arms.join(", ")} · week {data.week} · {data.term}</p>
            <h2 className="mt-0.5 text-[18px] font-extrabold" style={{ color: INK }}>{data.topic}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Chip tone={stateTone(data.state)}>{stateLabel(data.state)}</Chip>
              {data.version > 1 ? <span className="text-[11px] font-semibold" style={{ color: MUTED }}>Version {data.version}</span> : null}
              {data.teacher ? <span className="text-[11px]" style={{ color: MUTED }}>Written by {data.teacher}</span> : null}
              {data.signedBy ? <span className="text-[11px]" style={{ color: MUTED }}>Signed by {data.signedBy}{data.signedAt ? ` on ${longDate(data.signedAt)}` : ""}</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => { if (!printSheet({ letterhead: data.letterhead, kicker: "Lesson note", title: `${data.subject} · week ${data.week} — ${data.topic}`, sub: `${data.arms.join(", ")} · ${data.term} · ${stateLabel(data.state)}${data.version > 1 ? ` · version ${data.version}` : ""}${data.teacher ? ` · written by ${data.teacher}` : ""}`, body: notesHtml(data.sections, data.text) })) toast.show("Allow pop-ups to print.", "bad"); }}>Print</Btn>
            {data.review?.canSign ? <><Btn kind="danger" onClick={() => setPanel("return")}>Return it</Btn><Btn kind="primary" onClick={() => setPanel("sign")}>Sign the note</Btn></> : null}
          </div>
        </div>
        {data.review?.own ? <p className="mt-3 rounded-[10px] px-3 py-2 text-[11.5px]" style={{ background: "#FDF6E7", color: "#8A6410" }}>You wrote this note, so someone else signs it — it goes to the academic lead.</p> : null}
        {data.review?.resubmitReply ? <p className="mt-3 rounded-[10px] px-3 py-2 text-[11.5px]" style={{ background: "#EBF1FA", color: "#2A5A96" }}><b>What the teacher changed:</b> {data.review.resubmitReply}</p> : null}
      </Card>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
          {data.sections.map((entry, index) => (
            <Card key={entry.key}>
              <p className="text-[12.5px] font-extrabold" style={{ color: INK }}><span className="mr-1.5 text-[11px]" style={{ color: MUTED }}>{index + 1}</span>{entry.label}{entry.required ? <span className="ml-2 rounded-full px-[7px] py-[1px] text-[9.5px] font-bold uppercase" style={{ background: "#FDF6E7", color: "#8A6410" }}>Required</span> : null}</p>
              {has(data.text[entry.key]) ? <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-[1.75]" style={{ color: INK }}>{data.text[entry.key]}</p> : <p className="mt-2 text-[12px] italic" style={{ color: MUTED }}>{entry.required ? "Required, and not written." : "Not written."}</p>}
            </Card>
          ))}
        </div>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 lg:sticky lg:top-4"><Thread thread={data.thread} /></div>
      </div>
      {panel === "sign" ? <Confirm title="Sign this note?" body="The teacher is told, and it is ready to teach from." confirm="Sign it" busy={busy === "sign"} onConfirm={() => decide("sign")} onCancel={() => setPanel(null)}><label className="mt-3 block"><Label>A word for the teacher (optional)</Label><textarea className={`${inputClass} min-h-[60px]`} value={comment} onChange={(event) => setComment(event.target.value)} /></label></Confirm> : null}
      {panel === "return" ? (
        <Confirm title="Return this note" body="Say what to change. The teacher sees it beside the section." confirm="Return it" danger busy={busy === "return"} onConfirm={() => { if (!comment.trim()) return toast.show("Say what to change — a return without a comment cannot be acted on.", "bad"); void decide("return"); }} onCancel={() => setPanel(null)}>
          <label className="mt-3 block"><Label>Section</Label><select className={inputClass} value={section} onChange={(event) => setSection(event.target.value)}><option value="">Not one section</option>{data.sections.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
          <label className="mt-3 block"><Label>What to change</Label><textarea className={`${inputClass} min-h-[80px]`} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Be specific." /></label>
        </Confirm>
      ) : null}
    </div>
  );
}

/** An early-years week as a grid: the days down the side, the parts of the day across. Reads as a table when it is only being read. */
function WeekGridView({ grid, fallback, hint, editable, onChange, required }: { grid: ReturnType<typeof parseGrid>; fallback?: string; hint: string; editable: boolean; onChange: (day: string, slot: string, value: string) => void; required: boolean }) {
  const filled = Object.values(grid).some((day) => Object.values(day).some((cell) => cell.trim()));
  if (!editable && !filled) {
    return has(fallback) ? <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-[1.75]" style={{ color: INK }}>{fallback}</p> : <p className="mt-2 text-[12px] italic" style={{ color: MUTED }}>{required ? "Required, and not written." : "Not written."}</p>;
  }
  return (
    <div>
      {editable ? <p className="mt-1 text-[11px]" style={{ color: MUTED }}>{hint} Fill the parts of each day you plan; leave the rest empty.</p> : null}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-[5px] text-[11.5px]">
          <thead><tr><th className="w-[84px]" />{GRID_SLOTS.map((slot) => <th key={slot} className="text-left text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>{slot}</th>)}</tr></thead>
          <tbody>
            {GRID_DAYS.map((day) => (
              <tr key={day}>
                <th className="text-left align-top text-[11.5px] font-extrabold" style={{ color: INK }}>{day}</th>
                {GRID_SLOTS.map((slot) => {
                  const value = grid[day]?.[slot] ?? "";
                  return (
                    <td key={slot} className="align-top">
                      {editable ? <textarea className={`${inputClass} !min-h-[62px] !px-2 !py-1.5 !text-[11.5px]`} value={value} onChange={(event) => onChange(day, slot, event.target.value)} aria-label={`${day} ${slot}`} /> : <div className="min-h-[34px] rounded-[8px] border px-2 py-1.5" style={{ borderColor: value ? "#DCE7E0" : "#EEF3F0", background: value ? "#fff" : "#FAFCFB", color: INK }}>{value}</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
