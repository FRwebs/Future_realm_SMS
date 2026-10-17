"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { sendJsonForData } from "@/lib/modules/submit";

type Result = { status: string; invoiceNo: string; already: boolean; total: number; applied: string | null; mode: string };

/** Asks the server what the payment provider says, once, and states plainly what happened. */
export function VerifyPayment({ reference }: { reference: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) {
      setError("There is no payment to check.");
      return;
    }
    sendJsonForData<Result>("/api/v1/subscription-billing/payments/verify", "POST", { reference }).then(setResult).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "That could not be checked."));
  }, [reference]);

  const good = result?.status === "SUCCESS";
  const tone = error ? "#B23B3B" : good ? "#17714F" : "#8A6410";
  return (
    <section className="rounded-[14px] border bg-white p-6" style={{ borderColor: "#DEE8E2" }}>
      <p className="text-[15px] font-bold" style={{ color: tone }}>
        {error ? "We could not check that payment" : !result ? "Checking with the payment provider…" : good ? "Payment successful" : result.status === "PENDING" ? "The payment is still pending" : "The payment did not go through"}
      </p>
      <p className="mt-2 text-[12.5px] leading-[1.6]" style={{ color: "#435048" }}>
        {error ?? (!result ? "This takes a moment." : good ? `${result.invoiceNo} is paid. ${result.applied ? `${result.applied}.` : ""}${result.already ? " It had already been confirmed." : ""}` : "Nothing was charged and the account is exactly as it was. You can try again from the Plan tab.")}
      </p>
      {result?.mode === "test" ? <p className="mt-2 text-[11.5px]" style={{ color: "#8A6410" }}>The payment provider is in test mode: no card was charged, and this payment was simulated.</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/subscription-billing/plan" className="rounded-[10px] bg-[#0D2315] px-[14px] py-[9px] text-[12px] font-semibold text-white">Back to the Plan</Link>
        <Link href="/subscription-billing/credits" className="rounded-[10px] border border-[#CFDDD5] px-[14px] py-[9px] text-[12px] font-semibold text-[#435048]">Open Credits</Link>
      </div>
    </section>
  );
}
