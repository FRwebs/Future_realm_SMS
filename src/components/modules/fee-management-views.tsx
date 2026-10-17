import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { familyPage, loadCollections, loadFamily, type FeePage } from "@/lib/modules/live/m10-collections";
import { loadPreview, loadStructure, loadStructureOptions, loadStructures, rulesPage, structurePage } from "@/lib/modules/live/m10-structures";

/**
 * The pages Fee Management opens from its tabs. Each is a server view: it checks the module is
 * open to the person asking, reads the page from the API, and hands it to the workspace.
 */

async function allowed() {
  const session = await getServerSession();
  if (!session) return null;
  return await canOpenModule(session, "M10");
}

function Shell({ content }: { content: FeePage }) {
  return <ModuleWorkspace eyebrow="Fee Management" title={content.title ?? "Fee Management"} description={content.desc ?? ""} primary={content.primary} launchers={content.launchers} rows={content.rows} back={content.crumb} />;
}

export async function FamilyView({ id }: { id: string }) {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  const [detail, data] = await Promise.all([loadFamily(id).catch(() => null), loadCollections()]);
  if (!detail) notFound();
  return <Shell content={familyPage(detail, data)} />;
}

export async function StructureView({ id }: { id: string }) {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  const [detail, preview, data, options] = await Promise.all([loadStructure(id).catch(() => null), loadPreview(id).catch(() => null), loadStructures(), loadStructureOptions()]);
  if (!detail || !preview) notFound();
  return <Shell content={structurePage(detail, preview, data, options.terms)} />;
}

export async function RulesView() {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  return <Shell content={rulesPage(await loadStructures())} />;
}
