import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { TabBar } from "@/components/modules/tab-bar";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { itemPage, loadItem, SECTIONS, type Section } from "@/lib/modules/live/m13-queue";
import { loadRoute, routePage } from "@/lib/modules/live/m13-workflow";

/**
 * The pages Approvals & Workflow opens from its tabs. Each is a server view: it checks the module is open to
 * the person asking, reads the page from the API, and hands it to the workspace.
 */

async function gate() {
  const session = await getServerSession();
  if (!session) return { denied: null as never, ok: false as const };
  if (!(await canOpenModule(session, "M13"))) return { denied: <AccessDenied backHref="/command-center/today" />, ok: false as const };
  return { denied: null, ok: true as const };
}

type Content = Parameters<typeof ModuleWorkspace>[0];

function Workspace({ content, children }: { content: { title?: string; desc?: string; primary?: Content["primary"]; launchers?: Content["launchers"]; rows: Content["rows"]; crumb: { label: string; href: string } }; children?: React.ReactNode }) {
  return <ModuleWorkspace eyebrow="Approvals & Workflow" title={content.title ?? "Approvals & Workflow"} description={content.desc ?? ""} primary={content.primary} launchers={content.launchers} rows={content.rows} back={content.crumb}>{children}</ModuleWorkspace>;
}

export async function ItemView({ keyValue, section }: { keyValue: string; section?: string }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const known = SECTIONS.find((entry) => entry.path === (section ? `/${section}` : ""));
  if (!known) notFound();
  const page = await loadItem(keyValue).catch(() => null);
  if (!page) notFound();
  const view = itemPage(page, known.section as Section);
  return (
    <Workspace content={view.content}>
      <TabBar items={view.tabs} ariaLabel={`${page.title}`} />
    </Workspace>
  );
}

export async function RouteView({ type }: { type: string }) {
  const access = await gate();
  if (!access.ok) return access.denied;
  const page = await loadRoute(type).catch(() => null);
  if (!page) notFound();
  return <Workspace content={routePage(page).content} />;
}
