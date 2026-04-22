import { redirect } from "next/navigation";

export default async function StudentCurriculumPage() {
  redirect("/my-subjects" as never);
}
