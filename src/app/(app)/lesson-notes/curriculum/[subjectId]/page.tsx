import { redirect } from "next/navigation";

/** A subject's scheme lives on the Curriculum tab, where the subjects sit beside it. */
export default async function SchemePage({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  redirect(`/lesson-notes/curriculum?subject=${encodeURIComponent(subjectId)}`);
}
