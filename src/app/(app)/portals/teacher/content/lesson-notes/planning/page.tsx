import { AccessDenied } from "@/components/feedback/access-denied";
import { TeacherLessonNotesWorkspace } from "@/components/portals/teacher-lesson-notes-workspace";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import type { CurriculumTopicView, TeacherPortalView } from "@/lib/domain/types";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function normalizeQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function TeacherLessonNotesPlanningPage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/teacher/content/lesson-notes")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const resolvedSearch = searchParams ? await searchParams : {};
  const selectedSubjectId = normalizeQueryValue(resolvedSearch.subjectId);
  const selectedClassId = normalizeQueryValue(resolvedSearch.classId);

  const [portal, topics] = await Promise.all([
    apiGet<TeacherPortalView>("/api/v1/teacher-portal/dashboard"),
    apiGet<CurriculumTopicView[]>("/api/v1/nigeria-operations/curriculum").catch(() => []),
  ]);

  return (
    <TeacherLessonNotesWorkspace
      portal={portal}
      topics={topics}
      selectedSubjectId={selectedSubjectId}
      selectedClassId={selectedClassId}
    />
  );
}
