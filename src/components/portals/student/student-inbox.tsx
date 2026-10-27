"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { readCookie } from "@/lib/modules/submit";
import { toneOf } from "@/lib/modules/tones";
import type { DrawerSpec, PanelTone } from "@/lib/modules/panels";

export type InboxMessage = { id: string; cat: string; from: string; role: string; title: string; preview: string; body: string[]; when: string; read: boolean; to: string; reply: DrawerSpec | null };
export type StudentInboxProps = { messages: InboxMessage[]; empty: string; base: string; openDrawer?: (spec: DrawerSpec) => void };

const CAT_TONE: Record<string, PanelTone> = { "From teachers": "progress", School: "submitted", Sent: "neutral" };

/** The list on the left, the message on the right. Opening one marks it read, for good. */
export function StudentInbox({ messages, empty, base, openDrawer }: StudentInboxProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(messages[0]?.id ?? null);
  const [read, setRead] = useState<Record<string, boolean>>({});
  const isRead = (message: InboxMessage) => read[message.id] ?? message.read;
  const open = messages.find((message) => message.id === selected) ?? messages[0] ?? null;

  async function choose(message: InboxMessage) {
    setSelected(message.id);
    if (isRead(message)) return;
    setRead((current) => ({ ...current, [message.id]: true }));
    await fetch(`${base}/messages/${encodeURIComponent(message.id)}/read`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "x-csrf-token": readCookie("fr_csrf") ?? "" }, body: "{}" }).catch(() => undefined);
    router.refresh();
  }

  if (!messages.length) return <section className="rounded-[14px] border bg-(--color-bg-surface) px-[18px] py-[28px] text-center text-[12px]" style={{ borderColor: "#DEE8E2", color: "#5E6D64" }}>{empty}</section>;

  return (
    <section className="grid min-w-0 overflow-hidden rounded-[14px] border bg-(--color-bg-surface) lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]" style={{ borderColor: "#DEE8E2" }}>
      <ul className="max-h-[560px] min-w-0 overflow-y-auto border-b lg:border-b-0 lg:border-r" style={{ borderColor: "#EDF3EF" }}>
        {messages.map((message) => {
          const swatch = toneOf(CAT_TONE[message.cat] ?? "neutral");
          const unread = !isRead(message);
          return (
            <li key={message.id}>
              <button type="button" onClick={() => void choose(message)} className="block w-full border-b px-[16px] py-[12px] text-left" style={{ borderColor: "#EDF3EF", background: message.id === open?.id ? "#F1F7F4" : "transparent", boxShadow: message.id === open?.id ? "inset 3px 0 0 #12796A" : "none" }}>
                <span className="flex items-center gap-[8px]">
                  <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: unread ? "#12796A" : "transparent" }} />
                  <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: "#0D2315", fontWeight: unread ? 700 : 500 }}>{message.title}</span>
                  <span className="flex-none text-[10px]" style={{ color: "#5E6D64" }}>{message.when}</span>
                </span>
                <span className="mt-[3px] flex items-center gap-[8px] pl-[15px]">
                  <span className="rounded-full border px-[7px] py-[1.5px] text-[9.5px] font-bold" style={{ background: swatch.bg, color: swatch.fg, borderColor: swatch.bd }}>{message.cat}</span>
                  <span className="min-w-0 flex-1 truncate text-[11px]" style={{ color: "#5E6D64" }}>{message.preview}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {open ? (
        <article className="min-w-0 px-[18px] py-[16px]">
          <span className="rounded-full border px-[8px] py-[2.5px] text-[10px] font-semibold" style={{ background: toneOf(CAT_TONE[open.cat] ?? "neutral").bg, color: toneOf(CAT_TONE[open.cat] ?? "neutral").fg, borderColor: toneOf(CAT_TONE[open.cat] ?? "neutral").bd }}>{open.cat}</span>
          <h3 className="mt-[8px] text-balance text-[15px] font-extrabold tracking-[-0.01em]" style={{ color: "#0D2315" }}>{open.title}</h3>
          <p className="mt-[3px] text-[10.5px]" style={{ color: "#5E6D64" }}>
            {open.cat === "Sent" ? `From you · to ${open.to}` : `From ${open.from}${open.role ? ` · ${open.role}` : ""}`} · {open.when}
          </p>
          <div className="mt-[12px] grid gap-[9px]">{open.body.map((line, i) => <p key={i} className="text-pretty text-[12px] leading-[1.6]" style={{ color: "#2C3B31" }}>{line}</p>)}</div>
          {open.reply ? <button type="button" onClick={() => openDrawer?.(open.reply!)} className="mt-[14px] inline-flex rounded-[9px] border bg-white px-[13px] py-[8px] text-[11.5px] font-semibold" style={{ borderColor: "#CFDDD5", color: "#435048" }}>Reply</button> : null}
          {open.cat === "School" ? <p className="mt-[12px] text-[10.5px]" style={{ color: "#5E6D64" }}>An announcement — replies are not monitored.</p> : null}
        </article>
      ) : null}
    </section>
  );
}
