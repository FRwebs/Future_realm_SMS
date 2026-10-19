import type { Metadata } from "next";

import { EnrolStudentView } from "@/components/modules/student-records-views";

export const metadata: Metadata = { title: "Student Records · Enrol a student", description: "Enrol a student: who they are, where they sit, and who looks after them." };

export default async function EnrolStudentPage() {
  return <EnrolStudentView />;
}
