import { TeacherContentShell } from "@/components/portals/teacher-content-shell";

export default function TeacherContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TeacherContentShell>{children}</TeacherContentShell>;
}
