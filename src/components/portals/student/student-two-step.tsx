"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { readCookie } from "@/lib/modules/submit";
import { toneOf } from "@/lib/modules/tones";

export type TwoStepProps = { enabled: boolean; since: string | null };

const API = "/api/v1/profile/me/mfa";
const BTN = "inline-flex rounded-[9px] px-[14px] py-[9px] text-[11.5px] font-semibold disabled:opacity-50";

async function call<T>(path: string, method: "POST" | "PATCH", body: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, { method, credentials: "include", headers: { "Content-Type": "application/json", "x-csrf-token": readCookie("fr_csrf") ?? "" }, body: JSON.stringify(body) });
  const result = (await response.json().catch(() => ({}))) as { ok?: boolean; data?: T; error?: string; message?: string };
  if (!response.ok || result.ok === false) throw new Error(result.error ?? result.message ?? "That did not work. Try again.");
  return result.data as T;
}

/** Two-step sign-in with an authenticator app: scan, confirm with a code, keep the backup codes. Turning it off asks for the password. */
export function StudentTwoStep({ enabled, since }: TwoStepProps) {
  const router = useRouter();
  const [stage, setStage] = useState<"idle" | "scan" | "codes" | "off">("idle");
  const [setup, setSetup] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tone = toneOf(enabled ? "positive" : "progress");

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try { await task(); } catch (cause) { setError(cause instanceof Error ? cause.message : "That did not work."); } finally { setBusy(false); }
  }

  return (
    <section className="min-w-0 rounded-[14px] border px-[17px] py-[15px]" style={{ background: tone.bg, borderColor: tone.bd }}>
      <p className="text-[11.5px] font-bold" style={{ color: tone.fg }}>{enabled ? "Two-step sign-in is on" : "Add two-step sign-in"}</p>
      <p className="mt-[3px] max-w-[640px] text-pretty text-[11px] leading-[1.55]" style={{ color: tone.fg }}>
        {enabled ? `A code from your authenticator app is asked for when you sign in${since ? ` — on since ${new Date(since).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}.` : "A code from an authenticator app when you sign in keeps your account yours, even if someone learns your password."}
      </p>

      {stage === "idle" ? (
        <div className="mt-[11px]">
          {enabled ? (
            <button type="button" className={`${BTN} border bg-white`} style={{ borderColor: "#CFDDD5", color: "#435048" }} onClick={() => { setStage("off"); setError(null); }}>Turn it off</button>
          ) : (
            <button type="button" disabled={busy} className={`${BTN} text-white`} style={{ background: "#0D2315" }} onClick={() => run(async () => { setSetup(await call("/setup", "POST")); setStage("scan"); })}>Set it up</button>
          )}
        </div>
      ) : null}

      {stage === "scan" && setup ? (
        <div className="mt-[12px] grid gap-[10px] sm:grid-cols-[auto_minmax(0,1fr)]">
          { }
          <img src={setup.qrCodeDataUrl} alt="QR code to scan with your authenticator app" width={150} height={150} className="rounded-[10px] border bg-white p-[6px]" style={{ borderColor: "#CFDDD5" }} />
          <div className="grid content-start gap-[8px]">
            <p className="text-[11px]" style={{ color: tone.fg }}>Scan this with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy). Cannot scan? Type this key in: <b className="break-all font-mono">{setup.secret}</b></p>
            <label className="text-[10.5px] font-semibold" style={{ color: "#435048" }}>The 6-digit code the app shows
              <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" className="mt-[4px] block w-[160px] rounded-[9px] border bg-white px-[11px] py-[8px] text-[13px] tabular-nums tracking-[0.2em]" style={{ borderColor: "#CFDDD5" }} />
            </label>
            <div className="flex gap-[8px]">
              <button type="button" disabled={busy || code.length < 6} className={`${BTN} text-white`} style={{ background: "#0D2315" }} onClick={() => run(async () => { const done = await call<{ backupCodes: string[] }>("/confirm", "POST", { code }); setCodes(done.backupCodes); setStage("codes"); })}>Confirm</button>
              <button type="button" className={`${BTN} border bg-white`} style={{ borderColor: "#CFDDD5", color: "#435048" }} onClick={() => { setStage("idle"); setCode(""); }}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {stage === "codes" ? (
        <div className="mt-[12px] grid gap-[8px]">
          <p className="text-[11px] font-semibold" style={{ color: tone.fg }}>Two-step sign-in is on. Keep these backup codes somewhere safe — each works once if you lose your phone, and they are not shown again.</p>
          <div className="grid max-w-[360px] grid-cols-2 gap-[6px] font-mono text-[12px]">{codes.map((entry) => <span key={entry} className="rounded-[8px] border bg-white px-[10px] py-[6px]" style={{ borderColor: "#CFDDD5" }}>{entry}</span>)}</div>
          <div><button type="button" className={`${BTN} text-white`} style={{ background: "#0D2315" }} onClick={() => { setStage("idle"); router.refresh(); }}>I have saved them</button></div>
        </div>
      ) : null}

      {stage === "off" ? (
        <div className="mt-[12px] grid max-w-[360px] gap-[8px]">
          <label className="text-[10.5px] font-semibold" style={{ color: "#435048" }}>Your password, to turn it off
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="mt-[4px] block w-full rounded-[9px] border bg-white px-[11px] py-[8px] text-[12px]" style={{ borderColor: "#CFDDD5" }} />
          </label>
          <div className="flex gap-[8px]">
            <button type="button" disabled={busy || !password} className={`${BTN} text-white`} style={{ background: "#B23B3B" }} onClick={() => run(async () => { await call("/disable", "PATCH", { password }); setPassword(""); setStage("idle"); router.refresh(); })}>Turn off</button>
            <button type="button" className={`${BTN} border bg-white`} style={{ borderColor: "#CFDDD5", color: "#435048" }} onClick={() => { setStage("idle"); setPassword(""); }}>Keep it on</button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-[8px] text-[11.5px]" style={{ color: "#B23B3B" }}>{error}</p> : null}
    </section>
  );
}
