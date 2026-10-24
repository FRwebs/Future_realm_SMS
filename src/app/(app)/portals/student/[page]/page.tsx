import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StudentView } from "@/components/portals/student/student-view";
import { studentPageSlugs } from "@/lib/modules/live/student";
import { studentPages } from "@/lib/modules/student-workspace";

type PageProps = { params: Promise<{ page: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  const entry = studentPages.find((candidate) => candidate.slug === page);
  return entry ? { title: entry.label } : {};
}

export default async function StudentPage({ params, searchParams }: PageProps) {
  const { page } = await params;
  if (!studentPageSlugs().includes(page)) notFound();
  const query = Object.fromEntries(Object.entries((await searchParams) ?? {}).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  return <StudentView page={page} query={query} />;
}
