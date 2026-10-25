"use client";

import { InlineNotice, useNotice } from "@/components/ui/inline-notice";

/** A toggle-styled row that isn't backed by real functionality — clicking it explains why, right under the row,
 * instead of sitting there dead. Matches the mockup's visual shape without overclaiming. */
export function InertToggleRow({ label, detail, note }: { label: string; detail: string; note: string }) {
  const notice = useNotice();
  const say = () => notice.info("Not built yet", note);

  return (
    <div className="border-b border-[var(--color-border-subtle)] last:border-0">
      <div
        role="button"
        tabIndex={0}
        onClick={say}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            say();
          }
        }}
        className="flex cursor-pointer items-center gap-2.5 py-2.5"
      >
        <div className="h-[19px] w-[34px] shrink-0 rounded-full bg-[#D5E0DA] p-0.5">
          <div className="h-[15px] w-[15px] rounded-full bg-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{label}</p>
          <p className="text-[11.5px] text-[var(--color-text-muted)]">{detail}</p>
        </div>
      </div>
      <InlineNotice notice={notice.notice} onDismiss={notice.clear} compact className="mb-2.5" />
    </div>
  );
}
