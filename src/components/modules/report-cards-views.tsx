import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { completionArmPage, loadCompletionArm } from "@/lib/modules/live/m6-completion";
import { loadRemarkPage, remarkPage } from "@/lib/modules/live/m6-remarks";
import type { TabContent } from "@/lib/modules/panels";

/**
 * The pages Report Cards opens from its tabs. Each is a server view: it checks the module is open to the
 * person asking, reads the page from the API, and hands it to the workspace.
 */

async function gate() {
  const session = await getServerSession();
  if (!session) return { denied: null as never, ok: false as const };
  if (!(await canOpenModule(session, "M06"))) return { denied: <AccessDenied backHref="/command-center/today" />, ok: false as const };
  return { denied: null, ok: true as const };
}

type Page = TabContent & { crumb: { label: string; href: string } };

function Workspace({ content, children }: { content: Page; children?: React.ReactNode }) {
  return <ModuleWorkspace eyebrow="Report Cards" title={content.title ?? "Report Cards"} description={content.desc ?? ""} primary={content.primary} launchers={content.launchers} rows={content.rows} back={content.crumb}>{children}</ModuleWorkspace>;
}

export async function RemarkView({ classId, studentId }: { classId: string; studentId: string }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const page = await loadRemarkPage(classId, studentId).catch(() => null);
  if (!page) notFound();
  return <Workspace content={remarkPage(page, page.school).content} />;
}

export async function CompletionArmView({ classId }: { classId: string }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const arm = await loadCompletionArm(classId).catch(() => null);
  if (!arm) notFound();
  return <Workspace content={completionArmPage(arm, arm.school).content} />;
}
