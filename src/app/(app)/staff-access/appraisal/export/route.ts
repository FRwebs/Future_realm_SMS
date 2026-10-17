import { csvResponse, toCsv } from "@/lib/modules/csv";
import { loadAppraisal } from "@/lib/modules/live/m7-appraisal";

/** The cycle as it stands: where everyone is, and what they and the reviewer said. */
export async function GET() {
  try {
    const data = await loadAppraisal();
    const rows = data.people.map((person) => [person.name, person.role, person.department, person.set, person.stage, person.selfScore ?? "", person.mine ?? "", person.evidence, person.reviewer ?? ""]);
    return csvResponse("appraisal-cycle.csv", toCsv(["Staff member", "Role", "Department", "KPI set", "Stage", "Their score", "Reviewer’s score", "Evidence items", "Reviewer"], rows));
  } catch {
    return new Response("You cannot export the appraisal cycle.", { status: 403 });
  }
}
