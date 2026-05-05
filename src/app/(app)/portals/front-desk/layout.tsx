import { SupportSectionTabs } from "@/components/portals/support-section-tabs";
import { frontDeskPortalLayout } from "@/lib/support-services/portal";

export default function FrontDeskPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6">
      <SupportSectionTabs
        title={frontDeskPortalLayout.title}
        description={frontDeskPortalLayout.description}
        tabs={frontDeskPortalLayout.tabs}
      />
      {children}
    </div>
  );
}
