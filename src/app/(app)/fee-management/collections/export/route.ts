import { csvResponse, toCsv } from "@/lib/modules/csv";
import { loadCollections } from "@/lib/modules/live/m10-collections";

/** The debtor list, as the bursar takes it to a meeting. */
export async function GET() {
  try {
    const data = await loadCollections();
    const rows = data.debtors.map((family) => [family.name, family.relation, family.phone, family.children.map((child) => `${child.name} (${child.arm})`).join("; "), family.billed, family.paid, family.owing, family.bucket, family.days, family.stage, family.portal]);
    return csvResponse("debtor-list.csv", toCsv(["Family", "Relation", "Phone", "Children", "Billed", "Paid", "Outstanding", "Ageing", "Days", "Escalation", "Portal"], rows));
  } catch {
    return new Response("You cannot export the debtor list.", { status: 403 });
  }
}
