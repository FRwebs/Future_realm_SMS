"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { sendJsonForData } from "@/lib/modules/submit";

export type FamilyMessage = {
  id: string; text: string; channel: string; at: string; read: boolean; acknowledgeAsked: boolean; acknowledgedAt: string | null;
  replies: Array<{ id: string; text: string; at: string; state: string; outcome: string | null }>;
};

const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso));
const channelName = (channel: string) => (channel === "SMS" ? "SMS" : channel === "EMAIL" ? "Email" : "In-app");

/**
 * What the school has written to this family. A message is marked read the moment it is opened, a request to acknowledge is one tap, and a
 * reply goes to the school office — the family is told so, and sees where their reply stands.
 */
export function FamilyMessages({ school, messages }: { school: string; messages: FamilyMessage[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, kind: "read" | "acknowledge" | "reply") {
    setBusy(`${kind}:${id}`);
    setNote((current) => ({ ...current, [id]: "" }));
    try {
      await sendJsonForData(`/api/v1/parent-portal/messages/${id}/${kind}`, "POST", kind === "reply" ? { text: draft[id] ?? "" } : {});
      if (kind === "reply") setDraft((current) => ({ ...current, [id]: "" }));
      router.refresh();
    } catch (cause) {
      setNote((current) => ({ ...current, [id]: cause instanceof Error ? cause.message : "That did not go through." }));
    } finally {
      setBusy(null);
    }
  }
  function toggle(message: FamilyMessage) {
    const next = open === message.id ? null : message.id;
    setOpen(next);
    if (next && !message.read) void act(message.id, "read");
  }

  if (!messages.length) {
    return (
      <section className="surface-card p-6 text-center">
        <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Nothing from the school yet</p>
        <p className="mt-1 text-[12.5px] text-[var(--color-text-secondary)]">When your child’s teacher or the office writes to you, it appears here.</p>
      </section>
    );
  }
  return (
    <ul className="grid gap-3">
      {messages.map((message) => {
        const expanded = open === message.id;
        return (
          <li key={message.id} className="surface-card overflow-hidden">
            <button type="button" onClick={() => toggle(message)} aria-expanded={expanded} className="flex w-full items-start gap-3 p-4 text-left">
              <span className="mt-[6px] h-[8px] w-[8px] flex-none rounded-full" style={{ background: message.read ? "#D5E0DA" : "#12796A" }} aria-label={message.read ? "Read" : "Unread"} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                  <strong className="text-[12px] text-[var(--color-text-primary)]">{school}</strong>
                  <span>{when(message.at)}</span><span>· {channelName(message.channel)}</span>
                  {message.acknowledgeAsked && !message.acknowledgedAt ? <span className="rounded-full bg-[#FDF6E7] px-2 py-[1px] font-bold text-[#8A6410]">Asks you to acknowledge</span> : null}
                  {message.acknowledgedAt ? <span className="rounded-full bg-[#EAF6F0] px-2 py-[1px] font-bold text-[#17714F]">Acknowledged</span> : null}
                </span>
                <span className={`mt-1 block text-[13px] leading-[1.55] [overflow-wrap:anywhere] ${expanded ? "whitespace-pre-wrap" : "line-clamp-2"} text-[var(--color-text-primary)] ${message.read ? "" : "font-semibold"}`}>{message.text}</span>
              </span>
            </button>
            {expanded ? (
              <div className="grid gap-3 border-t border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                {message.replies.length ? (
                  <ul className="grid gap-2">
                    {message.replies.map((reply) => (
                      <li key={reply.id} className="rounded-[10px] bg-white p-3 text-[12.5px]">
                        <span className="block text-[11px] text-[var(--color-text-muted)]">You wrote · {when(reply.at)} · {reply.state}</span>
                        <span className="mt-1 block text-[var(--color-text-primary)]">{reply.text}</span>
                        {reply.outcome ? <span className="mt-1 block text-[11.5px] text-[#17714F]">The school: {reply.outcome}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {message.acknowledgeAsked && !message.acknowledgedAt ? (
                  <button type="button" disabled={busy !== null} onClick={() => void act(message.id, "acknowledge")} className="justify-self-start rounded-[9px] bg-[#0D2315] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50">{busy === `acknowledge:${message.id}` ? "Saving…" : "I have read this"}</button>
                ) : null}
                <div className="grid gap-2">
                  <label className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-muted)]" htmlFor={`reply-${message.id}`}>Reply to the school</label>
                  <textarea id={`reply-${message.id}`} value={draft[message.id] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, [message.id]: event.target.value }))} rows={3} placeholder="Your reply goes to the school office." className="w-full rounded-[10px] border border-[var(--color-border-default)] bg-white p-3 text-[13px] outline-none focus:border-[#12796A]" />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-[var(--color-text-muted)]">Replies reach the office, not your child’s teacher’s phone.</span>
                    <button type="button" disabled={busy !== null || (draft[message.id] ?? "").trim().length < 2} onClick={() => void act(message.id, "reply")} className="rounded-[9px] border border-[var(--color-border-default)] bg-white px-4 py-2 text-[12px] font-semibold text-[var(--color-text-primary)] disabled:opacity-50">{busy === `reply:${message.id}` ? "Sending…" : "Send reply"}</button>
                  </div>
                </div>
                {note[message.id] ? <p className="rounded-[9px] bg-[#FDF3F3] px-3 py-2 text-[12px] text-[#B23B3B]">{note[message.id]}</p> : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
