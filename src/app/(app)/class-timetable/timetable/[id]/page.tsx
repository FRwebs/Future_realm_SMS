import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { TimetablePreview } from "@/components/modules/timetable-preview";
import { loadTimetable } from "@/lib/modules/live/m3-class-timetable";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Class & Timetable · Timetable preview",
  description: "One arm's week at a time, exactly as a teacher or guardian would read it.",
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ arm?: string; teacher?: string }>;
};

/** A saved timetable, previewed arm by arm. `live` is the week as it was before versions were kept. */
export default async function TimetablePreviewPage({ params, searchParams }: PageProps) {
  const [{ id }, { arm, teacher }] = await Promise.all([params, searchParams]);

  const session = await getServerSession();
  if (!session) return null;

  if (!(await canOpenModule(session, "M03"))) {
    return <AccessDenied backHref="/command-center/today" />;
  }

  const detail = await loadTimetable(id).catch(() => null);
  if (!detail) notFound();

  return <TimetablePreview detail={detail} initialArmId={arm} initialTeacherId={teacher} />;
}
