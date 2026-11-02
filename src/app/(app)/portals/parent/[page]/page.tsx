import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ParentView } from "@/components/portals/parent/parent-view";
import { parentPageSlugs } from "@/lib/modules/live/parent";
import { parentPages } from "@/lib/modules/parent-workspace";

type PageProps = { params: Promise<{ page: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  const entry = parentPages.find((candidate) => candidate.slug === page);
  return entry ? { title: entry.label } : {};
}

export default async function ParentPage({ params, searchParams }: PageProps) {
  const { page } = await params;
  if (!parentPageSlugs().includes(page)) notFound();
  const query = Object.fromEntries(Object.entries((await searchParams) ?? {}).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  return <ParentView page={page} query={query} />;
}
