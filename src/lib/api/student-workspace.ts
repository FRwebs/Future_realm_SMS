import { cache } from "react";

import { apiGet } from "@/lib/api/server";
import { getServerSession } from "@/lib/auth/session";
import { ttlCached } from "@/lib/cache/ttl";

export const SW = "/api/v1/student-portal/ws";

/** What a student's rail counts: work still to hand in (and whether any is late) and messages unread. Short-lived: it should move when they act. */
export type StudentBadges = {
  counts: Record<string, number>;
  /** The work badge carries its own warning: amber while there is work to hand in, red once any of it is past its date. */
  tones: Record<string, "warning" | "danger" | undefined>;
};

export const getStudentBadges = cache(async (role: string): Promise<StudentBadges> => {
  if (role !== "STUDENT") return { counts: {}, tones: {} };
  try {
    const session = await getServerSession();
    if (!session) return { counts: {}, tones: {} };
    const counts = await ttlCached(`sbadge:${session.schoolId}:${session.userId}`, 15_000, () => apiGet<{ work: number; late: number; unread: number }>(`${SW}/badges`));
    return {
      counts: { s_assignments: counts.work, s_messages: counts.unread },
      tones: { s_assignments: counts.work ? (counts.late ? "danger" : "warning") : undefined },
    };
  } catch {
    return { counts: {}, tones: {} };
  }
});
