import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DocumentPaper } from "@/components/modules/document-paper";
import { PrintControls } from "@/components/modules/print-button";
import { apiGet } from "@/lib/api/server";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { structurePaper } from "@/lib/modules/live/documents";
import { loadStructure } from "@/lib/modules/live/m10-structures";

export const metadata: Metadata = { title: "Fee structure", description: "What a family on this structure is charged, as it is handed over." };

type SchoolPayload = { record?: { name: string; address: string | null; city: string | null; mainPhone: string | null } };

/** A fee structure as a family would read it, for the printer. */
export default async function PrintStructurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!(await canOpenModule(session, "M10"))) notFound();
  const [structure, school] = await Promise.all([loadStructure(id).catch(() => null), apiGet<SchoolPayload>("/api/v1/configuration/school-information").catch(() => null)]);
  if (!structure) notFound();
  const letterhead = { name: school?.record?.name ?? "School", place: [school?.record?.address, school?.record?.city].filter(Boolean).join(", "), contact: school?.record?.mainPhone ?? undefined };
  return (
    <main className="mx-auto max-w-[820px] bg-white px-8 py-8 text-[#0D2315] print:max-w-none print:px-0 print:py-0">
      <PrintControls backHref={`/fee-management/structures/${id}`} label={`${structure.ref} · ${structure.state}`} />
      <DocumentPaper doc={structurePaper(structure, letterhead)} />
    </main>
  );
}
