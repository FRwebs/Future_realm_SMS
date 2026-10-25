"use client";

import { InlineNotice, useNotice } from "@/components/ui/inline-notice";
import { cn } from "@/lib/utils/cn";

/**
 * A control the product shows but does not yet do. Pressing it says so — and why — right under the control, rather than in a corner of the
 * screen, and the person can see at a glance that nothing happened.
 */
export function UnbuiltAction({ label, note, className }: { label: string; note: string; className?: string }) {
  const notice = useNotice();
  return (
    <span className="inline-flex max-w-full flex-col items-start gap-[8px]">
      <button type="button" onClick={() => notice.info("Not built yet", note)} className={cn("btn-secondary px-4 text-[11.5px]", className)}>
        {label}
      </button>
      <InlineNotice notice={notice.notice} onDismiss={notice.clear} compact className="max-w-[360px]" />
    </span>
  );
}
