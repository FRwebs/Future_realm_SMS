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
      <p className="mt-[6px] break-words text-[14px] font-medium leading-[1.45]" style={{ color: "#5C6B62" }}>{line}</p>
    </header>
  );
}

/** What a teacher's laptop reads: the account's tabs, one at a time. A phone reads the whole account on one page instead. */
export function TabsOnLaptop({ children }: { children: React.ReactNode }) {
  return usePhoneKind() === "teacher" ? <div className="grid gap-5 max-md:hidden">{children}</div> : <>{children}</>;
}

/** The whole account on one page, as the teacher mobile mockup draws it. Drawn only for a teacher, and only below laptop width. */
export function OnePageOnPhone({ children }: { children: React.ReactNode }) {
  return usePhoneKind() === "teacher" ? <div className="grid gap-[6px] md:hidden">{children}</div> : null;
}

export function PhoneSection({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="mt-[14px] grid gap-[10px]">
      <div className="px-[2px]">
        <h2 className="text-[17px] font-extrabold" style={{ color: "#0D2315" }}>{title}</h2>
        {sub ? <p className="mt-[2px] text-[13.5px] leading-[1.5]" style={{ color: "#5C6B62" }}>{sub}</p> : null}
      </div>
      {children}
    </section>
  );
}
