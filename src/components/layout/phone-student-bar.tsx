"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { NotificationBell, initials } from "@/components/layout/topbar";
import type { PortalType } from "@/lib/navigation/registry";
import type { SessionUser } from "@/lib/domain/types";
import type { StudentChrome } from "@/lib/api/student-workspace";

const HOME = "/portals/student";
const ABOUT_ME = ["profile", "notifications", "account", "sync"];

/** Whether this phone has a connection, and when the page was read. */
function useLink() {
  const [online, setOnline] = useState(true);
  const [at, setAt] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setOnline(navigator.onLine);
    read();
    setAt(new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: false }));
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => { window.removeEventListener("online", read); window.removeEventListener("offline", read); };
  }, []);
  return { online, at };
}

/** "Nooria | STUDENTS" with the school's name under it, the crest of the home bar. */
function Wordmark({ school }: { school?: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col justify-center gap-[5px]">
      <span className="flex min-w-0 items-center gap-[10px]">
        <span className="flex h-[30px] flex-none items-center rounded-[9px] bg-[#0D2315] px-[9px] text-[14px] font-black tracking-[-0.02em] text-white">Nooria</span>
        <span aria-hidden className="h-[18px] w-px flex-none" style={{ background: "#CFDDD5" }} />
        <span className="truncate text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-[#12796A]">Students</span>
      </span>
      {school ? <span className="truncate text-[11px] font-bold leading-[1.2] text-[#5F6E65]">{school}</span> : null}
    </span>
  );
}

const greeting = (hour: number) => (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");

/**
 * The student's top bar on a phone, drawn from the student mobile mockup.
 *
 * Today has the light bar — the wordmark with the school beneath it, the bell, the student's initials — and under it a greeting, the
 * date, and whether this phone is up to date. Every other page has the dark curved bar with the page's name in the middle and the
 * term beneath it. The avatar opens the account page directly, as the mockup's does.
 */
export function PhoneStudentBar({
  session,
  portalType,
  chrome,
  pages,
}: {
  session: SessionUser;
  portalType: PortalType;
  chrome: StudentChrome;
  /** The portal's own page names, keyed by the slug in the address. */
  pages: Record<string, string>;
}) {
  const pathname = usePathname().replace(/\/$/, "");
  const router = useRouter();
  const link = useLink();
  const parts = pathname.split("/");
  const slug = parts[3] ?? "today";
  const home = pathname === HOME;
  const pushed = parts.length > 4;
  const first = chrome.who.name.split(" ")[0] ?? chrome.who.name;
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const dateLine = now ? now.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" }) : "";
  const tone = link.online ? { bg: "#EAF6F0", fg: "#17714F", dot: "#22A06B", text: "Up to date" } : { bg: "#F4F6F5", fg: "#5A6862", dot: "#8A9A92", text: "Offline" };

  if (home) {
    return (
      <div className="md:hidden">
        <div className="sticky top-0 z-40 flex h-[62px] items-center gap-[10px] pl-[20px] pr-[12px]" style={{ background: "rgba(244,247,245,0.92)", backdropFilter: "blur(14px)" }}>
          <Wordmark school={chrome.school.name} />
          <NotificationBell session={session} portalType={portalType} phone="light" />
          <Link href={"/portals/student/account" as Route} aria-label={`${chrome.who.initials || initials(session.name)}, your account`} className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full text-[13px] font-extrabold text-[#0D2315]" style={{ background: "#E3F1EA" }}>
            {chrome.who.initials || initials(session.name)}
          </Link>
        </div>
        <div className="px-5 pt-1">
          <h1 className="text-[21px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[#0D2315]">{now ? `${greeting(now.getHours())}, ${first}` : `Hello, ${first}`}</h1>
          <div className="mt-[9px] flex flex-wrap items-center justify-between gap-x-[10px] gap-y-2">
            <span className="text-[13px] font-semibold text-[#6E7C74]">{dateLine}</span>
            <Link href={"/portals/student/sync" as Route} className="inline-flex min-h-[36px] items-center gap-[7px] rounded-full px-[13px] text-[12px] font-extrabold" style={{ background: tone.bg, color: tone.fg }}>
              <span aria-hidden className="h-[7px] w-[7px] rounded-full" style={{ background: tone.dot }} />
              {tone.text}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="md:hidden">
      <div className="sticky top-0 z-40">
        <div className="relative z-[2] overflow-hidden rounded-b-[26px] bg-[#0D2315]" style={{ boxShadow: "0 12px 26px -20px rgba(13,35,21,0.9)" }}>
          <span aria-hidden className="absolute -right-[64px] -top-[96px] h-[190px] w-[190px] rounded-full border-[1.5px]" style={{ borderColor: "rgba(95,214,180,0.12)" }} />
          <span aria-hidden className="absolute -bottom-[70px] -left-[40px] h-[120px] w-[120px] rounded-full border-[1.5px]" style={{ borderColor: "rgba(95,214,180,0.08)" }} />
          <div className="relative grid h-[62px] grid-cols-[52px_minmax(0,1fr)_52px] items-center px-[4px]">
            <div className="flex justify-center">
              {pushed || slug === "account" ? (
                <button type="button" onClick={() => router.back()} aria-label="Back" className="flex h-[44px] w-[44px] items-center justify-center rounded-full active:bg-white/10">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
                </button>
              ) : null}
            </div>
            <div className="min-w-0 text-center">
              <div className="truncate text-[min(16.5px,4.8vw)] font-extrabold leading-[1.25] text-white">{pages[slug] ?? "Your portal"}</div>
              <div className="truncate text-[11.5px] font-semibold leading-[1.3]" style={{ color: "rgba(255,255,255,0.68)" }}>{ABOUT_ME.includes(slug) ? session.name : chrome.school.term}</div>
            </div>
            <div className="flex justify-center">
              <NotificationBell session={session} portalType={portalType} phone="dark" />
            </div>
          </div>
        </div>
        <Link href={"/portals/student/sync" as Route} role="status" className="relative z-[1] -mt-[26px] mx-[14px] flex items-center justify-center gap-[8px] overflow-hidden whitespace-nowrap rounded-b-[18px] px-[14px] pb-[9px] pt-[33px] text-[12px] font-extrabold" style={{ background: tone.bg, color: tone.fg, boxShadow: "0 8px 18px -16px rgba(13,35,21,0.5)" }}>
          <span aria-hidden className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: tone.dot, boxShadow: "0 0 0 3px rgba(255,255,255,0.7)" }} />
          <span>{link.online ? `Up to date${link.at ? ` · checked at ${link.at}` : ""}` : "Offline · showing what was last loaded"}</span>
        </Link>
      </div>
    </div>
  );
}
