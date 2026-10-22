import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { CatalogueImport } from "@/components/modules/catalogue-import";
import { loadCatalogueOptions, loadNote, loadReviewNote, loadScheme, notePage, reviewNotePage, schemePage } from "@/lib/modules/live/t17-lesson-notes";
import type { TabContent } from "@/lib/modules/panels";

/** The pages Lesson Notes opens from its tabs: a subject's scheme, a week's note, and a note under review. */

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

export async function SchemeView({ subjectId }: { subjectId: string }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const scheme = await loadScheme(subjectId).catch(() => null);
  if (!scheme) notFound();
  return <Workspace content={schemePage(scheme, await loadCatalogueOptions(subjectId))} />;
}

export async function NoteView({ subjectId, week }: { subjectId: string; week: string }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const note = await loadNote(subjectId, week).catch(() => null);
  if (!note) notFound();
  return <Workspace content={notePage(note)} />;
}

export async function ReviewNoteView({ planId }: { planId: string }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const note = await loadReviewNote(planId).catch(() => null);
  if (!note) notFound();
  return <Workspace content={reviewNotePage(note)} />;
}

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
