"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { NotificationBell, initials } from "@/components/layout/topbar";
import type { PortalType } from "@/lib/navigation/registry";
import type { SessionUser } from "@/lib/domain/types";
import type { ParentChrome } from "@/lib/api/parent-workspace";

/** The pages that are about the parent, not a child: no child chips, and the bar names the page by who it covers. */
const ABOUT_PARENT = ["prefs", "account", "sync"];
const HOME = "/portals/parent/overview";

/** What this phone knows about its own connection. A parent has no offline outbox, so this is the connection and the time the page was read. */
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

/** "Nooria | PARENTS" crest for the home bar. */
function Wordmark() {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-[10px]">
      <span className="flex h-[34px] flex-none items-center rounded-[10px] bg-[#0D2315] px-[10px] text-[15px] font-black tracking-[-0.02em] text-white">Nooria</span>
      <span aria-hidden className="h-[22px] w-px flex-none" style={{ background: "#CAD6CE" }} />
      <span className="truncate text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#12796A]">Parents</span>
    </span>
  );
}

/**
 * The parent's top bar on a phone, drawn from the parent mobile mockup.
 *
 * Home has the light bar — the wordmark, the bell, the parent's initials — and every other page has the dark curved bar with the page's
 * name in the middle and, beneath it, who the page covers: the whole family or one child. A line under either says whether the page
 * was read on a live connection. The avatar opens the account page directly, as the mockup's does.
 */
export function PhoneParentBar({
  session,
  portalType,
  pages,
  kids,
  schools,
}: {
  session: SessionUser;
  portalType: PortalType;
  /** The portal's own page names, keyed by the slug in the address. */
  pages: Record<string, string>;
  /** The children's first names, by id: a page about one child says whose it is. */
  kids: Record<string, string>;
  /** How many schools the family is at: a page about the whole family says which. */
  schools: number;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const link = useLink();
  const slug = pathname.replace(/\/$/, "").split("/")[3] ?? "overview";
  const home = pathname.replace(/\/$/, "") === HOME || pathname.replace(/\/$/, "") === "/portals/parent";
  const pushed = pathname.replace(/\/$/, "").split("/").length > 4;
  const status = link.online ? `Up to date${link.at ? ` · checked at ${link.at}` : ""}` : "Offline · showing what was last loaded";
  const tone = link.online ? { bg: "#EAF6F0", fg: "#17714F", dot: "#22A06B" } : { bg: "#F4F6F5", fg: "#5A6862", dot: "#8A9A92" };
  const childId = params.get("child");
  // A page that is itself showing one thing in full — an open message — names it in the bar and takes the way back.
  const [reading, setReading] = useState<{ title: string; sub: string } | null>(null);
  useEffect(() => {
    const on = (event: Event) => setReading((event as CustomEvent<{ title: string; sub: string } | null>).detail ?? null);
    window.addEventListener("fr:phone-reading", on);
    return () => window.removeEventListener("fr:phone-reading", on);
  }, []);
  const who = ABOUT_PARENT.includes(slug) ? session.name : (childId && kids[childId]) || (schools > 1 ? `Whole family · ${schools === 2 ? "both" : `all ${schools}`} schools` : "Whole family");

  if (home) {
    return (
      <div className="md:hidden">
        <div className="sticky top-0 z-40 flex h-[62px] items-center gap-[10px] pl-[20px] pr-[12px]" style={{ background: "rgba(244,247,245,0.92)", backdropFilter: "blur(14px)" }}>
          <Wordmark />
          <NotificationBell session={session} portalType={portalType} phone="light" />
          <Link href={"/portals/parent/account" as Route} aria-label={`${initials(session.name)}, your account`} className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full text-[13.5px] font-extrabold text-[#0D2315]" style={{ background: "#E3F1EA" }}>{initials(session.name)}</Link>
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
              {reading ? (
                <button type="button" onClick={() => window.dispatchEvent(new Event("fr:phone-reading-close"))} aria-label="Back to the messages" className="flex h-[44px] w-[44px] items-center justify-center rounded-full active:bg-white/10">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
                </button>
              ) : slug === "messages" || slug === "calendar" ? (
                <button type="button" onClick={() => window.dispatchEvent(new Event(slug === "messages" ? "fr:bar-read-all" : "fr:bar-main"))} aria-label={slug === "messages" ? "Mark every message read" : "Add school dates to my phone"} className="flex h-[44px] w-[44px] items-center justify-center rounded-full text-white active:bg-white/10">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {slug === "messages" ? <path d="m5 12.5 4.5 4.5 9-10" /> : <path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 19.5h14" />}
                  </svg>
                </button>
              ) : pushed || slug === "account" ? (
                <button type="button" onClick={() => router.back()} aria-label="Back" className="flex h-[44px] w-[44px] items-center justify-center rounded-full active:bg-white/10">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
                </button>
              ) : null}
            </div>
            <div className="min-w-0 text-center">
              <div className="truncate text-[min(16.5px,4.8vw)] font-extrabold leading-[1.25] text-white">{reading?.title ?? pages[slug] ?? "Your portal"}</div>
              <div className="truncate text-[12.5px] font-medium leading-[1.2]" style={{ color: "rgba(255,255,255,0.7)" }}>{reading?.sub ?? who}</div>
            </div>
            <div className="flex justify-center">
              <NotificationBell session={session} portalType={portalType} phone="dark" />
            </div>
          </div>
        </div>
        <div className="relative z-[1] -mt-[26px] mx-[14px] flex items-center justify-center gap-[8px] overflow-hidden whitespace-nowrap rounded-b-[18px] px-[14px] pb-[9px] pt-[33px] text-[12px] font-extrabold" style={{ background: tone.bg, color: tone.fg, boxShadow: "0 8px 18px -16px rgba(13,35,21,0.5)" }}>
          <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: tone.dot, boxShadow: "0 0 0 3px rgba(255,255,255,0.7)" }} />
          <span>{status}</span>
        </div>
      </div>
    </div>
  );
}

/** The line under a child's name is the one for the page being read. */
const lineOf = (stats: ParentChrome["family"]["stats"], slug: string): [string, string] => {
  const own = slug === "overview" ? stats.home : slug === "attendance" ? stats.attendance : slug === "fees" ? stats.fees : null;
  return own && own[0] ? own : stats.fallback;
};
const INK: Record<string, string> = { negative: "#B23B3B", attention: "#8A6410", positive: "#17714F", progress: "#2A5A96" };

/**
 * Whose page this is, as the mockup's chips: the whole family first, then each child, scrolling sideways. The lit one is the one being
 * read, and each says what is outstanding for it so a parent sees where the problem is before opening anything. A choice keeps its
 * page: the address changes only by its child.
 */
export function PhoneParentChips({ chrome }: { chrome: ParentChrome }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const slug = pathname.replace(/\/$/, "").split("/")[3] ?? "overview";
  const selected = params.get("child") ?? "all";
  const href = useMemo(() => {
    const base = `/portals/parent${slug === "overview" ? "" : `/${slug}`}`;
    return (child: string) => (child === "all" ? base || "/portals/parent" : `${base}?child=${child}`);
  }, [slug]);
  const [reading, setReading] = useState(false);
  useEffect(() => {
    const on = (event: Event) => setReading(Boolean((event as CustomEvent).detail));
    window.addEventListener("fr:phone-reading", on);
    return () => window.removeEventListener("fr:phone-reading", on);
  }, []);
  if (ABOUT_PARENT.includes(slug) || !chrome.children.length || reading) return null;

  const chip = (key: string, mark: string, name: string, stats: ParentChrome["family"]["stats"], swatch: [string, string, string], needs: number, urgent: boolean, photo: string | null) => {
    const on = key === selected;
    const [line, tone] = lineOf(stats, slug);
    return (
      <Link key={key} href={href(key) as Route} aria-current={on ? "true" : undefined} className="flex min-h-[54px] flex-none items-center gap-[10px] rounded-full py-[7px] pl-[8px] pr-[16px]" style={on ? { background: "#0D2315", boxShadow: "0 8px 18px -10px rgba(13,35,21,0.7)" } : { background: "#fff", boxShadow: "0 1px 2px rgba(13,35,21,0.06), 0 6px 16px -12px rgba(13,35,21,0.25)" }}>
        <span className="relative flex-none">
          <span className="flex h-[38px] w-[38px] items-center justify-center overflow-hidden rounded-full border text-[12px] font-extrabold" style={{ background: swatch[0], color: swatch[1], borderColor: swatch[2] }}>
            {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : mark}
          </span>
          {needs ? (
            <span className="absolute -right-[5px] -top-[5px] flex h-[19px] min-w-[19px] items-center justify-center rounded-full px-[5px] text-[10.5px] font-black" style={{ background: urgent ? "#C93F3F" : "#E0A526", color: urgent ? "#fff" : "#0D2315", border: `2px solid ${on ? "#0D2315" : "#fff"}` }}>{needs}</span>
          ) : null}
        </span>
        <span className="min-w-0 text-left">
          <span className="block whitespace-nowrap text-[15px] font-extrabold leading-[1.2]" style={{ color: on ? "#fff" : "#0D2315" }}>{name}</span>
          {line ? <span className="block whitespace-nowrap text-[12.5px] font-semibold leading-[1.3]" style={{ color: on ? "rgba(255,255,255,0.78)" : INK[tone] ?? "#5C6B62" }}>{line}</span> : null}
        </span>
      </Link>
    );
  };

  return (
    <div className="-mx-4 mb-[16px] flex gap-[10px] overflow-x-auto px-4 pb-[6px] pt-[6px] md:hidden" style={{ scrollbarWidth: "none" }} aria-label="Whose page" role="group">
      {chip("all", "All", "Family", chrome.family.stats, ["#BFE8D6", "#0D2315", "#9ED6BC"], chrome.family.needs, chrome.family.urgent, null)}
      {chrome.children.map((child) => chip(child.id, child.initials, child.first, child.stats, child.swatch, child.needs, child.urgent, child.photoUrl))}
    </div>
  );
}

