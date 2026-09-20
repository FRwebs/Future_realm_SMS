"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import { formatDate } from "@/lib/utils/formatters";

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

async function apiCall<T>(endpoint: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(endpoint, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": getCookie("fr_csrf") ?? "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = (await response.json()) as { ok?: boolean; error?: string; data?: T };
  if (!response.ok || result.ok === false) {
    throw new Error(result.error ?? "Request failed");
  }
  return result.data as T;
}

function BackupCodesView({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  return (
    <div className="grid gap-4">
      <p className="text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">
        Save these codes somewhere safe. Each one works once, as a way in if you lose access to your authenticator app.
        They won&apos;t be shown again.
      </p>
      <div className="grid grid-cols-2 gap-2 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4 font-[var(--font-mono)] text-[13px]">
        {codes.map((code) => (
          <span key={code}>{code}</span>
        ))}
      </div>
      <button type="button" onClick={onDone} className="btn-primary">
        I&apos;ve saved these codes
      </button>
    </div>
  );
}

function SetupFlow({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [step, setStep] = useState<"loading" | "scan" | "done">("loading");
  const [setup, setSetup] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiCall<{ secret: string; qrCodeDataUrl: string }>("/api/v1/profile/me/mfa/setup", "POST")
      .then((data) => {
        if (cancelled) return;
        setSetup(data);
        setStep("scan");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to start setup");
        setStep("scan");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleConfirm(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const data = await apiCall<{ backupCodes: string[] }>("/api/v1/profile/me/mfa/confirm", "POST", { code });
      setBackupCodes(data.backupCodes);
      setStep("done");
      showToast({ variant: "success", title: "Two-factor authentication is on", description: "Keep your backup codes somewhere safe." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setPending(false);
    }
  }

  if (step === "loading") {
    return <p className="py-8 text-center text-[13px] text-[var(--color-text-secondary)]">Setting up...</p>;
  }

  if (step === "done") {
    return (
      <BackupCodesView
        codes={backupCodes}
        onDone={() => {
          onClose();
          router.refresh();
        }}
      />
    );
  }

  if (!setup) {
    return <p className="py-8 text-center text-[13px] text-[var(--color-danger)]">{error ?? "Unable to start setup."}</p>;
  }

  return (
    <form onSubmit={handleConfirm} className="grid gap-4">
      <p className="text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">
        Scan this with an authenticator app (Google Authenticator, Authy, 1Password), or enter the code manually.
      </p>
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={setup.qrCodeDataUrl} alt="Scan this QR code with your authenticator app" width={200} height={200} className="rounded-[10px] border border-[var(--color-border-default)]" />
      </div>
      <div className="rounded-[8px] bg-[var(--color-bg-subtle)] px-3 py-2 text-center font-[var(--font-mono)] text-[12.5px] tracking-wider text-[var(--color-text-primary)]">
        {setup.secret}
      </div>
      <label className="block">
        <span className="mb-1.5 block text-[11.5px] font-semibold text-[#435048]">Enter the 6-digit code to confirm</span>
        <input
          type="text"
          autoFocus
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="w-full rounded-[10px] border border-[var(--color-border-default)] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[var(--color-accent-primary)]"
          placeholder="123456"
        />
      </label>
      {error ? <p className="text-[12.5px] text-[var(--color-danger)]">{error}</p> : null}
      <button type="submit" disabled={pending || code.trim().length === 0} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
        {pending ? "Confirming..." : "Confirm and turn on"}
      </button>
    </form>
  );
}

function PasswordConfirmFlow({
  description,
  submitLabel,
  onSubmit,
  onDone,
}: {
  description: string;
  submitLabel: string;
  onSubmit: (password: string) => Promise<string[] | void>;
  onDone: () => void;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const codes = await onSubmit(password);
      if (codes && codes.length > 0) {
        setBackupCodes(codes);
      } else {
        onDone();
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work");
    } finally {
      setPending(false);
    }
  }

  if (backupCodes) {
    return (
      <BackupCodesView
        codes={backupCodes}
        onDone={() => {
          onDone();
          router.refresh();
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <p className="text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">{description}</p>
      <label className="block">
        <span className="mb-1.5 block text-[11.5px] font-semibold text-[#435048]">Current password</span>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-[10px] border border-[var(--color-border-default)] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[var(--color-accent-primary)]"
        />
      </label>
      {error ? <p className="text-[12.5px] text-[var(--color-danger)]">{error}</p> : null}
      <button type="submit" disabled={pending || password.length === 0} className="btn-destructive disabled:cursor-not-allowed disabled:opacity-60">
        {pending ? "Working..." : submitLabel}
      </button>
    </form>
  );
}

export function MfaPanel({ mfaEnabled, mfaEnrolledAt }: { mfaEnabled: boolean; mfaEnrolledAt?: string }) {
  const [dialog, setDialog] = useState<"none" | "setup" | "disable" | "regenerate">("none");

  return (
    <>
      <div className="flex items-center justify-between gap-3.5 border-b border-[#F2F7F4] px-5 py-3">
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">Two-factor authentication</p>
          <p className="text-pretty mt-0.5 text-[11px] text-[#8C9A92]">
            {mfaEnabled ? `On since ${mfaEnrolledAt ? formatDate(mfaEnrolledAt) : "unknown"} — an authenticator app code is required at sign-in.` : "Off — sign-in is email and password only."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {mfaEnabled ? (
            <>
              <button type="button" onClick={() => setDialog("regenerate")} className="text-[11.5px] font-semibold text-[var(--color-text-accent)] hover:underline">
                New backup codes
              </button>
              <button type="button" onClick={() => setDialog("disable")} className="text-[11.5px] font-semibold text-[var(--color-danger)] hover:underline">
                Turn off
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setDialog("setup")} className="text-[11.5px] font-semibold text-[var(--color-text-accent)] hover:underline">
              Turn on
            </button>
          )}
        </div>
      </div>

      <Modal open={dialog === "setup"} onClose={() => setDialog("none")} title="Turn on two-factor authentication" size="report">
        <SetupFlow onClose={() => setDialog("none")} />
      </Modal>

      <Modal open={dialog === "disable"} onClose={() => setDialog("none")} title="Turn off two-factor authentication" size="report">
        <PasswordConfirmFlow
          description="This removes the authenticator requirement from your account. Anyone with your password alone could then sign in."
          submitLabel="Turn off"
          onSubmit={(password) => apiCall("/api/v1/profile/me/mfa/disable", "PATCH", { password }).then(() => undefined)}
          onDone={() => setDialog("none")}
        />
      </Modal>

      <Modal open={dialog === "regenerate"} onClose={() => setDialog("none")} title="Generate new backup codes" size="report">
        <PasswordConfirmFlow
          description="Your existing backup codes will stop working the moment new ones are generated."
          submitLabel="Generate new codes"
          onSubmit={(password) => apiCall<{ backupCodes: string[] }>("/api/v1/profile/me/mfa/backup-codes", "POST", { password }).then((data) => data.backupCodes)}
          onDone={() => setDialog("none")}
        />
      </Modal>
    </>
  );
}
