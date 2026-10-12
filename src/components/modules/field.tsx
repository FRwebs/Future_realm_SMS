"use client";

import type { FormField } from "@/lib/modules/panels";
import { CARD_BORDER, MUTED } from "@/lib/modules/tones";

const CONTROL =
  "w-full min-w-0 rounded-[10px] border-[1.5px] px-[11.5px] py-[10px] text-[12px] font-medium leading-normal text-[#0D2315] outline-none min-h-[38px] box-border focus:border-[#12796A]";

import { cn } from "@/lib/utils/cn";

/**
 * One input, and the value it starts from.
 *
 * Extracted from panel-renderer so the drawer can use it too. The drawer is
 * imported *by* panel-renderer, so importing it back would be circular — and
 * an "Edit …" drawer that cannot render an input is the whole reason this
 * needed to move.
 */
export function initialValue(field: FormField): unknown {
  if (field.kind === "toggle") return field.on ?? false;
  if (field.kind === "checks") return field.checked ?? [];
  if (field.kind === "static") return field.value;
  return field.value ?? "";
}

export function Field({
  field,
  value,
  setValue,
}: {
  field: FormField;
  value: unknown;
  setValue: (next: unknown) => void;
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

  const wrap = cn("min-w-0", field.span === 2 && "col-[1/-1]");

  if (field.kind === "static") {
    return (
      <div className={wrap}>
        {label}
        <p className="text-pretty pt-[2px] text-[11.5px] font-semibold leading-[1.5] text-[#0D2315]">
          {field.value}
        </p>
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
