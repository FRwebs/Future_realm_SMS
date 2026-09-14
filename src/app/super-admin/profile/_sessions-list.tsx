"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import type { SuperAdminInternalSession } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

const PAGE_SIZE = 5;

export function SessionsList({ sessions }: { sessions: SuperAdminInternalSession[] }) {
  const [page, setPage] = useState(1);

  if (!sessions.length) {
    return <p className="px-5 py-4 text-[12px] text-[var(--color-text-secondary)]">No other active sessions.</p>;
  }

  const totalPages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sessions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, sessions.length);
  const buttonBase =
    "flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border-default)] text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <>
      {pageRows.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-3.5 border-b border-[#F2F7F4] px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-semibold text-[var(--color-text-primary)]">{item.device ?? "Unknown device"}</p>
            <p className="text-pretty mt-0.5 text-[11px] text-[#8C9A92]">
              {item.ipAddress ?? "Unknown IP"} · expires {formatDate(item.expiresAt)}
            </p>
          </div>
          <ResourceActionDialog
            triggerLabel="Revoke"
            title="Revoke session"
            description="This immediately signs this device out. You'll need to sign in again there."
            endpoint={`/api/super-admin/internal-team/sessions/${item.id}/revoke`}
            method="PATCH"
            variant="textActionDanger"
            submitLabel="Revoke session"
            confirmLabel="Confirm"
            confirmMessage="This device will be signed out immediately."
            fields={[]}
          />
        </div>
      ))}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3 border-b border-[#F2F7F4] px-5 py-2.5">
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Showing {rangeStart}–{rangeEnd} of {sessions.length}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage <= 1}
              className={buttonBase}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <p className="text-[11px] font-semibold text-[var(--color-text-primary)]">
              Page {currentPage} of {totalPages}
            </p>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={currentPage >= totalPages}
              className={buttonBase}
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
