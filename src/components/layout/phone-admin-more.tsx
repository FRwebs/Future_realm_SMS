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

const BELL = "M12 3.5A5.5 5.5 0 0 0 6.5 9v3.2L5 15.5h14l-1.5-3.3V9A5.5 5.5 0 0 0 12 3.5zM10 18.5a2 2 0 0 0 4 0";
const WARN = "M12 4.5 21 19.5H3zM12 10v4M12 16.8h.01";
const USER = "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c0-3.6 3.3-6 7.5-6s7.5 2.4 7.5 6";
const LOCK = "M4.5 10.5h15V20h-15zM8 10.5V7.5a4 4 0 0 1 8 0v3";
const OUT = "M9 4.5H5.5v15H9M14 8l4 4-4 4M18 12H9.5";
const CHEVRON = "m9 6 6 6-6 6";

function Glyph({ path, size = 20, stroke = 1.8 }: { path: string; size?: number; stroke?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={path} /></svg>;
}
const Heading = ({ children }: { children: React.ReactNode }) => <h3 className="mb-[10px] mt-[22px] px-[2px] text-[16px] font-extrabold" style={{ color: INK }}>{children}</h3>;

/**
 * The More sheet of the School Admin mobile mockup.
 *
 * It is the rail, kept in the rail's own sections — Academic Operations, People, Finance and the rest — so a module is where the
 * person already knows it is, rather than reordered for the sake of a phone. Under it are the things that belong to the person
 * rather than a module: what is routed to them, their own record, and the way out.
 */
export function AdminMoreSheet({ groups, counts, urgent, session, schoolName, role, pageActs, onClose }: {
  /** The rail's sections, minus whatever is already a tab. */
  groups: Array<{ title: string; items: TabBarItem[] }>;
  counts: Record<string, number>;
  urgent: Record<string, boolean>;
  session: SessionUser;
  schoolName?: string;
  /** What this person is called at this school, for their own card. */
  role: string;
  /** What the page underneath can do, in its own words. The sheet asks the page to run one by index. */
  pageActs: string[];
  onClose: () => void;
}) {
  const router = useRouter();

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
        <span className="text-[12.5px] font-bold leading-[1.25]" style={{ color: INK }}>{item.short ?? item.label}</span>
        {count ? <span className="absolute right-[10px] top-[8px] flex h-[19px] min-w-[19px] items-center justify-center rounded-full px-[5px] text-[10.5px] font-black" style={{ background: urgent[item.id] ? "#C93F3F" : "#E0A526", color: urgent[item.id] ? "#fff" : INK, border: "2px solid #fff" }}>{count > 9 ? "9+" : count}</span> : null}
      </Link>
    );
  };

  const rows: Array<{ label: string; sub: string; icon: string; href: string }> = [
    { label: "Notifications", sub: "Everything routed to you", icon: BELL, href: "/account/notifications" },
    { label: "Emergency broadcast", sub: "Every family, every channel, at once", icon: WARN, href: "/communication-center/compose?urgent=1" },
    { label: "My profile", sub: "What the school holds about you", icon: USER, href: "/account" },
    { label: "Sign-in and security", sub: "Password, devices, two-step", icon: LOCK, href: "/account/security" },
  ];

  return (
    <>
      <button type="button" aria-label="Close" onClick={onClose} className="fixed inset-0 z-[37] bg-[rgba(13,35,21,0.5)] md:hidden" />
      <div role="dialog" aria-label="More" className="fixed inset-x-0 bottom-0 z-[38] max-h-[90vh] overflow-y-auto overscroll-contain rounded-t-[28px] px-[16px] pb-[calc(20px+env(safe-area-inset-bottom))] pt-[10px] md:hidden" style={{ background: "#F4F7F5", boxShadow: "0 -12px 30px -18px rgba(13,35,21,0.55)" }}>
        <span className="mx-auto mb-[14px] block h-[4px] w-[38px] rounded-full" style={{ background: "#C9D6CE" }} />
        <div className="flex items-center justify-between">
          <h2 className="text-[22px] font-extrabold tracking-[-0.01em]" style={{ color: INK }}>More</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-white" style={{ color: INK, boxShadow: "0 1px 2px rgba(13,35,21,0.1)" }}><Glyph path="M6 6l12 12M18 6 6 18" size={18} stroke={2.1} /></button>
        </div>

        <Link href={"/account" as Route} className="relative mt-[16px] flex items-center gap-[12px] overflow-hidden rounded-[20px] px-[14px] py-[14px]" style={{ background: INK }}>
          <span aria-hidden className="absolute -right-[40px] -top-[60px] h-[150px] w-[150px] rounded-full border-[1.5px]" style={{ borderColor: "rgba(95,214,180,0.14)" }} />
          <span className="relative flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full bg-[#E3F1EA] text-[15px] font-extrabold" style={{ color: INK }}>{initials(session.name)}</span>
          <span className="relative min-w-0 flex-1">
            <span className="block truncate text-[16px] font-extrabold text-white">{session.name}</span>
            <span className="mt-[1px] block truncate text-[12.5px] font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>{[role, schoolName].filter(Boolean).join(" · ")}</span>
          </span>
          <span className="relative flex flex-none items-center gap-[3px] text-[13.5px] font-extrabold" style={{ color: "#5FD6B4" }}>Account <Glyph path={CHEVRON} size={15} stroke={2.2} /></span>
        </Link>

        {/* What the page underneath offers, before the rest of the portal: a thumb that opened More
            while reading a page is more likely to want something on it than a different module. */}
        {pageActs.length ? (
          <>
            <Heading>On this screen</Heading>
            <div className="overflow-hidden rounded-[18px]" style={CARD}>
              {pageActs.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => { onClose(); window.dispatchEvent(new CustomEvent("fr:page-act", { detail: index })); }}
                  className="flex min-h-[60px] w-full items-center gap-[12px] px-[14px] py-[10px] text-left"
                  style={index === pageActs.length - 1 ? undefined : { borderBottom: "1px solid #EDF3EF" }}
                >
                  <span className="flex h-[40px] w-[40px] flex-none items-center justify-center rounded-full" style={{ background: "#EEF4F0", color: "#17604F" }}><Glyph path={CHEVRON} size={18} /></span>
                  <span className="min-w-0 flex-1 text-[14.5px] font-bold leading-[1.3]" style={{ color: INK }}>{label}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {groups.map((group) => (
          <section key={group.title}><Heading>{group.title}</Heading><div className="grid grid-cols-3 gap-[10px]">{group.items.map(tile)}</div></section>
        ))}

        <Heading>You</Heading>
        <div className="overflow-hidden rounded-[18px]" style={CARD}>
          {rows.map((entry, index) => (
            <Link key={entry.label} href={entry.href as Route} className="flex min-h-[60px] items-center gap-[12px] px-[14px] py-[10px]" style={index === rows.length - 1 ? undefined : { borderBottom: "1px solid #EDF3EF" }}>
              <span className="flex h-[40px] w-[40px] flex-none items-center justify-center rounded-full" style={{ background: "#EEF4F0", color: "#17604F" }}><Glyph path={entry.icon} size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-bold leading-[1.3]" style={{ color: INK }}>{entry.label}</span>
                <span className="mt-[2px] block text-[12.5px] font-medium leading-[1.4]" style={{ color: MUTED }}>{entry.sub}</span>
              </span>
              <span style={{ color: "#A5B2AA" }}><Glyph path={CHEVRON} size={17} stroke={2} /></span>
            </Link>
          ))}
        </div>

        <button type="button" onClick={() => void signOut()} className="mt-[22px] flex min-h-[54px] w-full items-center justify-center gap-[9px] rounded-[16px] text-[15px] font-extrabold" style={{ ...CARD, color: "#B23B3B" }}>
          <Glyph path={OUT} size={18} stroke={2} />Sign out
        </button>
        <p className="mt-[10px] px-[10px] text-center text-[12.5px] font-medium leading-[1.45]" style={{ color: MUTED }}>Anything not yet synced stays saved on this device.</p>
      </div>
    </>
  );
}
