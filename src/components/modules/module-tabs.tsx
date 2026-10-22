import { TabBar } from "@/components/modules/tab-bar";
import type { SchoolModule } from "@/lib/modules/school-modules";

/**
 * A module's tabs.
 *
 * A tab the holder cannot open is absent rather than disabled — the mockup is
 * explicit that greying a control out "only teaches people to ask for it".
 */
export function ModuleTabs({
  module,
  visibleTabSlugs,
  labels,
  name,
}: {
  module: SchoolModule;
  /** The tabs to show, in the order to show them. */
  visibleTabSlugs: string[];
  /** The holder's own words for a tab (a teacher's "My students" is the registry). */
  labels?: Record<string, string>;
  /** The holder's own name for the module. */
  name?: string;
}) {
  const bySlug = new Map(module.tabs.map((tab) => [tab.slug, tab]));

  return (
    <TabBar
      ariaLabel={`${name ?? module.name} tabs`}
      items={visibleTabSlugs
        .map((slug) => bySlug.get(slug))
        .filter((tab): tab is NonNullable<typeof tab> => Boolean(tab))
        .map((tab) => ({ href: `/${module.slug}/${tab.slug}`, label: labels?.[tab.slug] ?? tab.label }))}
    />
  );
}
