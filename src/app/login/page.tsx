import { LoginForm } from "@/components/forms/login-form";
import { LanguagePicker } from "@/components/layout/language-picker";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ verified?: string }> }) {
  const { verified } = await searchParams;
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

        <div className="relative z-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.08)] px-3.5 py-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-gold)" }} />
            <span className="text-xs font-bold tracking-[0.08em] text-white">FUTUREREALM SMS</span>
          </span>
          <h1 className="mt-16 max-w-[460px] font-(--font-heading) text-[38px] font-extrabold leading-[1.18] tracking-[-0.01em] text-white">
            One school, one truth — every school day accounted for.
          </h1>
          <p className="mt-[18px] max-w-[420px] text-[14.5px] leading-[1.65] text-[rgba(255,255,255,0.62)]">
            Administrators, teachers, parents and students all sign in here. Attendance, results, fees
            and messages stay in step — online or off, in any country.
          </p>
          <div className="mt-[34px] flex flex-wrap gap-2.5">
            {["Works fully offline", "Any curriculum ready", "Role-based access control"].map((label) => (
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

        <div className="relative z-1 max-w-[440px] rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] px-6 py-[22px]">
          <p className="text-[13.5px] italic leading-[1.6] text-[rgba(255,255,255,0.88)]">
            &ldquo;Knowledge is power. Information is liberating. Education is the premise of progress,
            in every society, in every family.&rdquo;
          </p>
          <div className="mt-4 flex items-center gap-[10px]">
            <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-[rgba(255,255,255,0.14)] font-(--font-heading) text-[11px] font-bold text-white">
              KA
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Kofi Annan</p>
              <p className="text-[11px] text-[rgba(255,255,255,0.55)]">Secretary-General of the United Nations, 1997–2006</p>
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
            <span className="font-(--font-heading) text-lg font-extrabold text-[#0d2315]">FutureRealm SMS</span>
          </div>

          {verified ? (
            <div className="mb-6 flex items-start gap-[9px] rounded-[11px] border border-[#cfe4db] bg-[#edf7f1] px-3 py-[11px]">
              <svg width="14.5" height="14.5" viewBox="0 0 24 24" fill="none" stroke="#12796a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0">
                <circle cx="12" cy="12" r="9" />
                <path d="m8 12.4 2.6 2.6L16 9.6" />
              </svg>
              <div className="text-[11px] leading-normal text-[#17604f]">
                <b>Email verified.</b> Sign in with the email address or the User ID we sent you.
              </div>
            </div>
          ) : null}
          <h2 className="font-(--font-heading) text-[26px] font-bold tracking-[-0.01em] text-[#0d2315]">
            Welcome back
          </h2>
          <p className="mb-[30px] mt-1.5 text-[13.5px] text-[#5f6e65]">
            Sign in with your email address or User ID
          </p>

          <LoginForm />
          <LanguagePicker />
        </div>
      </div>
    </main>
  );
}
