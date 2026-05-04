import { TeacherContentSectionShell } from "@/components/portals/teacher-content-section-shell";

export default function TeacherLessonNotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TeacherContentSectionShell
      eyebrow="Lesson Notes"
      title="Planning and teaching queue"
      description="Split lesson planning into focused views so teachers can either work the next lesson in detail or review the wider teaching queue without scrolling through one oversized page."
      tabs={[
        {
          href: "/portals/teacher/content/lesson-notes/planning",
          label: "Planning",
          description: "Live planning studio",
          icon: "BookOpen",
          matches: [
            "/portals/teacher/content/lesson-notes",
            "/portals/teacher/content/lesson-notes/planning",
            "/portals/teacher/curriculum",
          ],
        },
        {
          href: "/portals/teacher/content/lesson-notes/queue",
          label: "Queue",
          description: "Weekly backlog and prep board",
          icon: "FileStack",
          matches: ["/portals/teacher/content/lesson-notes/queue"],
        },
      ]}
    >
      {children}
    </TeacherContentSectionShell>
  );
}
