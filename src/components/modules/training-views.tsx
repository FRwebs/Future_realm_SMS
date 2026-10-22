import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { getTeacherWorkspace } from "@/lib/api/teacher-workspace";
import { checkoutPage, coursePage, lessonPage, loadBasket, loadCourse, loadLesson } from "@/lib/modules/live/t19-training";
import type { TabContent } from "@/lib/modules/panels";

/** The pages Training opens from its tabs: a course, and a lesson in it. */

async function gate() {
  const session = await getServerSession();
  if (!session) return { denied: null as never, ok: false as const };
  if (!(await canOpenModule(session, "M19"))) return { denied: <AccessDenied backHref="/command-center/today" />, ok: false as const };
  return { denied: null, ok: true as const };
}

type Page = TabContent & { crumb: { label: string; href: string } };

function Workspace({ content }: { content: Page }) {
  return <ModuleWorkspace eyebrow="Training" title={content.title ?? "Training"} description={content.desc ?? ""} primary={content.primary} launchers={content.launchers} rows={content.rows} back={content.crumb} />;
}

export async function CourseView({ courseId }: { courseId: string }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const course = await loadCourse(courseId).catch(() => null);
  if (!course) notFound();
  return <Workspace content={coursePage(course)} />;
}

/** The basket, settled — by the school, or recorded as paid by the teacher. */
export async function CheckoutView() {
  const access = await gate();
  if (!access.ok) return access.denied;
  const session = await getServerSession();
  const [basket, me] = await Promise.all([loadBasket().catch(() => null), session ? getTeacherWorkspace(session.role, session.schoolId) : null]);
  if (!basket) notFound();
  return <Workspace content={checkoutPage(basket, me?.person.email ?? "")} />;
}

export async function LessonView({ courseId, position }: { courseId: string; position: string }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const lesson = await loadLesson(courseId, position).catch(() => null);
  if (!lesson) notFound();
  return <Workspace content={lessonPage(lesson)} />;
}

/** Staff & Access → Learning: a course as its author sees it. */
export async function CourseEditorView({ courseId }: { courseId: string }) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canOpenModule(session, "M07"))) return <AccessDenied backHref="/command-center/today" />;
  const { loadManagedCourse, courseEditorPage } = await import("@/lib/modules/live/m7-learning");
  const course = await loadManagedCourse(courseId).catch(() => null);
  if (!course) notFound();
  const content = courseEditorPage(course);
  return <ModuleWorkspace eyebrow="Staff & Access" title={content.title ?? "Course"} description={content.desc ?? ""} primary={content.primary} launchers={content.launchers} rows={content.rows} back={content.crumb} />;
}
