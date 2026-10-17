import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PrintControls } from "@/components/modules/print-button";
import { apiGet } from "@/lib/api/server";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { FEES, naira } from "@/lib/modules/live/m10-forms";
import type { ReceiptDoc } from "@/lib/modules/live/m10-types";

export const metadata: Metadata = { title: "Receipt", description: "A payment received, as it is handed to the family." };

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—");

/**
 * A receipt is a document: the school's letterhead, who paid, what it was applied to, and what is
 * still owed. A reprint is stamped DUPLICATE on the page itself, so it can never pass for the
 * original — the original stays the only payment recorded.
 */
export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ duplicate?: string }> }) {
  const { id } = await params;
  const { duplicate } = await searchParams;
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!(await canOpenModule(session, "M10"))) notFound();
  const receipt = await apiGet<ReceiptDoc>(`${FEES}/payments/${id}/receipt`).catch(() => null);
  if (!receipt) notFound();
  const dup = duplicate === "1" || receipt.receipts > 1;

  return (
    <main className="mx-auto max-w-[820px] bg-white px-8 py-8 text-[#0D2315] print:max-w-none print:px-0 print:py-0">
      <PrintControls backHref="/fee-management/collections" label={`${receipt.ref} · ${naira(receipt.paid)}${dup ? " · duplicate" : ""}`} />
      <section className="relative rounded-[12px] border border-[#DEE8E2] p-8 print:rounded-none print:border-0">
        {dup ? <p className="pointer-events-none absolute right-8 top-8 rotate-[-8deg] rounded-[8px] border-2 border-[#B23B3B] px-3 py-1 text-[15px] font-extrabold tracking-[0.18em] text-[#B23B3B]">DUPLICATE</p> : null}
        <header className="flex items-start justify-between gap-6 border-b-2 border-[#0D2315] pb-4">
          <div>
            <h1 className="text-[18px] font-extrabold leading-tight">{receipt.school.name}</h1>
            <p className="mt-1 text-[11px] text-[#5F6E65]">{receipt.school.address}</p>
            <p className="text-[11px] text-[#5F6E65]">{[receipt.school.phone, receipt.school.email].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#8C9A92]">{dup ? "Duplicate receipt" : "Official receipt"}</p>
            <p className="mt-1 text-[13px] font-bold text-[#12796A]">Receipt {receipt.ref}</p>
            <p className="mt-0.5 text-[10.5px] text-[#77857C]">{day(receipt.date)}{receipt.term ? ` · ${receipt.term}` : ""}</p>
          </div>
        </header>
        <dl className="grid grid-cols-4 gap-x-4 gap-y-3 border-b border-[#EDF3EF] py-4 text-[11.5px]">
          {[
            ["Received from", receipt.payer],
            ["On behalf of", receipt.student],
            ["Admission number", receipt.adm],
            ["Class and arm", receipt.arm],
            ["Payment mode", receipt.mode],
            ["Reference", receipt.bankRef],
            ["Date received", day(receipt.date)],
            ["Received by", `${receipt.by} · Bursary`],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[8.5px] font-bold uppercase tracking-[0.07em] text-[#8C9A92]">{label}</dt>
              <dd className="mt-[3px] font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <table className="mt-4 w-full overflow-hidden rounded-[9px] border border-[#E6EEE9] text-[11px]">
          <thead className="bg-[#F7FAF8] text-[8.5px] uppercase tracking-[0.06em] text-[#8C9A92]">
            <tr>
              <th className="px-3 py-2 text-left">Fee item</th>
              <th className="px-3 py-2 text-right">Billed</th>
              <th className="px-3 py-2 text-right">Previously paid</th>
              <th className="px-3 py-2 text-right">This payment</th>
              <th className="px-3 py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.map((item, index) => (
              <tr key={item.label} className={index % 2 ? "bg-[#FBFDFC]" : ""}>
                <td className="px-3 py-[7px] font-medium">{item.label}</td>
                <td className="px-3 py-[7px] text-right font-mono">{naira(item.billed)}</td>
                <td className="px-3 py-[7px] text-right font-mono">{naira(item.previously)}</td>
                <td className="px-3 py-[7px] text-right font-mono font-bold">{naira(item.applied)}</td>
                <td className="px-3 py-[7px] text-right font-mono">{naira(item.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 grid grid-cols-4 gap-3">
          {[
            ["Billed", naira(receipt.billed), receipt.invoice ?? ""],
            ["Paid to date", naira(receipt.paidToDate), "Including this payment"],
            ["This payment", naira(receipt.paid), receipt.mode],
            ["Balance", naira(receipt.balance), receipt.ageing],
          ].map(([label, value, sub]) => (
            <div key={label} className="rounded-[9px] border border-[#E6EEE9] bg-[#F7FAF8] px-3 py-[10px]">
              <p className="text-[8.5px] font-bold uppercase tracking-[0.07em] text-[#77857C]">{label}</p>
              <p className="mt-1 font-mono text-[15px] font-extrabold">{value}</p>
              <p className="mt-[2px] text-[9.5px] text-[#77857C]">{sub}</p>
            </div>
          ))}
        </div>
        <footer className="mt-6 flex items-end justify-between gap-6 border-t border-[#EDF3EF] pt-4 text-[9.5px] leading-[1.55] text-[#8C9A92]">
          <p className="max-w-[380px]">{dup ? "A reprint of a receipt already issued. It records nothing new; the original is the only payment on file." : "A receipt is a record of money received. It is never edited — a mistake is corrected by a named reversal."}</p>
          <p>{receipt.ref}</p>
        </footer>
      </section>
    </main>
  );
}
