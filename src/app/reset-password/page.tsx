import Link from "next/link";

import { ResetPasswordForm } from "@/components/forms/reset-password-form";

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <main className="flex min-h-screen text-[#0d2315]">
      <div className="relative hidden min-w-0 flex-col justify-between overflow-hidden bg-[#0d2315] px-10 py-12 md:flex md:flex-[1.05] lg:px-14">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 800 900" preserveAspectRatio="xMidYMid slice">
          <path d="M-50 780 Q 200 680 400 760 T 850 700" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" fill="none" />
          <path d="M-50 850 Q 220 740 420 830 T 850 780" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
          <path d="M-50 100 Q 240 40 460 110 T 850 60" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
          <circle cx="700" cy="150" r="220" stroke="rgba(255,255,255,0.05)" strokeWidth="1" fill="none" />
          <circle cx="700" cy="150" r="150" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
        </svg>
        <div className="relative z-[1]">
          <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.08)] px-3.5 py-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--color-gold)]" />
            <span className="text-xs font-bold tracking-[0.08em] text-white">SECURE RESET</span>
          </span>
          <h1 className="mt-16 max-w-[460px] font-[var(--font-heading)] text-[38px] font-extrabold leading-[1.18] text-white">
            Create a new password for your workspace.
          </h1>
          <p className="mt-[18px] max-w-[420px] text-[14.5px] leading-[1.65] text-[rgba(255,255,255,0.62)]">
            Once your password changes, existing sessions for this account are revoked so the next sign-in starts clean.
          </p>
        </div>
        <div className="relative z-[1] max-w-[440px] rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] px-6 py-[22px]">
          <p className="text-[13.5px] leading-[1.6] text-[rgba(255,255,255,0.88)]">
            Use a password that is unique to FutureRealm SMS and avoid sharing it across school systems.
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center bg-white px-6 py-10 sm:px-10">
        <div className="w-full max-w-[380px]">
          <span className="mb-9 inline-flex items-center gap-2 rounded-full border border-[#dee8e2] bg-[#f4f8f6] px-3 py-1.5 md:hidden">
            <span className="h-2 w-2 rounded-full bg-[var(--color-gold)]" />
            <span className="text-xs font-bold tracking-[0.08em] text-[#0d2315]">FUTUREREALM SMS</span>
          </span>
          <div className="mb-9 hidden md:block">
            <Link href="/login" className="font-[var(--font-heading)] text-lg font-extrabold text-[#0d2315]">FutureRealm SMS</Link>
          </div>
          <h2 className="font-[var(--font-heading)] text-[26px] font-bold tracking-[-0.01em] text-[#0d2315]">Set new password</h2>
          <p className="mb-[30px] mt-1.5 text-[13.5px] text-[#77857c]">Choose a strong password to restore account access.</p>
          <ResetPasswordForm token={token} />
        </div>
      </div>
    </main>
  );
}
