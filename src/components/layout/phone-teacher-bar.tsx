"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { NotificationBell, initials } from "@/components/layout/topbar";
import { accountPath } from "@/lib/modules/account";
import type { SessionUser } from "@/lib/domain/types";
import type { TeacherRail } from "@/lib/navigation/workflows";
import { readOutbox } from "@/lib/offline/outbox";
import type { PortalType } from "@/lib/navigation/registry";

/** Where a teacher's day starts; the one screen whose bar is the light one with the greeting under it. */
export const TEACHER_HOME = "/command-center/today";

type Sync = { tone: "positive" | "offline" | "critical"; label: string; short: string };

/**
 * What this phone is holding for the school.
 *
 * The count is the outbox itself — registers and scores marked with no connection — so "2 waiting" is a thing that can be sent, not a
 * decoration. It is re-read when the connection changes and whenever the outbox says it moved.
 */
function useSync(): Sync {
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  useEffect(() => {
    const read = () => { setOnline(navigator.onLine); setQueued(readOutbox().length); };
    read();
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    window.addEventListener("storage", read);
    window.addEventListener("fr:outbox-flush", read);
    const timer = window.setInterval(read, 15_000);
    return () => {
      window.removeEventListener("online", read);
      window.removeEventListener("offline", read);
      window.removeEventListener("storage", read);
      window.removeEventListener("fr:outbox-flush", read);
      window.clearInterval(timer);
    };
  }, []);
  if (!online) return { tone: "offline", label: queued ? `${queued} ${queued === 1 ? "item" : "items"} saved on this phone · sends when you reconnect` : "Offline · everything saves to this phone", short: queued ? `${queued} waiting` : "Offline" };
  if (queued) return { tone: "offline", label: `${queued} ${queued === 1 ? "item" : "items"} waiting to sync · tap to send`, short: `${queued} waiting` };
  return { tone: "positive", label: "Synced · nothing waiting on this phone", short: "Synced" };
}

const TONES = {
  positive: { bg: "#EAF6F0", fg: "#17714F", dot: "#22A06B" },
  offline: { bg: "#F4F6F5", fg: "#5A6862", dot: "#8A9A92" },
  critical: { bg: "#FDF3F3", fg: "#B23B3B", dot: "#DB5555" },
} as const;

/** The small pill beside the date on the home screen: what this phone is holding for the school. A tap sends it, or opens the sync page. */
export function PhoneSyncChip() {
  const sync = useSync();
  const tone = TONES[sync.tone];
  return (
    <Link
      href={"/sync-support/sync" as Route}
      onClick={() => sendOrOpen(sync)}
      className="inline-flex min-h-[36px] items-center gap-[7px] whitespace-nowrap rounded-full px-[13px] text-[12.5px] font-extrabold"
      style={{ background: tone.bg, color: tone.fg }}
    >
      <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: tone.dot, boxShadow: "0 0 0 3px rgba(255,255,255,0.7)" }} />
      <span>{sync.short}</span>
    </Link>
  );
}

function sendOrOpen(sync: Sync) {
  // With something queued the tap sends it; otherwise it opens the page that says when this phone last synced.
  if (sync.short.endsWith("waiting")) window.dispatchEvent(new Event("fr:outbox-flush"));
}

/** "Greenfield College, Ibadan" → crest "GC", first line "Greenfield College", second "IBADAN". */
function crestOf(name: string) {
  const [head, ...rest] = name.split(",");
  const words = (head ?? name).trim().split(/\s+/).filter(Boolean);
  const second = rest.join(",").trim() || (words.length > 2 ? words[words.length - 1]! : "");
  const first = rest.length || words.length <= 2 ? words.join(" ") : words.slice(0, -1).join(" ");
  return { mark: words.slice(0, 3).map((word) => word[0]!.toUpperCase()).join(""), first, second };
}

/**
 * The teacher's top bar on a phone, drawn from the teacher mobile mockup.
 *
 * Two bars, never one: the home screen has a light bar — the school's crest and name, the bell, the teacher's initials — with the
 * greeting under it; every other screen has the dark curved bar with the screen's name in the middle, a way back on a pushed screen, and
 * the bell. Beneath either, one line says whether this phone is up to date. The desktop top bar is hidden below tablet width, so
 * there is exactly one of them on screen.
 */
export function PhoneTeacherBar({
  session,
  schoolName,
  portalType,
  rail,
}: {
  session: SessionUser;
  schoolName?: string;
  portalType: PortalType;
  rail: TeacherRail;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const sync = useSync();
  const clean = pathname.replace(/\/$/, "");
  const home = clean === TEACHER_HOME || clean === "/command-center";
  const segments = clean.split("/").filter(Boolean);
  const label = useMemo(() => {
    const own = [...rail.items, ...rail.extra].find((item) => item.href.split("/")[1] === segments[0]);
    return own?.label ?? "Your workspace";
  }, [rail, segments]);
  // `/attendance/mark` is a tab; `/attendance/mark/<class>/<subject>/<period>` is a screen pushed on top of it.
  // Writing a message is the one tab with no place in the strip: it is reached by the button on Sent, and left by the arrow.
  const onAccount = segments[0] === "account";
  const pushed = onAccount || segments.length > 2 || (segments[0] === "communication-center" && segments[1] === "compose");
  const tone = TONES[sync.tone];
  const crest = crestOf(schoolName ?? "Your school");
  const who = initials(session.name);

  const dot = <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: tone.dot, boxShadow: "0 0 0 3px rgba(255,255,255,0.7)" }} />;
  const syncBody = (
    <>
      {dot}
      <span>{sync.label}</span>
    </>
  );

  return (
    <div className="md:hidden">
      {home ? (
        <>
          <div className="sticky top-0 z-40 flex h-[62px] items-center gap-[10px] pl-[20px] pr-[12px]" style={{ background: "rgba(244,247,245,0.92)", backdropFilter: "blur(14px)" }}>
            <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[12px] bg-[#0D2315] text-[11px] font-black tracking-[0.05em] text-white">{crest.mark}</span>
            <span className="min-w-0 flex-1 leading-[1.2]">
              <span className="block truncate text-[13.5px] font-extrabold text-[#0D2315]">{crest.first}</span>
              {crest.second ? <span className="block truncate text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-[#12796A]">{crest.second}</span> : null}
            </span>
            <NotificationBell session={session} portalType={portalType} phone="light" />
            {/* The mockup's avatar opens the account page itself, not a menu over the page. */}
            <Link href={accountPath as Route} aria-label="Account" className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full text-[13.5px] font-extrabold text-[#0D2315]" style={{ background: "#E3F1EA" }}>{who}</Link>
          </div>
        </>
      ) : (
        <div className="sticky top-0 z-40">
          <div className="relative z-[2] overflow-hidden rounded-b-[26px] bg-[#0D2315]" style={{ boxShadow: "0 12px 26px -20px rgba(13,35,21,0.9)" }}>
            <span aria-hidden className="absolute -right-[64px] -top-[96px] h-[190px] w-[190px] rounded-full border-[1.5px]" style={{ borderColor: "rgba(95,214,180,0.12)" }} />
            <span aria-hidden className="absolute -bottom-[70px] -left-[40px] h-[120px] w-[120px] rounded-full border-[1.5px]" style={{ borderColor: "rgba(95,214,180,0.08)" }} />
            <div className="relative grid h-[62px] grid-cols-[52px_minmax(0,1fr)_52px] items-center px-[4px]">
              <div className="flex justify-center">
                {pushed ? (
                  <button type="button" onClick={() => router.back()} aria-label="Back" className="flex h-[44px] w-[44px] items-center justify-center rounded-full active:bg-white/10">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
                  </button>
                ) : null}
              </div>
              <div className="min-w-0 text-center">
                <div className="truncate text-[min(16.5px,4.8vw)] font-extrabold leading-[1.25] tracking-[-0.005em] text-white">{onAccount ? "Account" : label}</div>
                {onAccount ? <div className="truncate text-[12.5px] font-medium leading-[1.2]" style={{ color: "rgba(255,255,255,0.7)" }}>{session.name}</div> : null}
              </div>
              <div className="flex justify-center">
                {onAccount ? null : <NotificationBell session={session} portalType={portalType} phone="dark" />}
              </div>
            </div>
          </div>
          <Link
            href={"/sync-support/sync" as Route}
            onClick={() => sendOrOpen(sync)}
            className="relative z-[1] -mt-[26px] mx-[14px] flex items-center justify-center gap-[8px] overflow-hidden whitespace-nowrap rounded-b-[18px] px-[14px] pb-[9px] pt-[33px] text-[12px] font-extrabold"
            style={{ background: tone.bg, color: tone.fg, boxShadow: "0 8px 18px -16px rgba(13,35,21,0.5)" }}
          >
            {syncBody}
          </Link>
        </div>
      )}
    </div>
  );
}
