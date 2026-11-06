"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { initials } from "@/components/layout/topbar";
import type { TabBarItem } from "@/components/layout/portal-tab-bar";
import type { SessionUser } from "@/lib/domain/types";

const INK = "#0D2315";
const MUTED = "#5C6B62";
const CARD = { background: "#fff", boxShadow: "0 1px 2px rgba(13,35,21,0.05), 0 8px 22px -16px rgba(13,35,21,0.22)" };

const SEND = "M5 12.5 20 5l-4.5 15-3.5-6.5L5 12.5z";
const HELP = "M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4M12 16.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z";
const CLOCK = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2";
const OUT = "M9 4.5H5.5v15H9M14 8l4 4-4 4M18 12H9.5";
const CHEVRON = "m9 6 6 6-6 6";

type Entry = { label: string; sub: string; icon: string; href: string; page: string };

/**
 * What a student reaches for from anywhere, each going to the page that does it.
 *
 * The mockup opens these as sheets over whatever is on screen; here each is the page itself, with its own address — so a student
 * can be sent one, and come back to it. Only a page this school shows its students is offered.
 */
const QUICK: Entry[] = [
  { label: "Hand in work", sub: "What is still waiting for you", icon: SEND, href: "/portals/student/assignments", page: "assignments" },
  { label: "Ask a teacher", sub: "About work, a topic or a result", icon: HELP, href: "/portals/student/messages?ask=1", page: "messages" },
  { label: "Ask for more time", sub: "Your teacher decides, and replies in Messages", icon: CLOCK, href: "/portals/student/messages?ask=1&about=time", page: "messages" },
];

/** The mockup's own four headings over the pages that are not on the bar. */
const GROUPS: Array<{ title: string; pages: string[] }> = [
  { title: "My learning", pages: ["timetable", "attendance", "calendar"] },
  { title: "My school", pages: ["messages"] },
  { title: "Me", pages: ["profile", "notifications", "account"] },
  { title: "This phone", pages: ["sync"] },
];

const slugOf = (item: TabBarItem) => item.id.replace(/^s_/, "");

function Glyph({ path, size = 20, stroke = 1.8 }: { path: string; size?: number; stroke?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={path} /></svg>;
}
const Heading = ({ children }: { children: React.ReactNode }) => <h3 className="mb-[10px] mt-[22px] px-[2px] text-[16px] font-extrabold" style={{ color: INK }}>{children}</h3>;

/**
 * The More sheet of the student mobile mockup: who is signed in, every page that is not on the bar under its heading, the three
 * things a student does from anywhere, and the way out. A heading with nothing under it — a page this school keeps back from its
 * students — is not drawn.
 */
export function StudentMoreSheet({ items, primaryIds, counts, urgent, session, school, line, onClose }: {
  items: TabBarItem[];
  primaryIds: string[];
  counts: Record<string, number>;
  urgent: Record<string, boolean>;
  session: SessionUser;
  school?: string;
  /** The student's class and admission number, as the rail's own card says it. */
  line?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const shown = new Set(items.map(slugOf));
  const rest = items.filter((item) => !primaryIds.includes(item.id));
  const groups = GROUPS.map((group) => ({ title: group.title, items: group.pages.map((page) => rest.find((item) => slugOf(item) === page)).filter((item): item is TabBarItem => Boolean(item)) })).filter((group) => group.items.length);
  const placed = new Set(groups.flatMap((group) => group.items.map((item) => item.id)));
  const loose = rest.filter((item) => !placed.has(item.id));
  const quick = QUICK.filter((entry) => shown.has(entry.page));

  async function signOut() {
    await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  const tile = (item: TabBarItem) => {
    const count = counts[item.id] ?? 0;
    return (
      <Link key={item.id} href={item.href as Route} className="relative flex min-h-[98px] flex-col items-center justify-center gap-[9px] rounded-[18px] px-[6px] py-[12px] text-center" style={CARD}>
        <span className="flex h-[44px] w-[44px] items-center justify-center rounded-full" style={{ background: "#EEF4F0", color: "#17604F" }}><Glyph path={item.icon} size={21} /></span>
        <span className="text-[12.5px] font-bold leading-[1.25]" style={{ color: INK }}>{item.label}</span>
        {count ? <span className="absolute right-[10px] top-[8px] flex h-[19px] min-w-[19px] items-center justify-center rounded-full px-[5px] text-[10.5px] font-black" style={{ background: urgent[item.id] ? "#C93F3F" : "#E0A526", color: urgent[item.id] ? "#fff" : INK, border: "2px solid #fff" }}>{count > 9 ? "9+" : count}</span> : null}
      </Link>
    );
  };

  return (
    <>
      <button type="button" aria-label="Close" onClick={onClose} className="fixed inset-0 z-[37] bg-[rgba(13,35,21,0.5)] md:hidden" />
      <div role="dialog" aria-label="More" className="fixed inset-x-0 bottom-0 z-[38] max-h-[90vh] overflow-y-auto overscroll-contain rounded-t-[28px] px-[16px] pb-[calc(20px+env(safe-area-inset-bottom))] pt-[10px] md:hidden" style={{ background: "#F4F7F5", boxShadow: "0 -12px 30px -18px rgba(13,35,21,0.55)" }}>
        <span className="mx-auto mb-[14px] block h-[4px] w-[38px] rounded-full" style={{ background: "#C9D6CE" }} />
        <div className="flex items-center justify-between">
          <h2 className="text-[22px] font-extrabold tracking-[-0.01em]" style={{ color: INK }}>More</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-white" style={{ color: INK, boxShadow: "0 1px 2px rgba(13,35,21,0.1)" }}><Glyph path="M6 6l12 12M18 6 6 18" size={18} stroke={2.1} /></button>
        </div>

        <Link href={"/portals/student/account" as Route} className="relative mt-[16px] flex items-center gap-[12px] overflow-hidden rounded-[20px] px-[14px] py-[14px]" style={{ background: INK }}>
          <span aria-hidden className="absolute -right-[40px] -top-[60px] h-[150px] w-[150px] rounded-full border-[1.5px]" style={{ borderColor: "rgba(95,214,180,0.14)" }} />
          <span className="relative flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full bg-[#E3F1EA] text-[15px] font-extrabold" style={{ color: INK }}>{initials(session.name)}</span>
          <span className="relative min-w-0 flex-1">
            <span className="block truncate text-[16px] font-extrabold text-white">{session.name}</span>
            <span className="mt-[1px] block truncate text-[12.5px] font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>{[line, school].filter(Boolean).join(" · ") || "Student"}</span>
          </span>
          <span className="relative flex flex-none items-center gap-[3px] text-[13.5px] font-extrabold" style={{ color: "#5FD6B4" }}>Account <Glyph path={CHEVRON} size={15} stroke={2.2} /></span>
        </Link>

        {[...groups, ...(loose.length ? [{ title: "Also for you", items: loose }] : [])].map((group) => (
          <section key={group.title}><Heading>{group.title}</Heading><div className="grid grid-cols-3 gap-[10px]">{group.items.map(tile)}</div></section>
        ))}

        {quick.length ? (
          <>
            <Heading>Quick actions</Heading>
            <div className="overflow-hidden rounded-[18px]" style={CARD}>
              {quick.map((entry, index) => (
                <Link key={entry.label} href={entry.href as Route} className="flex min-h-[60px] items-center gap-[12px] px-[14px] py-[10px]" style={index === quick.length - 1 ? undefined : { borderBottom: "1px solid #EDF3EF" }}>
                  <span className="flex h-[40px] w-[40px] flex-none items-center justify-center rounded-full" style={{ background: "#EEF4F0", color: "#17604F" }}><Glyph path={entry.icon} size={18} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-bold leading-[1.3]" style={{ color: INK }}>{entry.label}</span>
                    <span className="mt-[2px] block text-[12.5px] font-medium leading-[1.4]" style={{ color: MUTED }}>{entry.sub}</span>
                  </span>
                  <span style={{ color: "#A5B2AA" }}><Glyph path={CHEVRON} size={17} stroke={2} /></span>
                </Link>
              ))}
            </div>
          </>
        ) : null}

        <button type="button" onClick={() => void signOut()} className="mt-[22px] flex min-h-[54px] w-full items-center justify-center gap-[9px] rounded-[16px] text-[15px] font-extrabold" style={{ ...CARD, color: "#B23B3B" }}>
          <Glyph path={OUT} size={18} stroke={2} />Sign out
        </button>
        <p className="mt-[10px] px-[10px] text-center text-[12.5px] font-medium leading-[1.45]" style={{ color: MUTED }}>Each page is read from your school as it opens, so sign out leaves nothing behind on this phone.</p>
      </div>
    </>
  );
}
