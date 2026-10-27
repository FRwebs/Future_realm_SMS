import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";

import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { FEES, naira } from "@/lib/modules/live/m10-forms";
import { plural } from "@/lib/modules/live/m7-format";

export const metadata: Metadata = { title: "Fee Management · Statement", description: "Every payment in the period, as one document." };

type Statement = {
  rows: Array<{ receipt: string; student: string; adm: string; arm: string; section: string; amount: number; mode: string; reference: string; by: string; date: string; invoice: string }>;
  outstanding: Array<{ family: string; owing: number; days: number }>;
};

const SCOPES = ["The whole school", "A section", "A class", "An arm", "One family"];
const PERIODS = ["This term", "This session", "Every session", "A date range"];
const INCLUDE = ["Every payment received", "Outstanding balances"];
const field = "w-full rounded-[10px] border border-[#DEE8E2] bg-white px-[11px] py-[8px] text-[12px] text-[#0D2315]";
const label = "grid gap-[5px] text-[10.5px] font-semibold text-[#0D2315]";

/**
 * A financial statement, read off the payments themselves — nothing re-keyed. Choose a scope and a
 * period, read it here, then take it away as a spreadsheet or print it.
 */
export default async function StatementPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canOpenModule(session, "M10"))) return <AccessDenied backHref="/command-center/today" />;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  const scope = query.scope ?? "The whole school";
  const period = query.period ?? "This session";
  const data = await apiGet<Statement>(`${FEES}/history/statement?${params.toString()}`).catch(() => null);
  const total = data?.rows.reduce((sum, row) => sum + row.amount, 0) ?? 0;
  const csv = `/fee-management/history/statement/csv?${params.toString()}`;

  return (
    <div className="grid min-w-0 gap-[14px]">
      <Link href={"/fee-management/history" as Route} className="inline-flex w-fit items-center gap-[6px] text-[11.5px] font-semibold text-[#12796A] hover:underline">
        ← Back to History
      </Link>
      <section className="rounded-[15px] bg-[#0D2315] px-[19px] py-[15px] text-white">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/50">Fee Management</p>
        <h1 className="mt-1 font-(family-name:--font-heading) text-[19px] font-extrabold">Spool a statement</h1>
        <p className="mt-1 text-[11px] text-white/60">Every payment in the period, as one document — read off the payments themselves.</p>
      </section>

      <form method="get" className="grid gap-[12px] rounded-[14px] border border-[#DEE8E2] bg-white p-[18px] sm:grid-cols-2">
        <label className={label}>Scope<select name="scope" defaultValue={scope} className={field}>{SCOPES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className={label}>Which one<input name="which" defaultValue={query.which ?? ""} placeholder="A section, class, arm or family name" className={field} /><span className="text-[10px] font-normal text-[#6B7A71]">Not needed for the whole school.</span></label>
        <label className={label}>Period<select name="period" defaultValue={period} className={field}>{PERIODS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-[10px]">
          <label className={label}>From<input type="date" name="from" defaultValue={query.from ?? ""} className={field} /></label>
          <label className={label}>To<input type="date" name="to" defaultValue={query.to ?? ""} className={field} /></label>
        </div>
        <label className={label}>Include<select name="include" defaultValue={query.include ?? INCLUDE[0]} className={field}>{INCLUDE.map((item) => <option key={item}>{item}</option>)}</select></label>
        <div className="flex items-end justify-end gap-2">
          <button type="submit" className="rounded-[10px] bg-[#0D2315] px-[16px] py-[9px] text-[12px] font-semibold text-white">Read the statement</button>
        </div>
      </form>

      {data ? (
        <section className="rounded-[14px] border border-[#DEE8E2] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDF3EF] px-[18px] py-[14px]">
            <div>
              <h2 className="text-[12.5px] font-semibold">{scope}{query.which ? ` · ${query.which}` : ""} · {period.toLowerCase()}</h2>
              <p className="mt-[3px] text-[10.5px] text-[#6B7A71]">{plural(data.rows.length, "payment")} · {naira(total)} received{data.outstanding.length ? ` · ${data.outstanding.length === 1 ? "1 family still owes" : `${data.outstanding.length} families still owe`} ${naira(data.outstanding.reduce((sum, row) => sum + row.owing, 0))}` : ""}</p>
            </div>
            <a href={csv} className="rounded-[9px] bg-[#0D2315] px-[14px] py-[8px] text-[11.5px] font-semibold text-white">Download as a spreadsheet</a>
          </div>
          {data.rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[11px]">
                <thead className="bg-[#F7FAF8] text-[9.5px] uppercase tracking-wider text-[#67766D]">
                  <tr>{["Date", "Receipt", "Student", "Class and arm", "Amount", "Method", "Reference", "Recorded by"].map((head) => <th key={head} className="px-[14px] py-[9px] text-left">{head}</th>)}</tr>
                </thead>
                <tbody>
                  {data.rows.slice(0, 200).map((row) => (
                    <tr key={`${row.receipt}-${row.reference}`} className="border-t border-[#F2F7F4]">
                      <td className="px-[14px] py-[9px]">{row.date}</td>
                      <td className="px-[14px] py-[9px] font-mono font-semibold">{row.receipt}</td>
                      <td className="px-[14px] py-[9px]">{row.student}<span className="block text-[10px] text-[#6B7A71]">{row.adm}</span></td>
                      <td className="px-[14px] py-[9px]">{row.arm}</td>
                      <td className="px-[14px] py-[9px] font-mono font-semibold">{naira(row.amount)}</td>
                      <td className="px-[14px] py-[9px]">{row.mode}</td>
                      <td className="px-[14px] py-[9px] font-mono">{row.reference}</td>
                      <td className="px-[14px] py-[9px]">{row.by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.rows.length > 200 ? <p className="border-t border-[#F2F7F4] px-[18px] py-[10px] text-[10.5px] text-[#6B7A71]">Showing the first 200 of {data.rows.length}. The spreadsheet carries all of them.</p> : null}
            </div>
          ) : (
            <p className="px-[18px] py-[28px] text-center text-[11.5px] text-[#6B7A71]">No payment falls inside that scope and period.</p>
          )}
        </section>
      ) : (
        <p className="rounded-[14px] border border-[#F3D2D2] bg-[#FDF2F2] px-[18px] py-[14px] text-[11.5px] font-semibold text-[#A32B2B]">That statement could not be read. Check the scope and the dates.</p>
      )}
    </div>
  );
}
