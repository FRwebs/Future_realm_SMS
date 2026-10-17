import { NextResponse } from "next/server";

import { apiGet } from "@/lib/api/server";
import { csvResponse, toCsv } from "@/lib/modules/csv";
import { AT } from "@/lib/modules/live/m4-forms";
import type { Section } from "@/lib/modules/live/m4-spool";

/** A spooled attendance record. The printable form is a page; every other format is a spreadsheet. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.toString();
  const format = url.searchParams.get("format") ?? "";
  if (/pdf|print/i.test(format)) return NextResponse.redirect(new URL(`/print/attendance?${query}`, url));
  try {
    const data = await apiGet<{ meta: { title: string; period: string; school: string; by: string; generatedAt: string; purpose: string }; sections: Section[] }>(`${AT}/spool?${query}`);
    const intro: Array<Array<string | number>> = [[data.meta.title], [`Period: ${data.meta.period}`], [`Purpose: ${data.meta.purpose}`], [`Prepared by ${data.meta.by} on ${data.meta.generatedAt.slice(0, 10)}`], []];
    const rows: Array<Array<string | number>> = [...intro];
    for (const section of data.sections) rows.push([section.title], section.head, ...section.rows, []);
    return csvResponse("attendance-record.csv", toCsv([data.meta.school], rows));
  } catch {
    return new Response("You cannot spool an attendance record.", { status: 403 });
  }
}
