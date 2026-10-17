import { csvResponse, toCsv } from "@/lib/modules/csv";
import { loadFamilies } from "@/lib/modules/live/m9-guardians";

/** Every family, with how to reach them and whether the portal does. */
export async function GET() {
  try {
    const data = await loadFamilies();
    const rows = data.rows.map((row) => [row.name, row.relation, row.phone, row.email ?? "", row.children.map((child) => `${child.name} (${child.arm})`).join("; "), row.phoneOnly ? "Phone-only" : row.portal, row.delivery, row.consent, row.owes ? row.amount : 0, row.language]);
    return csvResponse("guardians.csv", toCsv(["Guardian", "Relation", "Phone", "Email", "Children", "Portal", "Delivery", "Consent", "Owes", "Language"], rows));
  } catch {
    return new Response("You cannot export guardians.", { status: 403 });
  }
}
