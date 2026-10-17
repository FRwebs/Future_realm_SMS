import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PrintControls } from "@/components/modules/print-button";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadTermResult } from "@/lib/modules/live/m8-record";

export const metadata: Metadata = { title: "Result", description: "One term's result, as it is handed to the family." };

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—");

/**
 * A result is a document: the school's letterhead, the child, every subject with every component
 * as the teacher entered it, and the remarks the family was told. A dash is a component nobody
 * entered — it is not a zero, and it is not averaged in.
 */
export default async function ResultPage({ params }: { params: Promise<{ studentId: string; termId: string }> }) {
  const { studentId, termId } = await params;
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!(await canOpenModule(session, "M08"))) notFound();
  const result = await loadTermResult(studentId, termId).catch(() => null);
  if (!result) notFound();
  const draft = result.state !== "Published";

  return (
    <main className="mx-auto max-w-[820px] bg-white px-8 py-8 text-[#0D2315] print:max-w-none print:px-0 print:py-0">
      <PrintControls backHref={`/student-records/registry/${studentId}/academic?term=${termId}`} label={`${result.student.name} · ${result.term.name}${draft ? " · draft" : ""}`} />
      <section className="relative rounded-[12px] border border-[#DEE8E2] p-8 print:rounded-none print:border-0">
        {draft ? <p className="pointer-events-none absolute right-8 top-8 rotate-[-8deg] rounded-[8px] border-2 border-[#8A6410] px-3 py-1 text-[15px] font-extrabold tracking-[0.18em] text-[#8A6410]">NOT PUBLISHED</p> : null}
        <header className="flex items-start justify-between gap-6 border-b-2 border-[#0D2315] pb-4">
          <div>
            <h1 className="text-[18px] font-extrabold leading-tight">{result.school.name}</h1>
            <p className="mt-1 text-[11px] text-[#5F6E65]">{result.school.address}</p>
            <p className="text-[11px] text-[#5F6E65]">{[result.school.phone, result.school.email].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#8C9A92]">Report of the term</p>
            <p className="mt-1 text-[13px] font-bold text-[#12796A]">{result.term.name} {result.term.session}</p>
            <p className="mt-0.5 text-[10.5px] text-[#77857C]">{result.published ? `Published ${day(result.published)}` : "Not yet published"}</p>
          </div>
        </header>
        <dl className="grid grid-cols-4 gap-x-4 gap-y-3 border-b border-[#EDF3EF] py-4 text-[11.5px]">
          {[
            ["Student", result.student.name],
            ["Admission number", result.student.adm],
            ["Class and arm", result.arm],
            ["Gender", result.student.gender],
            ["Term average", String(result.avg)],
            ["Position", result.position ? `${result.position} of ${result.outOf}` : "Not ranked"],
            ["Grade", result.grade],
            ["Attendance", result.attendance.pct === null ? "Not marked" : `${result.attendance.pct}% · ${result.attendance.present} of ${result.attendance.days} days`],
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
              <th className="px-3 py-2 text-left">Subject</th>
              {result.components.map((component) => (
                <th key={component} className="px-3 py-2 text-right">{component}</th>
              ))}
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Grade</th>
              <th className="px-3 py-2 text-right">Class avg</th>
            </tr>
          </thead>
          <tbody>
            {result.subjects.map((subject, index) => (
              <tr key={subject.id} className={index % 2 ? "bg-[#FBFDFC]" : ""}>
                <td className="px-3 py-[7px] font-medium">{subject.name}</td>
                {result.components.map((component) => {
                  const hit = subject.components.find((entry) => entry.name === component);
                  return <td key={component} className="px-3 py-[7px] text-right font-mono">{hit ? hit.score : "—"}</td>;
                })}
                <td className="px-3 py-[7px] text-right font-mono font-bold">{subject.total}</td>
                <td className="px-3 py-[7px] text-right font-bold">{subject.grade}</td>
                <td className="px-3 py-[7px] text-right font-mono">{subject.classAvg ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            ["Form master's remark", result.teacherComment],
            ["Principal's remark", result.principalComment],
          ].map(([label, body]) => (
            <div key={label} className="rounded-[9px] border border-[#E6EEE9] bg-[#F7FAF8] p-3">
              <p className="text-[8.5px] font-bold uppercase tracking-[0.07em] text-[#8C9A92]">{label}</p>
              <p className="mt-1 text-[11.5px] leading-snug">{body ?? "Nothing was written for this term."}</p>
            </div>
          ))}
        </div>
        <footer className="mt-5 flex items-end justify-between border-t border-[#EDF3EF] pt-3 text-[9.5px] text-[#77857C]">
          <p>A dash is a component nobody entered. It is not a zero, and it is not averaged in.</p>
          <p>{result.student.adm} · {result.term.name}</p>
        </footer>
      </section>
    </main>
  );
}
