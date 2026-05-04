import { redirect } from "next/navigation";

export default async function TeacherCurriculumPage() {
  redirect("/portals/teacher/content/lesson-notes" as never);
}
