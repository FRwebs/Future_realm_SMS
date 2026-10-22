import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { CatalogueImport } from "@/components/modules/catalogue-import";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { addSubjectPage, historyNotePage, historyPage, notePage, reviewNotePage, subjectNotesPage } from "@/lib/modules/live/t17-lesson-notes";
import type { TabContent } from "@/lib/modules/panels";

/** The pages Lesson Notes opens from its tabs: adding a subject, a subject's notes, a week's note, the history, and a note under review. */

async function gate() {
  const session = await getServerSession();
  if (!session) return { denied: null as never, ok: false as const };
  if (!(await canOpenModule(session, "M17"))) return { denied: <AccessDenied backHref="/command-center/today" />, ok: false as const };
  return { denied: null, ok: true as const };
}

type Page = TabContent & { crumb: { label: string; href: string } };

function Workspace({ content }: { content: Page }) {
  return <ModuleWorkspace eyebrow="Lesson Notes" title={content.title ?? "Lesson Notes"} description={content.desc ?? ""} primary={content.primary} launchers={content.launchers} rows={content.rows} back={content.crumb} />;
}

async function open(build: () => Promise<Page>) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const page = await build().catch(() => null);
  if (!page) notFound();
  return <Workspace content={page} />;
}

export const AddSubjectView = () => open(() => addSubjectPage());
export const SubjectNotesView = ({ subjectId, term }: { subjectId: string; term?: string }) => open(() => subjectNotesPage(subjectId, term));
export const NoteView = ({ subjectId, week, term }: { subjectId: string; week: string; term?: string }) => open(() => notePage(subjectId, week, term));
export const HistoryView = ({ subjectId }: { subjectId: string }) => open(() => historyPage(subjectId));
export const HistoryNoteView = ({ subjectId, planId }: { subjectId: string; planId: string }) => open(() => historyNotePage(subjectId, planId));
export const ReviewNoteView = ({ planId }: { planId: string }) => open(() => reviewNotePage(planId));

/** Load a curriculum's outlines for this school from Excel. */
export async function CatalogueImportView() {
  const access = await gate();
  if (!access.ok) return access.denied;
  return (
    <ModuleWorkspace eyebrow="Lesson Notes" title="Import a curriculum" description="Load your own subject outlines from Excel. Teachers start their schemes of work from them." rows={[]} back={{ label: "Back to Coverage", href: "/lesson-notes/coverage" }}>
      <CatalogueImport base="/api/v1/curriculum-catalogue" templateHref="/api/v1/curriculum-catalogue/template" who="Teachers at your school see what you load beside the platform’s outlines." />
    </ModuleWorkspace>
  );
}
