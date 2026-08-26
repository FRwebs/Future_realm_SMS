"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/ui/toast-provider";
import type { MyWorkApprovalItem } from "@/lib/domain/types";

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

async function callAction(endpoint: string, method: string, body: Record<string, unknown>) {
  const response = await fetch(endpoint, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": getCookie("fr_csrf") ?? ""
    },
    body: JSON.stringify(body)
  });

  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; success?: boolean; error?: string; message?: string };
  if (!response.ok || payload.ok === false || payload.success === false) {
    throw new Error(payload.error ?? payload.message ?? "Unable to complete this action.");
  }
  return payload;
}

export function MyWorkApprovalActions({ item }: { item: MyWorkApprovalItem }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, setPending] = useState<"approve" | "decline" | null>(null);

  async function handleApprove() {
    setPending("approve");
    try {
      await callAction(item.approveEndpoint, item.approveMethod, item.approveBody ?? {});
      showToast({ variant: "success", title: "Approved", description: item.title });
      router.refresh();
    } catch (error) {
      showToast({ variant: "error", title: "Couldn't approve", description: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setPending(null);
    }
  }

  async function handleDecline() {
    let reason: string | undefined;
    if (item.declineNeedsReason) {
      reason = window.prompt("Reason for declining (logged to the audit trail):")?.trim();
      if (!reason) return;
    }

    setPending("decline");
    try {
      await callAction(item.declineEndpoint, item.declineMethod, { ...(item.declineBody ?? {}), ...(reason ? { reason } : {}) });
      showToast({ variant: "success", title: "Declined", description: item.title });
      router.refresh();
    } catch (error) {
      showToast({ variant: "error", title: "Couldn't decline", description: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-2.5 flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleApprove}
        disabled={pending !== null}
        className="rounded-[8px] bg-[#0d2315] px-3 py-1.5 text-[11.5px] font-semibold text-white transition disabled:opacity-60"
      >
        {pending === "approve" ? "Working…" : item.approveLabel}
      </button>
      <button
        type="button"
        onClick={handleDecline}
        disabled={pending !== null}
        className="rounded-[8px] border border-[var(--color-border-default)] bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[var(--color-text-secondary)] transition disabled:opacity-60"
      >
        {pending === "decline" ? "Working…" : "Decline"}
      </button>
    </div>
  );
}
