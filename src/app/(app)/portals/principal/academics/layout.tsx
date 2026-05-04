import { PrincipalSectionTabs } from "@/components/portals/principal-section-tabs";
import { principalAcademicTabs } from "@/lib/principal/portal";

export default function PrincipalAcademicsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6">
      <PrincipalSectionTabs
        title="Academic oversight"
        description="Stay inside the leadership lens while moving between academic performance, promotion readiness, and principal comment completion."
        tabs={principalAcademicTabs}
      />
      {children}
    </div>
  );
}
