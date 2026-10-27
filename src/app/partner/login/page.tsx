import { PartnerAuthForm } from "@/components/partner/partner-auth-form";

export default function PartnerLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F8F6] px-6 py-10">
      <div className="w-full max-w-[400px] rounded-[20px] border border-[#DEE8E2] bg-white p-8 shadow-[0_40px_80px_-50px_rgba(13,35,21,0.5)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#12796A]">Partner portal</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[24px] font-extrabold tracking-[-0.02em] text-[#0D2315]">Sign in</h1>
        <p className="mb-6 mt-2 text-[12.5px] leading-[1.6] text-[#5D6B63]">The schools you brought, how they are holding up, your commission and your registered deals.</p>
        <PartnerAuthForm mode="login" />
        <p className="mt-5 text-[11.5px] leading-[1.5] text-[#5f6e65]">No login yet? Your partner manager sends one when your agreement is countersigned.</p>
      </div>
    </main>
  );
}
