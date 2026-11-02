import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ChildSwitcher } from "@/components/portals/parent/child-switcher";
import type { SwitcherChild } from "@/components/portals/parent/child-switcher";
import { StudentTabs } from "@/components/portals/student/student-tabs";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { getServerSession } from "@/lib/auth/session";
import { getPlatformSync } from "@/lib/api/platform-sync";
import { buildParentPage, PAGE_MODULE } from "@/lib/modules/live/parent";
import { childOf, loadMe, loadNeeds } from "@/lib/modules/live/parent/shared";
import { familyOnlyPages, parentPages } from "@/lib/modules/parent-workspace";
import type { ParentPageSlug } from "@/lib/modules/parent-workspace";

/** One page of a parent's own workspace. Only a guardian's account reaches it; everything on it is their own family's record. */
export async function ParentView({ page, query }: { page: string; query: Record<string, string | undefined> }) {
  const session = await getServerSession();
  if (!session) return null;
  if (session.role !== "PARENT") return <AccessDenied backHref="/" />;

  // A module the Back Office has switched off — or the whole portal — says so,
  // rather than showing what the school no longer runs.
  const off = (await getPlatformSync(session.schoolId))?.switchedOff ?? [];
  const closed = off.find((entry) => entry.slug === "parent-portal") ?? off.find((entry) => entry.slug === PAGE_MODULE[page]);
  if (closed) {
    return (
      <ModuleWorkspace
        eyebrow="Your school"
        title={closed.slug === "parent-portal" ? "The parent portal is switched off" : "This page is switched off"}
        description={closed.reason}
        rows={[{ cols: "1fr", panels: [{ type: "note", tone: "neutral", title: "Nothing is lost", body: "It returns exactly as it was when your school has it back. If you need something now, call or message the school office." }] }]}
      />
    );
  }

  const me = await loadMe();
  const child = childOf(query, me);

  // A page this school keeps back from parents is not in the rail; reached by
  // address it says whose choice that was rather than failing.
  const entry = parentPages.find((candidate) => candidate.slug === page);
  const needsPolicy = ({ results: "Results", attendance: "Attendance", fees: "Fees", learning: "Timetable" } as Record<string, string>)[page];
  if (needsPolicy && !me.sees.includes(needsPolicy)) {
    return (
      <ModuleWorkspace
        eyebrow="Your school"
        title="Your school has not made this page visible to parents"
        description="The school decides what its parents see. Ask the school office if you need something from it."
        rows={[{ cols: "1fr", panels: [{ type: "note", tone: "neutral", title: "Not shown to parents", body: "This is your school’s choice, not a fault." }] }]}
      />
    );
  }

  const built = buildParentPage(page, child, query);
  const content = built
    ? await built
    : {
        eyebrow: "Parent portal",
        title: entry?.label ?? "This page",
        desc: "This page of the portal is not built yet.",
        rows: [{ cols: "1fr", panels: [{ type: "note" as const, tone: "neutral" as const, title: "Not built yet", body: "It is in the rail because it is part of this portal, and it will read your family's own record when it is built. Nothing you need is hidden behind it today — the school office can answer anything it would have shown." }] }],
      };

  // The switcher is chrome above the page, not page content: it is how a parent
  // says which child they mean, and every page below it obeys that choice.
  const showSwitcher = !familyOnlyPages.includes(page as ParentPageSlug) && me.children.length > 0;
  let switcher: { children: SwitcherChild[]; family: { stat: string; needs: number; urgent: boolean } } | null = null;
  if (showSwitcher) {
    const all = await loadNeeds("all").catch(() => ({ items: [] }));
    const forChild = (id: string) => all.items.filter((need) => need.childId === id);
    const familyNeeds = all.items.length;
    switcher = {
      family: {
        stat: familyNeeds ? `${familyNeeds} ${familyNeeds === 1 ? "thing needs" : "things need"} you` : "Nothing to do",
        needs: familyNeeds,
        urgent: all.items.some((need) => need.tone === "negative"),
      },
      children: me.children.map((kid) => {
        const mine = forChild(kid.id);
        return {
          ...kid,
          stat: mine.length ? `${mine.length} to do` : kid.arm,
          statTone: mine.some((need) => need.tone === "negative") ? ("negative" as const) : mine.length ? ("attention" as const) : undefined,
          needs: mine.length,
          urgent: mine.some((need) => need.tone === "negative"),
        };
      }),
    };
  }

  const active = content.tab ?? content.tabs?.[0]?.label ?? "";
  return (
    <>
      {switcher ? <ChildSwitcher page={page} selected={child} children={switcher.children} family={switcher.family} /> : null}
      <ModuleWorkspace
        eyebrow={content.eyebrow ?? "Your school"}
        title={content.title ?? ""}
        description={content.desc ?? ""}
        primary={content.primary}
        launchers={content.launchers}
        rows={content.rows ?? []}
      >
        {content.tabs?.length ? <StudentTabs tabs={content.tabs} active={active} ariaLabel={`${content.title} tabs`} /> : null}
      </ModuleWorkspace>
    </>
  );
}

export const parentPageExists = (page: string) => parentPages.some((entry) => entry.slug === page);
export { notFound };
