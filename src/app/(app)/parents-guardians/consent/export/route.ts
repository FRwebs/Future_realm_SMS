import { csvResponse, toCsv } from "@/lib/modules/csv";
import { loadConsent } from "@/lib/modules/live/m9-consent";

/** The consent register: who gave what, by what means — the evidence a regulator asks for. */
export async function GET() {
  try {
    const data = await loadConsent();
    const rows = data.rows.map((row) => [row.name, row.phone, row.children.map((child) => `${child.name} (${child.arm})`).join("; "), ...data.types.map((type) => (row.consents[type.code] === "GIVEN" ? "Given" : row.consents[type.code] === "WITHDRAWN" ? "Withdrawn" : "Not given")), row.givenBy]);
    return csvResponse("consent-register.csv", toCsv(["Guardian", "Phone", "Children", ...data.types.map((type) => type.name), "Given by"], rows));
  } catch {
    return new Response("You cannot export the consent register.", { status: 403 });
  }
}
