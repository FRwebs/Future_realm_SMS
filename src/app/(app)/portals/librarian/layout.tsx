import { SupportSectionTabs } from "@/components/portals/support-section-tabs";
import { librarianPortalLayout } from "@/lib/support-services/portal";

export default function LibrarianPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6">
      <SupportSectionTabs
        title={librarianPortalLayout.title}
        description={librarianPortalLayout.description}
        tabs={librarianPortalLayout.tabs}
      />
      {children}
    </div>
  );
}
