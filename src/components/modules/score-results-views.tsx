import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { broadsheetPage, gridPage, loadBroadsheet, loadGrid, previewPage } from "@/lib/modules/live/m5-enter";
import { armResultPage, loadArmResult, loadCorrectionOptions, loadCorrections, loadStudent, studentResultPage } from "@/lib/modules/live/m5-results";
import { armReviewPage, loadArmReview, loadReview, loadSheet, sheetPage } from "@/lib/modules/live/m5-review";
import type { TabContent } from "@/lib/modules/panels";

/**
 * The pages Score Entry & Results opens from its tabs. Each is a server view: it checks the module is
 * open to the person asking, reads the page from the API, and hands it to the workspace.
 */

async function gate() {
  const session = await getServerSession();
  if (!session) return { denied: null as never, ok: false as const };
  if (!(await canOpenModule(session, "M05"))) return { denied: <AccessDenied backHref="/command-center/today" />, ok: false as const };
  return { denied: null, ok: true as const };
}

type Page = TabContent & { crumb: { label: string; href: string } };

function Workspace({ content }: { content: Page }) {
  return <ModuleWorkspace eyebrow="Score Entry & Results" title={content.title ?? "Score Entry & Results"} description={content.desc ?? ""} primary={content.primary} launchers={content.launchers} rows={content.rows} back={content.crumb} />;
}

export async function ArmReviewView({ classId }: { classId: string }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const arm = await loadArmReview(classId).catch(() => null);
  if (!arm) notFound();
  return <Workspace content={armReviewPage(arm).content} />;
}

export async function SheetView({ classId, subjectId }: { classId: string; subjectId: string }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const [sheet, review] = await Promise.all([loadSheet(classId, subjectId).catch(() => null), loadReview().catch(() => null)]);
  if (!sheet) notFound();
  return <Workspace content={sheetPage(sheet, review?.school ?? "").content} />;
}

export async function StudentView({ classId, studentId, from }: { classId: string; studentId: string; from: "review" | "results" }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const [student, options] = await Promise.all([loadStudent(classId, studentId).catch(() => null), loadCorrectionOptions()]);
  if (!student) notFound();
  return <Workspace content={studentResultPage(student, from, options).content} />;
}

export async function GridView({ classId, subjectId, preview }: { classId: string; subjectId: string; preview?: boolean }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const grid = await loadGrid(classId, subjectId).catch(() => null);
  if (!grid) notFound();
  return <Workspace content={(preview ? previewPage(grid) : gridPage(grid)).content} />;
}

export async function BroadsheetView({ classId }: { classId: string }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const sheet = await loadBroadsheet(classId).catch(() => null);
  if (!sheet) notFound();
  return <Workspace content={broadsheetPage(sheet).content} />;
}

export async function ArmResultView({ classId }: { classId: string }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const [arm, corrections, options] = await Promise.all([loadArmResult(classId).catch(() => null), loadCorrections(classId), loadCorrectionOptions()]);
  if (!arm) notFound();
  return <Workspace content={armResultPage(arm, corrections.rows, options).content} />;
}
