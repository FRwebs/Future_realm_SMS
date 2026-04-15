import type { Route } from "next";
import Link from "next/link";

export function AccessDenied({
  title = "Access restricted",
  detail = "Your current role can sign in, but it does not have permission to open this section.",
  backHref = "/dashboard"
}: {
  title?: string;
  detail?: string;
  backHref?: Route;
}) {
  return (
    <section className="rounded-[2rem] border border-white/50 bg-white/90 p-8 shadow-panel">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Permission check</p>
      <h1 className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/68">{detail}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={backHref}
          className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-800"
        >
          Go to allowed workspace
        </Link>
      </div>
    </section>
  );
}
