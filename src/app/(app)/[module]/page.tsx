import type { Route } from "next";
import { notFound, redirect } from "next/navigation";

import { getSchoolModule, schoolModulePath, schoolModules } from "@/lib/modules/school-modules";

type PageProps = { params: Promise<{ module: string }> };

export async function generateStaticParams() {
  return schoolModules.map((module) => ({ module: module.slug }));
}

/** A module opens on its first tab — the module itself has no separate page. */
export default async function SchoolModulePage({ params }: PageProps) {
  const { module: moduleSlug } = await params;

  const module = getSchoolModule(moduleSlug);
  if (!module) notFound();

  redirect(schoolModulePath(module) as Route);
}
