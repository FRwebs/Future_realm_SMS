"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { NotificationBell, initials } from "@/components/layout/topbar";
import type { PortalType } from "@/lib/navigation/registry";
import type { SessionUser } from "@/lib/domain/types";

/** What this phone knows about its own connection: there is no outbox behind either portal's actions, so this is the connection and the time the page was read. */
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

/** The "Nooria | STUDENTS" crest, with the school underneath, as the home bar draws it. */
function Wordmark({ eyebrow, school }: { eyebrow: string; school: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col justify-center gap-[5px]">
      <span className="flex min-w-0 items-center gap-[10px]">
        <span className="flex h-[34px] flex-none items-center rounded-[10px] bg-[#0D2315] px-[10px] text-[15px] font-black tracking-[-0.02em] text-white">Nooria</span>
        <span aria-hidden className="h-[18px] w-px flex-none" style={{ background: "#CFDDD5" }} />
        <span className="truncate text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-[#12796A]">{eyebrow}</span>
      </span>
      {school ? <span className="truncate text-[11px] font-bold leading-[1.2] text-[#5F6E65]">{school}</span> : null}
    </span>
  );
}

/**
 * The top bar of a portal that has a phone design, drawn from the School Admin and Student mobile mockups.
 *
 * The two mockups draw the same bar and differ only in the word under the crest and what each line says, so this is one component
 * with those as its arguments. Home has the light bar — the crest, the school, the bell, their initials — and under it the greeting
 * and the date, with the sync chip on the same line. Every other page has the dark curved bar carrying the page's name, with the
 * sync line hanging beneath it. The avatar goes straight to the account page, as the mockups' does.
 */
export function PhonePortalBar({
  session,
  portalType,
  eyebrow,
  home,
  accountHref,
  syncHref,
  school,
  pages,
  subtitle,
  greetingName,
  dateLine,
  ownDepth,
  leftAction,
}: {
  session: SessionUser;
  portalType: PortalType;
  /** The word under the crest: "Students", "School Admin". */
  eyebrow: string;
  /** The addresses the bar treats as home — the light bar, the greeting, no page name. */
  home: string[];
  accountHref: string;
  /** Where the sync line and chip go. */
  syncHref: string;
  school: string;
  /** Each page's own name, keyed by the address it starts at; the bar takes the longest one that matches. */
  pages: Record<string, string>;
  /** The line under it: who the page covers, or which class. */
  subtitle: string;
  greetingName: string;
  dateLine: string;
  /**
   * How many path segments a page of this portal has before it counts as drilled into.
   *
   * A student's pages are three deep ("/portals/student/results"), an administrator's module and its tab are two
   * ("/attendance/register") — and neither is a screen you came from somewhere else to reach, so neither takes the back arrow.
   */
  ownDepth: number;
  /** The one button the mockup puts in the top-left of a page, if that page has one. */
  leftAction?: { label: string; icon: string; event: string } | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const link = useLink();
  const path = pathname.replace(/\/$/, "");
  const atHome = home.includes(path);
  const deep = path.split("/").filter(Boolean).length > ownDepth;
  const title = Object.entries(pages)
    .filter(([at]) => path === at || path.startsWith(`${at}/`))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? "";
  const status = link.online ? `Up to date${link.at ? ` · synced at ${link.at}` : ""}` : "Offline · showing what was last loaded";
  const short = link.online ? "Up to date" : "Offline";
  const tone = link.online ? { bg: "#EAF6F0", fg: "#17714F", dot: "#22A06B" } : { bg: "#F4F6F5", fg: "#5A6862", dot: "#8A9A92" };

  if (atHome) {
    return (
      <div className="md:hidden">
        <div className="sticky top-0 z-40 flex h-[62px] items-center gap-[10px] pl-[20px] pr-[12px]" style={{ background: "rgba(244,247,245,0.92)", backdropFilter: "blur(14px)" }}>
          <Wordmark eyebrow={eyebrow} school={school} />
          <NotificationBell session={session} portalType={portalType} phone="light" />
          <Link href={accountHref as Route} aria-label={`${initials(session.name)}, your account`} className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full text-[13px] font-extrabold text-[#0D2315]" style={{ background: "#E3F1EA" }}>{initials(session.name)}</Link>
        </div>
        <div className="px-[20px] pt-[4px]">
          <p className="text-[21px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[#0D2315]">{greeting()}, {greetingName}</p>
          <div className="mt-[9px] flex flex-wrap items-center justify-between gap-[8px_10px]">
            <span className="text-[13px] font-semibold text-[#6E7C74]">{dateLine}</span>
            <Link href={syncHref as Route} className="inline-flex min-h-[36px] items-center gap-[7px] whitespace-nowrap rounded-full px-[13px] text-[12.5px] font-extrabold" style={{ background: tone.bg, color: tone.fg }}>
              <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: tone.dot, boxShadow: "0 0 0 3px rgba(255,255,255,0.7)" }} />
              {short}
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
              {leftAction ? (
                <button type="button" onClick={() => window.dispatchEvent(new Event(leftAction.event))} aria-label={leftAction.label} className="flex h-[44px] w-[44px] items-center justify-center rounded-full text-white active:bg-white/10">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={leftAction.icon} /></svg>
                </button>
              ) : deep ? (
                <button type="button" onClick={() => router.back()} aria-label="Back" className="flex h-[44px] w-[44px] items-center justify-center rounded-full active:bg-white/10">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
                </button>
              ) : null}
            </div>
            <div className="min-w-0 text-center">
              <div className="truncate text-[min(16.5px,4.8vw)] font-extrabold leading-[1.25] text-white">{title}</div>
              <div className="truncate text-[12.5px] font-medium leading-[1.2]" style={{ color: "rgba(255,255,255,0.7)" }}>{subtitle}</div>
            </div>
            <div className="flex justify-center">
              <NotificationBell session={session} portalType={portalType} phone="dark" />
            </div>
          </div>
        </div>
        <Link href={syncHref as Route} className="relative z-[1] -mt-[26px] mx-[14px] flex items-center justify-center gap-[8px] overflow-hidden whitespace-nowrap rounded-b-[18px] px-[14px] pb-[9px] pt-[33px] text-[12px] font-extrabold" style={{ background: tone.bg, color: tone.fg, boxShadow: "0 8px 18px -16px rgba(13,35,21,0.5)" }}>
          <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: tone.dot, boxShadow: "0 0 0 3px rgba(255,255,255,0.7)" }} />
          <span>{status}</span>
        </Link>
      </div>
    </div>
  );
}

/** The time of day, as a person would say it. */
function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}
