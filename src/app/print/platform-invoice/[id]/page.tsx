import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PrintControls } from "@/components/modules/print-button";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { naira } from "@/lib/modules/live/m11-forms";
import { loadInvoice } from "@/lib/modules/live/m11-plan";

export const metadata: Metadata = { title: "Invoice", description: "An invoice from Future Realm, as it is handed to the school." };

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—");

/**
 * An invoice is a document: who issued it, who it is for, what each line is, the VAT, and every
 * payment against it. A paid invoice is stamped PAID on the page itself.
 */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!(await canOpenModule(session, "M11"))) notFound();
  const invoice = await loadInvoice(id).catch(() => null);
  if (!invoice) notFound();
  const paid = invoice.state === "Paid";

  return (
    <main className="mx-auto max-w-[820px] bg-white px-8 py-8 text-[#0D2315] print:max-w-none print:px-0 print:py-0">
      <PrintControls backHref="/subscription-billing/plan" label={`${invoice.no} · ${naira(invoice.total)}${paid ? " · paid" : ""}`} />
      <section className="relative rounded-[12px] border border-[#DEE8E2] p-8 print:rounded-none print:border-0">
        <p className={`pointer-events-none absolute right-8 top-8 rotate-[-8deg] rounded-[8px] border-2 px-3 py-1 text-[15px] font-extrabold tracking-[0.18em] ${paid ? "border-[#17714F] text-[#17714F]" : invoice.state === "Overdue" ? "border-[#B23B3B] text-[#B23B3B]" : "border-[#8A6410] text-[#8A6410]"}`}>{invoice.state === "Paid" ? "PAID" : invoice.state === "Overdue" ? "OVERDUE" : "UNPAID"}</p>
        <header className="flex items-start justify-between gap-6 border-b-2 border-[#0D2315] pb-4">
          <div>
            <h1 className="text-[18px] font-extrabold leading-tight">Future Realm</h1>
            <p className="mt-1 text-[11px] text-[#5F6E65]">School management platform</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#8C9A92]">{invoice.kind} invoice</p>
            <p className="mt-1 text-[13px] font-bold text-[#12796A]">{invoice.no}</p>
            <p className="mt-0.5 text-[10.5px] text-[#77857C]">Issued {day(invoice.issued)}</p>
          </div>
        </header>
        <dl className="grid grid-cols-4 gap-x-4 gap-y-3 border-b border-[#EDF3EF] py-4 text-[11.5px]">
          {[
            ["Billed to", invoice.billTo.name],
            ["Attention", invoice.billTo.attention || "—"],
            ["Address", invoice.billTo.address || "—"],
            ["Email", invoice.billTo.email || "—"],
            ["Issued", day(invoice.issued)],
            ["Due", day(invoice.due)],
            ["State", invoice.state],
            ["Paid on", day(invoice.paidAt)],
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
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-right">Quantity</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr key={`${line.description}-${index}`} className={index % 2 ? "bg-[#FBFDFC]" : ""}>
                <td className="px-3 py-[7px] font-medium">{line.description}</td>
                <td className="px-3 py-[7px] text-right">{line.qty}</td>
                <td className="px-3 py-[7px] text-right font-mono">{line.rate}</td>
                <td className="px-3 py-[7px] text-right font-mono">{naira(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 ml-auto grid w-[280px] gap-1 text-[11.5px]">
          <p className="flex justify-between"><span className="text-[#77857C]">Subtotal</span><span className="font-mono">{naira(invoice.subtotal)}</span></p>
          <p className="flex justify-between"><span className="text-[#77857C]">VAT</span><span className="font-mono">{naira(invoice.tax)}</span></p>
          <p className="flex justify-between border-t border-[#0D2315] pt-1 text-[13px] font-bold"><span>Total</span><span className="font-mono">{naira(invoice.total)}</span></p>
        </div>
        <section className="mt-5">
          <p className="text-[8.5px] font-bold uppercase tracking-[0.07em] text-[#8C9A92]">Payments against this invoice</p>
          {invoice.payments.length ? (
            <ul className="mt-2 grid gap-1 text-[11px]">
              {invoice.payments.map((payment) => (
                <li key={payment.reference} className="flex justify-between rounded-[8px] border border-[#E6EEE9] px-3 py-[6px]">
                  <span>{day(payment.at)} · {payment.method} · <span className="font-mono">{payment.reference}</span></span>
                  <span><span className="mr-3 text-[#77857C]">{payment.status}</span><span className="font-mono font-semibold">{naira(payment.amount)}</span></span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[11px] text-[#77857C]">No payment has been made against it yet. Pay by card from the Plan tab, or by bank transfer quoting {invoice.no}.</p>
          )}
        </section>
        <footer className="mt-5 flex items-end justify-between border-t border-[#EDF3EF] pt-3 text-[9.5px] text-[#77857C]">
          <p>An invoice is never edited; a correction is a new invoice.</p>
          <p>{invoice.no}</p>
        </footer>
      </section>
    </main>
  );
}
