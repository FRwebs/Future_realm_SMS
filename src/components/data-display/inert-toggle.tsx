"use client";

import { useToast } from "@/components/ui/toast-provider";

/** A toggle-styled row that isn't backed by real functionality — clicking it explains why,
 * instead of sitting there dead. Matches the mockup's visual shape without overclaiming. */
export function InertToggleRow({ label, detail, note }: { label: string; detail: string; note: string }) {
  const { showToast } = useToast();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => showToast({ variant: "info", title: "Not built", description: note })}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          showToast({ variant: "info", title: "Not built", description: note });
        }
      }}
      className="flex cursor-pointer items-center gap-2.5 border-b border-[var(--color-border-subtle)] py-2.5 last:border-0"
    >
      <div className="h-[19px] w-[34px] shrink-0 rounded-full bg-[#D5E0DA] p-0.5">
        <div className="h-[15px] w-[15px] rounded-full bg-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{label}</p>
        <p className="text-[11.5px] text-[var(--color-text-muted)]">{detail}</p>
      </div>
    </div>
  );
}
