"use client";

import { DevicePanel } from "@/components/modules/device-panel";

/**
 * "This phone", folded shut. The home of Sync shows what is waiting; what this phone knows about itself — whether it is online, how much it
 * holds, whether the browser will keep it — is one tap away, in the same panel the laptop shows.
 */
export function PhoneDevice() {
  return (
    <details className="group rounded-[18px] bg-white" style={{ boxShadow: "0 1px 2px rgba(13,35,21,0.05), 0 8px 22px -14px rgba(13,35,21,0.22)" }}>
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between px-[18px] text-[14px] font-extrabold text-[#0D2315] [&::-webkit-details-marker]:hidden">
        This phone
        <span className="flex h-[32px] w-[32px] items-center justify-center rounded-full bg-[#EEF4F0] text-[#435048] transition-transform group-open:rotate-180" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </span>
      </summary>
      <div className="px-[10px] pb-[10px]">
        <DevicePanel title="Held on this phone" sub="What this phone knows that the server cannot." />
      </div>
    </details>
  );
}
