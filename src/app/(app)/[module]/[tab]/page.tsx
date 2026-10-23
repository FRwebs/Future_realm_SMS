import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ModuleTabs } from "@/components/modules/module-tabs";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { getTabContent } from "@/lib/modules/content";
import { getLiveTabContent } from "@/lib/modules/live";
import { teacherKpiTitle, withKpiTitles } from "@/lib/modules/kpi-titles";
import { slimRows } from "@/lib/modules/slim";
import { windowRows } from "@/lib/modules/window";
import { canOpenModule, getServerPermissions, refreshServerPermissions } from "@/lib/auth/server-access";
import { currentCtx } from "@/lib/cache/ttl";
import { isSchoolStaffRole } from "@/lib/modules/school-access";
import {
  getSchoolModule,
  getSchoolModuleTab,
  schoolModules,
  schoolPermissionKey,
} from "@/lib/modules/school-modules";
import { getServerSession } from "@/lib/auth/session";
import { getTeacherWorkspace } from "@/lib/api/teacher-workspace";
import { orderTeacherTabs, teacherModuleByCode, teacherModuleDescription, teacherModuleLabel } from "@/lib/modules/teacher-workspace";

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
  // The tab's own data does not wait for the access checks: it is asked for now, alongside them, and thrown away if they say no (the API
  // refuses what is not theirs in any case). On a cold page that is one trip instead of two.
  const stampWhenAsked = currentCtx();
  const contentAsked = getLiveTabContent(module.code, tab.slug, query);
  contentAsked.catch(() => undefined);

  // What this person may do and who they are as a teacher are asked together, not one after the other — and the tab's own data is asked for as
  // soon as they are known, rather than after the access checks have finished.
  const [granted, teacherView] = await Promise.all([
    isSchoolStaffRole(session.role) ? getServerPermissions(session) : Promise.resolve(null),
    getTeacherWorkspace(session.role, session.schoolId),
  ]);
  let held = granted ? new Set(granted) : null;
  const canViewTab = (slug: string) => !held || held.has(schoolPermissionKey(module.slug, slug, "View"));
  if (!(await canOpenModule(session, module.code)) || !canViewTab(tab.slug)) {
    // On a remembered answer, "no" is asked once more afresh: somebody who has just been given access should not be told no for a while.
    if (!held) return <AccessDenied backHref="/command-center/today" />;
    held = new Set(await refreshServerPermissions(session));
    if (!module.tabs.some((moduleTab) => canViewTab(moduleTab.slug)) || !canViewTab(tab.slug)) return <AccessDenied backHref="/command-center/today" />;
  }

  // A module that has graduated to the API builds its tab from this school's
  // own records; one that has not keeps rendering the authored content.
  const content = (await contentAsked) ?? getTabContent(module.code, tab.slug);

  // The API's answer carries its context stamp. If the stamp moved while this page was being drawn — a role, an assignment, a switch — the
  // access it was decided on may be out of date, so it is decided again on fresh permissions before anything is shown.
  if (held && currentCtx() !== stampWhenAsked) {
    const fresh = new Set(await refreshServerPermissions(session));
    if (!fresh.has(schoolPermissionKey(module.slug, tab.slug, "View"))) return <AccessDenied backHref="/command-center/today" />;
  }

  // The tabs of this module they can open — one they cannot is absent from the strip.
  let visibleTabSlugs = module.tabs.filter((moduleTab) => canViewTab(moduleTab.slug)).map((moduleTab) => moduleTab.slug);

  // A teacher meets the same module in their own words and their own order of tabs.
  const teacher = teacherView;
  const teaching = teacher && teacherModuleByCode[module.code] ? teacher : null;
  if (teaching) visibleTabSlugs = orderTeacherTabs(module.code, visibleTabSlugs);
  const moduleName = teaching ? (teacherModuleLabel(module.code, teaching.persona) ?? module.name) : module.name;
  const tabLabels: Record<string, string> | undefined = teaching && module.code === "m8" ? { registry: "My students" } : undefined;

  return (
    <ModuleWorkspace
      eyebrow={moduleName}
      title={content?.title ?? tabLabels?.[tab.slug] ?? tab.label}
      description={content?.desc ?? (teaching ? teacherModuleDescription(module.code, teaching.persona) : undefined) ?? module.description}
      primary={content?.primary}
      launchers={content?.launchers}
      rows={
        content?.rows
          ? withKpiTitles(
              // A long table is sent one page at a time (search, filters and page live in the address); a middling one keeps only its first page's drawers.
              slimRows(windowRows(content.rows, { module: module.slug, tab: tab.slug, query }), { module: module.slug, tab: tab.slug, query }),
              module.code,
              tab.label,
              teacher
                ? (code, label) => teacherKpiTitle(code, label, { earlyYears: teacher.persona === "early-years", arm: teacher.formArms.length === 1 ? teacher.formArms[0]!.name : teacher.formArms.length ? null : teacher.assistantArms[0]?.name ?? null, department: teacher.department?.name ?? null })
                : undefined,
            )
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
      <ModuleTabs module={module} visibleTabSlugs={visibleTabSlugs} labels={tabLabels} name={moduleName} />
    </ModuleWorkspace>
  );
}
