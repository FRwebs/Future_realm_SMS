import type { Metadata } from "next";

import { AddSubjectView } from "@/components/modules/lesson-notes-views";

export const metadata: Metadata = { title: "Lesson Notes · Add a subject", description: "Plan a subject the school has not given you." };

export default function AddSubjectPage() {
  return <AddSubjectView />;
}
