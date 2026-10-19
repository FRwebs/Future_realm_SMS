"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { DocumentModal } from "@/components/modules/document-modal";
import type { DrawerSpec, FormField, PanelFact } from "@/lib/modules/panels";
import { Field, assetSummary, fieldVisible, initialValue } from "@/components/modules/field";
import { sendJson, sendJsonForData } from "@/lib/modules/submit";
import { INK, MUTED } from "@/lib/modules/tones";

export function FactRows({ facts }: { facts: PanelFact[] }) {
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
/**
 * What each kind of modal announces about itself, taken from the mockup.
 *
 * A modal that says "Confirm before it runs" above the title is doing work a
 * paragraph cannot: it tells somebody whether they are reading, changing or
 * committing before they have read a word of the content.
 */
/**
 * What each kind of modal calls itself.
 *
 * The mockup uses this as the modal's eyebrow when the caller gives no kicker,
 * so a modal always says what it is — "FULL RECORD", "EDIT", "CONFIRM BEFORE IT
 * RUNS" — before the title.
 */
const DRAWER_MODES: Record<string, { label: string }> = {
  form: { label: "New record" },
  view: { label: "Full record" },
  edit: { label: "Edit" },
  decide: { label: "Decision" },
  output: { label: "Produce a document" },
  commit: { label: "Confirm before it runs" },
  info: { label: "For reference" },
  document: { label: "Document" },
};

export function ModuleDrawer({
  spec,
  onClose,
}: {
  spec: DrawerSpec | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // A record opened to be read can be taken into editing: the drawer is swapped
  // for its `edit` spec rather than stacking a second one on top of it.
  const [swapped, setSwapped] = useState<{ from: DrawerSpec; to: DrawerSpec } | null>(null);

  if (!spec || !mounted) return null;
  const active = swapped && swapped.from === spec ? swapped.to : spec;
  // A document can hand the person on to another — the next child's card, the form that sends it —
  // and it does so by replacing itself, so one overlay is ever open at a time.
  const swap = (next: DrawerSpec) => setSwapped({ from: spec, to: next });
  if (active.load) return <LazyDrawer key={active.load} spec={active} onClose={onClose} onSwap={swap} />;
  if (active.doc) return <DocumentModal key={`${active.title}:doc`} spec={active} onClose={onClose} onSwap={swap} />;

  // Keyed on the record so moving from one row's drawer to another's starts
  // clean — the open panel owns its own committed/pending/error state, and
  // remounting resets it without an effect that watches `spec`.
  return (
    <DrawerPanel
      key={`${spec.title}:${active === spec ? "read" : "edit"}`}
      spec={active}
      onClose={onClose}
      onEdit={spec.edit && active === spec ? () => setSwapped({ from: spec, to: spec.edit as DrawerSpec }) : undefined}
    />
  );
}

/**
 * A drawer whose body is read when it opens. It shows what it already knows — the title, the kicker —
 * and swaps itself for the full record when that arrives, or says plainly that it could not.
 */
function LazyDrawer({ spec, onClose, onSwap }: { spec: DrawerSpec; onClose: () => void; onSwap: (next: DrawerSpec) => void }) {
  const [loaded, setLoaded] = useState<{ url: string; spec: DrawerSpec | null; error: string | null } | null>(null);
  useEffect(() => {
    let live = true;
    fetch(spec.load as string, { credentials: "include" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as Partial<DrawerSpec> & { error?: string; message?: string } | null;
        if (!response.ok || !body) throw new Error(body?.error ?? body?.message ?? "That record could not be read.");
        if (live) setLoaded({ url: spec.load as string, spec: { ...spec, ...body, load: undefined } as DrawerSpec, error: null });
      })
      .catch((cause) => {
        if (live) setLoaded({ url: spec.load as string, spec: null, error: cause instanceof Error ? cause.message : "That record could not be read." });
      });
    return () => {
      live = false;
    };
  }, [spec]);
  const [editing, setEditing] = useState(false);
  const ready = loaded && loaded.url === spec.load ? loaded : null;
  const base: DrawerSpec = ready?.spec ?? { ...spec, load: undefined, mode: spec.mode ?? "view", readOnly: true, sub: ready?.error ?? "Reading the record…", readOnlyNote: ready?.error ? ready.error : "Reading the record…", facts: [] };
  const shown = editing && base.edit ? base.edit : base;
  if (shown.doc) return <DocumentModal key={`${spec.title}:doc`} spec={shown} onClose={onClose} onSwap={onSwap} />;
  return <DrawerPanel key={`${spec.title}:${ready?.spec ? "loaded" : "wait"}:${editing ? "edit" : "read"}`} spec={shown} onClose={onClose} onEdit={base.edit && !editing ? () => setEditing(true) : undefined} />;
}

type ConfirmKind = "save" | "discard" | "delete";

/**
 * A question put to somebody before something irreversible, drawn over the modal.
 *
 * The mockup asks three: whether to write what was just reviewed, whether to throw
 * away what was typed, and whether to delete. Each says what it is about to do in
 * words, and the way out is always the first thing the eye lands on.
 */
export function ConfirmSheet({
  title,
  body,
  ok,
  cancel,
  tone,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  ok: string;
  cancel: string;
  tone: "progress" | "attention" | "critical";
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const palette =
    tone === "critical"
      ? { bg: "#FDF2F2", fg: "#B23B3B", button: "#B23B3B" }
      : tone === "attention"
        ? { bg: "#FDF6E7", fg: "#8A6410", button: INK }
        : { bg: "#EBF1FA", fg: "#2A5A96", button: INK };

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center px-6" style={{ background: "rgba(13,35,21,0.42)" }}>
      <div
        role="alertdialog"
        aria-label={title}
        className="w-full max-w-[380px] rounded-[16px] bg-white px-[20px] py-[18px]"
        style={{ boxShadow: "0 30px 60px -28px rgba(13,35,21,0.6)" }}
      >
        <span
          className="mb-[11px] flex h-[34px] w-[34px] items-center justify-center rounded-[11px]"
          style={{ background: palette.bg }}
          aria-hidden
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={palette.fg} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            {tone === "critical" ? (
              <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 10.5v6M13.5 10.5v6" />
            ) : tone === "attention" ? (
              <path d="M6 6l12 12M18 6 6 18" />
            ) : (
              <path d="M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z" />
            )}
          </svg>
        </span>
        <p className="text-[14px] font-bold leading-[1.3]" style={{ color: INK }}>
          {title}
        </p>
        <p className="mt-[5px] text-pretty text-[11.5px] leading-[1.55]" style={{ color: "#5C6A62" }}>
          {body}
        </p>
        <div className="mt-[16px] flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="whitespace-nowrap rounded-[9px] border bg-white px-[14px] py-[9px] text-[11.5px] font-semibold"
            style={{ borderColor: "#CFDDD5", color: "#435048" }}
          >
            {cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="whitespace-nowrap rounded-[9px] px-[15px] py-[10px] text-[11.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: palette.button }}
          >
            {pending ? "Working…" : ok}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A date input holds "2026-04-10"; a person reading it back wants "10 April 2026". */
function prettyDate(text: string): string {
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return text;
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${Number(match[3])} ${months[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

export const asText = (value: unknown) =>
  Array.isArray(value)
    ? value.join(", ")
    : typeof value === "boolean"
      ? value
        ? "Yes"
        : "No"
      : value && typeof value === "object" && "choice" in value
        ? assetSummary(value)
        : prettyDate(String(value ?? ""));

/** What a field's answer reads as when it is read back before saving. */
export function describe(field: FormField, value: unknown): string {
  if (field.kind === "matrix") {
    const ticks = (value as string[] | undefined) ?? [];
    const rows = new Set(ticks.map((tick) => tick.split("|")[0]));
    return ticks.length ? `${ticks.length} actions across ${rows.size} ${rows.size === 1 ? "row" : "rows"}` : "Nothing granted";
  }
  if (field.kind === "lines") {
    const rows = (value as Array<Record<string, string>> | undefined) ?? [];
    return rows.length
      ? rows.map((row) => field.cols.map((col) => row[col.key]).filter(Boolean).join(" \u00b7 ")).join("; ")
      : "None";
  }
  if (field.kind === "picker") {
    const chosen = (value as string[] | undefined) ?? [];
    return chosen.length ? chosen.map((item) => field.options.find((option) => option.value === item)?.label ?? item).join(", ") : "Nobody";
  }
  return asText(value);
}

/**
 * What a form sends: only the fields named in `map` travel, exactly as a form panel does, so a
 * drawer can show a value the endpoint would reject beside ones it takes.
 */
export function buildBody(
  submit: NonNullable<DrawerSpec["submit"]>,
  allFields: FormField[],
  values: Record<string, unknown>,
  reason: string,
): Record<string, unknown> {
  const edited: Record<string, unknown> = {};
  for (const [label, key] of Object.entries(submit.map ?? {})) {
    let value = values[label];
    if (value === undefined) continue;
    // A file the school keeps is sent as what it is: nothing at all when it
    // is being kept, an empty string when it is being removed, the image
    // itself when a new one was chosen.
    const field = allFields.find((item) => item.label === label);
    if (field && !fieldVisible(field, values)) continue;
    // A line that only informs — "None exist yet" — is not an answer, and must not travel as one.
    if (field?.kind === "static") continue;
    // Ticks on rows whose module is no longer ticked are not part of the answer.
    if (field?.kind === "matrix" && field.groupFrom) {
      const groups = (values[field.groupFrom] as string[] | undefined) ?? [];
      const live = new Set(field.rows.filter((row) => !row.group || groups.includes(row.group)).map((row) => row.key));
      value = (value as string[]).filter((tick) => live.has(tick.split("|")[0]));
    }
    if (field?.kind === "asset") {
      const asset = value as { choice: string; data?: string };
      if (asset.choice === field.options[0]) continue;
      if (asset.choice === field.options[2]) value = "";
      else if (asset.data) value = asset.data;
      else continue;
    }
    // A select shows a label and the endpoint stores a code; `encode` is
    // the pairing, so what travels is what the column actually holds.
    const table = submit.encode?.[label];
    edited[key] = Array.isArray(value) && table
      ? value.map((item) => (typeof item === "string" && item in table ? table[item] : item))
      : table && typeof value === "string" && value in table
        ? table[value]
        : value;
  }

  for (const [label, [key, entry]] of Object.entries(submit.nest ?? {})) {
    const raw = values[label];
    const field = allFields.find((item) => item.label === label);
    if (typeof raw !== "string" || (field && !fieldVisible(field, values))) continue;
    const table = submit.encode?.[label];
    const bucket = (edited[key] as Record<string, string> | undefined) ?? {};
    bucket[entry] = table && raw in table ? table[raw] : raw;
    edited[key] = bucket;
  }

  return {
    ...(submit.body ?? {}),
    ...edited,
    ...(reason.trim() ? { [submit.reasonKey ?? "reason"]: reason.trim() } : {}),
  };
}

/** A matrix or list seeded from another field starts again whenever that field changes. */
export function withSeeds(allFields: FormField[], current: Record<string, unknown>, field: FormField, next: unknown): Record<string, unknown> {
  const updated: Record<string, unknown> = { ...current, [field.label]: next };
  for (const other of allFields) {
    if ((other.kind === "matrix" || other.kind === "checks") && other.seeds?.field === field.label) {
      const set = other.seeds.sets[String(next)];
      if (set) updated[other.label] = [...set];
    }
  }
  return updated;
}

export type CommitResult = { queued?: boolean; links?: Array<{ name: string; link: string }>; warnings?: string[]; link?: string; name?: string; fields?: Array<[string, string]>; checkoutUrl?: string; note?: string; gateway?: string; href?: string; hrefLabel?: string };

/** What a committed form says: what happened, what the server handed back, and where to go next. */
export function CommitDone({
  spec,
  result,
  doneTitle,
  doneBody,
  doneLines,
}: {
  spec: DrawerSpec;
  result: CommitResult | null;
  doneTitle: string;
  doneBody?: string;
  /** The first few answers a person gave, repeated back; left out when there are none to show. */
  doneLines?: PanelFact[];
}) {
  return (
              <>
                <div
                  className="rounded-[12px] border px-[13px] py-[11px]"
                  style={{ background: "#EAF6F0", borderColor: "#CFE4DB" }}
                >
                  <p className="text-[12px] font-bold" style={{ color: "#17714F" }}>
                    {result?.queued ? "Saved on this device — not yet at the school" : doneTitle}
                  </p>
                  {doneBody && !result?.queued ? (
                    <p
                      className="mt-[5px] text-pretty text-[11px] leading-[1.55]"
                      style={{ color: "#17604F" }}
                    >
                      {doneBody}
                    </p>
                  ) : null}
                </div>
                {doneLines?.length ? <FactRows facts={doneLines.map(([label, value]) => [label, value])} /> : null}
                {result?.fields?.length ? <FactRows facts={result.fields.map(([label, value]) => [label, value])} /> : null}
                {result?.note ? (
                  <p className="text-[11px] leading-[1.55]" style={{ color: MUTED }}>
                    {result.note}
                  </p>
                ) : null}
                {result?.checkoutUrl ? (
                  <div className="grid gap-[6px]">
                    <a href={result.checkoutUrl} className="inline-flex items-center justify-center rounded-[10px] px-[14px] py-[10px] text-[12px] font-semibold text-white" style={{ background: INK }}>
                      Continue to payment
                    </a>
                    <p className="text-[10.5px] leading-[1.5]" style={{ color: MUTED }}>
                      {result.gateway === "test" ? "The payment provider is in test mode: no card is charged and the payment is simulated." : "Your card is entered on the payment provider's page — it never touches this school's records."}
                    </p>
                  </div>
                ) : null}
                {result?.href ? (
                  <a href={result.href} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-[10px] px-[14px] py-[10px] text-[12px] font-semibold text-white" style={{ background: INK }}>
                    {result.hrefLabel ?? "Open it"}
                  </a>
                ) : null}
                {spec.next ? (
                  <a href={spec.next.href} className="inline-flex items-center justify-center rounded-[10px] border px-[14px] py-[10px] text-[12px] font-semibold" style={{ borderColor: "#CFDDD5", color: "#435048" }}>
                    {spec.next.label}
                  </a>
                ) : null}
                {result?.warnings?.length ? (
                  <div className="rounded-[12px] border px-[13px] py-[10px]" style={{ background: "#FBF6E8", borderColor: "#E7D9B4" }}>
                    <p className="text-[11px] font-semibold" style={{ color: "#8A6410" }}>
                      Created, with {result.warnings.length === 1 ? "one thing" : `${result.warnings.length} things`} to look at
                    </p>
                    <ul className="mt-[4px] grid gap-[3px]">
                      {result.warnings.map((warning) => (
                        <li key={warning} className="text-[10.5px] leading-[1.5]" style={{ color: "#8A6410" }}>
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {(() => {
                  const links = result?.links ?? (result?.link ? [{ name: result.name ?? "Activation link", link: result.link }] : []);
                  return links.length ? (
                    <div className="grid gap-[7px]">
                      <p className="text-[10.5px] leading-[1.5]" style={{ color: MUTED }}>
                        Share each link with the person it is for. It works once, and the one before it no longer does.
                      </p>
                      {links.map((item) => {
                        const full = `${typeof window === "undefined" ? "" : window.location.origin}${item.link}`;
                        return (
                          <div key={item.link} className="grid gap-[4px] rounded-[11px] border px-[12px] py-[9px]" style={{ borderColor: "#E4EDE8" }}>
                            <span className="text-[11px] font-semibold" style={{ color: INK }}>{item.name}</span>
                            <div className="flex items-center gap-[7px]">
                              <input readOnly value={full} aria-label={`Link for ${item.name}`} className="min-w-0 flex-1 rounded-[8px] border bg-[#F7FAF8] px-[9px] py-[6px] text-[10.5px]" style={{ borderColor: "#DEE8E2" }} onFocus={(event) => event.currentTarget.select()} />
                              <button type="button" onClick={() => navigator.clipboard?.writeText(full)} className="rounded-[8px] border border-[#CFDDD5] bg-white px-[10px] py-[6px] text-[10.5px] font-semibold text-[#435048]">
                                Copy
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null;
                })()}
              </>
  );
}

/**
 * Only mounted while a drawer is actually open.
 *
 * That is what keeps `useRouter` out of the closed case: ModuleDrawer sits on
 * every module page whether or not anything is open, and calling the hook there
 * requires an app-router context that server-rendered markup and unit tests do
 * not have.
 */
function DrawerPanel({
  spec,
  onClose,
  onEdit,
}: {
  spec: DrawerSpec;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const [committed, setCommitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [doneKind, setDoneKind] = useState<"saved" | "deleted">("saved");
  /** What the server handed back that the person needs to see: links to share, warnings to read. */
  const [result, setResult] = useState<CommitResult | null>(null);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const allFields = useMemo(
    () => (spec.steps?.length ? spec.steps.flatMap((step) => step.fields) : (spec.fields ?? [])),
    [spec],
  );
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(allFields.map((field) => [field.label, initialValue(field)])),
  );
  const [stepIndex, setStepIndex] = useState(0);
  /** Stage 1 of a staged form: reading back exactly what will be written. */
  const [reviewing, setReviewing] = useState(false);
  const router = useRouter();

  /** Each field's value as the modal opened, so a change can name what it replaces. */
  const before = useMemo(() => {
    const map: Record<string, string> = {};
    for (const field of allFields) map[field.label] = asText(initialValue(field));
    return map;
  }, [allFields]);

  const dirty =
    reason.trim().length > 0 ||
    allFields.some((field) => asText(values[field.label]) !== before[field.label]);

  // Anything with something to lose asks before it closes.
  function requestClose() {
    if (!committed && dirty) setConfirm("discard");
    else onClose();
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (confirm) setConfirm(null);
      else requestClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
    // requestClose closes over dirty/committed/confirm; re-bind when they change.
  }, [onClose, dirty, committed, confirm]);

  const modeMeta =
    DRAWER_MODES[spec.readOnly ? "view" : (spec.mode === "read" ? "view" : (spec.mode ?? "view"))] ??
    DRAWER_MODES.view;

  const hasForm = !spec.readOnly && allFields.length > 0;
  /**
   * A form and an edit are both taken in two stages, as the mockup takes them:
   * fill, then read back exactly what will be written — each changed value shown
   * against the one it replaces — and only then save. A person cannot hold the
   * before and the after in their head at once, so the modal holds it for them.
   */
  const staged = hasForm && (spec.mode === "edit" || spec.mode === "form");
  const isEdit = staged && spec.mode === "edit";
  const isCommit =
    !spec.readOnly &&
    (spec.mode === "commit" ||
      spec.mode === "form" ||
      spec.mode === "decide" ||
      spec.mode === "output" ||
      spec.mode === "edit");
  const submit = spec.submit;
  const steps = spec.steps ?? [];
  const onLastStep = !steps.length || stepIndex === steps.length - 1;
  const step = steps[stepIndex] ?? null;
  const visibleFields = (step ? step.fields : (spec.fields ?? [])).filter((field) => fieldVisible(field, values));

  /** A step cannot be left until everything it marks required is answered. */
  const unanswered = visibleFields.filter((field) => {
    if (!field.required) return false;
    const value = values[field.label];
    if (Array.isArray(value)) return value.length === 0;
    return value === undefined || value === null || String(value).trim() === "";
  });

  /**
   * The mockup sizes the modal by what is in it: 520px reads as one column of
   * prose, and anything past three fields gets 700px so the pairs sit side by
   * side instead of becoming a long scroll.
   */
  const panelMax = (step ? step.fields.length : (spec.fields?.length ?? 0)) > 3 ? 700 : 520;

  // An edit always asks why: the reason is kept with both values, so the next
  // person to open the record can see what changed and what it was before.
  const needsReason = Boolean(submit?.reasonKey) || isEdit;
  const reasonMissing = (Boolean(submit?.reasonRequired) || isEdit) && !reason.trim();

  const changeFacts: PanelFact[] = allFields
    .filter((field) => field.kind !== "static" && fieldVisible(field, values))
    .map((field) => {
      const now = describe(field, values[field.label]);
      const was = before[field.label] ?? "";
      return [field.label, now || "—", isEdit && was && was !== now ? `Was: ${was}` : ""];
    });

  /** What the done screen repeats back: the first few answers a person actually gave. */
  const doneLines: PanelFact[] = changeFacts.filter(([, value]) => value !== "—").slice(0, 4);

  const noun = String(spec.remove?.noun ?? spec.title)
    .replace(/^(add|create|new|edit)\s+(an?\s+)?/i, "")
    .toLowerCase();

  async function commit() {
    setConfirm(null);
    // No endpoint means the drawer was authored as a confirmation only. It
    // still closes the loop for the reader; it just has nothing to send.
    if (!submit) {
      setCommitted(true);
      return;
    }

    setPending(true);
    setError(null);
    try {
      const answer = await sendJsonForData<typeof result>(submit.endpoint, submit.method ?? "POST", buildBody(submit, allFields, values, reason));
      setResult(answer && typeof answer === "object" ? answer : null);
      setDoneKind("saved");
      setCommitted(true);
      // The page is a server component reading live figures, so the decision
      // has to be re-read rather than patched in — the queue, the counts above
      // it and the activity list all move together.
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not go through.");
      // The answer is in the form and the sheet is closed; take them back to it.
      setReviewing(false);
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!spec.remove) return;
    setConfirm(null);
    setPending(true);
    setError(null);
    try {
      await sendJson(spec.remove.endpoint, "DELETE", {});
      setDoneKind("deleted");
      setCommitted(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That could not be deleted.");
    } finally {
      setPending(false);
    }
  }

  const primaryLabel = spec.commitLabel ?? (isEdit ? "Save changes" : "Confirm");
  const askBeforeWriting =
    staged && /^(add|create|new)\s/i.test(spec.title) && !isEdit
      ? `Create this ${noun}?`
      : staged
        ? "Save these changes?"
        : "Run this now?";

  const confirmView: Record<ConfirmKind, Parameters<typeof ConfirmSheet>[0]> = {
    save: {
      title: askBeforeWriting,
      body: "Nothing is written until you confirm.",
      ok: primaryLabel,
      cancel: "Go back",
      tone: "progress",
      pending,
      onCancel: () => setConfirm(null),
      onConfirm: commit,
    },
    discard: {
      title: "Discard your changes?",
      body: "What you have filled in here will be lost.",
      ok: "Discard",
      cancel: "Keep editing",
      tone: "attention",
      onCancel: () => setConfirm(null),
      onConfirm: onClose,
    },
    delete: {
      title: `Delete this ${spec.remove?.noun ?? "record"}?`,
      body:
        spec.remove?.warn ??
        `“${spec.title}” will be removed from every list and report it appears in. It is kept in the audit log.`,
      ok: "Delete permanently",
      cancel: "Keep it",
      tone: "critical",
      pending,
      onCancel: () => setConfirm(null),
      onConfirm: remove,
    },
  };

  const doneTitle =
    doneKind === "deleted" ? (spec.remove?.done ?? `${spec.title} deleted`) : (spec.commitDone ?? "Done");
  const doneBody =
    doneKind === "deleted"
      ? (spec.remove?.doneBody ?? "It is gone from every list. The deletion is in the audit log under your name.")
      : spec.commitDoneBody;

  return createPortal(
    <div
      className="fixed inset-0 z-[42] flex items-center justify-center overflow-y-auto px-6 py-8"
      role="dialog"
      aria-modal="true"
      aria-label={spec.title}
    >
      <button
        type="button"
        aria-label="Close" title="Close"
        onClick={requestClose}
        className="fixed inset-0 cursor-default"
        style={{ background: "rgba(13,35,21,0.5)" }}
      />

      <div
        className="relative flex w-full flex-col overflow-hidden rounded-[20px] bg-white"
        style={{
          maxWidth: `${panelMax}px`,
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
              {/* The mockup's eyebrow: the kicker when there is one, otherwise
                  what kind of modal this is — "FULL RECORD", "EDIT". */}
              <p
                className="mb-[5.5px] text-[9.5px] font-bold tracking-[0.08em]"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                {(spec.kicker ?? modeMeta.label).toUpperCase()}
                {isEdit && spec.kicker ? " · EDITING" : ""}
              </p>
              <h2 className="text-pretty text-[19px] font-bold leading-[1.25] tracking-[-0.01em] text-white">
                {committed ? doneTitle : spec.title}
              </h2>
              {spec.sub && !committed ? (
                <p
                  className="mt-[4.5px] text-pretty text-[11px] leading-[1.5]"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                >
                  {spec.sub}
                </p>
              ) : null}

              {/* A staged form says which of the two stages you are on. */}
              {staged && !committed ? (
                <div className="mt-[11px] flex flex-wrap items-center gap-[7px]">
                  {[
                    { label: isEdit ? "Edit the values" : "Fill it in", on: !reviewing, done: reviewing, mark: reviewing ? "✓" : "1" },
                    { label: "Check and confirm", on: reviewing, done: false, mark: "2" },
                  ].map((pill) => (
                    <span
                      key={pill.label}
                      className="inline-flex items-center gap-[7px] whitespace-nowrap rounded-full py-[5px] pl-[6px] pr-[11px] text-[10.5px] font-semibold"
                      style={{
                        color: pill.on || pill.done ? "#fff" : "rgba(255,255,255,0.5)",
                        background: pill.on ? "rgba(255,255,255,0.14)" : "transparent",
                        border: `1px solid ${pill.on ? "rgba(255,255,255,0.2)" : "transparent"}`,
                      }}
                    >
                      <span
                        className="flex h-[17px] w-[17px] flex-none items-center justify-center rounded-full text-[9px] font-extrabold"
                        style={{
                          background: pill.done ? "#fff" : pill.on ? "#12796A" : "rgba(255,255,255,0.12)",
                          color: pill.done ? INK : "#fff",
                        }}
                      >
                        {pill.mark}
                      </span>
                      {pill.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close" title="Close"
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
              <CommitDone spec={spec} result={result} doneTitle={doneTitle} doneBody={doneBody} doneLines={doneKind === "saved" && staged ? doneLines : undefined} />
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

            {!committed && spec.facts?.length ? <FactRows facts={spec.facts} /> : null}

            {steps.length && !committed && !(staged && reviewing) ? (
              <div className="grid gap-[7px]">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[12px] font-semibold" style={{ color: INK }}>
                    {step?.title}
                  </span>
                  <span className="text-[10.5px] font-semibold tabular-nums" style={{ color: MUTED }}>
                    Step {stepIndex + 1} of {steps.length}
                  </span>
                </div>
                {step?.hint ? (
                  <p className="text-[10.5px] leading-[1.5]" style={{ color: MUTED }}>
                    {step.hint}
                  </p>
                ) : null}
                <div className="mt-[2px] flex gap-[4px]" aria-hidden>
                  {steps.map((_, index) => (
                    <span
                      key={index}
                      className="h-[3px] flex-1 rounded-full"
                      style={{ background: index <= stepIndex ? INK : "#E6EEE9" }}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {staged && reviewing && !committed ? (
              <>
                <div
                  className="rounded-[12px] border px-[13px] py-[11px]"
                  style={{ background: "#EBF1FA", borderColor: "#DCE7F5" }}
                >
                  <p className="text-pretty text-[11px] leading-[1.55]" style={{ color: "#2A5A96" }}>
                    {spec.reviewNote ??
                      (isEdit
                        ? "These are the values that will be written. Both the previous and the new value stay on the record."
                        : "This is exactly what will be created. Go back to change anything.")}
                  </p>
                </div>
                <dl className="grid gap-[9px]">
                  {changeFacts.map(([label, value, hint]) => (
                    <div
                      key={label}
                      className="grid gap-[2px] rounded-[11px] border px-[13px] py-[10px]"
                      style={{ borderColor: "#E4EDE8", background: hint ? "#FBFDFC" : "transparent" }}
                    >
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.07em]" style={{ color: MUTED }}>
                        {label}
                      </dt>
                      <dd className="text-pretty text-[12px] font-semibold leading-[1.45]" style={{ color: INK }}>
                        {value}
                      </dd>
                      {hint ? (
                        <dd className="text-[10.5px] leading-[1.45]" style={{ color: "#8A6410" }}>
                          {hint}
                        </dd>
                      ) : null}
                    </div>
                  ))}
                </dl>
              </>
            ) : null}

            {visibleFields.length && !committed && !(staged && reviewing) ? (
              <div
                className="grid items-start gap-x-[16px] gap-y-[14px]"
                style={{ gridTemplateColumns: `repeat(${panelMax === 700 ? 2 : 1}, minmax(0,1fr))` }}
              >
                {visibleFields.map((field) => (
                  <div key={field.label} className={field.span === 2 ? "sm:col-span-2" : undefined}>
                    <Field
                      field={field}
                      value={values[field.label]}
                      values={values}
                      setValue={(next) => setValues((current) => withSeeds(allFields, current, field, next))}
                    />
                  </div>
                ))}
              </div>
            ) : null}

            {isCommit && needsReason && !committed && (!staged || reviewing) ? (
              <label className="grid gap-[6px]">
                <span className="text-[10.5px] font-semibold" style={{ color: INK }}>
                  {submit?.reasonLabel ?? (isEdit ? "Reason for this change" : "Reason")}
                  {submit?.reasonRequired || isEdit ? (
                    <span style={{ color: "#B23B3B" }}> · required</span>
                  ) : (
                    <span style={{ color: MUTED }}> · optional</span>
                  )}
                </span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  className="w-full resize-y rounded-[10px] border px-[11px] py-[9px] text-[11.5px] leading-[1.5] outline-none focus:border-[#BFDCD1]"
                  placeholder={
                    isEdit
                      ? "Say what changed and why — the next person to open this record sees it."
                      : undefined
                  }
                  style={{ borderColor: "#DEE8E2", color: INK }}
                />
                {isEdit ? (
                  <span className="text-[10px] leading-[1.45]" style={{ color: MUTED }}>
                    Kept with the before and after values, permanently.
                  </span>
                ) : null}
              </label>
            ) : null}
          </div>
        </div>

        <footer
          className="flex flex-none flex-wrap items-center justify-between gap-x-[14.5px] gap-y-[10px] px-[23.5px] py-[14.5px]"
          style={{ background: "#FBFDFC", borderTop: "1px solid #EDF3EF" }}
        >
          <div className="flex min-w-[140px] flex-1 basis-[200px] items-center gap-[12px]">
            {spec.remove && !committed && !spec.readOnly ? (
              <button
                type="button"
                onClick={() => setConfirm("delete")}
                disabled={pending}
                className="whitespace-nowrap rounded-[9px] px-[4px] py-[6px] text-[11.5px] font-semibold disabled:opacity-50"
                style={{ color: "#B23B3B" }}
              >
                Delete
              </button>
            ) : null}
            <p className="text-pretty text-[10.5px] leading-[1.4]" style={{ color: MUTED }}>
              {committed
                ? ""
                : staged && reviewing
                  ? "Confirmed on the next step"
                  : staged
                    ? (spec.commitNote ?? (isEdit ? "Logged with your name and both values" : "Nothing is written until you confirm"))
                    : (spec.commitNote ?? "")}
            </p>
          </div>

          <div className="ml-auto flex flex-none flex-wrap items-center justify-end gap-2">
            {isCommit && !committed ? (
              <>
                {!(staged && reviewing) ? (
                  <button
                    type="button"
                    onClick={requestClose}
                    className="whitespace-nowrap rounded-[9px] border bg-white px-[15.5px] py-[9px] text-[11.5px] font-semibold"
                    style={{ borderColor: "#CFDDD5", color: "#435048" }}
                  >
                    Cancel
                  </button>
                ) : null}
                {steps.length && stepIndex > 0 && !(staged && reviewing) ? (
                  <button
                    type="button"
                    onClick={() => setStepIndex((current) => current - 1)}
                    className="whitespace-nowrap rounded-[9px] border bg-white px-[12px] py-[9px] text-[11.5px] font-semibold"
                    style={{ borderColor: "#DEE8E2", color: "#435048" }}
                  >
                    Back
                  </button>
                ) : null}
                {staged && reviewing ? (
                  <button
                    type="button"
                    onClick={() => setReviewing(false)}
                    className="whitespace-nowrap rounded-[9px] border bg-white px-[12px] py-[9px] text-[11.5px] font-semibold"
                    style={{ borderColor: "#DEE8E2", color: "#435048" }}
                  >
                    Back to the form
                  </button>
                ) : null}
                {staged && !reviewing && onLastStep ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setReviewing(true);
                    }}
                    disabled={unanswered.length > 0}
                    title={
                      unanswered.length
                        ? `Answer ${unanswered.map((field) => field.label).join(", ")} first.`
                        : undefined
                    }
                    className="whitespace-nowrap rounded-[9px] px-[17px] py-[10px] text-[11.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: INK, boxShadow: "0 7px 16px -9px rgba(13,35,21,0.6)" }}
                  >
                    {isEdit ? "Review changes" : "Review"}
                  </button>
                ) : null}
                {!onLastStep && !(staged && reviewing) ? (
                  <button
                    type="button"
                    onClick={() => setStepIndex((current) => current + 1)}
                    disabled={unanswered.length > 0}
                    title={
                      unanswered.length
                        ? `Answer ${unanswered.map((field) => field.label).join(", ")} first.`
                        : undefined
                    }
                    className="whitespace-nowrap rounded-[9px] px-[17px] py-[10px] text-[11.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: INK, boxShadow: "0 7px 16px -9px rgba(13,35,21,0.6)" }}
                  >
                    Next
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => (staged ? setConfirm("save") : commit())}
                  hidden={!onLastStep || (staged && !reviewing)}
                  disabled={pending || reasonMissing || unanswered.length > 0}
                  title={reasonMissing ? "Say why before you send this." : undefined}
                  className="whitespace-nowrap rounded-[9px] px-[17px] py-[10px] text-[11.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: INK,
                    boxShadow: "0 7px 16px -9px rgba(13,35,21,0.6)",
                  }}
                >
                  {pending ? "Sending…" : primaryLabel}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="whitespace-nowrap rounded-[9px] border bg-white px-[15.5px] py-[9px] text-[11.5px] font-semibold"
                  style={{ borderColor: "#CFDDD5", color: "#435048" }}
                >
                  Close
                </button>
                {onEdit && !committed ? (
                  <button
                    type="button"
                    onClick={onEdit}
                    className="whitespace-nowrap rounded-[9px] px-[17px] py-[10px] text-[11.5px] font-semibold text-white"
                    style={{ background: INK, boxShadow: "0 7px 16px -9px rgba(13,35,21,0.6)" }}
                  >
                    {spec.editLabel ?? "Edit this record"}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </footer>

        {confirm ? <ConfirmSheet {...confirmView[confirm]} /> : null}
      </div>
    </div>,
    document.body,
  );
}
