"use client";

import Link from "next/link";
import type { Route } from "next";
import { Bell, X } from "lucide-react";
import { createPortal } from "react-dom";

const INK = "#0D2315";
const MUTED = "#5C6B62";

export type SheetNotice = { id: string; title: string; body: string; href: string | null; unread: boolean };

/**
 * What needs the teacher, as the teacher mobile mockup draws it: a sheet rising from the bottom with a count in its heading, the newest
 * first, each a line to tap and go straight to the screen that clears it, and the school's quiet hours underneath. It reads the same
 * feed as the laptop's dropdown, so the two can never disagree about what has been routed to this person.
 */
export function PhoneNotificationSheet({
  notices,
  unread,
  quietHours,
  settingsHref = "/account/preferences",
  onClose,
}: {
  notices: SheetNotice[];
  unread: number;
  /** The person's own setting, as saved ("19:00 – 07:00 WAT"), or "None". Null while it is still being read. */
  quietHours: string | null;
  /** Where this person changes what reaches them: a parent's notification choices live in their own portal. */
  settingsHref?: string;
  onClose: () => void;
}) {
  const heading = unread ? `${unread} ${unread === 1 ? "thing needs" : "things need"} you` : notices.length ? "Nothing new" : "You are all caught up";
  const quiet = quietHours === null ? null : quietHours === "None" ? "Quiet hours are off. Every notification reaches you as it happens." : `Quiet hours are ${quietHours}. Non-urgent notifications wait until morning; an emergency never does.`;
  // Drawn on the page itself: the bar it is opened from clips and filters what sits inside it.
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <button type="button" aria-label="Close notifications" onClick={onClose} className="fixed inset-0 z-[60] bg-[rgba(13,35,21,0.5)] md:hidden" />
      <div role="dialog" aria-label="Notifications" className="fixed inset-x-0 bottom-0 z-[61] max-h-[86vh] overflow-y-auto overscroll-contain rounded-t-[28px] bg-white px-[20px] pb-[calc(22px+env(safe-area-inset-bottom))] pt-[10px] md:hidden" style={{ boxShadow: "0 -12px 30px -18px rgba(13,35,21,0.55)" }}>
        <span className="mx-auto mb-[16px] block h-[4px] w-[38px] rounded-full" style={{ background: "#DEE8E2" }} />
        <div className="flex items-start gap-[14px]">
          <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full" style={{ background: "#E8EFFB", color: "#2A5A96" }}><Bell className="h-[21px] w-[21px]" strokeWidth={1.8} aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.1em]" style={{ color: "#12796A" }}>Notifications</p>
            <h2 className="mt-[1px] text-[22px] font-extrabold leading-[1.2] tracking-[-0.01em]" style={{ color: INK }}>{heading}</h2>
            <p className="mt-[4px] text-[14px] font-medium leading-[1.5]" style={{ color: MUTED }}>Newest first. Tap one to go straight to the screen that clears it.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-[40px] w-[40px] flex-none items-center justify-center rounded-full" style={{ background: "#EEF4F0", color: INK }}><X className="h-[18px] w-[18px]" strokeWidth={2.1} /></button>
        </div>

        {notices.length ? (
          <div className="mt-[18px] overflow-hidden rounded-[18px]" style={{ background: "#F4F7F5" }}>
            {notices.slice(0, 8).map((notice, index) => {
              const inner = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-extrabold leading-[1.3]" style={{ color: INK }}>
                      {notice.unread ? <span aria-hidden className="mr-[7px] inline-block h-[7px] w-[7px] rounded-full align-middle" style={{ background: "#12796A" }} /> : null}
                      {notice.title}
                    </span>
                    <span className="mt-[3px] line-clamp-3 block text-[13.5px] font-medium leading-[1.5]" style={{ color: MUTED }}>{notice.body}</span>
                  </span>
                  {notice.href ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A5B2AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="flex-none"><path d="m9 6 6 6-6 6" /></svg> : null}
                </>
              );
              const cls = "flex min-h-[64px] items-center gap-[10px] px-[16px] py-[13px] text-left";
              const style = index ? { borderTop: "1px solid #E6EDE8" } : undefined;
              return notice.href ? (
                <Link key={notice.id} href={notice.href as Route} onClick={onClose} className={cls} style={style}>{inner}</Link>
              ) : (
                <div key={notice.id} className={cls} style={style}>{inner}</div>
              );
            })}
          </div>
        ) : (
          <p className="mt-[18px] rounded-[18px] px-[16px] py-[22px] text-center text-[14px] font-medium" style={{ background: "#F4F7F5", color: MUTED }}>Nothing has been routed to you. When something is yours to do, it appears here first.</p>
        )}

        {quiet ? (
          <div className="mt-[16px] flex items-start gap-[10px]">
            <span className="mt-[1px] flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full" style={{ background: "#E3F1EA", color: "#17714F" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d="M12 11v6M12 7h.01" /></svg>
            </span>
            <p className="text-[13.5px] font-medium leading-[1.5]" style={{ color: MUTED }}>{quiet}</p>
          </div>
        ) : null}

        <Link href={settingsHref as Route} onClick={onClose} className="mt-[18px] flex h-[54px] items-center justify-center rounded-[16px] text-[15px] font-extrabold text-white" style={{ background: INK }}>Notification settings</Link>
      </div>
    </>,
    document.body,
  );
}
