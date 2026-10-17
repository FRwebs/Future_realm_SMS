import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { teacherPage } from "@/lib/modules/live/m3-pages";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Class & Timetable · Teacher",
  description: "Every subject-arm one teacher holds, and what it costs them in periods.",
};

type PageProps = { params: Promise<{ id: string }> };

/** One teacher, opened from the teachers table on the Subjects tab. */
export default async function TeacherSubjectsPage({ params }: PageProps) {
  const { id } = await params;

  const session = await getServerSession();
  if (!session) return null;

  if (!(await canOpenModule(session, "M03"))) {
    return <AccessDenied backHref="/command-center/today" />;
  }

  const content = await teacherPage(id);
  if (!content) notFound();

  return (
    <ModuleWorkspace
      eyebrow="Class & Timetable"
      title={content.title ?? "Teacher"}
      description={content.desc ?? ""}
      primary={content.primary}
      launchers={content.launchers}
      rows={content.rows}
      back={{ label: "Back to Subjects", href: "/class-timetable/subjects" }}
    />
  );
}
