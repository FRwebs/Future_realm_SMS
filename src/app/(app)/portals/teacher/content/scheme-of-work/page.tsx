import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeacherSchemeOfWorkPage({ searchParams }: PageProps) {
  const resolvedSearch = searchParams ? await searchParams : {};
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearch)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) query.append(key, item);
      }
      continue;
    }
    if (value) query.set(key, value);
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  redirect(`/portals/teacher/content/scheme-of-work/coverage${suffix}` as never);
}
