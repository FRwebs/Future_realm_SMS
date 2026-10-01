"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import type { DrawerSpec, PanelFact } from "@/lib/modules/panels";
import { sendJson } from "@/lib/modules/submit";
import { INK, MUTED } from "@/lib/modules/tones";

function FactRows({ facts }: { facts: PanelFact[] }) {
  return (
    <div className="overflow-hidden rounded-[12px] border" style={{ borderColor: "#E6EEE9" }}>
      {facts.map(([label, value, note], index) => (
        <div
          key={`${label}-${index}`}
          className="flex items-start justify-between gap-[14px] px-[13px] py-[10px] last:border-b-0"
          style={{ borderBottom: "1px solid #F2F7F4" }}
        >
          <div className="min-w-0 basis-[40%]">
            <p
              className="text-[9.5px] font-bold uppercase leading-[1.35] tracking-[0.06em]"
              style={{ color: MUTED }}
            >
              {label}
            </p>
            {note ? (
              <p
                className="mt-[3px] text-pretty text-[10px] leading-[1.45]"
                style={{ color: "#6B7A71" }}
              >
                {note}
              </p>
            ) : null}
          </div>
          <p
            className="min-w-0 flex-1 text-pretty text-right text-[11.5px] font-semibold leading-[1.45]"
            style={{ color: INK }}
          >
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * The overlay a trigger opens.
 *
 * The mockup centres this rather than sliding it in from the edge: a scrim over
 * the page, a panel capped at 520px with an ink header carrying the eyebrow,
 * title and sub, the facts in a bordered block, and the decision in a footer
 * bar. Reading a record and committing a decision are the same surface — the
 * facts come first either way.
 */
export function ModuleDrawer({
  spec,
  onClose,
}: {
  spec: DrawerSpec | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!spec || !mounted) return null;

  // Keyed on the record so moving from one row's drawer to another's starts
  // clean — the open panel owns its own committed/pending/error state, and
  // remounting resets it without an effect that watches `spec`.
  return <DrawerPanel key={spec.title} spec={spec} onClose={onClose} />;
}

/**
 * Only mounted while a drawer is actually open.
 *
 * That is what keeps `useRouter` out of the closed case: ModuleDrawer sits on
 * every module page whether or not anything is open, and calling the hook there
 * requires an app-router context that server-rendered markup and unit tests do
 * not have.
 */
function DrawerPanel({ spec, onClose }: { spec: DrawerSpec; onClose: () => void }) {
  const [committed, setCommitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const router = useRouter();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const isCommit = spec.mode === "commit" && !spec.readOnly;
  const submit = spec.submit;
  const needsReason = Boolean(submit?.reasonKey);
  const reasonMissing = Boolean(submit?.reasonRequired) && !reason.trim();

  async function commit() {
    // No endpoint means the drawer was authored as a confirmation only. It
    // still closes the loop for the reader; it just has nothing to send.
    if (!submit) {
      setCommitted(true);
      return;
    }

    setPending(true);
    setError(null);
    try {
      await sendJson(submit.endpoint, submit.method ?? "POST", {
        ...(submit.body ?? {}),
        ...(submit.reasonKey && reason.trim()
          ? { [submit.reasonKey]: reason.trim() }
          : {}),
      });
      setCommitted(true);
      // The page is a server component reading live figures, so the decision
      // has to be re-read rather than patched in — the queue, the counts above
      // it and the activity list all move together.
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not go through.");
    } finally {
      setPending(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[42] flex items-center justify-center overflow-y-auto px-6 py-8"
      role="dialog"
      aria-modal="true"
      aria-label={spec.title}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 cursor-default"
        style={{ background: "rgba(13,35,21,0.5)" }}
      />

      <div
        className="relative flex w-full max-w-[520px] flex-col overflow-hidden rounded-[20px] bg-white"
        style={{
          maxHeight: "calc(100vh - 64px)",
          boxShadow: "0 45px 90px -36px rgba(13,35,21,0.6)",
        }}
      >
        <header
          className="relative flex-none overflow-hidden px-[23.5px] py-[20px]"
          style={{ background: INK }}
        >
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full opacity-50"
            viewBox="0 0 800 200"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <circle cx="720" cy="20" r="130" stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
          </svg>

          <div className="relative flex items-start justify-between gap-[18px]">
            <div className="min-w-0">
              {spec.kicker ? (
                <p
                  className="mb-[5.5px] text-[9.5px] font-bold tracking-[0.08em]"
                  style={{ color: "rgba(255,255,255,0.45)" }}
                >
                  {spec.kicker.toUpperCase()}
                </p>
              ) : null}
              <h2 className="text-pretty text-[19px] font-bold leading-[1.25] tracking-[-0.01em] text-white">
                {committed ? (spec.commitDone ?? spec.title) : spec.title}
              </h2>
              {spec.sub && !committed ? (
                <p
                  className="mt-[4.5px] text-pretty text-[11px] leading-[1.5]"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                >
                  {spec.sub}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-[27px] w-[27px] flex-none items-center justify-center rounded-[9px]"
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              <X className="h-[12.5px] w-[12.5px] text-white" strokeWidth={2.2} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-[23.5px] py-[21.5px]">
          <div className="grid gap-[14px]">
            {committed ? (
              <div
                className="rounded-[12px] border px-[13px] py-[11px]"
                style={{ background: "#EAF6F0", borderColor: "#CFE4DB" }}
              >
                <p className="text-[12px] font-bold" style={{ color: "#17714F" }}>
                  {spec.commitDone ?? "Done"}
                </p>
                {spec.commitDoneBody ? (
                  <p
                    className="mt-[5px] text-pretty text-[11px] leading-[1.55]"
                    style={{ color: "#17604F" }}
                  >
                    {spec.commitDoneBody}
                  </p>
                ) : null}
              </div>
            ) : null}

            {spec.readOnly ? (
              <div
                className="rounded-[12px] border px-[13px] py-[10px]"
                style={{ background: "#F7FAF8", borderColor: "#E6EEE9" }}
              >
                <p className="text-[10.5px] leading-[1.5]" style={{ color: MUTED }}>
                  {spec.readOnlyNote ??
                    "This is a record of what happened. It is read-only, and cannot be edited or deleted."}
                </p>
              </div>
            ) : null}

            {error ? (
              <div
                className="rounded-[12px] border px-[13px] py-[11px]"
                style={{ background: "#FDF2F2", borderColor: "#F3D2D2" }}
              >
                <p className="text-[11.5px] font-semibold leading-[1.5]" style={{ color: "#A32B2B" }}>
                  {error}
                </p>
              </div>
            ) : null}

            {spec.facts?.length ? <FactRows facts={spec.facts} /> : null}

            {isCommit && needsReason && !committed ? (
              <label className="grid gap-[6px]">
                <span className="text-[10.5px] font-semibold" style={{ color: INK }}>
                  {submit?.reasonLabel ?? "Reason"}
                  {submit?.reasonRequired ? null : (
                    <span style={{ color: MUTED }}> · optional</span>
                  )}
                </span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  className="w-full resize-y rounded-[10px] border px-[11px] py-[9px] text-[11.5px] leading-[1.5] outline-none focus:border-[#BFDCD1]"
                  style={{ borderColor: "#DEE8E2", color: INK }}
                />
              </label>
            ) : null}
          </div>
        </div>

        <footer
          className="flex flex-none flex-wrap items-center justify-between gap-x-[14.5px] gap-y-[10px] px-[23.5px] py-[14.5px]"
          style={{ background: "#FBFDFC", borderTop: "1px solid #EDF3EF" }}
        >
          <p
            className="min-w-[140px] flex-1 basis-[200px] text-pretty text-[10.5px] leading-[1.4]"
            style={{ color: MUTED }}
          >
            {committed ? "" : (spec.commitNote ?? "")}
          </p>

          <div className="ml-auto flex flex-none flex-wrap items-center justify-end gap-2">
            {isCommit && !committed ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="whitespace-nowrap rounded-[9px] border bg-white px-[12px] py-[9px] text-[11.5px] font-semibold"
                  style={{ borderColor: "#DEE8E2", color: "#435048" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={commit}
                  disabled={pending || reasonMissing}
                  title={reasonMissing ? "Say why before you send this." : undefined}
                  className="whitespace-nowrap rounded-[9px] px-[16px] py-[9.5px] text-[11.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: INK,
                    boxShadow: "0 7px 16px -9px rgba(13,35,21,0.6)",
                  }}
                >
                  {pending ? "Sending…" : (spec.commitLabel ?? "Confirm")}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="whitespace-nowrap rounded-[9px] border bg-white px-[12px] py-[9px] text-[11.5px] font-semibold"
                style={{ borderColor: "#DEE8E2", color: "#435048" }}
              >
                Close
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
