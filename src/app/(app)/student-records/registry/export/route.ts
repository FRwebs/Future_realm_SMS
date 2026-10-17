import { csvResponse, toCsv } from "@/lib/modules/csv";
import { loadRegistry } from "@/lib/modules/live/m8-registry";

/** The whole registry, as the school takes it to an inspector or a spreadsheet. */
export async function GET() {
  try {
    const data = await loadRegistry();
    const rows = data.rows.map((row) => [row.name, row.adm, row.arm, row.level, row.gender, row.boarding, row.guardian?.name ?? "", row.guardian?.relation ?? "", row.guardian?.phone ?? "", row.att ?? "", row.avg ?? "", row.grade, row.fee, row.portal, row.state]);
    return csvResponse("student-registry.csv", toCsv(["Student", "Admission number", "Arm", "Level", "Gender", "Enrolment", "Primary guardian", "Relation", "Phone", "Attendance %", "Average", "Grade", "Fees", "Portal", "State"], rows));
  } catch {
    return new Response("You cannot export the registry.", { status: 403 });
  }
}
