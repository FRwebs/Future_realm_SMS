import { TeacherContentSectionShell } from "@/components/portals/teacher-content-section-shell";

export default function TeacherSchemeOfWorkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TeacherContentSectionShell
      eyebrow="Scheme of Work"
      title="Coverage, submission, and review state"
      description="Separate hands-on weekly coverage work from approval readiness, so teachers can either manage delivery or step back and monitor where each teaching lane stands."
      tabs={[
        {
          href: "/portals/teacher/content/scheme-of-work/coverage",
          label: "Coverage",
          description: "Live weekly editor",
          icon: "BookMarked",
          matches: [
            "/portals/teacher/content/scheme-of-work",
            "/portals/teacher/content/scheme-of-work/coverage",
          ],
        },
        {
          href: "/portals/teacher/content/scheme-of-work/approvals",
          label: "Approvals",
          description: "Status and submission board",
          icon: "ShieldCheck",
          matches: ["/portals/teacher/content/scheme-of-work/approvals"],
        },
      ]}
    >
      {children}
    </TeacherContentSectionShell>
  );
}
