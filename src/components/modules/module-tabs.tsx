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
}: {
  module: SchoolModule;
  visibleTabSlugs: string[];
}) {
  const visible = new Set(visibleTabSlugs);

  return (
    <TabBar
      ariaLabel={`${module.name} tabs`}
      items={module.tabs
        .filter((tab) => visible.has(tab.slug))
        .map((tab) => ({ href: `/${module.slug}/${tab.slug}`, label: tab.label }))}
    />
  );
}
