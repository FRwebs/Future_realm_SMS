import { cache } from "react";

import { apiGet } from "@/lib/api/server";
import { getServerSession } from "@/lib/auth/session";
import { ttlCached } from "@/lib/cache/ttl";

export const SW = "/api/v1/student-portal/ws";

/** What a student's rail counts: work still to hand in (and whether any is late) and messages unread. Short-lived: it should move when they act. */
export const getStudentBadges = cache(async (role: string): Promise<Record<string, number>> => {
  if (role !== "STUDENT") return {};
  try {
    const session = await getServerSession();
    if (!session) return {};
    const counts = await ttlCached(`sbadge:${session.schoolId}:${session.userId}`, 15_000, () => apiGet<{ work: number; late: number; unread: number }>(`${SW}/badges`));
    return { s_assignments: counts.work, s_messages: counts.unread };
  } catch {
    return {};
  }
});
