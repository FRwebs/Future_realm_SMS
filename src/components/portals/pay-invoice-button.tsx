"use client";

import { useState } from "react";

type PayInvoiceButtonProps = {
  invoiceId: string;
  amount: number;
  label?: string;
};

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

export function PayInvoiceButton({ invoiceId, amount, label = "Pay now" }: PayInvoiceButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/finance/payments", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCookie("fr_csrf") ?? "",
        },
        body: JSON.stringify({
          invoiceId,
          amount,
          method: "ONLINE",
          provider: "PAYSTACK",
        }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: string;
        data?: { checkoutUrl?: string };
      };
      if (!response.ok || body.ok === false) {
        throw new Error(body.error ?? "Unable to start payment.");
      }
      if (body.data?.checkoutUrl) {
        window.location.href = body.data.checkoutUrl;
        return;
      }
      setError("Payment was initialized, but no checkout link was returned.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start payment.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        onClick={handlePay}
        disabled={pending || amount <= 0}
        className="rounded-full bg-ink px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Starting..." : label}
      </button>
      {error ? <p className="max-w-48 text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
