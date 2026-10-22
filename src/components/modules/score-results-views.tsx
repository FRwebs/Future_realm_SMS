import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { canOpenModule } from "@/lib/auth/server-access";
import { getTeacherWorkspace } from "@/lib/api/teacher-workspace";
import { getServerSession } from "@/lib/auth/session";
import { ScoreImport } from "@/components/modules/score-import";
import { childPage, loadChild } from "@/lib/modules/live/t5-observations";
import { formBroadsheetPage, loadFormBroadsheet, loadSheets, loadStudentResult, studentWorkingPage, teacherGridPage, teacherPreviewPage } from "@/lib/modules/live/t5-scores";
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
  // A teacher reaches the sheet from their own sheets, and meets the teacher's pages — never the administrator's.
  const session = await getServerSession();
  const teacher = session ? await getTeacherWorkspace(session.role, session.schoolId) : null;
  if (teacher) {
    const sheets = await loadSheets().catch(() => null);
    if (sheets) {
      const typeable = grid.editable && grid.state !== "Submitted" && grid.state !== "Approved";
      return <Workspace content={preview || !typeable ? teacherPreviewPage(grid, sheets) : teacherGridPage(grid, sheets)} />;
    }
  }
  return <Workspace content={(preview ? previewPage(grid) : gridPage(grid)).content} />;
}

/** One child in one of a teacher's subjects: how the total was reached, and the comment that prints beside it. */
export async function StudentWorkingView({ classId, subjectId, studentId }: { classId: string; subjectId: string; studentId: string }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const student = await loadStudentResult(classId, subjectId, studentId).catch(() => null);
  if (!student) notFound();
  return <Workspace content={studentWorkingPage(student)} />;
}

/** The form class against every subject it takes. */
export async function FormBroadsheetView({ classId }: { classId: string }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const sheet = await loadFormBroadsheet(classId).catch(() => null);
  if (!sheet) notFound();
  return <Workspace content={formBroadsheetPage(sheet)} />;
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

/** An early-years child: what the teacher saw, in words. */
export async function ObserveView({ studentId }: { studentId: string }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const child = await loadChild(studentId).catch(() => null);
  if (!child) notFound();
  return <Workspace content={childPage(child)} />;
}

/** Bring a sheet's scores in from the school's Excel template. */
export async function ScoreImportView({ classId, subjectId }: { classId: string; subjectId: string }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const back = `/score-entry-results/enter/${classId}/${subjectId}`;
  return (
    <ModuleWorkspace eyebrow="Score Entry & Results" title="Import scores from Excel" description="Download the template, fill it in, check what would change, then import it as a draft." rows={[]} back={{ label: "Back to the sheet", href: back }}>
      <ScoreImport classId={classId} subjectId={subjectId} back={back} />
    </ModuleWorkspace>
  );
}
