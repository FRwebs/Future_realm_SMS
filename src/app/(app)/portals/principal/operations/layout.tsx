import { PrincipalSectionTabs } from "@/components/portals/principal-section-tabs";
import { principalOperationsTabs } from "@/lib/principal/portal";

export default function PrincipalOperationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6">
      <PrincipalSectionTabs
        title="School life & operations"
        description="Calendar control and visitor visibility for the day-to-day physical life of the school."
        tabs={principalOperationsTabs}
      />
      {children}
    </div>
  );
}
