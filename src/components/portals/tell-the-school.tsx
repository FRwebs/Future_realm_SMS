"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { sendJsonForData } from "@/lib/modules/submit";

export type SubmissionOptions = { children: Array<{ id: string; name: string; arm: string; absences: Array<{ date: string; label: string }> }>; types: Array<{ name: string; target: number }> };
export type FamilySubmission = { id: string; type: string; child: string | null; detail: string; state: string; open: boolean; outcome: string | null; at: string; resolvedAt: string | null; with: string | null };

const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(iso));
const ABOUT_CHILD = ["Absence explanation", "Collection change", "Record correction", "Result query"];
const HINT: Record<string, string> = {
  "Absence explanation": "Your child’s form teacher reads this and decides. Tick the days you are explaining.",
  "Collection change": "Name who will collect your child and on which day. The form teacher checks it against the photo the school holds before agreeing.",
  "Contact update": "A new number or address. The school office updates the record.",
  "Record correction": "Something on your child’s record is wrong. The school office checks it.",
  "Result query": "A question about a score. The exam officer answers.",
  "Fee query": "A question about an invoice. The bursar answers.",
  "Meeting request": "Ask to meet the Principal.",
};

/** What a family tells the school, and where each thing stands: every submission has an owner and a clock from the moment it arrives. */
export function TellTheSchool({ options, submissions }: { options: SubmissionOptions; submissions: FamilySubmission[] }) {
  const router = useRouter();
  const [type, setType] = useState(options.types[0]?.name ?? "");
  const [child, setChild] = useState(options.children[0]?.id ?? "");
  const [dates, setDates] = useState<string[]>([]);
  const [detail, setDetail] = useState("");
  const [evidence, setEvidence] = useState("");
  const [collector, setCollector] = useState({ name: "", relation: "", phone: "", date: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const kid = options.children.find((entry) => entry.id === child);
  const aboutChild = ABOUT_CHILD.includes(type);
  const ready = detail.trim().length >= 8 && (!aboutChild || Boolean(child)) && (type !== "Absence explanation" || dates.length > 0) && (type !== "Collection change" || (collector.name && collector.relation && collector.phone && collector.date));
  const field = "w-full rounded-[10px] border border-(--color-border-default) bg-white px-3 py-2.5 text-[13px] outline-hidden focus:border-[#12796A]";
  const label = "text-[11px] font-bold uppercase tracking-[0.06em] text-(--color-text-muted)";
  const choices = useMemo(() => kid?.absences ?? [], [kid]);

  async function send() {
    setBusy(true);
    setMessage(null);
    try {
      await sendJsonForData("/api/v1/parent-portal/submissions", "POST", { type, child: aboutChild ? child : undefined, detail, evidence: evidence || undefined, dates: type === "Absence explanation" ? dates : [], collector: type === "Collection change" ? collector : undefined });
      setDetail(""); setEvidence(""); setDates([]); setCollector({ name: "", relation: "", phone: "", date: "" });
      setMessage({ ok: true, text: "Sent. The school has it, and a person now owns it — you can follow it below." });
      router.refresh();
    } catch (cause) {
      setMessage({ ok: false, text: cause instanceof Error ? cause.message : "That could not be sent." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <section className="surface-card grid gap-4 p-5">
        <div>
          <h2 className="text-[15px] font-extrabold text-(--color-text-primary)">Tell the school something</h2>
          <p className="mt-1 text-[12.5px] text-(--color-text-secondary)">{HINT[type] ?? "It goes to the person at the school who deals with it."}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5"><span className={label}>What it is about</span>
            <select value={type} onChange={(event) => { setType(event.target.value); setMessage(null); }} className={field}>{options.types.map((entry) => <option key={entry.name} value={entry.name}>{entry.name}</option>)}</select>
          </label>
          {aboutChild ? (
            <label className="grid gap-1.5"><span className={label}>Which child</span>
              <select value={child} onChange={(event) => { setChild(event.target.value); setDates([]); }} className={field}>{options.children.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.arm ? ` · ${entry.arm}` : ""}</option>)}</select>
            </label>
          ) : null}
        </div>
        {type === "Absence explanation" ? (
          <fieldset className="grid gap-2">
            <legend className={label}>The days you are explaining</legend>
            {choices.length ? (
              <div className="flex flex-wrap gap-2">
                {choices.map((entry) => (
                  <label key={entry.date} className="inline-flex cursor-pointer items-center gap-2 rounded-[9px] border border-(--color-border-default) bg-white px-3 py-2 text-[12.5px]">
                    <input type="checkbox" checked={dates.includes(entry.date)} onChange={() => setDates((current) => (current.includes(entry.date) ? current.filter((value) => value !== entry.date) : [...current, entry.date]))} />{entry.label}
                  </label>
                ))}
              </div>
            ) : <p className="text-[12.5px] text-(--color-text-secondary)">{kid?.name ?? "Your child"} has no unexplained absence on the school’s record this term, so there is nothing to explain.</p>}
          </fieldset>
        ) : null}
        {type === "Collection change" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5"><span className={label}>Who will collect</span><input value={collector.name} onChange={(event) => setCollector({ ...collector, name: event.target.value })} placeholder="Full name" className={field} /></label>
            <label className="grid gap-1.5"><span className={label}>Their relation to your child</span><input value={collector.relation} onChange={(event) => setCollector({ ...collector, relation: event.target.value })} placeholder="e.g. Aunt" className={field} /></label>
            <label className="grid gap-1.5"><span className={label}>Their phone number</span><input value={collector.phone} onChange={(event) => setCollector({ ...collector, phone: event.target.value })} inputMode="tel" className={field} /></label>
            <label className="grid gap-1.5"><span className={label}>On which day</span><input type="date" value={collector.date} onChange={(event) => setCollector({ ...collector, date: event.target.value })} className={field} /></label>
          </div>
        ) : null}
        <label className="grid gap-1.5"><span className={label}>What you want the school to know</span>
          <textarea value={detail} onChange={(event) => setDetail(event.target.value)} rows={4} placeholder="Write it as you would say it." className={field} /></label>
        {type === "Absence explanation" ? (
          <label className="grid gap-1.5"><span className={label}>What backs it up — optional</span>
            <input value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="e.g. Hospital card — bring it to the school if asked" className={field} /></label>
        ) : null}
        {message ? <p className="rounded-[9px] px-3 py-2 text-[12.5px]" style={message.ok ? { background: "#EAF6F0", color: "#17714F" } : { background: "#FDF3F3", color: "#B23B3B" }}>{message.text}</p> : null}
        <div className="flex justify-end">
          <button type="button" disabled={!ready || busy} onClick={() => void send()} className="rounded-[9px] bg-[#0D2315] px-5 py-2.5 text-[12.5px] font-semibold text-white disabled:opacity-50">{busy ? "Sending…" : "Send to the school"}</button>
        </div>
      </section>

      <section className="surface-card p-5">
        <h2 className="text-[15px] font-extrabold text-(--color-text-primary)">What you have sent</h2>
        {submissions.length ? (
          <ul className="mt-3 grid">
            {submissions.map((entry, index) => (
              <li key={entry.id} className="grid gap-1 py-3 text-[12.5px]" style={{ borderTop: index ? "1px solid var(--color-border-default)" : undefined }}>
                <span className="flex flex-wrap items-center gap-2">
                  <strong className="text-[13px] text-(--color-text-primary)">{entry.type}{entry.child ? ` · ${entry.child}` : ""}</strong>
                  <span className="rounded-full px-2 py-px text-[10.5px] font-bold" style={entry.state === "Resolved" ? { background: "#EAF6F0", color: "#17714F" } : entry.state === "Declined" ? { background: "#FDF3F3", color: "#B23B3B" } : { background: "#FDF6E7", color: "#8A6410" }}>{entry.state}</span>
                  <span className="text-[11px] text-(--color-text-muted)">Sent {day(entry.at)}{entry.with ? ` · with ${entry.with.toLowerCase()}` : ""}</span>
                </span>
                <span className="text-(--color-text-secondary)">{entry.detail}</span>
                {entry.outcome ? <span className="text-[#17714F]">The school: {entry.outcome}</span> : null}
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-[12.5px] text-(--color-text-secondary)">Nothing yet. What you send the school appears here, with who has it and what they decided.</p>}
      </section>
    </div>
  );
}
