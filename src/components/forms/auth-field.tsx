"use client";

import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

import { FieldMessage } from "@/components/ui/inline-notice";

type AuthFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  /** The icon at the start of the field. */
  icon: ReactNode;
  /** What is wrong with the field, said under it. */
  error?: string;
  /** Something at the right end of the label row — "Forgot password?". */
  aside?: ReactNode;
  /** A control inside the field at the right — "show password". */
  trailing?: ReactNode;
  /** On a phone, the taller 54px field of the phone sign-in (and 16px type, so the phone does not zoom in on it). */
  phoneSkin?: boolean;
};

/**
 * One labelled field on the sign-in family of screens. The label is tied to the input, the error to the input, and the input reports
 * itself invalid — so a screen reader announces what a sighted person reads under the field. Works with React Hook Form's `register`.
 */
export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField({ label, icon, error, aside, trailing, phoneSkin, className, ...input }, ref) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="mb-4">
      <div className="mb-[7px] flex items-center justify-between gap-3">
        <label htmlFor={id} className={`text-[11.5px] font-semibold text-[#435048] ${phoneSkin ? "max-md:text-[12.5px] max-md:font-bold" : ""}`}>{label}</label>
        {aside}
      </div>
      <div className={`flex items-center gap-[10px] rounded-[11px] border-[1.5px] px-[14px] py-[12px] transition focus-within:border-[#12796a] ${error ? "border-[#a13d3d]" : "border-[#dee8e2]"} ${phoneSkin ? `max-md:h-[54px] max-md:rounded-[14px] max-md:py-0 max-md:pr-1 ${error ? "max-md:border-[#db5555] max-md:bg-[#fff8f8]" : "max-md:border-[#d8e1dc] max-md:bg-white"}` : ""}`}>
        <span className="shrink-0 text-[#5E6D64]" aria-hidden="true">{icon}</span>
        <input
          {...input}
          ref={ref}
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`w-full min-w-0 flex-1 bg-transparent text-[13.5px] text-[#0d2315] outline-hidden placeholder:text-[#5E6D64] ${phoneSkin ? "max-md:h-full max-md:text-[16px]" : ""} ${className ?? ""}`}
        />
        {trailing}
      </div>
      <FieldMessage id={errorId}>{error}</FieldMessage>
    </div>
  );
});
