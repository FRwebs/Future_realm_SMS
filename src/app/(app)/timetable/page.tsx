import { TimetableOverviewClient } from "@/components/timetable/timetable-overview-client";
import { AccessDenied } from "@/components/feedback/access-denied";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";

export default async function TimetablePage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/timetable")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  return <TimetableOverviewClient />;
}
