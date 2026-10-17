import { csvResponse, toCsv } from "@/lib/modules/csv";
import { loadResults } from "@/lib/modules/live/m5-results";

/** The whole school's results, one row per arm. */
export async function GET() {
  try {
    const results = await loadResults();
    const rows = results.arms.map((arm) => [arm.name, arm.master ?? "", arm.roll, arm.computed, arm.average ?? "", arm.pass ?? "", arm.credit ?? "", arm.top?.grade ?? "", arm.incomplete ? "Incomplete" : "Complete"]);
    return csvResponse("school-results.csv", toCsv(["Arm", "Form master", "Roll", "Computed", "Average", "Pass rate %", "Credit rate %", "Top grade", "State"], rows));
  } catch {
    return new Response("You cannot export the school's results.", { status: 403 });
  }
}
