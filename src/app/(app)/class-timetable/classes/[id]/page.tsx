import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { armPage } from "@/lib/modules/live/m3-pages";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Class & Timetable · Class arm",
  description: "One arm: its form master, its subject teachers, its roster and its activity.",
};

type PageProps = { params: Promise<{ id: string }> };

/**
 * One arm, opened from the Classes tab.
 *
 * A school asking "who do I call about JSS 2A" should never have to leave this page:
 * the form master, every subject teacher, every child and what has been done to the
 * arm are all on it.
 */
export default async function ArmPage({ params }: PageProps) {
  const { id } = await params;

  const session = await getServerSession();
  if (!session) return null;

  if (!(await canOpenModule(session, "M03"))) {
    return <AccessDenied backHref="/command-center/today" />;
  }

  const content = await armPage(id);
  if (!content) notFound();

  return (
    <ModuleWorkspace
      eyebrow="Class & Timetable"
      title={content.title ?? "Class arm"}
      description={content.desc ?? ""}
      primary={content.primary}
      launchers={content.launchers}
      rows={content.rows}
      back={{ label: "Back to Classes", href: "/class-timetable/classes" }}
    />
  );
}
