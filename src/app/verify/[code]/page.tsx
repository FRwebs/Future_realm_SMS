import type { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = { title: "Verify a certificate", description: "Check that a training certificate is genuine." };
export const dynamic = "force-dynamic";

type Verdict = { valid: boolean; state?: string; certificate?: string; holder?: string; issuedBy?: string; school?: string; issuedAt?: string; expiresAt?: string | null };

const day = (iso?: string | null) => (iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(iso)) : "");

/** Anyone with a certificate's code can confirm it here — and sees only what a verifier needs: the certificate, who earned it, who awarded it, and when. */
export default async function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const store = await headers();
  const host = store.get("x-forwarded-host") ?? store.get("host") ?? "localhost:3000";
  const protocol = store.get("x-forwarded-proto") ?? "http";
  const verdict = await fetch(`${protocol}://${host}/api/v1/learning/verify/${encodeURIComponent(code)}`, { cache: "no-store" })
    .then(async (response) => (((await response.json()) as { data?: Verdict }).data ?? { valid: false }))
    .catch(() => ({ valid: false }) as Verdict);
  const genuine = verdict.valid;
  return (
    <main className="mx-auto flex min-h-screen max-w-[520px] flex-col justify-center px-5 py-10">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#67766D]">FutureRealm SMS · certificate check</p>
      <section className="mt-3 rounded-[16px] border bg-white p-6" style={{ borderColor: genuine ? "#CFE4DB" : "#F0CFCF" }}>
        <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold" style={genuine ? { background: "#EAF6F0", color: "#17714F" } : { background: "#FDF3F3", color: "#B23B3B" }}>
          <span className="h-[7px] w-[7px] rounded-full" style={{ background: genuine ? "#22A06B" : "#DB5555" }} />
          {genuine ? "Genuine" : verdict.state === "Expired" ? "Expired" : "Not found"}
        </span>
        <h1 className="mt-4 text-[20px] font-extrabold leading-tight text-[#0D2315]">{genuine || verdict.certificate ? verdict.certificate : "No certificate has this code"}</h1>
        {genuine || verdict.certificate ? (
          <dl className="mt-5 grid gap-4 text-[13px]">
            <div><dt className="text-[10px] font-bold uppercase tracking-[0.07em] text-[#67766D]">Earned by</dt><dd className="mt-1 font-semibold text-[#0D2315]">{verdict.holder}{verdict.school ? ` · ${verdict.school}` : ""}</dd></div>
            <div><dt className="text-[10px] font-bold uppercase tracking-[0.07em] text-[#67766D]">Awarded by</dt><dd className="mt-1 font-semibold text-[#0D2315]">{verdict.issuedBy}</dd></div>
            <div><dt className="text-[10px] font-bold uppercase tracking-[0.07em] text-[#67766D]">Issued</dt><dd className="mt-1 font-semibold text-[#0D2315]">{day(verdict.issuedAt)}</dd></div>
            <div><dt className="text-[10px] font-bold uppercase tracking-[0.07em] text-[#67766D]">Valid until</dt><dd className="mt-1 font-semibold text-[#0D2315]">{verdict.expiresAt ? day(verdict.expiresAt) : "It does not expire"}</dd></div>
          </dl>
        ) : (
          <p className="mt-3 text-[13px] leading-[1.6] text-[#5F6E65]">Check the code against the certificate — it begins FR- and is followed by two groups of four letters and numbers. A certificate that has been replaced by a renewal, or that the school has not verified, does not appear here.</p>
        )}
        <p className="mt-6 border-t pt-4 font-mono text-[11px] text-[#67766D]" style={{ borderColor: "#EDF3EF" }}>{code.toUpperCase()}</p>
      </section>
    </main>
  );
}
