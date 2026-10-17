import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { familyPage, loadFamilies, loadFamily, loadGuardianOptions } from "@/lib/modules/live/m9-guardians";

/**
 * The pages Parents & Guardians opens from its tabs. Each is a server view: it checks the module is
 * open to the person asking, reads the page from the API, and hands it to the workspace.
 */

export async function FamilyView({ id }: { id: string }) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canOpenModule(session, "M09"))) return <AccessDenied backHref="/command-center/today" />;
  const [family, options, all] = await Promise.all([loadFamily(id).catch(() => null), loadGuardianOptions(), loadFamilies()]);
  if (!family) notFound();
  const { content } = familyPage(family, options, all.rows);
  return <ModuleWorkspace eyebrow="Parents & Guardians" title={content.title ?? "Family"} description={content.desc ?? ""} primary={content.primary} launchers={content.launchers} rows={content.rows} back={content.crumb} />;
}
