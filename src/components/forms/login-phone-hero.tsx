"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";

import { useApiState } from "@/lib/api/wake";

const POINTS = ["Works offline", "Any curriculum", "Role-based access"];

/** Whether this phone has a connection, and whether the school's server has answered: the two things the pill in the corner says. */
function useConnection() {
  const apiState = useApiState();
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const read = () => setOnline(navigator.onLine);
    read();
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => { window.removeEventListener("online", read); window.removeEventListener("offline", read); };
  }, []);
  if (!online) return { label: "Offline", dot: "#E58B8B" };
  if (apiState === "waking" || apiState === "checking") return { label: "Connecting", dot: "#E7C45A" };
  if (apiState === "unreachable") return { label: "Server not answering", dot: "#E58B8B" };
  return { label: "Online", dot: "#5FD6B4" };
}

/**
 * The top of the sign-in page on a phone, drawn from the teacher and parent mobile mockups: a dark curved header on a pale ledge, the
 * wordmark with the connection beside it, one line about the product, and three promises as pills. From `md` up the page has its
 * two-column layout instead and this is not rendered.
 */
export function LoginPhoneHero() {
  const link = useConnection();
  return (
    <div className="relative flex-none md:hidden">
      <div
        className="relative z-[2] overflow-hidden rounded-b-[30px] bg-[#0D2315] px-5 pb-7 pt-[calc(4px+env(safe-area-inset-top))]"
        style={{ boxShadow: "0 16px 30px -24px rgba(13,35,21,0.9)" }}
      >
        <span aria-hidden className="absolute -bottom-[120px] -right-20 h-[260px] w-[260px] rounded-full border-[1.5px] border-[rgba(95,214,180,0.14)]" />
        <span aria-hidden className="absolute -bottom-[76px] -right-9 h-[172px] w-[172px] rounded-full border-[1.5px] border-[rgba(95,214,180,0.12)]" />
        <span aria-hidden className="absolute -bottom-8 right-2 h-[84px] w-[84px] rounded-full border-[1.5px] border-[rgba(95,214,180,0.1)]" />
        <div className="relative flex h-[54px] items-center justify-between">
          <span className="text-[21px] font-black tracking-[-0.02em] text-white">Nooria</span>
          <span role="status" className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-[7px]">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: link.dot }} />
            <span className="whitespace-nowrap text-[11.5px] font-bold text-white">{link.label}</span>
          </span>
        </div>
        {/* One line, whatever the width: the type shrinks with the header instead of wrapping. */}
        <div className="relative mt-3 [container-type:inline-size]">
          <p className="whitespace-nowrap font-extrabold leading-[1.15] tracking-[-0.02em] text-white [font-size:min(22px,6.1cqi)]">Every school day, accounted for.</p>
        </div>
        <ul className="relative mt-3.5 flex flex-wrap gap-[7px]">
          {POINTS.map((point) => (
            <li key={point} className="flex items-center gap-1.5 rounded-full bg-white/[0.08] py-1.5 pl-[7px] pr-[11px]">
              <span aria-hidden className="flex h-4 w-4 flex-none items-center justify-center rounded-full bg-[#5FD6B4]">
                <Check className="h-[9px] w-[9px] text-[#0D2315]" strokeWidth={3.6} />
              </span>
              <span className="whitespace-nowrap text-[11.5px] font-bold text-white">{point}</span>
            </li>
          ))}
        </ul>
      </div>
      <div aria-hidden className="relative z-[1] -mt-[26px] mx-[18px] h-10 rounded-b-[20px] bg-[#D5EADF]" />
    </div>
  );
}
