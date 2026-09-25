import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ModuleTabs } from "@/components/modules/module-tabs";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { getTabContent } from "@/lib/modules/content";
import { withKpiTitles } from "@/lib/modules/kpi-titles";
import { moduleLevelForRole } from "@/lib/modules/school-access";
import {
  getSchoolModule,
  getSchoolModuleTab,
  schoolModules,
} from "@/lib/modules/school-modules";
import { getServerSession } from "@/lib/auth/session";

type PageProps = { params: Promise<{ module: string; tab: string }> };

export async function generateStaticParams() {
  return schoolModules.flatMap((module) =>
    module.tabs.map((tab) => ({ module: module.slug, tab: tab.slug })),
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { module: moduleSlug, tab: tabSlug } = await params;
  const module = getSchoolModule(moduleSlug);
  if (!module) return {};

  const tab = getSchoolModuleTab(module, tabSlug);
  return {
    title: tab ? `${module.name} · ${tab.label}` : module.name,
    description: module.description,
  };
}

export default async function SchoolModuleTabPage({ params }: PageProps) {
  const { module: moduleSlug, tab: tabSlug } = await params;

  const module = getSchoolModule(moduleSlug);
  if (!module) notFound();

  const tab = getSchoolModuleTab(module, tabSlug);
  if (!tab) notFound();

  const session = await getServerSession();
  if (!session) return null;

  // A module the holder cannot reach is absent from their navigation entirely;
  // reaching it by URL is refused rather than quietly shown empty.
  if (moduleLevelForRole(session.role, module.code) === 0) {
    return <AccessDenied backHref="/command-center/today" />;
  }

  const content = getTabContent(module.code, tab.slug);

  // Every tab of a module the holder can open is visible to them: the mockup
  // scopes access by module, and by action within it, never by tab.
  const visibleTabSlugs = module.tabs.map((moduleTab) => moduleTab.slug);

  return (
    <ModuleWorkspace
      eyebrow={module.name}
      title={content?.title ?? tab.label}
      description={content?.desc ?? module.description}
      primary={content?.primary}
      launchers={content?.launchers}
      rows={
        content?.rows
          ? withKpiTitles(content.rows, module.code, tab.label)
          : [
              {
                cols: "1fr",
                panels: [
                  {
                    type: "pending",
                    title: `${module.name} · ${tab.label}`,
                    body: "This tab is defined by the mockup but has no content registered yet.",
                    contains: [],
                  },
                ],
              },
            ]
      }
    >
      <ModuleTabs module={module} visibleTabSlugs={visibleTabSlugs} />
    </ModuleWorkspace>
  );
}
