import type { SchemeOfWorkStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

const statusConfig: Record<SchemeOfWorkStatus, { label: string; tone: string; dot: string }> = {
  APPROVED: {
    label: "Approved",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-500"
  },
  SUBMITTED: {
    label: "Submitted",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
    dot: "bg-amber-500"
  },
  DRAFT: {
    label: "Draft",
    tone: "border-slate-200 bg-slate-50 text-slate-700",
    dot: "bg-slate-400"
  },
  RETURNED: {
    label: "Returned",
    tone: "border-rose-200 bg-rose-50 text-rose-800",
    dot: "bg-rose-500"
  }
};

export function SchemeOfWorkStatusBadge({
  status,
  size = "md"
}: {
  status?: string | null;
  size?: "sm" | "md";
}) {
  const normalized = (status?.toUpperCase() as SchemeOfWorkStatus | undefined) ?? "DRAFT";
  const config = statusConfig[normalized] ?? statusConfig.DRAFT;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border font-semibold",
        config.tone,
        size === "sm" ? "px-2.5 py-1 text-[0.68rem]" : "px-3 py-1.5 text-xs"
      )}
    >
      <span className={cn("rounded-full", config.dot, size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2")} />
      {config.label}
    </span>
  );
}
