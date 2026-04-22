import { cn } from "@/lib/utils/cn";

type StatusTone = "neutral" | "success" | "warning" | "danger" | "brand";

const toneStyles: Record<StatusTone, { shell: string; dot: string }> = {
  neutral: {
    shell: "border-slate-200 bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
  },
  success: {
    shell: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  warning: {
    shell: "border-amber-200 bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
  },
  danger: {
    shell: "border-rose-200 bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
  },
  brand: {
    shell: "border-primary-200 bg-primary-50 text-primary-700",
    dot: "bg-primary-500",
  },
};

export function getWorkflowStatusTone(status?: string | null): StatusTone {
  if (!status) return "neutral";
  if (["PUBLISHED", "APPROVED", "MARKED", "GENERATED", "ACTIVE", "SUCCESS", "PAID"].includes(status)) return "success";
  if (["DRAFT", "IN_REVIEW", "UNDER_REVIEW", "SUBMITTED", "PENDING", "ISSUED"].includes(status)) return "warning";
  if (["REJECTED", "RETURNED", "CORRECTION_REQUESTED", "OVERDUE", "FAILED", "CANCELLED"].includes(status)) return "danger";
  return "brand";
}

export function StatusBadge({ status, tone }: { status: string; tone?: StatusTone }) {
  const resolvedTone = tone ?? getWorkflowStatusTone(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        toneStyles[resolvedTone].shell
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", toneStyles[resolvedTone].dot)} />
      {status.replaceAll("_", " ")}
    </span>
  );
}
