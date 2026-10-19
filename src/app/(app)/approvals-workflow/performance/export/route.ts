import { csvResponse, toCsv } from "@/lib/modules/csv";
import { loadPerformance } from "@/lib/modules/live/m13-performance";

/** Who has decided what, and how long it took — time to a decision, never a score. */
export async function GET() {
  try {
    const d = await loadPerformance();
    const rows = [
      ...d.approvers.map((row) => ["Approver", row.name, row.role, row.decided, row.open, row.oldest ?? "", row.avgDays ?? "", row.escalated]),
      ...d.byType.map((row) => ["Type", row.name, "", row.count, "", "", row.avgDays ?? "", ""]),
    ];
    return csvResponse("approvals-performance.csv", toCsv(["Kind", "Name", "Role", "Decided", "Open to them", "Oldest open (days)", "Average days to decide", "Escalated past them"], rows));
  } catch {
    return new Response("You cannot export approval performance.", { status: 403 });
  }
}
