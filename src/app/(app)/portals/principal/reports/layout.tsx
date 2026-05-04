import { PrincipalSectionTabs } from "@/components/portals/principal-section-tabs";
import { principalReportTabs } from "@/lib/principal/portal";

export default function PrincipalReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6">
      <PrincipalSectionTabs
        title="Executive reports"
        description="Move between school analytics and finance oversight without losing the executive command context."
        tabs={principalReportTabs}
      />
      {children}
    </div>
  );
}
