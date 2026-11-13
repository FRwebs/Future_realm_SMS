"use client";

import { useOnline } from "@/lib/ui/use-online";

/** The curved dark header of the phone sign-in: the brand, whether this phone is online, and what the product is for. */
export function LoginHero() {
  const online = useOnline();
  return (
    <div className="relative flex-none md:hidden">
      <div
        className="relative z-[2] overflow-hidden rounded-b-[30px] bg-[#0d2315] px-5 pb-7 pt-[calc(4px+env(safe-area-inset-top))]"
        style={{ boxShadow: "0 16px 30px -24px rgba(13,35,21,0.9)" }}
      >
        <span aria-hidden="true" className="absolute -bottom-[120px] -right-20 h-[260px] w-[260px] rounded-full border-[1.5px] border-[rgba(95,214,180,0.14)]" />
        <span aria-hidden="true" className="absolute -bottom-[76px] -right-9 h-[172px] w-[172px] rounded-full border-[1.5px] border-[rgba(95,214,180,0.12)]" />
        <span aria-hidden="true" className="absolute -bottom-8 right-2 h-[84px] w-[84px] rounded-full border-[1.5px] border-[rgba(95,214,180,0.1)]" />
        <div className="relative flex h-[54px] items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-gold)" }} />
            <span className="text-[13px] font-extrabold tracking-[0.08em] text-white">FUTUREREALM SMS</span>
          </span>
          <span role="status" className="flex items-center gap-[6px] rounded-full bg-[rgba(255,255,255,0.1)] px-3 py-[7px]">
            <span className="h-[6px] w-[6px] flex-none rounded-full" style={{ background: online ? "#3ee08a" : "#8a9a92" }} />
            <span className="whitespace-nowrap text-[11.5px] font-bold text-white">{online ? "Online" : "Offline · works anyway"}</span>
          </span>
        </div>
        <h1 className="relative mt-3 max-w-[290px] text-[25px] font-extrabold leading-[1.15] tracking-[-0.02em] text-white [text-wrap:balance]">
          Every school day, accounted for.
        </h1>
        <ul className="relative mt-[14px] flex flex-wrap gap-[7px]">
          {["Works offline", "Any curriculum", "Role-based access"].map((label) => (
            <li key={label} className="flex items-center gap-[6px] rounded-full bg-[rgba(255,255,255,0.08)] py-[6px] pl-[7px] pr-[11px]">
              <span className="flex h-4 w-4 flex-none items-center justify-center rounded-full bg-[#5fd6b4]">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0d2315" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5 9-10" /></svg>
              </span>
              <span className="whitespace-nowrap text-[11.5px] font-bold text-white">{label}</span>
            </li>
          ))}
        </ul>
      </div>
      <div aria-hidden="true" className="relative z-[1] mx-[18px] -mt-[26px] h-10 rounded-b-[20px] bg-[#d5eadf]" />
    </div>
  );
}
