"use client";

import { Building2, CreditCard, Landmark, QrCode, ShieldCheck, Smartphone } from "lucide-react";
import { useState } from "react";

import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import { formatCurrency } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils/cn";

type PayInvoiceButtonProps = {
  invoiceId: string;
  amount: number;
  label?: string;
};

const paymentOptions = [
  {
    id: "card",
    title: "Card Payment",
    description: "Visa, Mastercard, and Verve with instant confirmation.",
    icon: CreditCard,
    provider: "PAYSTACK",
    channel: "card",
  },
  {
    id: "bank_transfer",
    title: "Bank Transfer",
    description: "Paystack will provide transfer instructions where available.",
    icon: Landmark,
    provider: "PAYSTACK",
    channel: "bank_transfer",
  },
  {
    id: "ussd",
    title: "USSD",
    description: "Pay from a Nigerian bank code without needing a smartphone.",
    icon: Smartphone,
    provider: "PAYSTACK",
    channel: "ussd",
  },
  {
    id: "flutterwave",
    title: "Fallback Gateway",
    description: "Use Flutterwave if Paystack is unavailable or the school enables it.",
    icon: Building2,
    provider: "FLUTTERWAVE",
    channel: "card, banktransfer, ussd",
  },
] as const;

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

export function PayInvoiceButton({ invoiceId, amount, label = "Pay now" }: PayInvoiceButtonProps) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<(typeof paymentOptions)[number]>(paymentOptions[0]);
  const [pending, setPending] = useState(false);

  function openPayment() {
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast({
        variant: "warning",
        title: "Payment amount unavailable",
        description: "This invoice does not have a payable balance yet.",
      });
      return;
    }
    setOpen(true);
  }

  async function handlePay() {
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast({
        variant: "warning",
        title: "Payment amount unavailable",
        description: "This invoice does not have a payable balance yet.",
      });
      return;
    }
    setPending(true);
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
          provider: selectedOption.provider,
          paymentChannel: selectedOption.channel,
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
      if (!body.data?.checkoutUrl) {
        throw new Error("Payment was initialized, but no checkout link was returned.");
      }
      window.location.href = body.data.checkoutUrl;
    } catch (err) {
      showToast({
        variant: "error",
        title: "Unable to start payment",
        description: err instanceof Error ? err.message : "Please try again or contact the school bursary.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openPayment}
        className="btn-primary h-9 px-3 text-[12px]"
      >
        {label}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Pay School Fees"
        subtitle="Choose a secure online payment channel. The school will only mark this invoice paid after gateway verification."
        size="md"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-slate-500">Amount to pay: <span className="font-black text-slate-900">{formatCurrency(amount)}</span></p>
            <button type="button" onClick={handlePay} disabled={pending} className="btn-primary">
              <ShieldCheck className="h-4 w-4" />
              {pending ? "Starting secure checkout..." : `Pay ${formatCurrency(amount)}`}
            </button>
          </div>
        }
      >
        <div className="grid gap-4">
          <div className="rounded-2xl border border-primary-100 bg-primary-50/80 p-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-primary-700">Secure payment</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-600">
              Card details are handled by the gateway. The SMS never stores card numbers, CVVs, or PINs.
            </p>
          </div>

          <div className="grid gap-3">
            {paymentOptions.map((option) => {
              const Icon = option.icon;
              const selected = selectedOption.id === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedOption(option)}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border p-4 text-left transition hover:border-primary-300 hover:bg-primary-50/70",
                    selected ? "border-primary-400 bg-primary-50 ring-2 ring-primary-500/15" : "border-slate-100 bg-white"
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                    {option.id === "bank_transfer" ? <QrCode className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </span>
                  <span>
                    <span className="block text-[13px] font-bold text-slate-900">{option.title}</span>
                    <span className="mt-1 block text-[12px] leading-5 text-slate-500">{option.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Modal>
    </>
  );
}
