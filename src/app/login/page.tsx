import { LoginForm } from "@/components/forms/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen text-[#0d2315]">
      <div
        className="relative hidden min-w-0 flex-col justify-between overflow-hidden px-10 py-12 md:flex md:flex-[1.05] lg:px-14"
        style={{ background: "#0d2315" }}
      >
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-50"
          viewBox="0 0 800 900"
          preserveAspectRatio="xMidYMid slice"
        >
          <path d="M-50 780 Q 200 680 400 760 T 850 700" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" fill="none" />
          <path d="M-50 850 Q 220 740 420 830 T 850 780" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
          <path d="M-50 100 Q 240 40 460 110 T 850 60" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
          <circle cx="700" cy="150" r="220" stroke="rgba(255,255,255,0.05)" strokeWidth="1" fill="none" />
          <circle cx="700" cy="150" r="150" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
        </svg>

        <div className="relative z-[1]">
          <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.08)] px-3.5 py-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-gold)" }} />
            <span className="text-xs font-bold tracking-[0.08em] text-white">FUTUREREALM SMS</span>
          </span>
          <h1 className="mt-16 max-w-[460px] font-[var(--font-heading)] text-[38px] font-extrabold leading-[1.18] tracking-[-0.01em] text-white">
            Run your entire school with total clarity.
          </h1>
          <p className="mt-[18px] max-w-[420px] text-[14.5px] leading-[1.65] text-[rgba(255,255,255,0.62)]">
            Attendance, results, fees and communication in one offline-first system built for how
            Nigerian schools actually work.
          </p>
          <div className="mt-[34px] flex flex-wrap gap-2.5">
            {["Works fully offline", "WAEC / NECO ready", "Role-based access control"].map((label) => (
              <div
                key={label}
                className="flex items-center gap-[7px] rounded-full border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.08)] px-3.5 py-2"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5 10 17.5 19.5 6.5" />
                </svg>
                <span className="text-xs font-semibold text-white">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-[1] max-w-[440px] rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] px-6 py-[22px]">
          <p className="text-[13.5px] italic leading-[1.6] text-[rgba(255,255,255,0.88)]">
            &ldquo;Every score corrected has a reason, an approver, and a timestamp. When a parent
            disputes a result, we show the evidence — not an argument.&rdquo;
          </p>
          <div className="mt-4 flex items-center gap-[10px]">
            <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-[rgba(255,255,255,0.14)] font-[var(--font-heading)] text-[11px] font-bold text-white">
              FR
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Dr. Adaeze Nwafor</p>
              <p className="text-[11px] text-[rgba(255,255,255,0.55)]">Principal, FutureRealm Reference School</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center bg-[#ffffff] px-6 py-10 sm:px-10">
        <div className="w-full max-w-[380px]">
          <span className="mb-9 inline-flex items-center gap-2 rounded-full border border-[#dee8e2] bg-[#f4f8f6] px-3 py-1.5 md:hidden">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-gold)" }} />
            <span className="text-xs font-bold tracking-[0.08em] text-[#0d2315]">FUTUREREALM SMS</span>
          </span>
          <div className="mb-9 hidden md:block">
            <span className="font-[var(--font-heading)] text-lg font-extrabold text-[#0d2315]">FutureRealm SMS</span>
          </div>

          <h2 className="font-[var(--font-heading)] text-[26px] font-bold tracking-[-0.01em] text-[#0d2315]">
            Welcome back
          </h2>
          <p className="mb-[30px] mt-1.5 text-[13.5px] text-[#77857c]">
            Sign in to your school&apos;s workspace
          </p>

          <LoginForm />
        </div>
      </div>
    </main>
  );
}
