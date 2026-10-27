"use client";

import { AddableChecks, LinesField, MatrixField, PickerField } from "@/components/modules/field-extras";
import type { FormField } from "@/lib/modules/panels";
import { CARD_BORDER, MUTED } from "@/lib/modules/tones";

const CONTROL =
  "w-full min-w-0 rounded-[10px] border-[1.5px] px-[11.5px] py-[10px] text-[12px] font-medium leading-normal text-[#0D2315] outline-hidden min-h-[38px] box-border focus:border-[#12796A]";

import { cn } from "@/lib/utils/cn";

/**
 * One input, and the value it starts from.
 *
 * Extracted from panel-renderer so the drawer can use it too. The drawer is
 * imported *by* panel-renderer, so importing it back would be circular — and
 * an "Edit …" drawer that cannot render an input is the whole reason this
 * needed to move.
 */
export type AssetValue = { choice: string; data?: string; name?: string };

/** What an asset field says about itself in a review, in words. */
export function assetSummary(value: unknown): string {
  const asset = value as AssetValue | undefined;
  if (!asset) return "";
  return asset.data && asset.name ? `${asset.choice} \u00b7 ${asset.name}` : asset.choice;
}

/** Shrinks an image to fit `edge` pixels on its longer side and returns it as a data URL. */
async function shrinkImage(file: File, edge = 320): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot prepare that image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const png = canvas.toDataURL("image/png");
  // A photographed signature is large as a PNG and small as a JPEG; a logo is the reverse.
  const result = png.length > 60_000 ? canvas.toDataURL("image/jpeg", 0.82) : png;
  if (result.length > 90_000) throw new Error("That image is too detailed to keep. Use a simpler or smaller one.");
  return result;
}

export function initialValue(field: FormField): unknown {
  if (field.kind === "toggle") return field.on ?? false;
  if (field.kind === "checks") return field.checked ?? [];
  if (field.kind === "static") return field.value;
  if (field.kind === "picker") return field.checked ?? [];
  if (field.kind === "matrix") return field.checked ?? [];
  if (field.kind === "lines") return (field.rows ?? []).map((row) => ({ ...row }));
  if (field.kind === "asset") return { choice: field.options[0] } satisfies AssetValue;
  // A select with no value renders its first option as selected, so starting
  // its state empty would save a blank for a field the screen says is answered.
  if (field.kind === "select") return field.value ?? field.options[0] ?? "";
  return "value" in field ? (field.value ?? "") : "";
}

/** Is a field offered right now, given what the other fields hold? */
export function fieldVisible(field: FormField, values: Record<string, unknown>): boolean {
  const rule = field.when;
  if (!rule) return true;
  const current = values[rule.field];
  if (rule.equals !== undefined) {
    const wanted = Array.isArray(rule.equals) ? rule.equals : [rule.equals];
    if (!wanted.includes(String(current ?? ""))) return false;
  }
  if (rule.includes !== undefined && !(Array.isArray(current) && current.includes(rule.includes))) return false;
  if (rule.excludes !== undefined && Array.isArray(current) && current.includes(rule.excludes)) return false;
  return true;
}

export function Field({
  field,
  value,
  setValue,
  values,
}: {
  field: FormField;
  value: unknown;
  setValue: (next: unknown) => void;
  /** Every field's value, for the fields that depend on another. */
  values?: Record<string, unknown>;
}) {
  const label = (
    <div className="mb-[7px] flex flex-wrap items-baseline gap-x-[6px]">
      <span className="text-[10.5px] font-semibold leading-[1.4] text-[#435048]">{field.label}</span>
      {field.required ? <span className="text-[10px] text-[#B23B3B]">Required</span> : null}
      {field.optional ? <span className="text-[10px] text-[#8B9A91]">Optional</span> : null}
      {field.unit ? <span className="text-[10px] text-[#8B9A91]">{field.unit}</span> : null}
    </div>
  );

  const hint = field.hint ? (
    <p className="mt-[5px] text-[10px] leading-[1.45] text-[#6B7A71]">{field.hint}</p>
  ) : null;

  const wrap = cn("min-w-0", field.span === 2 && "col-span-full");

  if (field.kind === "static") {
    const picked = field.by ? field.by.cases[String(values?.[field.by.field] ?? "")] : undefined;
    return (
      <div className={wrap}>
        {label}
        <p className="text-pretty pt-[2px] text-[11.5px] font-semibold leading-normal text-[#0D2315]">
          {picked?.value ?? field.value}
        </p>
        {picked?.hint ?? field.hint ? (
          <p className="mt-[5px] text-[10px] leading-[1.45] text-[#6B7A71]">{picked?.hint ?? field.hint}</p>
        ) : null}
      </div>
    );
  }

  if (field.kind === "picker") {
    return (
      <div className={wrap}>
        {label}
        <PickerField field={field} value={(value as string[]) ?? []} setValue={setValue} />
        {hint}
      </div>
    );
  }

  if (field.kind === "matrix") {
    // Rows that belong to a module appear only while the module is ticked above.
    const ticked = field.groupFrom ? (values?.[field.groupFrom] as string[] | undefined) : undefined;
    return (
      <div className={wrap}>
        {label}
        <MatrixField field={field} value={(value as string[]) ?? []} setValue={setValue} visibleGroups={ticked} />
        {hint}
      </div>
    );
  }

  if (field.kind === "lines") {
    return (
      <div className={wrap}>
        {label}
        <LinesField field={field} value={(value as Array<Record<string, string>>) ?? []} setValue={setValue} />
        {hint}
      </div>
    );
  }

  if (field.kind === "asset") {
    const asset = (value as AssetValue) ?? { choice: field.options[0] };
    const [keep, upload] = field.options;
    return (
      <div className={wrap}>
        {label}
        <div className="flex flex-wrap gap-[7px]">
          {field.options.map((option) => {
            const on = asset.choice === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setValue(option === keep ? { choice: option } : { ...asset, choice: option })}
                aria-pressed={on}
                className="flex min-h-[38px] items-center justify-center whitespace-nowrap rounded-[10px] border-[1.5px] px-[13px] py-[9px] text-[11.5px] font-medium"
                style={{
                  borderColor: on ? "#0D2315" : CARD_BORDER,
                  background: on ? "#F7FAF8" : "#fff",
                  color: on ? "#0D2315" : MUTED,
                }}
              >
                {option}
              </button>
            );
          })}
        </div>
        {asset.choice === upload ? (
          <div className="mt-[9px] flex flex-wrap items-center gap-[10px]">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              aria-label={`${field.label} file`}
              className="max-w-full text-[11px] text-[#435048] file:mr-[10px] file:cursor-pointer file:rounded-[8px] file:border file:border-[#CFDDD5] file:bg-white file:px-[11px] file:py-[6px] file:text-[11px] file:font-semibold file:text-[#435048]"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  const data = await shrinkImage(file);
                  setValue({ choice: upload, data, name: file.name });
                } catch (cause) {
                  setValue({ choice: upload });
                  event.target.value = "";
                  window.alert(cause instanceof Error ? cause.message : "That file could not be read.");
                }
              }}
            />
            {asset.data ? (
              <img src={asset.data} alt="" className="h-[38px] max-w-[96px] rounded-[7px] border border-[#E6EEE9] object-contain" />
            ) : (
              <span className="text-[10.5px] text-[#8B9A91]">Nothing chosen yet</span>
            )}
          </div>
        ) : null}
        {hint}
      </div>
    );
  }

  if (field.kind === "toggle") {
    const on = value as boolean;
    return (
      <div className={wrap}>
        {label}
        <button
          type="button"
          onClick={() => setValue(!on)}
          aria-pressed={on}
          className="flex items-center gap-[9px] pt-[2px]"
        >
          <span
            className="relative h-[19px] w-[34px] flex-none rounded-full transition-colors"
            style={{ background: on ? "#12796A" : "#D5E0DA" }}
          >
            <span
              className="absolute top-[2.5px] h-[14px] w-[14px] rounded-full bg-white transition-[left] shadow-[0_1px_2px_rgba(13,35,21,0.25)]"
              style={{ left: on ? 17.5 : 2.5 }}
            />
          </span>
          <span
            className="text-[11.5px] font-semibold"
            style={{ color: on ? "#12796A" : MUTED }}
          >
            {on ? (field.onLabel ?? "On") : (field.offLabel ?? "Off")}
          </span>
        </button>
        {hint}
      </div>
    );
  }

  if (field.kind === "choice") {
    return (
      <div className={wrap}>
        {label}
        <div className="flex flex-wrap gap-[7px]">
          {field.options.map((option) => {
            const on = value === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setValue(option)}
                aria-pressed={on}
                className="flex min-h-[38px] items-center justify-center whitespace-nowrap rounded-[10px] border-[1.5px] px-[13px] py-[9px] text-[11.5px] font-medium"
                style={{
                  borderColor: on ? "#0D2315" : CARD_BORDER,
                  background: on ? "#F7FAF8" : "#fff",
                  color: on ? "#0D2315" : MUTED,
                }}
              >
                {option}
              </button>
            );
          })}
        </div>
        {hint}
      </div>
    );
  }

  if (field.kind === "checks" && field.addable) {
    return (
      <div className={wrap}>
        {label}
        <AddableChecks field={field} value={(value as string[]) ?? []} setValue={setValue} />
        {hint}
      </div>
    );
  }

  if (field.kind === "checks") {
    const checked = value as string[];
    // Short options lay out as one wrapping line rather than a tall column that
    // leaves the space beside it dead.
    const rowWise =
      field.row === true ||
      (field.options.length > 4 && field.options.every((option) => option.length <= 5));

    return (
      <div className={wrap}>
        {label}
        <div className={rowWise ? "flex flex-wrap items-center gap-[7px]" : "flex flex-col gap-[2px]"}>
          {field.options.map((option) => {
            const on = checked.includes(option);
            return (
              <button
                key={option}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() =>
                  setValue(on ? checked.filter((item) => item !== option) : [...checked, option])
                }
                className={
                  rowWise
                    ? "inline-flex items-center gap-[7px] whitespace-nowrap rounded-full border py-[6px] pl-[9px] pr-[11px]"
                    : "flex min-h-[32px] items-center gap-[9px] text-left"
                }
                style={
                  rowWise
                    ? { borderColor: on ? "#0D2315" : CARD_BORDER, background: on ? "#F1F8F4" : "#fff" }
                    : undefined
                }
              >
                <span
                  className="flex h-[15px] w-[15px] flex-none items-center justify-center rounded-[4.5px] border-[1.5px] text-[9.5px] font-extrabold text-white"
                  style={{
                    background: on ? "#0D2315" : "#fff",
                    borderColor: on ? "#0D2315" : "#C2D2C8",
                  }}
                  aria-hidden
                >
                  {on ? "\u2713" : ""}
                </span>
                <span
                  className="text-[11.5px]"
                  style={{ color: on ? "#0D2315" : "#435048", fontWeight: on ? 600 : 400 }}
                >
                  {option}
                </span>
              </button>
            );
          })}
        </div>
        {hint}
      </div>
    );
  }

  if (field.kind === "select") {
    return (
      <div className={wrap}>
        {label}
        <select
          value={value as string}
          onChange={(event) => setValue(event.target.value)}
          aria-label={field.label}
          className={cn(CONTROL, "cursor-pointer bg-white")}
          style={{ borderColor: CARD_BORDER }}
        >
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {hint}
      </div>
    );
  }

  if (field.kind === "area") {
    return (
      <div className={wrap}>
        {label}
        <textarea
          value={value as string}
          onChange={(event) => setValue(event.target.value)}
          placeholder={field.placeholder}
          aria-label={field.label}
          className={cn(CONTROL, "min-h-[80px] resize-y bg-white leading-[1.55]")}
          style={{ borderColor: CARD_BORDER }}
        />
        {hint}
      </div>
    );
  }

  if (field.kind !== "text") return null;

  return (
    <div className={wrap}>
      {label}
      <input
        type={field.type ?? "text"}
        value={value as string}
        onChange={(event) => setValue(event.target.value)}
        placeholder={field.placeholder}
        readOnly={field.readOnly}
        aria-label={field.label}
        className={CONTROL}
        style={{ borderColor: CARD_BORDER, background: field.readOnly ? "#F7FAF8" : "#fff" }}
      />
      {hint}
    </div>
  );
}
