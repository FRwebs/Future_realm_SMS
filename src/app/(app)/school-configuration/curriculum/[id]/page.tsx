import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { curriculumDetail } from "@/lib/modules/live/m2-school-configuration";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "School Configuration · Curriculum",
  description: "Six layers: what is taught, how it is scored, what a parent receives.",
};

type PageProps = { params: Promise<{ id: string }> };

/**
 * One curriculum, opened from the list.
 *
 * The mockup opens a curriculum as a sub-page, not a modal — the six layers and
 * the two tables behind them are a place you work in, not a decision you
 * confirm and dismiss. `in-force` is the configuration the school is running;
 * any other id is a curriculum built in the builder.
 */
export default async function CurriculumDetailPage({ params }: PageProps) {
  const { id } = await params;

  const session = await getServerSession();
  if (!session) return null;

  if (!(await canOpenModule(session, "M02"))) {
    return <AccessDenied backHref="/command-center/today" />;
  }

  const content = await curriculumDetail(id);
  if (!content) notFound();

  return (
    <ModuleWorkspace
      eyebrow="School Configuration"
      title={content.title ?? "Curriculum"}
      description={content.desc ?? ""}
      primary={content.primary}
      launchers={content.launchers}
      rows={content.rows}
    />
  );
}
