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
};

/**
 * One labelled field on the sign-in family of screens. The label is tied to the input, the error to the input, and the input reports
 * itself invalid — so a screen reader announces what a sighted person reads under the field. Works with React Hook Form's `register`.
 */
export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField({ label, icon, error, aside, trailing, className, ...input }, ref) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="mb-4">
      <div className="mb-[7px] flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[11.5px] font-semibold text-[#435048] max-md:text-[12.5px] max-md:font-bold">{label}</label>
        {aside}
      </div>
      <div className={`flex items-center gap-[10px] rounded-[11px] border-[1.5px] px-[14px] py-[12px] transition focus-within:border-[#12796a] max-md:h-14 max-md:gap-3 max-md:rounded-2xl max-md:bg-white max-md:px-4 max-md:py-0 max-md:shadow-[0_1px_2px_rgba(13,35,21,0.05),0_8px_22px_-14px_rgba(13,35,21,0.22)] ${error ? "border-[#a13d3d]" : "border-[#dee8e2] max-md:border-transparent"}`}>
        <span className="shrink-0 text-[#5E6D64]" aria-hidden="true">{icon}</span>
        <input
          {...input}
          ref={ref}
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`w-full min-w-0 flex-1 bg-transparent text-[13.5px] text-[#0d2315] outline-hidden placeholder:text-[#5E6D64] max-md:h-full max-md:text-base ${className ?? ""}`}
        />
        {trailing}
      </div>
      <FieldMessage id={errorId}>{error}</FieldMessage>
    </div>
  );
});
