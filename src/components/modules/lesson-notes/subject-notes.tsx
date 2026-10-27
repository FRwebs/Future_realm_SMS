"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Btn, Card, Chip, CARD_BORDER, Confirm, Empty, INK, MUTED, esc, inputClass, printSheet, statusTone, useToast, useWrite } from "@/components/modules/lesson-notes/kit";
import { LN_API, stateLabel, stateTone, type SubjectNotesData } from "@/lib/modules/lesson-notes-types";

type Show = "any" | "this" | "taught" | "ahead";
type StateFilter = "any" | "Not started" | "Draft" | "Submitted" | "Returned" | "Approved";

/** One subject's notes for a term: every planned week, with where its note stands, and the one-step ways to move several at once. */
export function SubjectNotes({ data }: { data: SubjectNotesData }) {
  const router = useRouter();
  const toast = useToast();
  const { busy, run } = useWrite(toast.show);
  const [show, setShow] = useState<Show>("any");
  const [state, setState] = useState<StateFilter>("any");
  const [confirm, setConfirm] = useState(false);
  const [chooser, setChooser] = useState("");

  const href = (week: number) => `/lesson-notes/notes/${data.subjectId}/${week}?term=${data.term.id}`;
  const rows = useMemo(
    () => data.weeks.filter((entry) => {
      if (state !== "any" && entry.state !== state) return false;
      if (show === "this") return data.term.current === entry.week;
      if (show === "taught") return entry.status === "Taught" || entry.status === "Partly taught";
      if (show === "ahead") return data.term.current === null ? data.term.phase === "before" : entry.week > data.term.current;
      return true;
    }),
    [data, show, state],
  );
  const count = (name: string) => data.weeks.filter((entry) => entry.state === name).length;
  const drafts = data.weeks.filter((entry) => entry.state === "Draft");
  const unwritten = data.weeks.filter((entry) => entry.state === "Not started" && (data.term.current === null ? data.term.phase === "after" : entry.week <= data.term.current));

  async function submitDrafts() {
    const result = await run<{ submitted: number[]; left: number[]; to: string }>("drafts", `${LN_API}/notes/subject/${data.subjectId}/submit-drafts`, "POST", { termId: data.term.id }, (r) => `${r.submitted.length} note${r.submitted.length === 1 ? "" : "s"} sent to ${r.to}.${r.left.length ? ` Week ${r.left.join(", ")} still need a required section.` : ""}`);
    setConfirm(false);
    if (result) router.refresh();
  }
  function printAll() {
    const body = `<table><tr><th>Wk</th><th>Dates</th><th>Topic</th><th>Status</th><th>Note</th></tr>${rows.map((r) => `<tr><td>${r.week}</td><td>${esc(r.dates)}</td><td>${esc(r.topic)}</td><td>${esc(r.status)}</td><td>${esc(stateLabel(r.state))}</td></tr>`).join("")}</table>`;
    if (!printSheet({ letterhead: data.letterhead, kicker: "Lesson notes", title: `${data.subject} · ${data.arms.join(", ")}`, sub: `${data.term.name}, ${data.term.session}`, body })) toast.show("Allow pop-ups to print.", "bad");
  }

  return (
    <div className="grid gap-4">
      {toast.node}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-extrabold" style={{ color: INK }}>{data.subject} <span className="font-semibold" style={{ color: MUTED }}>· {data.arms.join(", ")}</span></h2>
            <p className="mt-1 text-[11.5px]" style={{ color: MUTED }}>{data.term.name}, {data.term.session} · {data.weeks.length} planned week{data.weeks.length === 1 ? "" : "s"}{data.signer && !data.readOnly ? ` · signed by ${data.signer.name}` : ""}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data.terms.length > 1 ? (
              <div className="inline-flex rounded-[10px] border p-[3px]" style={{ borderColor: CARD_BORDER, background: "#F6F9F7" }}>
                {data.terms.map((term) => <Link key={term.id} href={`/lesson-notes/notes/${data.subjectId}?term=${term.id}` as Route} className="rounded-[8px] px-[11px] py-[5px] text-[11.5px] font-bold" style={term.id === data.term.id ? { background: INK, color: "#fff" } : { color: MUTED }}>{term.name}</Link>)}
              </div>
            ) : null}
            <Btn onClick={printAll}>Print</Btn>
            {!data.readOnly && drafts.length ? <Btn kind="primary" onClick={() => setConfirm(true)}>Submit {drafts.length} draft{drafts.length === 1 ? "" : "s"}</Btn> : null}
          </div>
        </div>
        {data.readOnly ? <p className="mt-3 rounded-[10px] px-3 py-2 text-[11.5px]" style={{ background: "#F5F0FA", color: "#6B4E9E" }}>You hold this on cover, so you read these notes and teach from them. They are not yours to write.</p> : null}
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {([["Not started", count("Not started"), "neutral"], ["Draft", count("Draft"), "progress"], ["With the reviewer", count("Submitted"), "submitted"], ["Returned", count("Returned"), "negative"], ["Signed", count("Approved"), "positive"]] as const).map(([label, value, tone]) => (
            <div key={label} className="rounded-[12px] border px-3 py-2.5" style={{ borderColor: CARD_BORDER }}><dt className="text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>{label}</dt><dd className="mt-0.5 text-[20px] font-extrabold" style={{ color: value && tone === "negative" ? "#B23B3B" : INK }}>{value}</dd></div>
          ))}
        </dl>
      </Card>

      {!data.weeks.length ? (
        <Empty title="No week is planned for this term yet" body="A note is written against a topic in the scheme of work. Plan the weeks first, then come back to write them." icon="M5 4.5h9.5A2.5 2.5 0 0 1 17 7v12.5H7.5A2.5 2.5 0 0 1 5 17zM9 8.5h5M9 12h5">
          {!data.readOnly ? <Link href={`/lesson-notes/curriculum?subject=${data.subjectId}&term=${data.term.id}` as Route} className="inline-flex rounded-[10px] px-[14px] py-[8px] text-[11.5px] font-bold text-white" style={{ background: INK }}>Open the scheme</Link> : null}
        </Empty>
      ) : (
        <Card pad={false}>
          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3" style={{ borderColor: CARD_BORDER }}>
            <label className="flex items-center gap-2 text-[11px] font-bold" style={{ color: MUTED }}>Show
              <select className={`${inputClass} w-auto!`} value={show} onChange={(event) => setShow(event.target.value as Show)}><option value="any">Any week</option><option value="this">This week</option><option value="taught">Taught</option><option value="ahead">To come</option></select>
            </label>
            <label className="flex items-center gap-2 text-[11px] font-bold" style={{ color: MUTED }}>Note
              <select className={`${inputClass} w-auto!`} value={state} onChange={(event) => setState(event.target.value as StateFilter)}><option value="any">Any state</option><option value="Not started">Not started</option><option value="Draft">Draft</option><option value="Submitted">With the reviewer</option><option value="Returned">Returned</option><option value="Approved">Signed</option></select>
            </label>
            {!data.readOnly && unwritten.length ? (
              <label className="ml-auto flex items-center gap-2 text-[11px] font-bold" style={{ color: MUTED }}>Write a note
                <select className={`${inputClass} w-auto!`} value={chooser} onChange={(event) => { setChooser(event.target.value); if (event.target.value) router.push(href(Number(event.target.value)) as Route); }}>
                  <option value="">Choose a week…</option>{unwritten.map((entry) => <option key={entry.week} value={entry.week}>Week {entry.week} — {entry.topic}</option>)}
                </select>
              </label>
            ) : null}
          </div>
          {rows.length ? (
            <ul>
              {rows.map((entry) => (
                <li key={entry.week} className="border-b last:border-b-0" style={{ borderColor: "#EDF3EF", background: entry.current ? "#F4FAF7" : undefined }}>
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="w-[64px] flex-none"><span className="block text-[12px] font-extrabold" style={{ color: INK }}>Wk {entry.week}</span><span className="block text-[10px]" style={{ color: MUTED }}>{entry.dates}</span></span>
                    <span className="min-w-[180px] flex-1">
                      <span className="block text-[12.5px] font-bold" style={{ color: INK }}>{entry.topic}{entry.version > 1 ? <span className="ml-1.5 text-[10px] font-semibold" style={{ color: MUTED }}>v{entry.version}</span> : null}</span>
                      <span className="block text-[10.5px]" style={{ color: MUTED }}>{entry.subtopics} sub-topic{entry.subtopics === 1 ? "" : "s"} · {entry.covered} covered · {entry.done} of {entry.of} sections written</span>
                      {entry.state === "Returned" && entry.reviewNote ? <span className="mt-1 block rounded-[8px] px-2 py-1 text-[11px]" style={{ background: "#FDF3F3", color: "#B23B3B" }}>Returned: {entry.reviewNote}</span> : null}
                    </span>
                    <Chip tone={statusTone(entry.status)}>{entry.status}</Chip>
                    <Chip tone={stateTone(entry.state)}>{stateLabel(entry.state)}</Chip>
                    <Link href={href(entry.week) as Route} className="rounded-[10px] border px-[12px] py-[6px] text-[11.5px] font-bold" style={{ borderColor: entry.state === "Not started" && !data.readOnly ? INK : "#CFDDD5", background: entry.state === "Not started" && !data.readOnly ? INK : "#fff", color: entry.state === "Not started" && !data.readOnly ? "#fff" : INK }}>
                      {data.readOnly ? "Read" : entry.state === "Not started" ? "Write" : entry.state === "Draft" || entry.state === "Returned" ? "Continue" : "Open"}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : <div className="p-6"><Empty title="No week matches" body="Nothing fits both filters. Try ‘Any week’ and ‘Any state’." icon="M3 5h18l-7 8v6l-4-2v-4z" /></div>}
        </Card>
      )}

      {confirm ? <Confirm title={`Submit ${drafts.length} draft${drafts.length === 1 ? "" : "s"}?`} body={`${data.signer ? `${data.signer.name} is told.` : "The reviewer is told."} A draft that is missing a required section stays a draft, and you are told which.`} confirm="Submit them" busy={busy === "drafts"} onConfirm={submitDrafts} onCancel={() => setConfirm(false)} /> : null}
    </div>
  );
}
