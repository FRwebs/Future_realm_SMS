"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import type { TierChangePanel } from "@/lib/modules/panels";
import { readableError, sendJson } from "@/lib/modules/submit";
import { INK, MUTED, toneSwatches } from "@/lib/modules/tones";
import { cn } from "@/lib/utils/cn";

/**
 * Changing tier part-way through a term.
 *
 * The point of this screen is the arithmetic, not the choice: a school moving
 * up is charged for the part of the term it has not used, and it should see
 * that worked out — headcount, days, rate difference — before it agrees to
 * anything. A school moving down is told, plainly, that nothing changes today
 * and nothing is charged.
 *
 * The figures come from the server, from the same calculation that performs the
 * change, so the number shown and the number charged cannot drift apart.
 */

type Preview = {
  isUpgrade: boolean;
  direction: "UPGRADE" | "DOWNGRADE" | "SAME";
  currentTier: { key: string; name: string; rate: number };
  targetTier: { key: string; name: string; rate: number };
  activeStudentCount: number;
  term: { id: string; label: string; startDate: string; endDate: string } | null;
  totalTermDays: number;
  remainingTermDays: number;
  prorationRatio: number;
  immediateAmountDue: number;
  taxOnImmediate: number;
  immediateTotal: number;
  effectiveDate: string;
  effectiveOn: string | null;
  newTermlyAmount: number;
  termlyDifference: number;
  blocked: { code: string; message: string } | null;
};

const naira = (value: number) => `₦${Math.round(value).toLocaleString("en-NG")}`;

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })
    : "—";

const CARD = "min-w-0 rounded-[14px] border border-[#DEE8E2] bg-[var(--color-bg-surface)]";

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-[2px] py-[9px]">
      <div className="min-w-0">
        <div className="text-[11.5px] font-semibold" style={{ color: INK }}>
          {label}
        </div>
        {hint ? (
          <div className="mt-[1px] text-pretty text-[10.5px] leading-[1.45]" style={{ color: MUTED }}>
            {hint}
          </div>
        ) : null}
      </div>
      <div className="whitespace-nowrap text-[12px] font-semibold tabular-nums" style={{ color: INK }}>
        {value}
      </div>
    </div>
  );
}

export function TierChange({ panel }: { panel: TierChangePanel }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(
    async (tier: string) => {
      setLoading(true);
      setError(null);
      setPreview(null);
      try {
        const response = await fetch(`${panel.previewEndpoint}?tier=${encodeURIComponent(tier)}`, {
          credentials: "include",
        });
        const result = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          data?: Preview;
          error?: string;
          message?: string;
        };
        if (!response.ok || result.ok === false || !result.data) {
          throw new Error(readableError(result.error ?? result.message));
        }
        setPreview(result.data);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "That estimate could not be worked out.");
      } finally {
        setLoading(false);
      }
    },
    [panel.previewEndpoint],
  );

  useEffect(() => {
    if (open) void load(open);
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function confirm() {
    if (!preview || preview.blocked) return;
    setPending(true);
    setError(null);
    try {
      await sendJson(panel.changeEndpoint, "POST", { targetTier: preview.targetTier.key });
      setDone(
        preview.isUpgrade
          ? `The school is on ${preview.targetTier.name} now.`
          : `${preview.targetTier.name} starts on ${day(preview.effectiveOn)}.`,
      );
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not save.");
    } finally {
      setPending(false);
    }
  }

  async function withdraw() {
    if (!panel.cancelEndpoint) return;
    setPending(true);
    setError(null);
    try {
      await sendJson(panel.cancelEndpoint, "POST", {});
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not save.");
    } finally {
      setPending(false);
    }
  }

  const others = panel.tiers.filter((tier) => tier.key !== panel.currentTier.key);

  return (
    <section className={cn(CARD, "px-[18px] py-[15px]")}>
      <div className="mb-[13px] border-b border-[#EDF3EF] pb-[11px]">
        <h2 className="font-[family-name:var(--font-heading)] text-[14px] font-extrabold leading-[1.2] tracking-[-0.018em] text-[#0D2315]">
          {panel.title}
        </h2>
        {panel.sub ? (
          <p className="mt-[3px] text-pretty text-[11px] leading-[1.45]" style={{ color: MUTED }}>
            {panel.sub}
          </p>
        ) : null}
        {/* What the school is on, counted over what, for how long — the three
            facts every figure below is relative to. */}
        <p className="mt-[7px] text-[11px]" style={{ color: MUTED }}>
          <span className="font-semibold" style={{ color: INK }}>
            {panel.currentTier.name}
          </span>{" "}
          at {naira(panel.currentTier.rate)} per student
          {typeof panel.headcount === "number" ? (
            <>
              {" \u00b7 "}
              <span className="font-semibold" style={{ color: INK }}>
                {panel.headcount.toLocaleString("en-NG")}
              </span>{" "}
              on the roll
            </>
          ) : null}
          {panel.term ? (
            <>
              {" \u00b7 "}
              {panel.term.label}, {day(panel.term.startDate)} to {day(panel.term.endDate)}
            </>
          ) : null}
        </p>
      </div>

      {panel.pending ? (
        <div
          className="mb-[13px] flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[11px] border px-[13px] py-[11px]"
          style={{ background: toneSwatches.progress.bg, borderColor: toneSwatches.progress.bd }}
        >
          <p className="text-pretty text-[11.5px] leading-[1.5]" style={{ color: toneSwatches.progress.fg }}>
            <span className="font-bold">Your plan will downgrade to {panel.pending.tier}</span> at the
            start of next term{panel.pending.from ? `, on ${day(panel.pending.from)}` : ""}. Nothing
            changes, and nothing is charged, before then.
          </p>
          {panel.cancelEndpoint ? (
            <button
              type="button"
              onClick={() => void withdraw()}
              disabled={pending}
              className="whitespace-nowrap rounded-[9px] border bg-white px-[15.5px] py-[9px] text-[11.5px] font-semibold disabled:opacity-50"
              style={{ borderColor: "#CFDDD5", color: "#435048" }}
            >
              {pending ? "Withdrawing…" : "Cancel downgrade"}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
        {others.map((tier) => {
          const dearer = tier.rate > panel.currentTier.rate;
          return (
            <div key={tier.key} className="rounded-[12px] border border-[#E4EDE8] px-[13px] py-[12px]">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12.5px] font-bold" style={{ color: INK }}>
                  {tier.name}
                </span>
                <span
                  className="rounded-full px-[8px] py-[2px] text-[9.5px] font-bold uppercase tracking-[0.07em]"
                  style={{
                    background: dearer ? toneSwatches.positive.bg : toneSwatches.neutral.bg,
                    color: dearer ? toneSwatches.positive.fg : toneSwatches.neutral.fg,
                  }}
                >
                  {dearer ? "Upgrade" : "Downgrade"}
                </span>
              </div>
              <div className="mt-[4px] text-[11px]" style={{ color: MUTED }}>
                {naira(tier.rate)} per student, per term
              </div>
              <button
                type="button"
                onClick={() => {
                  setDone(null);
                  setOpen(tier.key);
                }}
                className="mt-[11px] w-full whitespace-nowrap rounded-[9px] px-[17px] py-[10px] text-[11.5px] font-semibold text-white"
                style={{ background: INK, boxShadow: "0 7px 16px -9px rgba(13,35,21,0.6)" }}
              >
                {dearer ? "See what it costs" : "See when it starts"}
              </button>
            </div>
          );
        })}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[42] flex items-center justify-center overflow-y-auto px-[24px] py-[32px]"
          role="dialog"
          aria-modal="true"
          aria-label="Change plan"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(null)}
            className="fixed inset-0 cursor-default"
            style={{ background: "rgba(13,35,21,0.5)" }}
          />

          <div
            className="relative flex w-full flex-col overflow-hidden rounded-[20px] bg-white"
            style={{
              maxWidth: "520px",
              maxHeight: "calc(100vh - 64px)",
              boxShadow: "0 45px 90px -36px rgba(13,35,21,0.6)",
            }}
          >
            <header className="relative flex-none overflow-hidden px-[23.5px] py-[20px]" style={{ background: INK }}>
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -right-[80px] -top-[132px] h-[336px] w-[336px] rounded-full border border-[rgba(95,214,180,0.12)]" />
              </div>
              <div className="relative flex items-start justify-between gap-[18px]">
                <div className="min-w-0">
                  <p className="mb-[5.5px] text-[9.5px] font-bold tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.45)" }}>
                    {preview
                      ? preview.isUpgrade
                        ? "CONFIRM BEFORE IT RUNS"
                        : "SCHEDULED CHANGE"
                      : "SUBSCRIPTION"}
                  </p>
                  <h2 className="text-pretty text-[19px] font-bold leading-[1.25] tracking-[-0.01em] text-white">
                    {panel.currentTier.name} to {panel.tiers.find((tier) => tier.key === open)?.name}
                  </h2>
                  <p className="mt-[4.5px] text-pretty text-[11px] leading-[1.5]" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {preview
                      ? preview.isUpgrade
                        ? "An upgrade takes effect immediately, and is charged only for the rest of this term."
                        : "A downgrade waits for the next term, because this one is already paid for."
                      : "Working out what this would cost…"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(null)}
                  aria-label="Close"
                  className="flex h-[27px] w-[27px] flex-none items-center justify-center rounded-[9px]"
                  style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)" }}
                >
                  <svg width="12.5" height="12.5" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-[23.5px] py-[21.5px]">
              {loading ? (
                <p className="text-[11.5px]" style={{ color: MUTED }}>
                  Reading the roll and the term dates…
                </p>
              ) : null}

              {done ? (
                <div
                  className="rounded-[12px] border px-[13px] py-[11px]"
                  style={{ background: toneSwatches.positive.bg, borderColor: toneSwatches.positive.bd }}
                >
                  <p className="text-[12px] font-bold" style={{ color: toneSwatches.positive.fg }}>
                    {done}
                  </p>
                </div>
              ) : null}

              {preview && !done ? (
                <>
                  {preview.blocked ? (
                    <div
                      className="mb-[14px] rounded-[12px] border px-[13px] py-[11px]"
                      style={{ background: toneSwatches.attention.bg, borderColor: toneSwatches.attention.bd }}
                    >
                      <p className="text-pretty text-[11px] leading-[1.55]" style={{ color: toneSwatches.attention.fg }}>
                        {preview.blocked.message}
                      </p>
                    </div>
                  ) : null}

                  <div className="mb-[14px] grid grid-cols-2 gap-[10px]">
                    {[
                      { label: "Now", tier: preview.currentTier },
                      { label: "Moving to", tier: preview.targetTier },
                    ].map((side) => (
                      <div key={side.label} className="rounded-[11px] border border-[#E4EDE8] px-[12px] py-[10px]">
                        <div className="text-[9.5px] font-bold uppercase tracking-[0.08em]" style={{ color: MUTED }}>
                          {side.label}
                        </div>
                        <div className="mt-[3px] text-[13px] font-extrabold" style={{ color: INK }}>
                          {side.tier.name}
                        </div>
                        <div className="text-[10.5px]" style={{ color: MUTED }}>
                          {naira(side.tier.rate)} per student
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="divide-y divide-[#EDF3EF] border-y border-[#EDF3EF]">
                    <Row
                      label="Active headcount"
                      value={preview.activeStudentCount.toLocaleString("en-NG")}
                      hint="Frozen at this moment, and kept with the charge"
                    />
                    <Row
                      label="Days left in the term"
                      value={`${preview.remainingTermDays} of ${preview.totalTermDays}`}
                      hint={preview.term ? preview.term.label : "No term is running"}
                    />
                    {preview.isUpgrade ? (
                      <>
                        <Row
                          label="Rate difference"
                          value={`${naira(preview.targetTier.rate - preview.currentTier.rate)} per student`}
                          hint="Only the difference is charged — this term is already paid at the old rate"
                        />
                        <Row
                          label="Part of the term unused"
                          value={`${Math.round(preview.prorationRatio * 100)}%`}
                          hint={`${preview.remainingTermDays} ÷ ${preview.totalTermDays} days`}
                        />
                        <Row label="Prorated difference" value={naira(preview.immediateAmountDue)} />
                        {preview.taxOnImmediate > 0 ? (
                          <Row label="VAT" value={naira(preview.taxOnImmediate)} />
                        ) : null}
                      </>
                    ) : (
                      <Row
                        label="Charged today"
                        value="Nothing"
                        hint="A downgrade costs nothing, and takes nothing away before next term"
                      />
                    )}
                    <Row
                      label="Takes effect"
                      value={preview.effectiveDate}
                      hint={preview.isUpgrade ? "The moment you confirm" : day(preview.effectiveOn)}
                    />
                    <Row
                      label="Per term after the change"
                      value={naira(preview.newTermlyAmount)}
                      hint={`${preview.activeStudentCount.toLocaleString("en-NG")} students × ${naira(preview.targetTier.rate)}`}
                    />
                  </div>

                  {preview.isUpgrade && !preview.blocked ? (
                    <div
                      className="mt-[14px] flex items-baseline justify-between gap-3 rounded-[12px] border px-[13px] py-[12px]"
                      style={{ background: toneSwatches.positive.bg, borderColor: toneSwatches.positive.bd }}
                    >
                      <span className="text-[11.5px] font-bold" style={{ color: toneSwatches.positive.fg }}>
                        Due today
                      </span>
                      <span className="text-[17px] font-extrabold tabular-nums" style={{ color: INK }}>
                        {naira(preview.immediateTotal)}
                      </span>
                    </div>
                  ) : null}
                </>
              ) : null}

              {error ? (
                <p
                  className="mt-[13px] rounded-[10px] border px-[12px] py-[9px] text-[11px] font-medium"
                  style={{ borderColor: "#E4B9B9", background: "#FBF2F2", color: "#B23B3B" }}
                >
                  {error}
                </p>
              ) : null}
            </div>

            <footer
              className="flex flex-none flex-wrap items-center justify-between gap-x-[14.5px] gap-y-[10px] px-[23.5px] py-[14.5px]"
              style={{ background: "#FBFDFC", borderTop: "1px solid #EDF3EF" }}
            >
              <p className="min-w-[140px] flex-1 basis-[200px] text-pretty text-[10.5px] leading-[1.4]" style={{ color: MUTED }}>
                {done
                  ? ""
                  : preview?.isUpgrade
                    ? "The headcount and the days used are kept with the charge, so this can be explained later."
                    : "You can withdraw a scheduled change at any time before it starts."}
              </p>
              <div className="ml-auto flex flex-none flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(null)}
                  className="whitespace-nowrap rounded-[9px] border bg-white px-[15.5px] py-[9px] text-[11.5px] font-semibold"
                  style={{ borderColor: "#CFDDD5", color: "#435048" }}
                >
                  {done ? "Close" : "Cancel"}
                </button>
                {!done && preview && !preview.blocked ? (
                  <button
                    type="button"
                    onClick={() => void confirm()}
                    disabled={pending}
                    className="whitespace-nowrap rounded-[9px] px-[17px] py-[10px] text-[11.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: INK, boxShadow: "0 7px 16px -9px rgba(13,35,21,0.6)" }}
                  >
                    {pending
                      ? "Saving…"
                      : preview.isUpgrade
                        ? `Confirm & pay ${naira(preview.immediateTotal)}`
                        : "Schedule for next term"}
                  </button>
                ) : null}
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
}

