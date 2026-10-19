import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DocumentPaper } from "@/components/modules/document-paper";
import { PrintControls } from "@/components/modules/print-button";
import { apiGet } from "@/lib/api/server";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { receiptPaper } from "@/lib/modules/live/documents";
import { FEES, naira } from "@/lib/modules/live/m10-forms";
import type { ReceiptDoc } from "@/lib/modules/live/m10-types";

export const metadata: Metadata = { title: "Receipt", description: "A payment received, as it is handed to the family." };

/** A receipt for the printer. A reprint is stamped DUPLICATE on the paper itself, so it can never pass for the original. */
export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ duplicate?: string }> }) {
  const { id } = await params;
  const { duplicate } = await searchParams;
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!(await canOpenModule(session, "M10"))) notFound();
  const receipt = await apiGet<ReceiptDoc>(`${FEES}/payments/${id}/receipt`).catch(() => null);
  if (!receipt) notFound();
  const dup = duplicate === "1" || receipt.receipts > 1;
  return (
    <main className="mx-auto max-w-[820px] bg-white px-8 py-8 text-[#0D2315] print:max-w-none print:px-0 print:py-0">
      <PrintControls backHref="/fee-management/collections" label={`${receipt.ref} · ${naira(receipt.paid)}${dup ? " · duplicate" : ""}`} />
      <DocumentPaper doc={receiptPaper(receipt, dup)} />
    </main>
  );
}
