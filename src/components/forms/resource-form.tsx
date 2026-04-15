"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCcw,
  XCircle,
} from "lucide-react";

import { useOfflineDraftQueue } from "@/hooks/use-offline-draft-queue";
import { cn } from "@/lib/utils/cn";

export interface ResourceField {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "textarea" | "date" | "select" | "multiselect";
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number | string[];
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
  step?: number;
  parse?: "json";
}

interface ResourceFormProps {
  title: string;
  description: string;
  endpoint: string;
  method?: "POST" | "PUT";
  fields: ResourceField[];
  submitLabel: string;
  offlineKey?: string;
  chrome?: "card" | "plain";
  confirmLabel?: string;
  confirmMessage?: string;
  onSuccess?: () => void;
  showHeader?: boolean;
}

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

export function ResourceForm({
  title,
  description,
  endpoint,
  method = "POST",
  fields,
  submitLabel,
  offlineKey,
  chrome = "card",
  confirmLabel,
  confirmMessage,
  onSuccess,
  showHeader = true,
}: ResourceFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "warning" | "danger">("success");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [pendingPayload, setPendingPayload] =
    useState<Record<string, unknown> | null>(null);

  const offlineQueue = useOfflineDraftQueue<Record<string, unknown>>({
    storageKey: offlineKey ?? `${endpoint}-unused`,
    endpoint,
  });

  async function submitPayload(
    payload: Record<string, unknown>,
    form: HTMLFormElement
  ) {
    setPending(true);
    setMessage(null);

    try {
      if (offlineKey && !navigator.onLine) {
        offlineQueue.saveDraft(payload);
        setTone("warning");
        setMessage("Saved as an offline draft. Sync when connectivity improves.");
        setNeedsConfirmation(false);
        setPendingPayload(null);
        form.reset();
        return;
      }

      const response = await fetch(endpoint, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCookie("fr_csrf") ?? "",
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || body.ok === false) {
        throw new Error(body.error ?? "Unable to save record");
      }

      setTone("success");
      setMessage("Saved successfully.");
      setNeedsConfirmation(false);
      setPendingPayload(null);
      form.reset();
      router.refresh();
      onSuccess?.();
    } catch (error) {
      setTone("danger");
      setMessage(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    let payload: Record<string, unknown>;
    try {
      payload = fields.reduce<Record<string, unknown>>((acc, field) => {
        if (field.type === "multiselect") {
          acc[field.name] = JSON.stringify(
            formData
              .getAll(field.name)
              .map((value) => (typeof value === "string" ? value : value.name))
              .filter(Boolean)
          );
          return acc;
        }

        const value = formData.get(field.name);
        if (value !== null) {
          const rawValue = typeof value === "string" ? value : value.name;
          acc[field.name] = field.parse === "json" ? JSON.parse(rawValue) : rawValue;
        }
        return acc;
      }, {});
    } catch {
      setTone("danger");
      setMessage("One of the JSON fields is not valid. Please review and try again.");
      return;
    }

    if (confirmLabel && !needsConfirmation) {
      setPendingPayload(payload);
      setNeedsConfirmation(true);
      setTone("warning");
      setMessage(confirmMessage ?? "Review the details before confirming.");
      return;
    }

    await submitPayload(payload, event.currentTarget);
  }

  async function handleSyncDrafts() {
    const result = await offlineQueue.syncDrafts();
    setTone("success");
    setMessage(`Synced ${result.synced} queued draft(s).`);
    router.refresh();
  }

  const feedbackToneClass = {
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning:
      "border-amber-200 bg-amber-50 text-amber-800",
    danger:
      "border-rose-200 bg-rose-50 text-rose-800",
  }[tone];

  const feedbackIcon = {
    success: CheckCircle2,
    warning: AlertTriangle,
    danger: XCircle,
  }[tone];

  const content = (
    <>
      {showHeader ? (
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-brand-700">
              Resource form
            </p>
            <h3 className="mt-2 font-[var(--font-heading)] text-2xl font-bold tracking-tight text-ink">
              {title}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/62">
              {description}
            </p>
          </div>

          {offlineKey ? (
            <div className="rounded-2xl border border-ink/8 bg-sand/55 px-4 py-3 text-sm shadow-sm">
              <p className="font-semibold text-ink">
                Queued drafts: {offlineQueue.draftCount}
              </p>
              <button
                type="button"
                onClick={handleSyncDrafts}
                disabled={offlineQueue.draftCount === 0 || offlineQueue.syncing}
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-ink/35"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                {offlineQueue.syncing ? "Syncing..." : "Sync queued drafts"}
              </button>
            </div>
          ) : null}
        </div>
      ) : offlineKey ? (
        <div className="mb-6 flex justify-end">
          <div className="rounded-2xl border border-ink/8 bg-sand/55 px-4 py-3 text-sm shadow-sm">
            <p className="font-semibold text-ink">
              Queued drafts: {offlineQueue.draftCount}
            </p>
            <button
              type="button"
              onClick={handleSyncDrafts}
              disabled={offlineQueue.draftCount === 0 || offlineQueue.syncing}
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-ink/35"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              {offlineQueue.syncing ? "Syncing..." : "Sync queued drafts"}
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map((field) => {
            const baseClassName =
              "mt-2 w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm font-medium text-ink shadow-sm outline-none transition duration-200 placeholder:text-ink/35 hover:border-ink/15 focus:border-brand-500 focus:ring-4 focus:ring-brand-100/70";

            const wrapperClass =
              field.type === "textarea" ? "md:col-span-2" : "";

            return (
              <label key={field.name} className={wrapperClass}>
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ink/45">
                  {field.label}
                  {field.required ? " *" : ""}
                </span>

                {field.type === "textarea" ? (
                  <textarea
                    name={field.name}
                    required={field.required}
                    placeholder={field.placeholder}
                    defaultValue={field.defaultValue as string | undefined}
                    rows={5}
                    className={cn(baseClassName, "min-h-[120px] resize-y")}
                  />
                ) : field.type === "select" ? (
                  <select
                    name={field.name}
                    required={field.required}
                    defaultValue={field.defaultValue as string | undefined}
                    className={cn(baseClassName, "h-12 appearance-none")}
                  >
                    {(field.options ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "multiselect" ? (
                  <select
                    name={field.name}
                    required={field.required}
                    multiple
                    defaultValue={field.defaultValue as string[] | undefined}
                    className={cn(baseClassName, "min-h-40 appearance-none")}
                  >
                    {(field.options ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={field.name}
                    required={field.required}
                    placeholder={field.placeholder}
                    defaultValue={
                      field.defaultValue as string | number | undefined
                    }
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    className={cn(baseClassName, "h-12")}
                    type={field.type ?? "text"}
                  />
                )}
              </label>
            );
          })}
        </div>

        <div className="border-t border-ink/6 pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-[24px]">
              {message ? (
                <div
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
                    feedbackToneClass
                  )}
                >
                  {(() => {
                    const Icon = feedbackIcon;
                    return <Icon className="h-4 w-4" />;
                  })()}
                  <span>{message}</span>
                </div>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)] transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-ink/40"
            >
              {pending ? "Saving..." : submitLabel}
            </button>
          </div>

          {needsConfirmation && pendingPayload ? (
            <div className="mt-4 rounded-[1.5rem] border border-amber-200 bg-amber-50/90 p-4 shadow-sm">
              <p className="font-semibold text-amber-900">
                Confirm before continuing
              </p>
              <p className="mt-1 text-sm text-amber-800">
                {confirmMessage ??
                  "Please confirm this action before the record is saved."}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={(event) => {
                    const form = event.currentTarget.closest("form");
                    if (form) void submitPayload(pendingPayload, form);
                  }}
                  className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-ink/40"
                >
                  {pending ? "Saving..." : confirmLabel}
                </button>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setNeedsConfirmation(false);
                    setPendingPayload(null);
                    setMessage(null);
                  }}
                  className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-ink ring-1 ring-ink/10 transition hover:bg-sand/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </form>
    </>
  );

  if (chrome === "plain") return content;

  return (
    <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel backdrop-blur">
      {content}
    </section>
  );
}
