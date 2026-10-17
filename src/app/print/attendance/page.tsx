import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PrintControls } from "@/components/modules/print-button";
import { apiGet } from "@/lib/api/server";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { AT } from "@/lib/modules/live/m4-forms";
import type { Spool } from "@/lib/modules/live/m4-spool";

export const metadata: Metadata = { title: "Attendance record", description: "An official extract of the attendance record." };

/**
 * An attendance record is a document: the school's name, who asked for it and why, and then exactly the
 * marks it was asked for. The page is the extract — print it, or save it as a PDF.
 */
export default async function AttendanceRecordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!(await canOpenModule(session, "M04"))) notFound();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  const record = await apiGet<Spool>(`${AT}/spool?${query.toString()}`).catch(() => null);
  if (!record) notFound();
  const { meta, sections } = record;

  return (
    <main className="mx-auto max-w-[900px] bg-white px-8 py-8 text-[#0D2315] print:max-w-none print:px-0 print:py-0">
      <PrintControls backHref="/attendance/log" label={`${meta.subject} · ${meta.period}`} />
      <section className="rounded-[12px] border border-[#DEE8E2] p-8 print:rounded-none print:border-0">
        <header className={`flex items-start justify-between gap-6 border-b-2 border-[#0D2315] pb-4 ${meta.letterhead ? "" : "opacity-70"}`}>
          <div>
            <h1 className="text-[18px] font-extrabold leading-tight">{meta.school}</h1>
            <p className="mt-1 text-[11px] text-[#5F6E65]">{meta.letterhead ? "Official attendance record" : "Attendance record · plain copy"}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#8C9A92]">Attendance record</p>
            <p className="mt-1 text-[13px] font-bold text-[#12796A]">{meta.subject}</p>
            <p className="mt-0.5 text-[10.5px] text-[#77857C]">{meta.period}</p>
          </div>
        </header>
        <dl className="grid grid-cols-4 gap-x-4 gap-y-3 border-b border-[#EDF3EF] py-4 text-[11.5px]">
          {[["Period", `${meta.from} to ${meta.to}`], ["Purpose", meta.purpose], ["Marks", meta.marks.toLocaleString()], ["Children", meta.children.toLocaleString()], ["Prepared by", meta.by], ["Prepared on", meta.generatedAt.slice(0, 10)]].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[8.5px] font-bold uppercase tracking-[0.07em] text-[#8C9A92]">{label}</dt>
              <dd className="mt-[3px] font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        {sections.map((section) => (
          <div key={section.title} className="mt-5">
            <h2 className="text-[12.5px] font-bold">{section.title} <span className="font-normal text-[#8C9A92]">· {section.rows.length}</span></h2>
            <table className="mt-2 w-full overflow-hidden rounded-[9px] border border-[#E6EEE9] text-[10.5px]">
              <thead className="bg-[#F7FAF8] text-[8.5px] uppercase tracking-[0.06em] text-[#8C9A92]">
                <tr>{section.head.map((head) => <th key={head} className="px-3 py-2 text-left">{head}</th>)}</tr>
              </thead>
              <tbody>
                {section.rows.length ? section.rows.slice(0, 1500).map((row, index) => (
                  <tr key={index} className={index % 2 ? "bg-[#FBFDFC]" : ""}>{row.map((value, cell) => <td key={cell} className="px-3 py-[5px]">{value}</td>)}</tr>
                )) : <tr><td colSpan={section.head.length} className="px-3 py-3 text-center text-[#8C9A92]">Nothing on record for this period.</td></tr>}
              </tbody>
            </table>
            {section.rows.length > 1500 ? <p className="mt-1 text-[10px] text-[#8C9A92]">Showing the first 1,500 of {section.rows.length}. The spreadsheet format holds all of them.</p> : null}
          </div>
        ))}
        <footer className="mt-8 grid grid-cols-2 gap-8 text-[10px] text-[#5F6E65]">
          <div className="border-t border-[#0D2315] pt-1">Signed — Principal</div>
          <div className="border-t border-[#0D2315] pt-1">School stamp</div>
        </footer>
      </section>
    </main>
  );
}
