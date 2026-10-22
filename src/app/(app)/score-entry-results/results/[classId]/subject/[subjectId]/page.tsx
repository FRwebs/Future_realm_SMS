import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadSubjectResult, subjectResultPage } from "@/lib/modules/live/t5-scores";

export const metadata: Metadata = { title: "Scores · Results", description: "One subject-arm, every child, ranked." };

/** A teacher's own subject-arm: every child ranked, with the components behind each total. Never another teacher's subject. */
export default async function SubjectResultPage({ params }: { params: Promise<{ classId: string; subjectId: string }> }) {
  const { classId, subjectId } = await params;
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canOpenModule(session, "M05"))) return <AccessDenied backHref="/command-center/today" />;
  const result = await loadSubjectResult(classId, subjectId).catch(() => null);
  if (!result) notFound();
  const content = subjectResultPage(result);
  return <ModuleWorkspace eyebrow="Scores" title={content.title ?? "Results"} description={content.desc ?? ""} primary={content.primary} launchers={content.launchers} rows={content.rows} back={content.crumb} />;
}
