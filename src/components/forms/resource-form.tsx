"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCcw,
  XCircle,
} from "lucide-react";

import { useToast } from "@/components/ui/toast-provider";
import { useOfflineDraftQueue } from "@/hooks/use-offline-draft-queue";

export interface ResourceField {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "textarea" | "date" | "select" | "multiselect" | "toggle" | "static";
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number | string[];
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
  step?: number;
  /** "json" parses the raw text as JSON. "csv" splits it into a trimmed, non-empty string array. */
  parse?: "json" | "csv";
  /** Renders a section heading above this field when it differs from the previous field's section. */
  section?: string;
  /** Small note under the field — for "toggle"/"static" fields, typically explains what's real vs. not built yet. */
  note?: string;
  /** Locks a toggle or select so it visually matches the design but can't actually be changed — pair with `note`. */
  disabled?: boolean;
}

interface ResourceFormProps {
  formId?: string;
  title: string;
  description: string;
  endpoint: string;
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  fields: ResourceField[];
  submitLabel: string;
  offlineKey?: string;
  chrome?: "card" | "plain";
  confirmLabel?: string;
  confirmMessage?: string;
  onSuccess?: () => void;
  showHeader?: boolean;
  /** Renders a "Cancel" button in the footer, next to the submit button, that calls this instead of submitting. */
  onCancel?: () => void;
}

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

export function ResourceForm({
  formId,
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
  onCancel,
}: ResourceFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
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
        showToast({
          variant: "warning",
          title: "Saved as offline draft",
          description: "Your changes were queued locally and can be synced when connectivity improves.",
        });
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
      showToast({
        variant: "success",
        title: "Saved successfully",
        description: title,
      });
      setNeedsConfirmation(false);
      setPendingPayload(null);
      form.reset();
      router.refresh();
      onSuccess?.();
    } catch (error) {
      setTone("danger");
      const nextMessage = error instanceof Error ? error.message : "Something went wrong";
      setMessage(nextMessage);
      showToast({
        variant: "error",
        title: "Unable to save record",
        description: nextMessage,
      });
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
        if (field.type === "static" || field.disabled) {
          return acc;
        }
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
          if (field.parse === "json" && rawValue.trim() === "" && !field.required) {
            return acc;
          }
          acc[field.name] =
            field.parse === "json"
              ? JSON.parse(rawValue)
              : field.parse === "csv"
                ? rawValue.split(",").map((part) => part.trim()).filter(Boolean)
                : rawValue;
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
    showToast({
      variant: "success",
      title: "Drafts synced",
      description: `${result.synced} queued draft(s) were uploaded successfully.`,
    });
    router.refresh();
  }

  const feedbackToneStyle = {
    success: { borderColor: "var(--color-success-dim)", background: "var(--color-success-dim)", color: "var(--color-success)" },
    warning: { borderColor: "var(--color-warning-dim)", background: "var(--color-warning-dim)", color: "var(--color-warning)" },
    danger: { borderColor: "var(--color-danger-dim)", background: "var(--color-danger-dim)", color: "var(--color-danger)" },
  }[tone];

  const feedbackIcon = {
    success: CheckCircle2,
    warning: AlertTriangle,
    danger: XCircle,
  }[tone];

  const segments: Array<{ section?: string; kind: "toggle" | "field"; fields: ResourceField[] }> = [];
  for (const field of fields) {
    const kind: "toggle" | "field" = field.type === "toggle" ? "toggle" : "field";
    const last = segments[segments.length - 1];
    if (last && last.section === field.section && last.kind === kind) {
      last.fields.push(field);
    } else {
      segments.push({ section: field.section, kind, fields: [field] });
    }
  }

  const content = (
    <>
      {showHeader ? (
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="section-eyebrow">Resource form</p>
            <h3 className="mt-2 text-[20px] font-bold text-[var(--color-text-primary)]">{title}</h3>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">{description}</p>
          </div>

          {offlineKey ? (
            <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] px-4 py-3 text-sm">
              <p className="font-semibold text-[var(--color-text-primary)]">
                Queued drafts: {offlineQueue.draftCount}
              </p>
              <button
                type="button"
                onClick={handleSyncDrafts}
                disabled={offlineQueue.draftCount === 0 || offlineQueue.syncing}
                className="btn-primary mt-2 h-9 px-4 text-[12px]"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                {offlineQueue.syncing ? "Syncing..." : "Sync queued drafts"}
              </button>
            </div>
          ) : null}
        </div>
      ) : offlineKey ? (
        <div className="mb-6 flex justify-end">
          <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] px-4 py-3 text-sm">
            <p className="font-semibold text-[var(--color-text-primary)]">
              Queued drafts: {offlineQueue.draftCount}
            </p>
            <button
              type="button"
              onClick={handleSyncDrafts}
              disabled={offlineQueue.draftCount === 0 || offlineQueue.syncing}
              className="btn-primary mt-2 h-9 px-4 text-[12px]"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              {offlineQueue.syncing ? "Syncing..." : "Sync queued drafts"}
            </button>
          </div>
        </div>
      ) : null}

      <form id={formId} onSubmit={handleSubmit} className="grid gap-5">
          <div>
            {segments.map((segment, segIndex) => (
              <div key={segment.section ?? `segment-${segIndex}`} style={{ marginBottom: segIndex === segments.length - 1 ? 0 : 20 }}>
                {segment.section ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 11 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8C9A92", whiteSpace: "nowrap" }}>
                      {segment.section}
                    </div>
                    <div style={{ height: 1, flex: 1, background: "#EDF3EF" }} />
                  </div>
                ) : null}

                {segment.kind === "toggle" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9 }}>
                    {segment.fields.map((field) => (
                      <div
                        key={field.name}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          showToast({
                            variant: "info",
                            title: field.disabled ? "Not built" : "Fixed — can't be changed here",
                            description: field.note ?? (field.disabled ? "This control isn't wired up in this build." : "This is always on and isn't editable.")
                          })
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            showToast({
                              variant: "info",
                              title: field.disabled ? "Not built" : "Fixed — can't be changed here",
                              description: field.note ?? (field.disabled ? "This control isn't wired up in this build." : "This is always on and isn't editable.")
                            });
                          }
                        }}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          borderRadius: 10,
                          padding: "10px 12px",
                          minWidth: 0,
                          cursor: "pointer",
                          background: field.disabled ? "#FCFDFC" : "#F4FAF7",
                          border: `1px solid ${field.disabled ? "#E6EEE9" : "#CFE4DB"}`
                        }}
                      >
                        <div
                          style={{
                            width: 30,
                            height: 17,
                            borderRadius: 100,
                            flex: "none",
                            marginTop: 1,
                            display: "flex",
                            alignItems: "center",
                            padding: "0 2px",
                            background: field.disabled ? "#DEE8E2" : "var(--color-accent-primary)",
                            justifyContent: field.disabled ? "flex-start" : "flex-end"
                          }}
                        >
                          <div style={{ width: 13, height: 13, borderRadius: 100, background: "#fff" }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#0D2315" }}>{field.label}</div>
                          {field.note ? <div style={{ fontSize: 11, color: "#8C9A92", marginTop: 2, lineHeight: 1.4 }}>{field.note}</div> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {segment.fields.map((field) => {
                      const readonly = field.type === "static" || field.disabled;
                      const isSelect = field.type === "select";
                      const spanFull = field.type === "textarea" || field.type === "multiselect";
                      return (
                        <label key={field.name} style={{ minWidth: 0, gridColumn: spanFull ? "1 / -1" : undefined }}>
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: "#435048", marginBottom: 6 }}>
                            {field.label}
                            {field.required ? " *" : ""}
                          </div>
                          {field.type === "textarea" ? (
                            <textarea
                              name={field.name}
                              required={field.required}
                              placeholder={field.placeholder}
                              defaultValue={field.defaultValue as string | undefined}
                              rows={4}
                              style={{ width: "100%", fontSize: 12.5, color: "#0D2315", fontWeight: 500, borderRadius: 10, padding: "11px 13px", background: "#fff", border: "1px solid #DEE8E2", outline: "none", resize: "vertical" }}
                            />
                          ) : field.type === "multiselect" ? (
                            <select
                              name={field.name}
                              required={field.required}
                              multiple
                              defaultValue={field.defaultValue as string[] | undefined}
                              style={{ width: "100%", minHeight: 120, fontSize: 12.5, color: "#0D2315", fontWeight: 500, borderRadius: 10, padding: "11px 13px", background: "#fff", border: "1px solid #DEE8E2", outline: "none" }}
                            >
                              {(field.options ?? []).map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div
                              role={field.type === "static" ? "button" : undefined}
                              tabIndex={field.type === "static" ? 0 : undefined}
                              onClick={
                                field.type === "static"
                                  ? () => showToast({ variant: "info", title: "Not editable here", description: field.note ?? "This field is locked — nothing in this build lets it be changed." })
                                  : undefined
                              }
                              onKeyDown={
                                field.type === "static"
                                  ? (event) => {
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        showToast({ variant: "info", title: "Not editable here", description: field.note ?? "This field is locked — nothing in this build lets it be changed." });
                                      }
                                    }
                                  : undefined
                              }
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 8,
                                borderRadius: 10,
                                padding: "11px 13px",
                                cursor: field.type === "static" ? "pointer" : undefined,
                                background: readonly ? "#F7FAF8" : "#fff",
                                border: `1px solid ${readonly ? "#E6EEE9" : "#DEE8E2"}`
                              }}
                            >
                              {field.type === "static" ? (
                                <span style={{ fontSize: 12.5, color: "#5D6B63", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {field.placeholder}
                                </span>
                              ) : field.type === "select" ? (
                                <select
                                  name={field.name}
                                  required={field.required}
                                  disabled={field.disabled}
                                  defaultValue={field.defaultValue as string | undefined}
                                  style={{ fontSize: 12.5, color: "#0D2315", fontWeight: 500, background: "transparent", border: "none", outline: "none", width: "100%", appearance: "none" }}
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
                                  defaultValue={field.defaultValue as string | number | undefined}
                                  min={field.min}
                                  max={field.max}
                                  step={field.step}
                                  style={{ fontSize: 12.5, color: "#0D2315", fontWeight: 500, background: "transparent", border: "none", outline: "none", width: "100%" }}
                                  type={field.type ?? "text"}
                                />
                              )}
                              {field.type === "static" ? (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B4C4BB" strokeWidth="1.9" strokeLinecap="round" style={{ flex: "none" }}>
                                  <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" />
                                  <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
                                </svg>
                              ) : isSelect ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9FB8A7" strokeWidth="2.2" strokeLinecap="round" style={{ flex: "none" }}>
                                  <path d="m6 9 6 6 6-6" />
                                </svg>
                              ) : null}
                            </div>
                          )}
                          {field.note ? <div style={{ fontSize: 11, color: "#8C9A92", marginTop: 5, lineHeight: 1.45 }}>{field.note}</div> : null}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

        <div
          className={
            chrome === "plain"
              ? "sticky -bottom-[22px] -mx-[26px] -mb-[22px] border-t border-[#EDF3EF] bg-[#FBFDFC] px-[26px] py-[15px]"
              : "border-t border-[var(--color-border-default)] pt-4"
          }
        >
          <div className={needsConfirmation && pendingPayload ? "hidden" : "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"}>
            <div className="min-h-[24px]">
              {message ? (
                <div
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium"
                  style={feedbackToneStyle}
                >
                  {(() => {
                    const Icon = feedbackIcon;
                    return <Icon className="h-4 w-4" />;
                  })()}
                  <span>{message}</span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {onCancel ? (
                <button type="button" onClick={onCancel} disabled={pending} className="btn-secondary px-5 disabled:cursor-not-allowed disabled:opacity-50">
                  Cancel
                </button>
              ) : null}
              <button
                type="submit"
                disabled={pending}
                className="btn-primary px-6"
              >
                {pending ? "Saving..." : submitLabel}
              </button>
            </div>
          </div>

          {needsConfirmation && pendingPayload ? (
            <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: "var(--color-warning-dim)", background: "var(--color-warning-dim)" }}>
              <p className="text-[14px] font-semibold text-[var(--color-warning)]">
                Confirm before continuing
              </p>
              <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
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
                  className="btn-primary h-9 px-4 text-[12px]"
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
                  className="btn-secondary h-9 px-4 text-[12px] disabled:cursor-not-allowed disabled:opacity-50"
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
    <section className="surface-card p-6">
      {content}
    </section>
  );
}
