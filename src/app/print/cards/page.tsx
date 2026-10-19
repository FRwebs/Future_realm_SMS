import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DocumentPaper } from "@/components/modules/document-paper";
import { PrintControls } from "@/components/modules/print-button";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { cardPaper } from "@/lib/modules/live/documents";
import { loadPrintSet } from "@/lib/modules/live/m6-card";

export const metadata: Metadata = { title: "Report cards", description: "Report cards for printing, one page per child." };

/** One A4 page per child, in roll order. A card that is not published prints stamped DRAFT, so it cannot be handed out by mistake. */
export default async function PrintCardsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!(await canOpenModule(session, "M06"))) notFound();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) for (const item of Array.isArray(value) ? value : value ? [value] : []) params.append(key, item);
  const set = await loadPrintSet(params).catch(() => null);
  if (!set || !set.cards.length) notFound();
  return (
    <main className="mx-auto max-w-[900px] bg-white px-6 py-8 print:max-w-none print:px-0 print:py-0">
      <PrintControls backHref="/report-cards/completion" label={`${set.count} ${set.count === 1 ? "card" : "cards"} · ${set.term.name} ${set.term.session}${set.drafts ? ` · ${set.drafts} draft` : ""}`} />
      <div className="grid gap-6 print:gap-0">
        {set.cards.map((view) => (
          <div key={view.card.studentId} className="print:break-after-page">
            <DocumentPaper doc={cardPaper(view)} />
          </div>
        ))}
      </div>
    </main>
  );
}
