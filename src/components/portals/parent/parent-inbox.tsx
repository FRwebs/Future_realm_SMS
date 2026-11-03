"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
  // The phone's chips narrow the list; the laptop has none, so on a laptop this stays "All".
  const [only, setOnly] = useState<string>("All");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const query = search.trim().toLowerCase();
  const list = useMemo(
    () => messages.filter((message) => (!query || `${message.title} ${message.body.join(" ")}`.toLowerCase().includes(query)) && (only === "All" || (only === "Unread" ? !message.read : message.category === only))),
    [messages, query, only],
  );
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
  // The phone's top bar has a tick for this; it asks here because the messages are here.
  useEffect(() => {
    const run = () => { if (unread && !busy) void readAll(); };
    window.addEventListener("fr:bar-read-all", run);
    return () => window.removeEventListener("fr:bar-read-all", run);
  });
  const choose = (message: InboxMessage) => {
    setSelected(message.id);
    setReading(true);
    setNote(null);
    setDraft("");
    if (!message.read) void call(message.id, "read");
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-[14px] border bg-(--color-bg-surface) max-md:overflow-visible max-md:rounded-none max-md:border-0 max-md:bg-transparent" style={{ borderColor: "#DEE8E2" }}>
      <div className="flex flex-wrap items-center gap-[10px] border-b px-[16px] py-[10px] max-md:border-0 max-md:px-0 max-md:pt-0" style={{ borderColor: "#EDF3EF" }}>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search messages" aria-label="Search messages" className="min-w-[160px] flex-1 rounded-[9px] border px-[11px] py-[7px] text-[12px] max-md:h-[48px] max-md:rounded-[16px] max-md:border-0 max-md:bg-white max-md:px-[16px] max-md:text-[14px] max-md:shadow-[0_1px_2px_rgba(13,35,21,0.05),0_8px_22px_-16px_rgba(13,35,21,0.22)]" style={{ borderColor: "#CFDDD5" }} />
        <span className="text-[11px] max-md:hidden" style={{ color: "#5E6D64" }}>{list.length} {list.length === 1 ? "message" : "messages"}</span>
        <button type="button" disabled={busy || !unread} onClick={() => void readAll()} className="rounded-[9px] border bg-white px-[12px] py-[6px] text-[11.5px] font-semibold disabled:opacity-50 max-md:hidden" style={{ borderColor: "#CFDDD5", color: "#435048" }}>Mark all as read</button>
      </div>
      <div className="-mx-4 mb-[14px] flex gap-[8px] overflow-x-auto px-4 pb-[2px] md:hidden" style={{ scrollbarWidth: "none" }} role="tablist" aria-label="Kind of message">
        {["All", "Unread", "Academic", "Financial", "Events", "General", "Safety"].map((name) => (
          <button key={name} type="button" role="tab" aria-selected={only === name} onClick={() => setOnly(name)} className="flex min-h-[42px] flex-none items-center gap-[7px] rounded-full border px-[16px] text-[14px] font-bold" style={only === name ? { background: "#E3F1EA", borderColor: "#5FBF9F", color: "#0D2315" } : { background: "#fff", borderColor: "#E4EDE8", color: "#435048" }}>
            {name}
            {name === "Unread" && unread ? <span className="rounded-full bg-[#EDF3EF] px-[7px] text-[11px] font-black">{unread}</span> : null}
          </button>
        ))}
      </div>
      <div className="mb-[10px] flex items-center justify-between px-[2px] md:hidden">
        <h2 className="text-[16px] font-extrabold" style={{ color: "#0D2315" }}>{only === "All" ? "Everything" : only} <span className="ml-[6px] rounded-full bg-[#EDF3EF] px-[8px] py-[2px] text-[11px] font-bold" style={{ color: "#435048" }}>{list.length} {list.length === 1 ? "message" : "messages"}</span></h2>
        <button type="button" disabled={busy || !unread} onClick={() => void readAll()} className="text-[13px] font-extrabold disabled:opacity-40" style={{ color: "#12796A" }}>Mark all read</button>
      </div>
      {!list.length ? (
        <p className="px-[18px] py-[30px] text-center text-[12px]" style={{ color: "#5E6D64" }}>{query ? `No messages match “${search.trim()}”.` : empty}</p>
      ) : (
        <div className="grid md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.45fr)]">
          <ul className={`max-h-[640px] overflow-y-auto border-r-0 md:border-r max-md:max-h-none max-md:overflow-hidden max-md:rounded-[20px] max-md:bg-white max-md:shadow-[0_1px_2px_rgba(13,35,21,0.05),0_8px_22px_-14px_rgba(13,35,21,0.22)] ${reading ? "hidden md:block" : ""}`} style={{ borderColor: "#EDF3EF" }}>
            {list.map((message) => {
              const active = open?.id === message.id;
              return (
                <li key={message.id}>
                  <button type="button" onClick={() => choose(message)} aria-current={active} className="block w-full border-b px-[16px] py-[12px] text-left max-md:px-[14px] max-md:py-[14px] max-md:last:border-b-0" style={{ borderColor: "#EDF3EF", background: active ? "#F1F7F4" : undefined, boxShadow: active ? "inset 3px 0 0 #12796A" : undefined }}>
                    <span className="flex items-center gap-[12px] md:hidden">
                      <span className="flex h-[44px] w-[44px] flex-none items-center justify-center rounded-full" style={{ background: TONE[message.category][0], color: TONE[message.category][1] }} aria-hidden>
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={message.category === "Safety" ? "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z" : message.category === "Financial" ? "M3.5 6.5h17v11h-17zM3.5 10.5h17" : message.category === "Events" ? "M4 5.5h16V20H4zM8 3.5v4M16 3.5v4M4 10h16" : "M4 5.5h16v10.5H9l-5 4zM8 9.5h8M8 12.8h5"} /></svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] leading-[1.35]" style={{ color: "#0D2315", fontWeight: message.read ? 600 : 800 }}>{message.title}</span>
                        <span className="mt-[3px] block text-[12.5px] font-medium leading-[1.45]" style={{ color: "#6E7C74" }}>{school} · {when(message.at)}{showChildren && message.children.length ? ` · ${message.children.map((child) => child.first).join(" and ")}` : ""}</span>
                      </span>
                      {!message.read ? <span className="flex-none rounded-full px-[10px] py-[3px] text-[11.5px] font-extrabold" style={{ background: "#E8EFFB", color: "#2A5A96" }}>New</span> : null}
                    </span>
                    <span className="flex items-center gap-[8px] max-md:hidden">
                      <span aria-label={message.read ? "Read" : "Unread"} className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: message.read ? "transparent" : "#12796A" }} />
                      <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: "#0D2315", fontWeight: message.read ? 500 : 700 }}>{message.title}</span>
                      <span className="flex-none text-[10px] tabular-nums" style={{ color: "#5E6D64" }}>{when(message.at)}</span>
                    </span>
                    {message.preview ? <span className="mt-[3px] line-clamp-1 block pl-[15px] text-[11px] max-md:hidden" style={{ color: "#5E6D64" }}>{message.preview}</span> : null}
                    <span className="mt-[6px] flex flex-wrap items-center gap-[5px] pl-[15px] max-md:hidden">
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
      <p className="mt-[14px] flex items-start gap-[12px] rounded-[18px] bg-white px-[16px] py-[14px] md:hidden" style={{ boxShadow: "0 1px 2px rgba(13,35,21,0.05), 0 8px 22px -16px rgba(13,35,21,0.22)" }}>
        <span className="mt-[1px] flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full" style={{ background: "#EEF4F0", color: "#17604F" }} aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.2 19 6v6c0 4-3 7.4-7 8.3-4-.9-7-4.3-7-8.3V6z" /></svg>
        </span>
        <span><span className="block text-[14.5px] font-extrabold" style={{ color: "#0D2315" }}>Safety messages always reach you</span><span className="mt-[2px] block text-[12.5px] font-medium" style={{ color: "#6E7C74" }}>Closures and safeguarding, on every channel.</span></span>
      </p>
    </section>
  );
}
