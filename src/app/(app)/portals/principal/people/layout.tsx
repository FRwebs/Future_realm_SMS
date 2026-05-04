import { PrincipalSectionTabs } from "@/components/portals/principal-section-tabs";
import { principalPeopleTabs } from "@/lib/principal/portal";

export default function PrincipalPeopleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6">
      <PrincipalSectionTabs
        title="People oversight"
        description="Review teachers, students, discipline, and leave pressure through one organised leadership workspace."
        tabs={principalPeopleTabs}
      />
      {children}
    </div>
  );
}
