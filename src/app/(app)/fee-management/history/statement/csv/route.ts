import { apiGet } from "@/lib/api/server";
import { csvResponse, toCsv } from "@/lib/modules/csv";

type Statement = { rows: Array<{ receipt: string; student: string; adm: string; arm: string; section: string; amount: number; mode: string; reference: string; by: string; date: string; invoice: string }> };

/** A statement as a spreadsheet: every payment in the scope and period, read off the payments themselves. */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.toString();
  try {
    const data = await apiGet<Statement>(`/api/v1/fee-management/history/statement?${query}`);
    const rows = data.rows.map((row) => [row.date, row.receipt, row.student, row.adm, row.arm, row.section, row.amount, row.mode, row.reference, row.by, row.invoice]);
    return csvResponse("fee-statement.csv", toCsv(["Date", "Receipt", "Student", "Admission number", "Class and arm", "Section", "Amount", "Method", "Reference", "Recorded by", "Invoice"], rows));
  } catch {
    return new Response("You cannot export a statement.", { status: 403 });
  }
}
