import { PrincipalSectionTabs } from "@/components/portals/principal-section-tabs";
import { principalCommunicationTabs } from "@/lib/principal/portal";

export default function PrincipalCommunicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6">
      <PrincipalSectionTabs
        title="Communication desk"
        description="Manage school-wide announcements and parent-facing broadcast readiness without leaving the principal portal."
        tabs={principalCommunicationTabs}
      />
      {children}
    </div>
  );
}
