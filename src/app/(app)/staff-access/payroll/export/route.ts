import { csvResponse, toCsv } from "@/lib/modules/csv";
import { loadPayroll } from "@/lib/modules/live/m7-payroll";

/** The payroll register: one line per person on this month's payroll, as the screen shows it. */
export async function GET() {
  try {
    const data = await loadPayroll();
    const rows = data.rows.map((row) => [row.name, row.role, row.department, row.band ?? "Not mapped", row.step ?? "", row.method, row.state, row.gross ?? "Held back", row.allowances ?? "Held back", row.deductions ?? "Held back", row.net ?? "Held back", row.reference ?? ""]);
    return csvResponse(`payroll-register-${data.month.year}-${String(data.month.month).padStart(2, "0")}.csv`, toCsv(["Staff member", "Role", "Department", "Band", "Step", "Method", "Payment", "Gross", "Allowances", "Deductions", "Net", "Reference"], rows));
  } catch {
    return new Response("You cannot export the payroll register.", { status: 403 });
  }
}
