import { cn } from "@/lib/utils/cn";

type StatusTone = "neutral" | "success" | "warning" | "danger" | "brand";

const toneStyles: Record<StatusTone, { shell: string; dot: string }> = {
  neutral: {
    shell: "border-(--color-border-default) bg-(--color-bg-subtle) text-(--color-text-secondary)",
    dot: "bg-(--color-text-muted)",
  },
  success: {
    shell: "border-(--color-success-dim) bg-(--color-success-dim) text-(--color-success)",
    dot: "bg-(--color-success)",
  },
  warning: {
    shell: "border-(--color-warning-dim) bg-(--color-warning-dim) text-(--color-warning)",
    dot: "bg-(--color-warning)",
  },
  danger: {
    shell: "border-(--color-danger-dim) bg-(--color-danger-dim) text-danger",
    dot: "bg-danger",
  },
  brand: {
    shell: "border-(--color-accent-primary-dim) bg-(--color-accent-primary-dim) text-(--color-text-accent)",
    dot: "bg-(--color-accent-primary)",
  },
};

export function getWorkflowStatusTone(status?: string | null): StatusTone {
  if (!status) return "neutral";
  if (["PUBLISHED", "APPROVED", "MARKED", "GENERATED", "ACTIVE", "SUCCESS", "PAID", "REACTIVATED"].includes(status)) return "success";
  if (["DRAFT", "IN_REVIEW", "UNDER_REVIEW", "SUBMITTED", "PENDING", "ISSUED", "TRIAL", "GRACE_PERIOD"].includes(status)) return "warning";
  if (["REJECTED", "RETURNED", "CORRECTION_REQUESTED", "OVERDUE", "FAILED", "CANCELLED", "SUSPENDED", "ARCHIVED", "DELETED"].includes(status)) return "danger";
  return "brand";
}

export function StatusBadge({ status, tone }: { status: string; tone?: StatusTone }) {
  const resolvedTone = tone ?? getWorkflowStatusTone(status);

  return (
    <span className={cn("inline-block rounded-full px-[9px] py-[3px] text-[11px] font-bold", toneStyles[resolvedTone].shell.replace(/border-\[[^\]]+\]\s?/g, ""))}>
      {status.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())}
    </span>
  );
}
