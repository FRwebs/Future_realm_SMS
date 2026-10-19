import { NextResponse } from "next/server";

import { apiGet } from "@/lib/api/server";
import { invoicePaper, receiptPaper, structurePaper } from "@/lib/modules/live/documents";
import { FEES } from "@/lib/modules/live/m10-forms";
import type { ReceiptDoc } from "@/lib/modules/live/m10-types";
import { loadStructure } from "@/lib/modules/live/m10-structures";
import { loadInvoice } from "@/lib/modules/live/m11-plan";
import { cardDocument, loadCard } from "@/lib/modules/live/m6-card";
import type { DrawerSpec } from "@/lib/modules/panels";

type SchoolPayload = { record?: { name: string; address: string | null; city: string | null; mainPhone: string | null } };

/**
 * A document, prepared when its modal is opened: read from what the API holds, drawn as data, and handed
 * back for the modal to show. Every kind reads through the API as the person asking, so each is checked
 * against what that person may see — the route adds no access of its own.
 */
export async function GET(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const query = new URL(request.url).searchParams;
  try {
    if (kind === "card") return NextResponse.json({ mode: "document", doc: await cardDocument(await loadCard(id, query.get("term") ?? undefined)) } satisfies Partial<DrawerSpec>);
    if (kind === "receipt") {
      const receipt = await apiGet<ReceiptDoc>(`${FEES}/payments/${encodeURIComponent(id)}/receipt`);
      return NextResponse.json({ mode: "document", doc: receiptPaper(receipt, query.get("duplicate") === "1" || receipt.receipts > 1) } satisfies Partial<DrawerSpec>);
    }
    if (kind === "structure") {
      const [structure, school] = await Promise.all([loadStructure(id), apiGet<SchoolPayload>("/api/v1/configuration/school-information").catch(() => null)]);
      const letterhead = { name: school?.record?.name ?? "School", place: [school?.record?.address, school?.record?.city].filter(Boolean).join(", "), contact: school?.record?.mainPhone ?? undefined };
      return NextResponse.json({ mode: "document", doc: structurePaper(structure, letterhead) } satisfies Partial<DrawerSpec>);
    }
    if (kind === "invoice") return NextResponse.json({ mode: "document", doc: invoicePaper(await loadInvoice(id)) } satisfies Partial<DrawerSpec>);
    return NextResponse.json({ error: "That kind of document is not kept here." }, { status: 404 });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "That document could not be read." }, { status: 404 });
  }
}

