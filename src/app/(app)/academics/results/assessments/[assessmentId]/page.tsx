import { redirect } from "next/navigation";

export default async function AssessmentWorkspaceRedirectPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;
  redirect(`/academics/results/assessment-format/${assessmentId}`);
}
