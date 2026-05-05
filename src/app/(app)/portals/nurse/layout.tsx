import { SupportSectionTabs } from "@/components/portals/support-section-tabs";
import { nursePortalLayout } from "@/lib/support-services/portal";

export default function NursePortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6">
      <SupportSectionTabs
        title={nursePortalLayout.title}
        description={nursePortalLayout.description}
        tabs={nursePortalLayout.tabs}
      />
      {children}
    </div>
  );
}
