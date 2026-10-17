import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PrintControls } from "@/components/modules/print-button";
import { apiGet } from "@/lib/api/server";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { naira } from "@/lib/modules/live/m7-pay-forms";
import { loadPayroll } from "@/lib/modules/live/m7-payroll";

export const metadata: Metadata = { title: "Payslips", description: "This month’s payslips, as they are handed over." };

type SchoolPayload = { record?: { name: string; address: string | null; city: string | null } };

/**
 * Every payslip on this month's run, one to a page. A page rather than a file because it prints,
 * saves as PDF, and can be corrected and printed again in the time it takes to say what was wrong.
 */
export default async function PrintPayslipsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!(await canOpenModule(session, "M07"))) notFound();

  const [data, school] = await Promise.all([loadPayroll(), apiGet<SchoolPayload>("/api/v1/configuration/school-information").catch(() => null)]);
  const slips = data.rows.filter((row) => row.slip);
  if (data.amountsHidden || !slips.length) notFound();

  return (
    <main className="mx-auto max-w-[820px] bg-white px-8 py-8 text-[#0D2315] print:max-w-none print:px-0 print:py-0">
      <PrintControls backHref="/staff-access/payroll/run" label={`${slips.length} payslip${slips.length === 1 ? "" : "s"} · ${data.month.label}`} />
      {slips.map((row) => {
        const slip = row.slip!;
        return (
          <section key={row.id} className="mb-8 break-after-page rounded-[12px] border border-[#DEE8E2] p-6 print:mb-0 print:rounded-none print:border-0">
            <header className="flex items-baseline justify-between border-b border-[#DEE8E2] pb-3">
              <div>
                <h1 className="text-[18px] font-extrabold">{school?.record?.name ?? "School"}</h1>
                <p className="text-[11px] text-[#6B7A71]">{[school?.record?.address, school?.record?.city].filter(Boolean).join(", ")}</p>
              </div>
              <p className="text-[12px] font-semibold">Payslip · {data.month.label}</p>
            </header>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-[12px]">
              <p><span className="text-[#6B7A71]">Name </span><strong>{row.name}</strong></p>
              <p><span className="text-[#6B7A71]">Role </span>{row.role}</p>
              <p><span className="text-[#6B7A71]">Band </span>{row.band} · step {row.step}</p>
              <p><span className="text-[#6B7A71]">Paid by </span>{row.method}</p>
            </div>
            <table className="mt-4 w-full text-[12px]">
              <tbody>
                <tr><td className="py-1">Gross</td><td className="py-1 text-right font-mono">{naira(slip.gross)}</td></tr>
                {slip.allowances.filter((item) => item.inPay).map((item) => (
                  <tr key={item.name}><td className="py-1 text-[#435048]">{item.name}</td><td className="py-1 text-right font-mono">{naira(item.amount)}</td></tr>
                ))}
                <tr className="border-t border-[#DEE8E2]"><td className="py-1">PAYE</td><td className="py-1 text-right font-mono">−{naira(slip.paye)}</td></tr>
                <tr><td className="py-1">Pension</td><td className="py-1 text-right font-mono">−{naira(slip.pension)}</td></tr>
                <tr><td className="py-1">NHF</td><td className="py-1 text-right font-mono">−{naira(slip.nhf)}</td></tr>
                <tr className="border-t-2 border-[#0D2315] text-[14px] font-extrabold"><td className="py-2">Net pay</td><td className="py-2 text-right font-mono">{naira(slip.net)}</td></tr>
              </tbody>
            </table>
            {slip.unpaidDays ? <p className="mt-2 text-[11px] text-[#8A6410]">Prorated for {slip.unpaidDays} unpaid {slip.unpaidDays === 1 ? "day" : "days"}.</p> : null}
            <p className="mt-4 text-[10.5px] text-[#6B7A71]">Status: {row.state}{row.reference ? ` · reference ${row.reference}` : ""}. A payslip is a record of a payment and cannot be edited.</p>
          </section>
        );
      })}
    </main>
  );
}
