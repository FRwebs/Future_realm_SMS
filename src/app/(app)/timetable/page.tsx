import { TimetableOverviewClient, type TimetableOverviewPayload } from "@/components/timetable/timetable-overview-client";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";

export default async function TimetablePage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/timetable"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const overview = await apiGet<TimetableOverviewPayload>("/api/v1/timetable/classes");

  return <TimetableOverviewClient initialPayload={overview} />;
}
