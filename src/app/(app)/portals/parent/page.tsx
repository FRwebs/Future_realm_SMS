import type { Metadata } from "next";

import { ParentView } from "@/components/portals/parent/parent-view";

export const metadata: Metadata = { title: "Overview", description: "Your family, and anything that needs you." };

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function ParentOverviewPage({ searchParams }: PageProps) {
  const query = Object.fromEntries(Object.entries((await searchParams) ?? {}).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  return <ParentView page="overview" query={query} />;
}
