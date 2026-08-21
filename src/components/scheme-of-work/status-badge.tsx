import type { SchemeOfWorkStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

const statusConfig: Record<
  SchemeOfWorkStatus,
  { label: string; tone: { background: string; color: string; borderColor: string }; dot: string }
> = {
  APPROVED: {
    label: "Approved",
    tone: {
      background: "var(--color-success-dim)",
      color: "var(--color-success)",
      borderColor: "var(--color-success)"
    },
    dot: "var(--color-success)"
  },
  SUBMITTED: {
    label: "Submitted",
    tone: {
      background: "var(--color-warning-dim)",
      color: "var(--color-warning)",
      borderColor: "var(--color-warning)"
    },
    dot: "var(--color-warning)"
  },
  DRAFT: {
    label: "Draft",
    tone: {
      background: "var(--color-bg-subtle)",
      color: "var(--color-text-secondary)",
      borderColor: "var(--color-border-default)"
    },
    dot: "var(--color-text-muted)"
  },
  RETURNED: {
    label: "Returned",
    tone: {
      background: "var(--color-danger-dim)",
      color: "var(--color-danger)",
      borderColor: "var(--color-danger)"
    },
    dot: "var(--color-danger)"
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
        size === "sm" ? "px-2.5 py-1 text-[0.68rem]" : "px-3 py-1.5 text-xs"
      )}
      style={config.tone}
    >
      <span
        className={cn("rounded-full", size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2")}
        style={{ background: config.dot }}
      />
      {config.label}
    </span>
  );
}
