"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import type { Role } from "@/lib/domain/types";

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

function defaultPathForRole(role: string) {
  if (role === "PARENT") return "/portals/parent";
  if (role === "PRINCIPAL") return "/portals/principal";
  if (role === "TEACHER" || role === "CLASS_TEACHER" || role === "SUBJECT_TEACHER") return "/portals/teacher";
  if (role === "ADMISSIONS_OFFICER") return "/portals/admission-officer";
  if (role === "EXAM_OFFICER" || role === "EXAMINATION_OFFICER") return "/portals/exam-officer";
  if (role === "SCHOOL_NURSE" || role === "NURSE") return "/portals/nurse";
  if (role === "LIBRARIAN") return "/portals/librarian";
  if (role === "RECEPTIONIST") return "/portals/front-desk";
  if (role === "HOSTEL_MANAGER" || role === "HOSTEL_MASTER" || role === "HOSTEL_MATRON" || role === "HOSTEL_MISTRESS") return "/portals/hostel";
  if (role === "TRANSPORT_COORDINATOR" || role === "TRANSPORT_MANAGER") return "/portals/transport";
  if (role === "STUDENT") return "/portals/student";
  if (role === "BURSAR" || role === "ACCOUNTANT" || role === "ACCOUNT_OFFICER") return "/finance";
  return "/dashboard";
}

interface ImpersonateUserDialogProps {
  userId: string;
  userName: string;
}

export function ImpersonateUserDialog({ userId, userName }: ImpersonateUserDialogProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/super-admin/impersonate/${userId}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCookie("fr_csrf") ?? "",
        },
        body: JSON.stringify({ reason }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: string;
        data?: { user?: { role?: Role } };
      };

      if (!response.ok || body.ok === false) {
        throw new Error(body.error ?? "Unable to start impersonation");
      }

      const destination = defaultPathForRole(body.data?.user?.role ?? "");
      showToast({
        variant: "success",
        title: "Impersonation started",
        description: `Redirecting to ${userName}'s interface.`,
      });
      setOpen(false);
      router.replace(destination);
      router.refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to start impersonation";
      setError(message);
      showToast({ variant: "error", title: "Unable to impersonate", description: message });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-destructive inline-flex items-center justify-center gap-2 px-5 text-[13px] font-semibold">
        <AlertTriangle className="h-4 w-4" />
        Impersonate
      </button>

      <Modal
        open={open}
        onClose={() => {
          if (!pending) {
            setOpen(false);
            setConfirming(false);
            setError(null);
          }
        }}
        title={`Impersonate ${userName}`}
        subtitle="Generate a 30-minute audited support session and switch into this user's interface."
        size="lg"
      >
        <div className="grid gap-5">
          <label className="grid gap-2">
            <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Reason for impersonation</span>
            <textarea
              required
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setConfirming(false);
              }}
              className="field-control min-h-32 resize-y"
              placeholder="Describe the support issue or verified request."
            />
          </label>

          {confirming ? (
            <div className="rounded-[12px] border border-[var(--color-warning-dim)] bg-[var(--color-warning-dim)] px-4 py-3 text-[12.5px] font-semibold text-[var(--color-warning)]">
              This creates a time-boxed, fully-logged view-as session.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-[12px] border border-[var(--color-danger-dim)] bg-[var(--color-danger-dim)] px-4 py-3 text-[12.5px] font-semibold text-[var(--color-danger)]">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-secondary h-10 px-4 text-[12.5px]" onClick={() => setOpen(false)} disabled={pending}>Cancel</button>
            <button type="button" className="btn-destructive h-10 px-4 text-[12.5px]" onClick={submit} disabled={pending || reason.trim().length < 3}>
              {pending ? "Starting..." : confirming ? "Confirm Impersonation" : "Generate token"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
