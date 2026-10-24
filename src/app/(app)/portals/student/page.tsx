import type { Metadata } from "next";

import { StudentView } from "@/components/portals/student/student-view";

export const metadata: Metadata = { title: "Today" };

export default async function StudentTodayPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const query = Object.fromEntries(Object.entries((await searchParams) ?? {}).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  return <StudentView page="today" query={query} />;
}
