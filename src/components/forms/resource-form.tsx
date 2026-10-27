"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, type Control, type RegisterOptions } from "react-hook-form";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCcw,
  XCircle,
} from "lucide-react";

import { FieldMessage, InlineNotice, type Notice } from "@/components/ui/inline-notice";
import { useOfflineDraftQueue } from "@/hooks/use-offline-draft-queue";
import { readReply } from "@/lib/modules/submit";
import { readDevicePreferences } from "@/lib/preferences";

export interface ResourceField {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "textarea" | "date" | "select" | "multiselect" | "toggle" | "switch" | "locked" | "static" | "hidden";
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number | string[];
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
  step?: number;
  /** "json" parses the raw text as JSON. "csv" splits it into a trimmed, non-empty string array. */
  parse?: "json" | "csv" | "bands";
  /** Gathers this field into one object sent under this key — a set of switches that the server reads as a single map of booleans. */
  object?: string;
  /** Renders a section heading above this field when it differs from the previous field's section. */
  section?: string;
  /** Small note under the field — for "toggle"/"static" fields, typically explains what's real vs. not built yet. */
  note?: string;
  /** Locks a toggle or select so it visually matches the design but can't actually be changed — pair with `note`. */
  disabled?: boolean;
  /** For "switch": whether it starts on. The value sent is the string "true" or "false". */
  on?: boolean;
  /** For "static": works the shown value out from what is typed so far — a preview that follows the form. */
  compute?: (values: Record<string, string>) => string;
  /** Which step of a stepped form this field belongs to (by the step's name). */
  wizardStep?: string;
  /** Spans both columns. Textareas and multiselects do this already; this is for the rest. */
  full?: boolean;
}

/**
 * The panel the mockup puts at the foot of a form, above the buttons: what
 * actually happens once this is saved. It is not decoration — a form that asks
 * for a decision without stating its consequence is asking for a guess.
 */
export interface ResourceImpact {
  label: string;
  rows: Array<[string, string]>;
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
  /** What saving this does, shown as the mockup's summary panel below the fields. */
  impact?: ResourceImpact;
  /** One sentence shown on the left of the footer — the standing caveat for this form. */
  note?: string;
  /**
   * "reason" is the mockup's decision modal: the consequence in plain words, a required reason, and a panel saying what will be
   * recorded. The modal is itself the confirmation, so there is no second step.
   */
  layout?: "form" | "reason";
  /** A stepped form: the step names in order, which one is showing, and how to move. Fields name their step; every step stays mounted so nothing is lost on the way. */
  steps?: Array<{ name: string }>;
  stepIndex?: number;
  onStepChange?: (index: number) => void;
  /** Leave the dialog open after a successful run and show the server's message in it — a test that reports what it would do. */
  keepOpen?: boolean;
  /** Reshapes the values just before they are sent — for an endpoint whose body is not a flat map. */
  transform?: (payload: Record<string, unknown>) => Record<string, unknown>;
  /** Instead of posting, hand the values to this address as a download — an export that needs a reason first. */
  downloadHref?: string;
  /** For the reason layout: red confirm button, for an act that cannot be quietly undone. */
  danger?: boolean;
  /** For the reason layout: what the record will say, and the change it describes (before → after). */
  recorded?: { line?: string; before?: string; after?: string };
}

/** One grading band per line — "A | 70-100 | Excellent" — read into {grade, min, max, remark}. */
function parseBands(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [grade, range, ...remark] = line.split("|").map((part) => part.trim());
      const [min, max] = (range ?? "").split(/[-–]/).map((part) => Number(part.trim()));
      if (!grade || !Number.isFinite(min) || !Number.isFinite(max)) throw new Error(`"${line}" is not a band. Write it as: A | 70-100 | Excellent`);
      return { grade, min, max, remark: remark.join(" | ") };
    });
}

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

/** The mockup's switch row: a real on/off control with a line saying what each position does. Holds "true" or "false". */
function SwitchField({ field, control }: { field: ResourceField; control: Control<Record<string, unknown>> }) {
  return (
    <Controller
      control={control}
      name={field.name}
      render={({ field: state }) => {
        const on = state.value === "true";
        return (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={field.disabled}
            onClick={() => state.onChange(on ? "false" : "true")}
            onBlur={state.onBlur}
            style={{ display: "flex", alignItems: "flex-start", gap: 9, borderRadius: 10, padding: "9px 11px", minWidth: 0, textAlign: "left", cursor: field.disabled ? "not-allowed" : "pointer", background: on ? "#F4FAF7" : "#FCFDFC", border: `1px solid ${on ? "#CFE4DB" : "#E6EEE9"}`, opacity: field.disabled ? 0.7 : 1 }}
          >
            <span style={{ width: 27, height: 15.5, borderRadius: 100, flex: "none", marginTop: 1, display: "flex", alignItems: "center", padding: "0 2px", background: on ? "var(--color-accent-primary)" : "#DEE8E2", justifyContent: on ? "flex-end" : "flex-start", transition: "background 120ms" }}>
              <span style={{ width: 11.5, height: 11.5, borderRadius: 100, background: "#fff" }} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#0D2315", textWrap: "pretty" }}>{field.label}</span>
              {field.note ? <span style={{ display: "block", fontSize: 10, color: "#5f6e65", marginTop: 2, lineHeight: 1.4 }}>{field.note}</span> : null}
            </span>
          </button>
        );
      }}
    />
  );
}

/** A searchable checklist for choosing several things. Nothing ticked means "all", which each field's note says. */
function MultiPicker({ field, control }: { field: ResourceField; control: Control<Record<string, unknown>> }) {
  return <Controller control={control} name={field.name} render={({ field: state }) => <PickerBody field={field} picked={Array.isArray(state.value) ? (state.value as string[]) : []} onChange={state.onChange} />} />;
}

function PickerBody({ field, picked, onChange }: { field: ResourceField; picked: string[]; onChange: (next: string[]) => void }) {
  const setPicked = (next: string[] | ((current: string[]) => string[])) => onChange(typeof next === "function" ? next(picked) : next);
  const [query, setQuery] = useState("");
  const options = field.options ?? [];
  const shown = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));
  const toggle = (value: string) => setPicked((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  return (
    <div style={{ border: "1px solid #DEE8E2", borderRadius: 10, background: "#fff", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", borderBottom: "1px solid #EDF3EF" }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          style={{ flex: 1, minWidth: 0, fontSize: 11.5, border: "none", outline: "none", background: "transparent", color: "#0D2315" }}
        />
        <span style={{ fontSize: 10.5, fontWeight: 600, color: picked.length ? "#12796A" : "#5E6D64", whiteSpace: "nowrap" }}>{picked.length ? `${picked.length} chosen` : "None chosen"}</span>
        {picked.length ? (
          <button type="button" onClick={() => setPicked([])} style={{ fontSize: 10.5, fontWeight: 600, color: "#5f6e65", background: "none", border: "none", cursor: "pointer" }}>
            Clear
          </button>
        ) : null}
      </div>
      <div style={{ maxHeight: 132, overflowY: "auto" }}>
        {shown.length === 0 ? <div style={{ padding: "10px 11px", fontSize: 11, color: "#5f6e65" }}>Nothing matches.</div> : null}
        {shown.map((option) => {
          const on = picked.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggle(option.value)}
              style={{ display: "flex", width: "100%", alignItems: "center", gap: 9, padding: "7px 11px", textAlign: "left", fontSize: 11.5, color: "#0D2315", background: on ? "#F4FAF7" : "#fff", border: "none", borderBottom: "1px solid #F2F7F4", cursor: "pointer" }}
            >
              <span style={{ width: 14, height: 14, borderRadius: 4.5, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${on ? "#12796A" : "#D5E0DA"}`, background: on ? "#12796A" : "#fff" }}>
                {on ? (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12 5 5 9-10" />
                  </svg>
                ) : null}
              </span>
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** What each field insists on, said in words beside it — the form never relies on the browser's own bubbles. */
function rulesFor(field: ResourceField): RegisterOptions<Record<string, unknown>, string> {
  const rules: RegisterOptions<Record<string, unknown>, string> = {};
  if (field.required) rules.required = `${field.label} is needed.`;
  rules.validate = (value) => {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) return true;
    if (field.type === "email" && !/^\S+@\S+\.\S+$/.test(text)) return "That does not look like an email address.";
    if (field.type === "number") {
      const number = Number(text);
      if (!Number.isFinite(number)) return "Enter a number.";
      if (field.min !== undefined && number < field.min) return `Use ${field.min} or more.`;
      if (field.max !== undefined && number > field.max) return `Use ${field.max} or less.`;
    }
    return true;
  };
  return rules;
}

/** The starting value of each control, as the form holds it. A switch holds "true" or "false"; a multiselect holds the chosen values. */
function startingValues(fields: ResourceField[]): Record<string, unknown> {
  return Object.fromEntries(
    fields.map((field) => {
      if (field.type === "multiselect") return [field.name, Array.isArray(field.defaultValue) ? field.defaultValue : []];
      if (field.type === "switch") return [field.name, field.on ?? field.defaultValue === "true" ? "true" : "false"];
      if (field.type === "select") return [field.name, field.defaultValue !== undefined ? String(field.defaultValue) : (field.options?.[0]?.value ?? "")];
      return [field.name, field.defaultValue !== undefined && !Array.isArray(field.defaultValue) ? String(field.defaultValue) : ""];
    }),
  );
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
  impact,
  note,
  layout = "form",
  steps,
  stepIndex = 0,
  onStepChange,
  transform,
  keepOpen,
  downloadHref,
  danger = false,
  recorded,
}: ResourceFormProps) {
  const router = useRouter();
  /** Why a locked control cannot be changed, said beside the control that was pressed. */
  const [explained, setExplained] = useState<{ field: string; notice: Notice } | null>(null);
  const explain = (field: ResourceField, title: string, description: string) => setExplained({ field: field.name, notice: { variant: "info", title, description } });
  const [pending, setPending] = useState(false);
  // The form's values live in React Hook Form; what the "static" preview fields compute from is what has been typed so far.
  const form = useForm<Record<string, unknown>>({ defaultValues: startingValues(fields) });
  const { register, control, formState: { errors } } = form;
  const watched = form.watch();
  const live: Record<string, string> = Object.fromEntries(Object.entries(watched).map(([key, value]) => [key, Array.isArray(value) ? "" : String(value ?? "")]));
  const problem = (field: ResourceField) => {
    const found = errors[field.name]?.message;
    return typeof found === "string" ? found : undefined;
  };
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "warning" | "danger">("success");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [pendingPayload, setPendingPayload] =
    useState<Record<string, unknown> | null>(null);

  const offlineQueue = useOfflineDraftQueue<Record<string, unknown>>({
    storageKey: offlineKey ?? `${endpoint}-unused`,
    endpoint,
  });

  async function submitPayload(payload: Record<string, unknown>) {
    setPending(true);
    setMessage(null);

    try {
      if (offlineKey && !navigator.onLine && !readDevicePreferences().keepOffline) {
        throw new Error("You are offline, and you have chosen not to keep work on this device (Preferences), so nothing was saved.");
      }
      if (offlineKey && !navigator.onLine) {
        offlineQueue.saveDraft(payload);
        setTone("warning");
        setMessage("Saved as an offline draft. Your changes are queued on this device and can be synced when connectivity improves.");
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

      const body = await readReply<{ ok?: boolean; error?: string; message?: string }>(response);

      if (!response.ok || body.ok === false) {
        throw new Error(body.error ?? "Unable to save record");
      }

      setTone("success");
      setMessage(keepOpen && body.message ? body.message : "Saved successfully.");
      setNeedsConfirmation(false);
      setPendingPayload(null);
      if (keepOpen) return;
      form.reset();
      router.refresh();
      onSuccess?.();
    } catch (error) {
      setTone("danger");
      const nextMessage = error instanceof Error ? error.message : "Something went wrong";
      setMessage(nextMessage);
    } finally {
      setPending(false);
    }
  }

  /** Moves a stepped form on once the step on show is in order; says what is not, beside the fields, if it is not. */
  async function advance() {
    const here = fields.filter((field) => field.wizardStep === steps![stepIndex]!.name && field.type !== "static" && !field.disabled).map((field) => field.name);
    if (await form.trigger(here)) onStepChange?.(stepIndex + 1);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (steps && stepIndex < steps.length - 1) {
      await advance();
      return;
    }
    await form.handleSubmit(send, () => {
      setTone("warning");
      setMessage("Some fields need attention — they are marked below.");
    })();
  }

  async function send(values: Record<string, unknown>) {
    let payload: Record<string, unknown>;
    try {
      payload = fields.reduce<Record<string, unknown>>((acc, field) => {
        // Display-only rows carry no value; only real controls are sent.
        if (field.type === "static" || field.type === "toggle" || field.type === "locked" || field.disabled) {
          return acc;
        }
        const raw = values[field.name];
        if (field.type === "multiselect") {
          acc[field.name] = JSON.stringify((Array.isArray(raw) ? raw : []).filter(Boolean));
          return acc;
        }

        if (field.object) {
          const group = (acc[field.object] ?? {}) as Record<string, boolean | string>;
          if (field.type === "switch") group[field.name] = raw === "true";
          else if (typeof raw === "string" && raw !== "") group[field.name] = raw;
          acc[field.object] = group;
          return acc;
        }

        if (raw !== undefined && raw !== null) {
          const rawValue = String(raw);
          if (field.parse === "json" && rawValue.trim() === "" && !field.required) {
            return acc;
          }
          acc[field.name] =
            field.parse === "bands"
              ? parseBands(rawValue)
              : field.parse === "json"
              ? JSON.parse(rawValue)
              : field.parse === "csv"
                ? rawValue.split(",").map((part) => part.trim()).filter(Boolean)
                : rawValue;
        }
        return acc;
      }, {});
    } catch (error) {
      setTone("danger");
      setMessage(error instanceof Error && error.message.includes("is not a band") ? error.message : "One of the fields is not valid. Please review and try again.");
      return;
    }

    if (transform) payload = transform(payload);

    if (downloadHref) {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(payload)) if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
      window.location.assign(`${downloadHref}${downloadHref.includes("?") ? "&" : "?"}${query.toString()}`);
      setTone("success");
      setMessage("Your export has started — it will download in a moment.");
      onSuccess?.();
      return;
    }

    if (confirmLabel && !needsConfirmation && layout !== "reason") {
      setPendingPayload(payload);
      setNeedsConfirmation(true);
      setTone("warning");
      setMessage(confirmMessage ?? "Review the details before confirming.");
      return;
    }

    await submitPayload(payload);
  }

  async function handleSyncDrafts() {
    const result = await offlineQueue.syncDrafts();
    setTone("success");
    setMessage(`Synced ${result.synced} queued draft(s).`);
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

  // Every form in the mockup is read in headed sections. Where a caller names none, the fields are grouped the way the mockup would:
  // the decision first, then the reason that goes on the record.
  const sectioned = fields.some((field) => field.section && field.type !== "hidden");
  const sectionOf = (field: ResourceField) => {
    if (sectioned) return field.section;
    if (field.type === "static") return "About this record";
    if (field.type === "textarea" && /reason|why|note|evidence|comment|message|detail/i.test(field.name)) return "Reason";
    return "Details";
  };
  const segments: Array<{ section?: string; step?: string; kind: "toggle" | "switch" | "locked" | "field"; fields: ResourceField[] }> = [];
  for (const rawField of fields.filter((field) => field.type !== "hidden")) {
    const field = sectioned ? rawField : { ...rawField, section: sectionOf(rawField) };
    const kind: "toggle" | "switch" | "locked" | "field" = field.type === "locked" || field.type === "toggle" || (field.type === "static" && /^(fixed for everyone|withheld by policy)/i.test(field.section ?? "")) ? "locked" : field.type === "switch" ? "switch" : "field";
    const last = segments[segments.length - 1];
    if (last && last.section === field.section && last.kind === kind && last.step === field.wizardStep) {
      last.fields.push(field);
    } else {
      segments.push({ section: field.section, step: field.wizardStep, kind, fields: [field] });
    }
  }

  const content = (
    <>
      {showHeader ? (
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="section-eyebrow">Resource form</p>
            <h3 className="mt-2 text-[20px] font-bold text-(--color-text-primary)">{title}</h3>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-(--color-text-secondary)">{description}</p>
          </div>

          {offlineKey ? (
            <div className="rounded-2xl border border-(--color-border-default) bg-(--color-accent-primary-dim) px-4 py-3 text-sm">
              <p className="font-semibold text-(--color-text-primary)">
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
          <div className="rounded-2xl border border-(--color-border-default) bg-(--color-accent-primary-dim) px-4 py-3 text-sm">
            <p className="font-semibold text-(--color-text-primary)">
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

      <form id={formId} onSubmit={handleSubmit} noValidate className="grid gap-5">
          <div>
            {segments.map((segment, segIndex) => (
              <div
                key={`${segment.section ?? "segment"}-${segIndex}`}
                data-step={segment.step}
                style={{ marginBottom: segIndex === segments.length - 1 ? 0 : 18, display: steps && segment.step && steps[stepIndex]?.name !== segment.step ? "none" : undefined }}
              >
                {segment.section && segment.section !== segments[segIndex - 1]?.section ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5f6e65", whiteSpace: "nowrap" }}>
                      {segment.section}
                    </div>
                    <div style={{ height: 1, flex: 1, background: "#EDF3EF" }} />
                  </div>
                ) : null}

                {segment.kind === "locked" ? (
                  <div style={{ border: "1px solid #EDF3EF", borderRadius: 11, overflow: "hidden", background: "#FBFDFC" }}>
                    {segment.fields.map((field, lockIndex) => (
                      <div key={field.name} style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "10px 12px", borderBottom: lockIndex === segment.fields.length - 1 ? "none" : "1px solid #F2F7F4" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B4C4BB" strokeWidth="1.9" strokeLinecap="round" style={{ flex: "none", marginTop: 1 }}>
                          <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" />
                          <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
                        </svg>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#77857C", textWrap: "pretty" }}>{field.label}</div>
                          {field.placeholder || field.note ? <div style={{ fontSize: 10, color: "#5E6D64", marginTop: 2, lineHeight: 1.45, textWrap: "pretty" }}>{[field.placeholder, field.note].filter(Boolean).join(" — ")}</div> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : segment.kind === "switch" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {segment.fields.map((field) => (
                      <SwitchField key={field.name} field={field} control={control} />
                    ))}
                  </div>
                ) : segment.kind === "toggle" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {segment.fields.map((field) => (
                      <div
                        key={field.name}
                        role="button"
                        tabIndex={0}
                        onClick={() => explain(field, field.disabled ? "Not built" : "Fixed — can't be changed here", field.note ?? (field.disabled ? "This control isn't wired up in this build." : "This is always on and isn't editable."))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            explain(field, field.disabled ? "Not built" : "Fixed — can't be changed here", field.note ?? (field.disabled ? "This control isn't wired up in this build." : "This is always on and isn't editable."));
                          }
                        }}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 9,
                          borderRadius: 10,
                          padding: "9px 11px",
                          minWidth: 0,
                          cursor: "pointer",
                          background: field.disabled ? "#FCFDFC" : "#F4FAF7",
                          border: `1px solid ${field.disabled ? "#E6EEE9" : "#CFE4DB"}`
                        }}
                      >
                        <div
                          style={{
                            width: 27,
                            height: 15.5,
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
                          <div style={{ width: 11.5, height: 11.5, borderRadius: 100, background: "#fff" }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#0D2315", textWrap: "pretty" }}>{field.label}</div>
                          {field.note ? <div style={{ fontSize: 10, color: "#5f6e65", marginTop: 2, lineHeight: 1.4 }}>{field.note}</div> : null}
                        </div>
                      </div>
                    ))}
                    {explained && segment.fields.some((field) => field.name === explained.field) ? (
                      <div style={{ gridColumn: "1 / -1" }}><InlineNotice notice={explained.notice} onDismiss={() => setExplained(null)} compact /></div>
                    ) : null}
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                    {segment.fields.map((field) => {
                      const readonly = field.type === "static" || field.disabled;
                      const isSelect = field.type === "select";
                      const spanFull = field.full || field.type === "textarea" || field.type === "multiselect";
                      return (
                        <label key={field.name} style={{ minWidth: 0, gridColumn: spanFull ? "1 / -1" : undefined }}>
                          <div style={{ fontSize: 10.5, fontWeight: 600, color: "#435048", marginBottom: 5.5 }}>
                            {field.label}
                            {field.required ? " *" : ""}
                          </div>
                          {field.type === "textarea" ? (
                            <textarea
                              {...register(field.name, rulesFor(field))}
                              aria-invalid={Boolean(problem(field))}
                              aria-required={field.required}
                              placeholder={field.placeholder}
                              rows={4}
                              style={{ width: "100%", fontSize: 11.5, color: "#0D2315", fontWeight: 500, borderRadius: 10, padding: "10px 11.5px", background: "#fff", border: "1px solid #DEE8E2", outline: "none", resize: "vertical" }}
                            />
                          ) : field.type === "multiselect" ? (
                            <MultiPicker field={field} control={control} />
                          ) : (
                            <div
                              role={field.type === "static" ? "button" : undefined}
                              tabIndex={field.type === "static" ? 0 : undefined}
                              onClick={
                                field.type === "static"
                                  ? () => explain(field, "Not editable here", field.note ?? "This field is locked — nothing in this build lets it be changed.")
                                  : undefined
                              }
                              onKeyDown={
                                field.type === "static"
                                  ? (event) => {
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        explain(field, "Not editable here", field.note ?? "This field is locked — nothing in this build lets it be changed.");
                                      }
                                    }
                                  : undefined
                              }
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 7,
                                borderRadius: 10,
                                padding: "10px 11.5px",
                                cursor: field.type === "static" ? "pointer" : undefined,
                                background: readonly ? "#F7FAF8" : "#fff",
                                border: `1px solid ${readonly ? "#E6EEE9" : "#DEE8E2"}`
                              }}
                            >
                              {field.type === "static" ? (
                                <span style={{ fontSize: 11.5, color: "#5D6B63", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {field.compute ? field.compute(live) : field.placeholder}
                                </span>
                              ) : field.type === "select" ? (
                                <select
                                  {...(field.disabled ? {} : register(field.name, rulesFor(field)))}
                                  aria-invalid={Boolean(problem(field))}
                                  aria-required={field.required}
                                  disabled={field.disabled}
                                  style={{ fontSize: 11.5, color: "#0D2315", fontWeight: 500, background: "transparent", border: "none", outline: "none", width: "100%", appearance: "none" }}
                                >
                                  {(field.options ?? []).map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  {...register(field.name, rulesFor(field))}
                                  aria-invalid={Boolean(problem(field))}
                                  aria-required={field.required}
                                  placeholder={field.placeholder}
                                  min={field.min}
                                  max={field.max}
                                  step={field.step}
                                  style={{ fontSize: 11.5, color: "#0D2315", fontWeight: 500, background: "transparent", border: "none", outline: "none", width: "100%" }}
                                  type={field.type ?? "text"}
                                />
                              )}
                              {field.type === "static" ? (
                                <svg width="11.5" height="11.5" viewBox="0 0 24 24" fill="none" stroke="#B4C4BB" strokeWidth="1.9" strokeLinecap="round" style={{ flex: "none" }}>
                                  <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" />
                                  <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
                                </svg>
                              ) : isSelect ? (
                                <svg width="12.5" height="12.5" viewBox="0 0 24 24" fill="none" stroke="#5E6D64" strokeWidth="2.2" strokeLinecap="round" style={{ flex: "none" }}>
                                  <path d="m6 9 6 6 6-6" />
                                </svg>
                              ) : null}
                            </div>
                          )}
                          <FieldMessage id={`${formId ?? "form"}-${field.name}-error`}>{problem(field)}</FieldMessage>
                          {field.note ? <div style={{ fontSize: 10, color: "#5f6e65", marginTop: 4.5, lineHeight: 1.45 }}>{field.note}</div> : null}
                        {explained?.field === field.name ? <div style={{ marginTop: 7 }}><InlineNotice notice={explained.notice} onDismiss={() => setExplained(null)} compact /></div> : null}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

        {impact && (!steps || stepIndex === steps.length - 1) ? (
          <div style={{ background: "#F7FAF8", border: "1px solid #E6EEE9", borderRadius: 13, padding: "13.5px 15.5px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5f6e65", marginBottom: 10 }}>
              {impact.label}
            </div>
            {impact.rows.map(([label, value]) => (
              <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "6.5px 0" }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "#0D2315", minWidth: 171, flex: "none", textWrap: "pretty" }}>{label}</div>
                <div style={{ fontSize: 11, color: "#5D6B63", lineHeight: 1.5, textWrap: "pretty" }}>{value}</div>
              </div>
            ))}
          </div>
        ) : null}

        <div
          className={
            chrome === "plain"
              ? "sticky bottom-[-22px] mx-[-26px] mb-[-22px] border-t border-[#EDF3EF] bg-[#FBFDFC] px-[26px] py-[15px]"
              : "border-t border-(--color-border-default) pt-4"
          }
        >
          <div className={needsConfirmation && pendingPayload ? "hidden" : "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-[14.5px]"}>
            <div className="min-h-[24px]">
              {message === null && note ? (
                <p className="max-w-[378px] text-pretty text-[10.5px] leading-normal text-[#5f6e65]">{note}</p>
              ) : null}
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
              {steps && stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={() => onStepChange?.(stepIndex - 1)}
                  disabled={pending}
                  className="rounded-[10px] border border-[#DEE8E2] bg-white px-[15.5px] py-[9px] text-[11.5px] font-semibold text-[#435048] transition hover:bg-[#F7FAF8] disabled:opacity-50"
                >
                  Back
                </button>
              ) : null}
              {onCancel ? (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={pending}
                  className="rounded-[10px] border border-[#DEE8E2] bg-white px-[15.5px] py-[9px] text-[11.5px] font-semibold text-[#435048] transition hover:bg-[#F7FAF8] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
              ) : null}
              <button
                type="submit"
                disabled={pending}
                className="whitespace-nowrap rounded-[10px] bg-[#0D2315] px-[16px] py-[10px] text-[11.5px] font-semibold text-white shadow-[0_7px_16px_-7px_rgba(13,35,21,0.5)] transition hover:bg-[#17402A] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Saving..." : steps && stepIndex < steps.length - 1 ? "Continue" : submitLabel}
              </button>
            </div>
          </div>

          {needsConfirmation && pendingPayload ? (
            <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: "var(--color-warning-dim)", background: "var(--color-warning-dim)" }}>
              <p className="text-[14px] font-semibold text-(--color-warning)">
                Confirm before continuing
              </p>
              <p className="mt-1 text-[13px] text-(--color-text-secondary)">
                {confirmMessage ??
                  "Please confirm this action before the record is saved."}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void submitPayload(pendingPayload)}
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

  if (layout === "reason") {
    const reasonField = fields.find((field) => field.type === "textarea");
    const FeedbackIcon = feedbackIcon;
    return (
      <form id={formId} onSubmit={handleSubmit} noValidate className="mx-[-23.5px] my-[-20px]">
        <div style={{ padding: "22px 24px 18px" }}>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 800, letterSpacing: "-0.015em", color: "#0D2315", textWrap: "pretty" }}>{title}</div>
          <div style={{ fontSize: 12, color: "#5D6B63", lineHeight: 1.6, marginTop: 8, textWrap: "pretty" }}>{description}</div>

          {reasonField ? (
            <>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "#435048", margin: "18px 0 6px" }}>
                {reasonField.label}
                {reasonField.required ? " (required)" : ""}
              </div>
              <textarea
                {...register(reasonField.name, rulesFor(reasonField))}
                aria-invalid={Boolean(problem(reasonField))}
                aria-required={reasonField.required}
                placeholder={reasonField.placeholder ?? "Say what prompted this. It travels with the record permanently."}
                rows={3}
                style={{ width: "100%", minHeight: 74, fontSize: 11.5, color: "#0D2315", fontWeight: 500, borderRadius: 11, padding: "11px 13px", background: "#fff", border: "1.5px solid #DEE8E2", outline: "none", resize: "vertical", lineHeight: 1.55 }}
              />
              <FieldMessage id={`${formId ?? "form"}-${reasonField.name}-error`}>{problem(reasonField)}</FieldMessage>
              {reasonField.note ? <div style={{ fontSize: 10, color: "#5f6e65", marginTop: 4.5, lineHeight: 1.45 }}>{reasonField.note}</div> : null}
            </>
          ) : null}

          {reasonField || recorded ? (
          <div style={{ background: "#F7FAF8", border: "1px solid #E6EEE9", borderRadius: 13, padding: "14px 15px", marginTop: 15 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5f6e65", marginBottom: 9 }}>Will be recorded</div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#0D2315" }}>{recorded?.line ?? `You · ${title}`}</div>
            {recorded?.before || recorded?.after ? (
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 7, flexWrap: "wrap" }}>
                {recorded.before ? <span style={{ fontSize: 10.5, color: "#5f6e65", background: "#F4F8F6", border: "1px solid #EDF3EF", borderRadius: 7, padding: "2px 7px" }}>{recorded.before}</span> : null}
                {recorded.before && recorded.after ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#5E6D64" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M5 12h13M13.5 7l5 5-5 5" />
                  </svg>
                ) : null}
                {recorded.after ? <span style={{ fontSize: 10.5, fontWeight: 600, color: "#17604F", background: "#EAF3EE", border: "1px solid #D5E5DC", borderRadius: 7, padding: "2px 7px" }}>{recorded.after}</span> : null}
              </div>
            ) : null}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid #E6EEE9" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5E6D64" strokeWidth="1.9" strokeLinecap="round" style={{ flex: "none" }}>
                <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" />
                <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
              </svg>
              <div style={{ fontSize: 10.5, color: "#77857C" }}>Written to the audit log under your name, and cannot be edited afterwards.</div>
            </div>
          </div>
          ) : null}
          {message ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium" style={feedbackToneStyle}>
              <FeedbackIcon className="h-4 w-4" />
              <span>{message}</span>
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 9, padding: "14px 24px", borderTop: "1px solid #EDF3EF", background: "#FBFDFC" }}>
          {onCancel ? (
            <button type="button" onClick={onCancel} disabled={pending} className="rounded-[10px] border border-[#DEE8E2] bg-white px-[15.5px] py-[9px] text-[11.5px] font-semibold text-[#435048] transition hover:bg-[#F7FAF8] disabled:opacity-50">
              Cancel
            </button>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className={`whitespace-nowrap rounded-[10px] px-[16px] py-[10px] text-[11.5px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${danger ? "bg-[#B23B3B] shadow-[0_7px_16px_-7px_rgba(178,59,59,0.5)] hover:bg-[#9C3030]" : "bg-[#0D2315] shadow-[0_7px_16px_-7px_rgba(13,35,21,0.5)] hover:bg-[#17402A]"}`}
          >
            {pending ? "Saving..." : submitLabel}
          </button>
        </div>
      </form>
    );
  }

  if (chrome === "plain") return content;

  return (
    <section className="surface-card p-6">
      {content}
    </section>
  );
}
