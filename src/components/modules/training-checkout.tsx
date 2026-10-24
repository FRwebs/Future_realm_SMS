"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useState } from "react";

import { Field } from "@/components/modules/field";
import { PANEL_SHELL, PanelHeader, PanelView } from "@/components/modules/panel-renderer";
import type { DrawerSpec, TableCellKind, TableRow } from "@/lib/modules/panels";
import { text as cell } from "@/lib/modules/panels";
import { sendJsonForData } from "@/lib/modules/submit";
import { CARD_BORDER, INK, MUTED } from "@/lib/modules/tones";

/**
 * Settling a basket. There are two honest ways a school pays for training: the school funds it (a request someone decides, and the course
 * opens if they say yes), or the teacher pays the provider themselves and records the reference so the office can check it. This platform
 * takes no card details from staff, and a form that pretended to would be worse than saying so.
 */
export type CheckoutProps = {
  basket: Array<{ courseId: string; title: string; provider: string; hours: string; priceLabel: string }>;
  totalLabel: string;
  email: string;
  base: string;
  back: string;
  openDrawer?: (spec: DrawerSpec) => void;
};

export function TrainingCheckout({ basket, totalLabel, email, base, back, openDrawer }: CheckoutProps) {
  const router = useRouter();
  const [payer, setPayer] = useState<"SCHOOL" | "SELF">("SCHOOL");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const noop = openDrawer ?? (() => undefined);

  async function remove(courseId: string) {
    try {
      await sendJsonForData(`${base}/basket/${courseId}`, "DELETE", {});
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "That could not be taken out.");
    }
  }
  async function settle() {
    setBusy(true);
    setMessage(null);
    try {
      await sendJsonForData(`${base}/basket/checkout`, "POST", payer === "SCHOOL" ? { payer, reason } : { payer, reference });
      router.push(`${back}?settled=${payer}` as Route);
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "That could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  const rows: TableRow[] = basket.map((entry) => ({
    cells: [
      { kind: "name", name: entry.title, sub: entry.hours, avatar: false },
      cell(entry.provider), cell(entry.priceLabel, { mono: true }),
      { kind: "action", label: "Remove", run: () => { void remove(entry.courseId); } },
    ] as TableCellKind[],
  }));
  const choose = (value: "SCHOOL" | "SELF", label: string, hint: string) => (
    <button key={value} type="button" role="radio" aria-checked={payer === value} onClick={() => { setPayer(value); setMessage(null); }} className="flex min-w-0 flex-col gap-[3px] rounded-[11px] px-[13px] py-[11px] text-left" style={{ background: payer === value ? "#F1F8F4" : "#fff", border: payer === value ? "1.5px solid #12796A" : "1px solid #DEE8E2" }}>
      <span className="text-[12px] font-bold" style={{ color: INK }}>{label}</span>
      <span className="text-[10.5px] leading-[1.4]" style={{ color: MUTED }}>{hint}</span>
    </button>
  );
  const ready = basket.length > 0 && (payer === "SCHOOL" ? reason.trim().length > 0 : reference.trim().length > 0);

  const requested = payer === "SCHOOL";
  const basketPanel = (
    <PanelView
      openDrawer={noop}
      panel={{
        type: "table", title: "Your basket", tag: `${basket.length} ${basket.length === 1 ? "course" : "courses"}`, tagTone: "neutral", noun: "course", nounPlural: "courses", per: 0, noRowOpen: true, dense: true,
        head: ["Course", "Provider", "Price", ""], rows,
        empty: "Your basket is empty. Add a course from the catalogue.",
      }}
    />
  );
  const total = (
    <section className="min-w-0 overflow-hidden rounded-[14px]" style={{ background: INK, border: `1px solid ${INK}`, boxShadow: "0 18px 40px -26px rgba(13,35,21,0.7)" }}>
      <div className="flex flex-col gap-[14px] p-[18px] text-white sm:px-[20px]">
        <div>
          <p className="text-[9.5px] font-bold uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.62)" }}>{requested ? "Requested from the school" : "Total paid to the provider"}</p>
          <p className="mt-[7px] text-[38px] font-extrabold leading-[1.05] tracking-[-0.035em] tabular-nums">{basket.length ? totalLabel : "₦0"}</p>
          <p className="mt-[6px] text-[11px] leading-[1.45]" style={{ color: "rgba(255,255,255,0.7)" }}>{basket.length} {basket.length === 1 ? "course" : "courses"} · prices held as they were when added · in naira</p>
        </div>
        <div className="flex flex-col border-t" style={{ borderColor: "rgba(255,255,255,0.14)" }}>
          {basket.map((entry) => (
            <div key={entry.courseId} className="flex justify-between gap-[12px] border-b py-[8px] text-[11.5px]" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <span className="min-w-0 truncate" style={{ color: "rgba(255,255,255,0.72)" }}>{entry.title}</span>
              <span className="flex-none font-semibold tabular-nums">{entry.priceLabel}</span>
            </div>
          ))}
          <div className="flex justify-between gap-[12px] border-b py-[8px] text-[11.5px]" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
            <span style={{ color: "rgba(255,255,255,0.72)" }}>{requested ? "Paid by" : "Paying"}</span>
            <span className="text-right font-semibold">{requested ? "The school, if approved" : "You, direct to the provider"}</span>
          </div>
        </div>
        <button type="button" disabled={!ready || busy} onClick={settle} className="flex items-center justify-center gap-[7px] rounded-[10px] bg-white px-[14px] py-[11px] text-[12px] font-bold disabled:cursor-not-allowed disabled:opacity-60" style={{ color: INK }}>
          {busy ? "Sending…" : requested ? `Send the request · ${totalLabel}` : `Record the payment · ${totalLabel}`}
        </button>
        <p className="text-pretty text-[10px] leading-[1.5]" style={{ color: "rgba(255,255,255,0.62)" }}>
          {requested ? "Nothing is charged to you. The courses open when whoever manages staff development approves." : `The courses open once the office has the reference. The receipt goes to ${email || "your account email"}.`}
        </p>
      </div>
    </section>
  );

  return (
    <div className="grid min-w-0 items-start gap-[14px]">
      <div className="grid min-w-0 items-start gap-[14px] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className={`${PANEL_SHELL} pb-[16px]`} style={{ borderColor: CARD_BORDER }}>
          <PanelHeader title="How it will be paid" sub="Card details are never entered here, and nothing is charged to you by this page." openDrawer={noop} />
          <div className="grid gap-[12px]">
            <div className="grid gap-[8px] sm:grid-cols-2" role="radiogroup" aria-label="Who pays">
              {choose("SCHOOL", "Ask the school to pay", "It goes to whoever manages staff development, with your reason. The courses open if they approve it.")}
              {choose("SELF", "I paid for it myself", "You pay the provider yourself. Record their reference here, so the office can check it and the courses open.")}
            </div>
            {payer === "SCHOOL" ? (
              <Field field={{ kind: "area", label: "Why the school should fund it", placeholder: "e.g. It covers the inclusion targets in my appraisal.", hint: "Whoever decides reads this." }} value={reason} setValue={(next) => setReason(String(next))} />
            ) : (
              <Field field={{ kind: "text", label: "The provider’s payment reference", placeholder: "From the receipt the provider sent you" }} value={reference} setValue={(next) => setReference(String(next))} />
            )}
            <Field field={{ kind: "static", label: "Receipt to", value: email || "Your account email" }} value="" setValue={() => undefined} />
            {message ? <p className="rounded-[9px] px-[11px] py-[9px] text-[11.5px]" style={{ background: "#FDF3F3", color: "#B23B3B" }}>{message}</p> : null}
          </div>
        </section>
        {basket.length ? total : null}
      </div>
      {basketPanel}
    </div>
  );
}
