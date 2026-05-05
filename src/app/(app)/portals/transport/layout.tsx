import { SupportSectionTabs } from "@/components/portals/support-section-tabs";
import { transportPortalLayout } from "@/lib/support-services/portal";

export default function TransportPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6">
      <SupportSectionTabs
        title={transportPortalLayout.title}
        description={transportPortalLayout.description}
        tabs={transportPortalLayout.tabs}
      />
      {children}
    </div>
  );
}
