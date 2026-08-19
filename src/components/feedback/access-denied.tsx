"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Home, LockKeyhole, ShieldAlert } from "lucide-react";

export function AccessDenied({
  title = "Access restricted",
  detail = "Your current role can sign in, but it does not have permission to open this section.",
  backHref = "/dashboard",
  backLabel = "Go to allowed workspace",
  showHomeLink = true,
  autoRedirect = true,
}: {
  title?: string;
  detail?: string;
  backHref?: string;
  backLabel?: string;
  showHomeLink?: boolean;
  autoRedirect?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!autoRedirect) return;
    router.replace(`${backHref}?notice=not-authorized&from=${encodeURIComponent(pathname)}` as Route);
  }, [autoRedirect, backHref, pathname, router]);

  return (
    <section className="surface-hero relative overflow-hidden p-8 md:p-10">
      <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-primary-200/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-32 w-32 rounded-full bg-blue-100/60 blur-3xl" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br from-primary-600 via-primary-500 to-[#4fa895] text-white shadow-[0_16px_30px_rgba(37,89,63,0.20)]">
            <ShieldAlert className="h-6 w-6" />
          </div>

          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary-700">
            Permission Check
          </p>
          <h1 className="mt-3 text-[28px] font-extrabold tracking-tight text-slate-900 md:text-[32px]">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-7 text-slate-600">
            {detail}
          </p>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700">
            <LockKeyhole className="h-3.5 w-3.5" />
            Access remains protected until the right role or permission is available.
          </div>
        </div>

        <div className="rounded-[18px] border border-primary-100 bg-white/85 p-5 shadow-sm backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            What you can do
          </p>
          <ul className="mt-3 space-y-2 text-[13px] text-slate-600">
            <li>Return to a page your account can already access.</li>
            <li>Ask a school administrator to review your assigned permissions.</li>
            <li>Sign in with the correct portal or role if you switched accounts.</li>
          </ul>
        </div>
      </div>

      <div className="relative mt-8 flex flex-wrap gap-3">
        <Link
          href={backHref as Route}
          className="btn-primary px-5"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>

        {showHomeLink ? (
          <Link href={"/" as Route} className="btn-secondary px-5">
            <Home className="h-4 w-4" />
            Back to home
          </Link>
        ) : null}
      </div>
    </section>
  );
}
