import { PartnerAuthForm } from "@/components/partner/partner-auth-form";

export default async function PartnerAcceptPage({ searchParams }: { searchParams?: Promise<{ token?: string }> }) {
  const { token } = (searchParams ? await searchParams : {}) as { token?: string };
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F8F6] px-6 py-10">
      <div className="w-full max-w-[400px] rounded-[20px] border border-[#DEE8E2] bg-white p-8 shadow-[0_40px_80px_-50px_rgba(13,35,21,0.5)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#12796A]">Partner portal</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[24px] font-extrabold tracking-[-0.02em] text-[#0D2315]">Welcome — choose your password</h1>
        <p className="mb-6 mt-2 text-[12.5px] leading-[1.6] text-[#5D6B63]">This link works once and expires 48 hours after it was sent.</p>
        {token ? <PartnerAuthForm mode="accept" token={token} /> : <p className="rounded-[10px] bg-[#FDF3F3] px-3 py-2 text-[12px] font-medium text-[#B23B3B]">This link is incomplete. Open it again from the email, or ask your partner manager for a new one.</p>}
      </div>
    </main>
  );
}
