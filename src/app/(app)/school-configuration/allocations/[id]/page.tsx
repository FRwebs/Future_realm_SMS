import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { allocationDetail } from "@/lib/modules/live/m2-school-configuration";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "School Configuration · Allocation",
  description: "What each class needs for a term, priced and printable for families.",
};

type PageProps = { params: Promise<{ id: string }> };

/**
 * One allocation, opened from the list.
 *
 * The mockup opens an allocation as a sub-page rather than a modal: it is a
 * table a person reads down, filters and prints for a family, not a single
 * decision to confirm and dismiss.
 */
export default async function AllocationDetailPage({ params }: PageProps) {
  const { id } = await params;

  const session = await getServerSession();
  if (!session) return null;

  if (!(await canOpenModule(session, "M02"))) {
    return <AccessDenied backHref="/command-center/today" />;
  }

  const content = await allocationDetail(id);
  if (!content) notFound();

  return (
    <ModuleWorkspace
      eyebrow="School Configuration"
      title={content.title ?? "Allocation"}
      description={content.desc ?? ""}
      primary={content.primary}
      launchers={content.launchers}
      rows={content.rows}
    />
  );
}
