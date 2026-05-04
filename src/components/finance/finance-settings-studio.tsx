"use client";

import { useState } from "react";
import { Save, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/ui/toast-provider";
import type { FinanceSettingsView } from "@/lib/domain/types";
import {
  FinancePageHeader,
  FinancePanel,
} from "@/components/finance/finance-studio-ui";

type Props = {
  settings: FinanceSettingsView;
};

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

export function FinanceSettingsStudio({ settings }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    paymentMethodsCsv: settings.paymentMethods.join(", "),
    allowOverpayment: settings.allowOverpayment ? "true" : "false",
    reminderScheduleCsv: settings.reminderScheduleDays.join(", "),
    receiptPrefix: settings.receiptPrefix,
  });

  async function submit() {
    setSaving(true);
    try {
      const response = await fetch("/api/v1/bursary/settings", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCookie("fr_csrf") ?? "",
        },
        body: JSON.stringify({
          paymentMethodsCsv: form.paymentMethodsCsv,
          allowOverpayment: form.allowOverpayment,
          reminderScheduleCsv: form.reminderScheduleCsv,
          receiptPrefix: form.receiptPrefix,
        }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || body.ok === false) throw new Error(body.error ?? "Could not update finance settings.");
      showToast({ variant: "success", title: "Finance settings updated", description: "The bursary operating rules are now saved." });
      router.refresh();
    } catch (error) {
      showToast({ variant: "error", title: "Settings update failed", description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="finance-page">
      <FinancePageHeader
        eyebrow="Finance settings"
        title="Control the bursary operating rules"
        description="Configure payment methods, overpayment handling, reminder cadence, and receipt sequencing from a clean, production-ready control surface."
        actions={
          <button type="button" onClick={submit} className="finance-btn-primary" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save settings"}
          </button>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <FinancePanel className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Metric label="Currency" value={settings.currency} />
            <Metric label="Receipt prefix" value={settings.receiptPrefix} />
            <Metric label="Current session" value={settings.sessionConfig?.currentSession ?? "-"} />
            <Metric label="Current term" value={settings.sessionConfig?.currentTerm ?? "-"} />
          </div>
        </FinancePanel>

        <FinancePanel className="p-5">
          <div className="flex items-start gap-3">
            <div className="finance-icon-surface grid h-10 w-10 place-items-center rounded-2xl">
              <Settings2 className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-[var(--finance-text-primary)]">Operational note</p>
              <p className="mt-2 text-sm leading-7 text-[var(--finance-text-secondary)]">
                Keep payment methods and reminder cadence aligned with how the school actually collects fees, not just how the software can.
              </p>
            </div>
          </div>
        </FinancePanel>
      </section>

      <FinancePanel className="p-5">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="finance-label mb-0">Payment methods</span>
            <input
              value={form.paymentMethodsCsv}
              onChange={(event) => setForm((current) => ({ ...current, paymentMethodsCsv: event.target.value }))}
              className="finance-field"
              placeholder="CASH, BANK_TRANSFER, POS, ONLINE"
            />
          </label>
          <label className="grid gap-2">
            <span className="finance-label mb-0">Allow overpayment</span>
            <select
              value={form.allowOverpayment}
              onChange={(event) => setForm((current) => ({ ...current, allowOverpayment: event.target.value }))}
              className="finance-select"
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="finance-label mb-0">Reminder schedule (days)</span>
            <input
              value={form.reminderScheduleCsv}
              onChange={(event) => setForm((current) => ({ ...current, reminderScheduleCsv: event.target.value }))}
              className="finance-field"
              placeholder="3, 0"
            />
          </label>
          <label className="grid gap-2">
            <span className="finance-label mb-0">Receipt prefix</span>
            <input
              value={form.receiptPrefix}
              onChange={(event) => setForm((current) => ({ ...current, receiptPrefix: event.target.value.toUpperCase() }))}
              className="finance-field finance-mono"
              placeholder="RCT"
            />
          </label>
        </div>
      </FinancePanel>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="finance-soft-surface rounded-2xl px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--finance-text-secondary)]">{label}</p>
      <p className="mt-3 text-xl font-bold text-[var(--finance-text-primary)]">{value}</p>
    </div>
  );
}
