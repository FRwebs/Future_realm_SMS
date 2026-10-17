import type { Route } from "next";
import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string; studentId: string }> };

/** A student is one record, wherever it is opened from — so the arm's own page hands over to it, with a way back. */
export default async function ArmStudentPage({ params }: PageProps) {
  const { id, studentId } = await params;
  redirect(`/student-records/registry/${encodeURIComponent(studentId)}?from=arm&arm=${encodeURIComponent(id)}` as Route);
}
