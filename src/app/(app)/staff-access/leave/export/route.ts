import { csvResponse, toCsv } from "@/lib/modules/csv";
import { loadLeave } from "@/lib/modules/live/m7-leave";

/** The leave register: every request on record, decided and undecided. */
export async function GET() {
  try {
    const data = await loadLeave();
    const rows = data.rows.map((row) => [row.name, row.role, row.department, row.type, row.dates, row.days, row.cover, row.sequence, row.status, row.source === "RECORDED" ? "Recorded after the fact" : "Requested", row.reason, row.decisionNote ?? ""]);
    return csvResponse("leave-register.csv", toCsv(["Staff member", "Role", "Department", "Type", "Dates", "Working days", "Cover", "Sequence", "Status", "How it arrived", "Reason", "Decision note"], rows));
  } catch {
    return new Response("You cannot export the leave register.", { status: 403 });
  }
}
