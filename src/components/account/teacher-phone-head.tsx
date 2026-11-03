"use client";

import { usePhoneKind } from "@/components/layout/phone-shell";

/** The account page's ink banner is a laptop's; a teacher's phone has its own bar above and a plain head below. */
export function HideOnTeacherPhone({ children }: { children: React.ReactNode }) {
  return usePhoneKind() === "teacher" ? <div className="max-md:hidden">{children}</div> : <>{children}</>;
}

/** Who this is, as the teacher mobile mockup opens the account screen: the role in green, the name large, the sign-in address under it. */
export function TeacherPhoneHead({ eyebrow, name, line }: { eyebrow: string; name: string; line: string }) {
  if (usePhoneKind() !== "teacher") return null;
  return (
    <header className="md:hidden">
      <p className="text-[11.5px] font-extrabold uppercase tracking-[0.1em]" style={{ color: "#12796A" }}>{eyebrow}</p>
      <h1 className="mt-[4px] text-pretty text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em]" style={{ color: "#0D2315" }}>{name}</h1>
      <p className="mt-[6px] break-words text-[14px] font-medium leading-[1.45]" style={{ color: "#6E7C74" }}>{line}</p>
    </header>
  );
}
