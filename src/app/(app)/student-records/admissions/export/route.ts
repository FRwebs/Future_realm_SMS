import { csvResponse, toCsv } from "@/lib/modules/csv";
import { loadBoard } from "@/lib/modules/live/m8-admissions";

/** Every application on record, with the cycle and the outcome. */
export async function GET() {
  try {
    const data = await loadBoard();
    const rows = data.history.map((row) => [row.name, row.ref, row.cycle, row.forClass, row.guardian, row.phone, row.score ?? "", row.stage]);
    return csvResponse("admissions.csv", toCsv(["Applicant", "Reference", "Cycle", "Applying for", "Guardian", "Phone", "Score", "State"], rows));
  } catch {
    return new Response("You cannot export admissions.", { status: 403 });
  }
}
