import Link from "next/link";
import type { Route } from "next";

import { apiGet } from "@/lib/api/server";

/**
 * A guardian page the school has chosen not to show (School Configuration → Policies → Guardian portal visibility). The API says so in the
 * school's own terms; the page repeats it plainly instead of failing.
 */
export async function guardianPage<T>(path: string): Promise<{ data: T; keptBack: null } | { data: null; keptBack: string }> {
  try {
    return { data: await apiGet<T>(path), keptBack: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Your school has not made")) return { data: null, keptBack: message.replace(/\s*\(status \d+\)$/, "") };
    throw error;
  }
}

export function KeptBack({ title, message, backHref, backLabel = "Back to child overview" }: { title: string; message: string; backHref: string; backLabel?: string }) {
  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href={backHref as Route} className="text-[13px] font-semibold text-(--color-text-accent)">{backLabel}</Link>
        <h1 className="mt-3 font-(--font-heading) text-[26px] font-black text-(--color-text-primary)">{title}</h1>
        <p role="status" className="mt-3 text-[13px] leading-6 text-(--color-text-secondary)">{message} Please ask the school office if you need it.</p>
      </section>
    </div>
  );
}
