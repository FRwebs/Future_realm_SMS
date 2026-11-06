"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { initials } from "@/components/layout/topbar";
import { roleLabels } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/domain/types";
import { apiJson, getUrl } from "@/lib/api/client";
import { membershipsContract } from "@/lib/api/contracts";
import { accountPath } from "@/lib/modules/account";
import type { TabBarItem } from "@/components/layout/portal-tab-bar";

const INK = "#0D2315";
const MUTED = "#5C6B62";
const CARD = { background: "#fff", boxShadow: "0 1px 2px rgba(13,35,21,0.05), 0 8px 22px -16px rgba(13,35,21,0.22)" };

const PLUS = "M12 5.5v13M5.5 12h13";
const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
const HELP = "M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4M12 16.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z";
const INFO = "M12 11v5M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z";
const NOTE = "M5 4.5h9.5A2.5 2.5 0 0 1 17 7v12.5H7.5A2.5 2.5 0 0 1 5 17zM9 8.5h5M9 12h5";
const CAP = "M12 4 2.5 8.5 12 13l9.5-4.5zM6 10.8v4.4c0 1.6 2.7 3 6 3s6-1.4 6-3v-4.4";
const CHECK = "M4 5.5h16V20H4zM8 3v4M16 3v4M8.5 14l2 2 4-4.5";
const SCORE = "M6 3.5h12v17H6zM9.5 8.5h5M9.5 12.5h5M9.5 16.5h3";
const OUT = "M9 4.5H5.5v15H9M14 8l4 4-4 4M18 12H9.5";
const CHEVRON = "m9 6 6 6-6 6";

type Entry = { label: string; sub?: string; icon: string; href: string };

/** The module a path belongs to is its first segment, which is also how the teacher's rail items are addressed. */
const baseOf = (href: string) => `/${href.split("?")[0]!.split("/").filter(Boolean)[0] ?? ""}`;

/** What the module being read offers one tap away, in the order a teacher would reach for it. Only what the teacher can open is shown. */
const ON_THIS_SCREEN: Record<string, Entry[]> = {
  "/command-center": [
    { label: "Write this week’s lesson note", icon: NOTE, href: "/lesson-notes/notes" },
    { label: "Request leave", icon: PLUS, href: "/my-employment/leave" },
    { label: "Your training", icon: CAP, href: "/training/for-you" },
  ],
  "/attendance": [
    { label: "Mark a register", icon: CHECK, href: "/attendance/mark" },
    { label: "Register history", icon: CHECK, href: "/attendance/register" },
  ],
  "/score-entry-results": [
    { label: "Enter scores", icon: SCORE, href: "/score-entry-results/enter" },
    { label: "See your results", icon: SCORE, href: "/score-entry-results/results" },
  ],
  "/lesson-notes": [
    { label: "Write this week’s lesson note", icon: NOTE, href: "/lesson-notes/notes" },
    { label: "Your scheme of work", icon: NOTE, href: "/lesson-notes/curriculum" },
  ],
  "/report-cards": [
    { label: "Write remarks", icon: NOTE, href: "/report-cards/remarks" },
    { label: "Where every card stands", icon: NOTE, href: "/report-cards/completion" },
  ],
};

const QUICK: Entry[] = [
  { label: "Request leave", sub: "Balance and classes affected worked out for you", icon: PLUS, href: "/my-employment/leave" },
  { label: "Report an absence today", sub: "The Principal is told straight away", icon: WARN, href: "/my-employment/my-assignments" },
  { label: "Ask about an assignment", sub: "A class, subject or cover is listed wrongly", icon: HELP, href: "/class-timetable/teaching" },
  { label: "Get help", sub: "Guides that work offline, or raise a ticket", icon: INFO, href: "/sync-support/help-support" },
];

/** Which heading each of the teacher's modules sits under, as the teacher mobile mockup groups them. */
const GROUPS: Array<{ title: string; bases: string[] }> = [
  { title: "Teaching", bases: ["/class-timetable", "/report-cards", "/student-records", "/parents-guardians", "/communication-center", "/approvals-workflow"] },
  { title: "You", bases: ["/my-employment", "/training", "/school-configuration"] },
  { title: "This device", bases: ["/sync-support"] },
];

function Glyph({ path, size = 20, stroke = 1.8 }: { path: string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={path} />
    </svg>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-[10px] mt-[22px] px-[2px] text-[16px] font-extrabold" style={{ color: INK }}>{children}</h3>;
}

function Badge({ count, urgent }: { count: number; urgent: boolean }) {
  if (!count) return null;
  return (
    <span className="absolute right-[10px] top-[8px] flex h-[19px] min-w-[19px] items-center justify-center rounded-full px-[5px] text-[10.5px] font-black" style={{ background: urgent ? "#C93F3F" : "#E0A526", color: urgent ? "#fff" : INK, border: "2px solid #fff" }}>
      {count > 9 ? "9+" : count}
    </span>
  );
}

/**
 * The More sheet of the teacher mobile mockup: who is signed in, what this screen offers, every module under its heading, the things a
 * teacher asks for most, and the way out. Every link is a module or a page this teacher can already open; a heading with nothing under
 * it is not drawn.
 */
export function TeacherMoreSheet({
  items,
  primaryIds,
  counts,
  urgent,
  pathname,
  session,
  schoolName,
  onClose,
}: {
  items: TabBarItem[];
  primaryIds: string[];
  counts: Record<string, number>;
  urgent: Record<string, boolean>;
  pathname: string;
  session: SessionUser;
  schoolName?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const open = new Set(items.map((item) => baseOf(item.href)));
  const rest = items.filter((item) => !primaryIds.includes(item.id));
  const grouped = GROUPS.map((group) => ({ title: group.title, items: rest.filter((item) => group.bases.includes(baseOf(item.href))).sort((a, b) => group.bases.indexOf(baseOf(a.href)) - group.bases.indexOf(baseOf(b.href))) })).filter((group) => group.items.length);
  const placed = new Set(grouped.flatMap((group) => group.items.map((item) => item.id)));
  const others = rest.filter((item) => !placed.has(item.id));
  const here = (ON_THIS_SCREEN[baseOf(pathname)] ?? []).filter((link) => open.has(baseOf(link.href)));
  const quick = QUICK.filter((link) => open.has(baseOf(link.href)));

  // A teacher who works at more than one school moves between them here, now that the avatar goes straight to the account page.
  const memberships = useQuery({ queryKey: ["memberships", "mine"], queryFn: ({ signal }) => apiJson(getUrl("/api/v1/memberships/mine"), signal, membershipsContract) });
  const schools = memberships.data ?? [];
  async function switchSchool(schoolId: string) {
    const csrf = document.cookie.split("; ").find((item) => item.startsWith("fr_csrf="))?.split("=")[1] ?? "";
    const response = await fetch(`/api/v1/memberships/switch/${schoolId}`, { method: "POST", credentials: "include", headers: { "x-csrf-token": csrf } });
    if (response.ok) window.location.assign("/");
  }

  async function signOut() {
    await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  const tile = (item: TabBarItem) => (
    <Link key={item.id} href={item.href as Route} className="relative flex min-h-[98px] flex-col items-center justify-center gap-[9px] rounded-[18px] px-[6px] py-[12px] text-center" style={CARD}>
      <span className="flex h-[44px] w-[44px] items-center justify-center rounded-full" style={{ background: "#EEF4F0", color: "#17604F" }}><Glyph path={item.icon} size={21} /></span>
      <span className="text-[12.5px] font-bold leading-[1.25]" style={{ color: INK }}>{item.label}</span>
      <Badge count={counts[item.id] ?? 0} urgent={Boolean(urgent[item.id])} />
    </Link>
  );

  const row = (link: Entry, last: boolean) => (
    <Link key={link.label} href={link.href as Route} className="flex min-h-[60px] items-center gap-[12px] px-[14px] py-[10px]" style={last ? undefined : { borderBottom: "1px solid #EDF3EF" }}>
      <span className="flex h-[40px] w-[40px] flex-none items-center justify-center rounded-full" style={{ background: "#EEF4F0", color: "#17604F" }}><Glyph path={link.icon} size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-bold leading-[1.3]" style={{ color: INK }}>{link.label}</span>
        {link.sub ? <span className="mt-[2px] block text-[12.5px] font-medium leading-[1.4]" style={{ color: MUTED }}>{link.sub}</span> : null}
      </span>
      <span style={{ color: "#A5B2AA" }}><Glyph path={CHEVRON} size={17} stroke={2} /></span>
    </Link>
  );

  return (
    <>
      <button type="button" aria-label="Close" onClick={onClose} className="fixed inset-0 z-[37] bg-[rgba(13,35,21,0.5)] md:hidden" />
      <div role="dialog" aria-label="More" className="fixed inset-x-0 bottom-0 z-[38] max-h-[90vh] overflow-y-auto overscroll-contain rounded-t-[28px] px-[16px] pb-[calc(20px+env(safe-area-inset-bottom))] pt-[10px] md:hidden" style={{ background: "#F4F7F5", boxShadow: "0 -12px 30px -18px rgba(13,35,21,0.55)" }}>
        <span className="mx-auto mb-[14px] block h-[4px] w-[38px] rounded-full" style={{ background: "#C9D6CE" }} />
        <div className="flex items-center justify-between">
          <h2 className="text-[22px] font-extrabold tracking-[-0.01em]" style={{ color: INK }}>More</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-white" style={{ color: INK, boxShadow: "0 1px 2px rgba(13,35,21,0.1)" }}>
            <Glyph path="M6 6l12 12M18 6 6 18" size={18} stroke={2.1} />
          </button>
        </div>

        <Link href={accountPath as Route} className="relative mt-[16px] flex items-center gap-[12px] overflow-hidden rounded-[20px] px-[14px] py-[14px]" style={{ background: INK }}>
          <span aria-hidden className="absolute -right-[40px] -top-[60px] h-[150px] w-[150px] rounded-full border-[1.5px]" style={{ borderColor: "rgba(95,214,180,0.14)" }} />
          <span className="relative flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full bg-[#E3F1EA] text-[14px] font-extrabold" style={{ color: INK }}>{initials(session.name)}</span>
          <span className="relative min-w-0 flex-1">
            <span className="block truncate text-[16px] font-extrabold text-white">{session.name}</span>
            <span className="mt-[1px] block truncate text-[12.5px] font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>{roleLabels[session.role]}{schoolName ? ` · ${schoolName}` : ""}</span>
          </span>
          <span className="relative flex flex-none items-center gap-[3px] text-[13px] font-extrabold" style={{ color: "#5FD6B4" }}>Account <Glyph path={CHEVRON} size={15} stroke={2.2} /></span>
        </Link>

        {schools.length > 1 ? (
          <>
            <Heading>Your schools</Heading>
            <div className="overflow-hidden rounded-[18px]" style={CARD}>
              {schools.map((entry, index) => (
                <button key={entry.schoolId} type="button" disabled={entry.current} onClick={() => void switchSchool(entry.schoolId)} className="flex min-h-[56px] w-full items-center justify-between gap-[10px] px-[16px] py-[10px] text-left disabled:bg-[#F7FAF8]" style={index ? { borderTop: "1px solid #EDF3EF" } : undefined}>
                  <span className="min-w-0 truncate text-[13.5px] font-bold" style={{ color: INK }}>{entry.schoolName}</span>
                  <span className="flex-none text-[12.5px] font-semibold" style={{ color: MUTED }}>{entry.current ? "You are here" : entry.role.replaceAll("_", " ").toLowerCase()}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {here.length ? (
          <>
            <Heading>On this screen</Heading>
            <div className="overflow-hidden rounded-[18px]" style={CARD}>{here.map((link, index) => row(link, index === here.length - 1))}</div>
          </>
        ) : null}

        {[...grouped, ...(others.length ? [{ title: "Also granted to you", items: others }] : [])].map((group) => (
          <section key={group.title}>
            <Heading>{group.title}</Heading>
            <div className="grid grid-cols-3 gap-[10px]">{group.items.map(tile)}</div>
          </section>
        ))}

        {quick.length ? (
          <>
            <Heading>Quick actions</Heading>
            <div className="overflow-hidden rounded-[18px]" style={CARD}>{quick.map((link, index) => row(link, index === quick.length - 1))}</div>
          </>
        ) : null}

        <button type="button" onClick={() => void signOut()} className="mt-[22px] flex min-h-[54px] w-full items-center justify-center gap-[9px] rounded-[16px] text-[14px] font-extrabold" style={{ ...CARD, color: "#B23B3B" }}>
          <Glyph path={OUT} size={18} stroke={2} />
          Sign out
        </button>
        <p className="mt-[10px] px-[10px] text-center text-[12.5px] font-medium leading-[1.45]" style={{ color: MUTED }}>Anything not yet synced stays saved on this device.</p>
      </div>
    </>
  );
}
