"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { formatDay } from "@/lib/date-format";
import { sendJsonForData } from "@/lib/modules/submit";

export type InboxMessage = {
  id: string; title: string; preview: string; body: string[]; category: "Academic" | "Financial" | "Events" | "General" | "Safety";
  at: string; channel: string; read: boolean; acknowledgeAsked: boolean; acknowledgedAt: string | null;
  children: Array<{ id: string; first: string }>;
  replies: Array<{ id: string; text: string; at: string; state: string; outcome: string | null }>;
};
export type InboxProps = { school: string; you: string; messages: InboxMessage[]; showChildren: boolean; empty: string };

const TONE: Record<InboxMessage["category"], [string, string, string]> = {
  Academic: ["#EBF1FA", "#2A5A96", "#DCE7F5"], Financial: ["#FDF6E7", "#8A6410", "#F2E4C6"], Events: ["#EEEDFA", "#4A44A0", "#E1DFF4"],
  General: ["#F2F5F3", "#435048", "#E2E8E5"], Safety: ["#FDF3F3", "#B23B3B", "#F3D7D7"],
};
const when = (iso: string) => formatDay(new Date(iso), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
const channelName = (channel: string) => (channel === "SMS" ? "SMS" : channel === "EMAIL" ? "Email" : "In the portal");
const API = "/api/v1/parent-portal/messages";

function Pill({ category }: { category: InboxMessage["category"] }) {
  const [bg, fg, bd] = TONE[category];
  return <span className="rounded-full border px-[7px] py-[1.5px] text-[9.5px] font-bold" style={{ background: bg, color: fg, borderColor: bd }}>{category}</span>;
}

/** The school's messages as a list beside the one being read: opening one marks it read, a request to acknowledge is one tap, a reply goes to the office. */
export function ParentInbox({ school, you, messages, showChildren, empty }: InboxProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const query = search.trim().toLowerCase();
  const list = useMemo(() => messages.filter((message) => !query || `${message.title} ${message.body.join(" ")}`.toLowerCase().includes(query)), [messages, query]);
  const open = list.find((message) => message.id === selected) ?? (reading ? null : list[0] ?? null);
  const unread = messages.filter((message) => !message.read).length;

  async function call(id: string, kind: "read" | "acknowledge" | "reply") {
    setBusy(true);
    setNote(null);
    try {
      await sendJsonForData(`${API}/${id}/${kind}`, "POST", kind === "reply" ? { text: draft } : {});
      if (kind === "reply") setDraft("");
      router.refresh();
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  }
  async function readAll() {
    setBusy(true);
    try {
      await Promise.all(messages.filter((message) => !message.read).map((message) => sendJsonForData(`${API}/${message.id}/read`, "POST", {})));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  const choose = (message: InboxMessage) => {
    setSelected(message.id);
    setReading(true);
    setNote(null);
    setDraft("");
    if (!message.read) void call(message.id, "read");
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-[14px] border bg-(--color-bg-surface)" style={{ borderColor: "#DEE8E2" }}>
      <div className="flex flex-wrap items-center gap-[10px] border-b px-[16px] py-[10px]" style={{ borderColor: "#EDF3EF" }}>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search messages" aria-label="Search messages" className="min-w-[160px] flex-1 rounded-[9px] border px-[11px] py-[7px] text-[12px]" style={{ borderColor: "#CFDDD5" }} />
        <span className="text-[11px]" style={{ color: "#5E6D64" }}>{list.length} {list.length === 1 ? "message" : "messages"}</span>
        <button type="button" disabled={busy || !unread} onClick={() => void readAll()} className="rounded-[9px] border bg-white px-[12px] py-[6px] text-[11.5px] font-semibold disabled:opacity-50" style={{ borderColor: "#CFDDD5", color: "#435048" }}>Mark all as read</button>
      </div>
      {!list.length ? (
        <p className="px-[18px] py-[30px] text-center text-[12px]" style={{ color: "#5E6D64" }}>{query ? `No messages match “${search.trim()}”.` : empty}</p>
      ) : (
        <div className="grid md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.45fr)]">
          <ul className={`max-h-[640px] overflow-y-auto border-r-0 md:border-r ${reading ? "hidden md:block" : ""}`} style={{ borderColor: "#EDF3EF" }}>
            {list.map((message) => {
              const active = open?.id === message.id;
              return (
                <li key={message.id}>
                  <button type="button" onClick={() => choose(message)} aria-current={active} className="block w-full border-b px-[16px] py-[12px] text-left" style={{ borderColor: "#EDF3EF", background: active ? "#F1F7F4" : undefined, boxShadow: active ? "inset 3px 0 0 #12796A" : undefined }}>
                    <span className="flex items-center gap-[8px]">
                      <span aria-label={message.read ? "Read" : "Unread"} className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: message.read ? "transparent" : "#12796A" }} />
                      <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: "#0D2315", fontWeight: message.read ? 500 : 700 }}>{message.title}</span>
                      <span className="flex-none text-[10px] tabular-nums" style={{ color: "#5E6D64" }}>{when(message.at)}</span>
                    </span>
                    {message.preview ? <span className="mt-[3px] line-clamp-1 block pl-[15px] text-[11px]" style={{ color: "#5E6D64" }}>{message.preview}</span> : null}
                    <span className="mt-[6px] flex flex-wrap items-center gap-[5px] pl-[15px]">
                      <Pill category={message.category} />
                      {showChildren ? message.children.map((child) => <span key={child.id} className="rounded-full bg-[#F2F5F3] px-[7px] py-[1.5px] text-[9.5px] font-semibold" style={{ color: "#435048" }}>{child.first}</span>) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {open ? (
            <article className={`min-w-0 px-[20px] py-[16px] ${reading ? "" : "hidden md:block"}`}>
              <button type="button" onClick={() => setReading(false)} className="mb-[8px] text-[11.5px] font-semibold md:hidden" style={{ color: "#12796A" }}>← All messages</button>
              <div className="flex flex-wrap items-center gap-[6px]">
                <Pill category={open.category} />
                {open.children.map((child) => <span key={child.id} className="rounded-full bg-[#F2F5F3] px-[7px] py-[1.5px] text-[9.5px] font-semibold" style={{ color: "#435048" }}>{child.first}</span>)}
              </div>
              <h2 className="mt-[8px] text-[16px] font-bold leading-snug" style={{ color: "#0D2315" }}>{open.title}</h2>
              <p className="mt-[4px] text-[11px]" style={{ color: "#5E6D64" }}>From {school} · to {you} · {when(open.at)} · {channelName(open.channel)}</p>
              <div className="mt-[14px] grid gap-[10px] text-[12.5px] leading-[1.65]" style={{ color: "#1E2D24" }}>
                {open.body.map((line, index) => <p key={index} className="wrap-anywhere">{line}</p>)}
              </div>
              {open.category === "Safety" ? <p className="mt-[12px] rounded-[9px] px-[11px] py-[8px] text-[11px]" style={{ background: "#FDF3F3", color: "#B23B3B" }}>Safety message — it reaches you on every channel, whatever your settings and quiet hours.</p> : null}
              <div className="mt-[14px] flex flex-wrap items-center gap-[8px]">
                {open.acknowledgeAsked && !open.acknowledgedAt ? <button type="button" disabled={busy} onClick={() => void call(open.id, "acknowledge")} className="rounded-[9px] px-[14px] py-[8px] text-[12px] font-semibold text-white disabled:opacity-50" style={{ background: "#0D2315" }}>I have read this</button> : null}
                {open.acknowledgedAt ? <span className="rounded-full px-[9px] py-[3px] text-[10.5px] font-bold" style={{ background: "#EAF6F0", color: "#17714F" }}>You acknowledged it · {when(open.acknowledgedAt)}</span> : null}
                <Link href="/portals/parent/requests" className="rounded-[9px] border bg-white px-[14px] py-[8px] text-[12px] font-semibold" style={{ borderColor: "#CFDDD5", color: "#435048" }}>Ask about this</Link>
              </div>
              {open.replies.length ? (
                <ul className="mt-[14px] grid gap-[8px]">
                  {open.replies.map((reply) => (
                    <li key={reply.id} className="rounded-[10px] p-[10px] text-[12px]" style={{ background: "#F5F8F6" }}>
                      <span className="block text-[10.5px]" style={{ color: "#5E6D64" }}>You wrote · {when(reply.at)} · {reply.state}</span>
                      <span className="mt-[3px] block" style={{ color: "#0D2315" }}>{reply.text}</span>
                      {reply.outcome ? <span className="mt-[3px] block text-[11px]" style={{ color: "#17714F" }}>The school: {reply.outcome}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-[14px] grid gap-[6px]">
                <label htmlFor="parent-reply" className="text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: "#5E6D64" }}>Reply to the school</label>
                <textarea id="parent-reply" rows={3} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Your reply goes to the school office." className="rounded-[9px] border px-[11px] py-[8px] text-[12.5px]" style={{ borderColor: "#CFDDD5" }} />
                <div className="flex items-center justify-between gap-[10px]">
                  <span className="text-[10.5px]" style={{ color: "#5E6D64" }}>Replies reach the office, not a teacher’s phone.</span>
                  <button type="button" disabled={busy || draft.trim().length < 2} onClick={() => void call(open.id, "reply")} className="rounded-[9px] border bg-white px-[14px] py-[7px] text-[12px] font-semibold disabled:opacity-50" style={{ borderColor: "#CFDDD5", color: "#0D2315" }}>Send reply</button>
                </div>
                {note ? <p className="rounded-[9px] px-[10px] py-[7px] text-[11.5px]" style={{ background: "#FDF3F3", color: "#B23B3B" }}>{note}</p> : null}
              </div>
            </article>
          ) : null}
        </div>
      )}
    </section>
  );
}
