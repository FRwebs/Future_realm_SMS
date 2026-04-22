import { redirect } from "next/navigation";

export default async function TeacherCurriculumPage() {
  redirect("/my-subjects" as never);
}
