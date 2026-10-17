import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ModuleTabs } from "@/components/modules/module-tabs";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { getTabContent } from "@/lib/modules/content";
import { getLiveTabContent } from "@/lib/modules/live";
import { withKpiTitles } from "@/lib/modules/kpi-titles";
import { canOpenModule, getServerPermissions } from "@/lib/auth/server-access";
import { isSchoolStaffRole } from "@/lib/modules/school-access";
import {
  getSchoolModule,
  getSchoolModuleTab,
  schoolModules,
  schoolPermissionKey,
} from "@/lib/modules/school-modules";
import { getServerSession } from "@/lib/auth/session";

type PageProps = { params: Promise<{ module: string; tab: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };

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

export default async function SchoolModuleTabPage({ params, searchParams }: PageProps) {
  const { module: moduleSlug, tab: tabSlug } = await params;
  const query = Object.fromEntries(Object.entries((await searchParams) ?? {}).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));

  const module = getSchoolModule(moduleSlug);
  if (!module) notFound();

  const tab = getSchoolModuleTab(module, tabSlug);
  if (!tab) notFound();

  const session = await getServerSession();
  if (!session) return null;

  // A module the holder cannot reach is absent from their navigation entirely;
  // reaching it by URL is refused rather than quietly shown empty. A tab is the same:
  // what Permissions took away from this person is honoured here, not only the module.
  const held = isSchoolStaffRole(session.role) ? new Set(await getServerPermissions(session)) : null;
  const canViewTab = (slug: string) => !held || held.has(schoolPermissionKey(module.slug, slug, "View"));
  if (!(await canOpenModule(session, module.code)) || !canViewTab(tab.slug)) {
    return <AccessDenied backHref="/command-center/today" />;
  }

  // A module that has graduated to the API builds its tab from this school's
  // own records; one that has not keeps rendering the authored content.
  const content =
    (await getLiveTabContent(module.code, tab.slug, query)) ?? getTabContent(module.code, tab.slug);

  // The tabs of this module they can open — one they cannot is absent from the strip.
  const visibleTabSlugs = module.tabs.filter((moduleTab) => canViewTab(moduleTab.slug)).map((moduleTab) => moduleTab.slug);

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
