import { SupportSectionTabs } from "@/components/portals/support-section-tabs";
import { hostelPortalLayout } from "@/lib/support-services/portal";

export default function HostelPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6">
      <SupportSectionTabs
        title={hostelPortalLayout.title}
        description={hostelPortalLayout.description}
        tabs={hostelPortalLayout.tabs}
      />
      {children}
    </div>
  );
}
