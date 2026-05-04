import { cn } from "@/lib/utils/cn";

type StatusTone = "neutral" | "success" | "warning" | "danger" | "brand";

const toneStyles: Record<StatusTone, { shell: string; dot: string }> = {
  neutral: {
    shell: "border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]",
    dot: "bg-[var(--color-text-muted)]",
  },
  success: {
    shell: "border-[var(--color-success-dim)] bg-[var(--color-success-dim)] text-[var(--color-success)]",
    dot: "bg-[var(--color-success)]",
  },
  warning: {
    shell: "border-[var(--color-warning-dim)] bg-[var(--color-warning-dim)] text-[var(--color-warning)]",
    dot: "bg-[var(--color-warning)]",
  },
  danger: {
    shell: "border-[var(--color-danger-dim)] bg-[var(--color-danger-dim)] text-[var(--color-danger)]",
    dot: "bg-[var(--color-danger)]",
  },
  brand: {
    shell: "border-[var(--color-accent-primary-dim)] bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]",
    dot: "bg-[var(--color-accent-primary)]",
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
