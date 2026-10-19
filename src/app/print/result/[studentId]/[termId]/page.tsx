import { redirect } from "next/navigation";

/** A result is the report card: the same paper, printed from the same place. */
export default async function ResultPage({ params }: { params: Promise<{ studentId: string; termId: string }> }) {
  const { studentId, termId } = await params;
  redirect(`/print/cards?students=${encodeURIComponent(studentId)}&term=${encodeURIComponent(termId)}`);
}
