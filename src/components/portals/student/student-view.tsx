import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { StudentTabs } from "@/components/portals/student/student-tabs";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { getServerSession } from "@/lib/auth/session";
import { buildStudentPage } from "@/lib/modules/live/student";

/** One page of a student's own workspace. Only a student's account reaches it; everything on it is read from their own record. */
export async function StudentView({ page, query }: { page: string; query: Record<string, string | undefined> }) {
  const session = await getServerSession();
  if (!session) return null;
  if (session.role !== "STUDENT") return <AccessDenied backHref="/" />;
  const built = buildStudentPage(page, query);
  if (!built) notFound();
  const content = await built;
  const active = content.tab ?? content.tabs?.[0]?.label ?? "";
  return (
    <ModuleWorkspace eyebrow={content.eyebrow ?? "Your school"} title={content.title ?? ""} description={content.desc ?? ""} primary={content.primary} launchers={content.launchers} rows={content.rows ?? []} back={undefined}>
      {content.tabs?.length ? <StudentTabs tabs={content.tabs} active={active} ariaLabel={`${content.title} tabs`} /> : null}
    </ModuleWorkspace>
  );
}
