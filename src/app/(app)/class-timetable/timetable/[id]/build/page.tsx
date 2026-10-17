import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { TimetableBuilder } from "@/components/modules/timetable-builder";
import { loadTimetable, loadTimetables } from "@/lib/modules/live/m3-class-timetable";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Class & Timetable · Build a timetable",
  description: "Pick a subject, then tap the periods it runs in.",
};

type PageProps = { params: Promise<{ id: string }> };

/**
 * The builder is a page, not a modal: a week grid needs room, and it holds its own
 * state across a form and a grid that changes with every tap.
 */
export default async function TimetableBuildPage({ params }: PageProps) {
  const { id } = await params;

  const session = await getServerSession();
  if (!session) return null;

  if (!(await canOpenModule(session, "M03"))) {
    return <AccessDenied backHref="/command-center/today" />;
  }

  const [detail, list] = await Promise.all([loadTimetable(id).catch(() => null), loadTimetables()]);
  if (!detail) notFound();

  const running = list.versions.find((version) => version.state === "RUNNING");

  return <TimetableBuilder detail={detail} runningId={running && running.id !== id ? running.id : null} />;
}
