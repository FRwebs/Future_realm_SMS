import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DocumentPaper } from "@/components/modules/document-paper";
import { PrintControls } from "@/components/modules/print-button";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { invoicePaper } from "@/lib/modules/live/documents";
import { naira } from "@/lib/modules/live/m11-forms";
import { loadInvoice } from "@/lib/modules/live/m11-plan";

export const metadata: Metadata = { title: "Invoice", description: "An invoice from Future Realm, as it is handed to the school." };

/** An invoice for the printer. A paid invoice is stamped PAID on the paper itself. */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!(await canOpenModule(session, "M11"))) notFound();
  const invoice = await loadInvoice(id).catch(() => null);
  if (!invoice) notFound();
  return (
    <main className="mx-auto max-w-[820px] bg-white px-8 py-8 text-[#0D2315] print:max-w-none print:px-0 print:py-0">
      <PrintControls backHref="/subscription-billing/plan" label={`${invoice.no} · ${naira(invoice.total)}${invoice.state === "Paid" ? " · paid" : ""}`} />
      <DocumentPaper doc={invoicePaper(invoice)} />
    </main>
  );
}
