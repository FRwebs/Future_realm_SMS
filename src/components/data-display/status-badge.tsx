import { cn } from "@/lib/utils/cn";

type StatusTone = "neutral" | "success" | "warning" | "danger" | "brand";

const toneStyles: Record<StatusTone, string> = {
  neutral: "border-ink/10 bg-sand/70 text-ink/70",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-rose-200 bg-rose-50 text-rose-800",
  brand: "border-brand-100 bg-brand-50 text-brand-800"
};

export function getWorkflowStatusTone(status?: string | null): StatusTone {
  if (!status) return "neutral";
  if (["PUBLISHED", "APPROVED", "MARKED", "GENERATED", "ACTIVE", "SUCCESS", "PAID"].includes(status)) return "success";
  if (["DRAFT", "IN_REVIEW", "UNDER_REVIEW", "SUBMITTED", "PENDING", "ISSUED"].includes(status)) return "warning";
  if (["REJECTED", "RETURNED", "CORRECTION_REQUESTED", "OVERDUE", "FAILED", "CANCELLED"].includes(status)) return "danger";
  return "brand";
}

export function StatusBadge({ status, tone }: { status: string; tone?: StatusTone }) {
  return (
    <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", toneStyles[tone ?? getWorkflowStatusTone(status)])}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
