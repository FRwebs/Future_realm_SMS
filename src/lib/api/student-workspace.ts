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
  /** Pages the school has chosen not to show its students (School Configuration → Policies → Student portal visibility). */
  hidden: string[];
};

export const getStudentBadges = cache(async (role: string): Promise<StudentBadges> => {
  if (role !== "STUDENT") return { counts: {}, tones: {}, hidden: [] };
  try {
    const session = await getServerSession();
    if (!session) return { counts: {}, tones: {}, hidden: [] };
    const counts = await ttlCached(`sbadge:${session.schoolId}:${session.userId}`, 15_000, () => apiGet<{ work: number; late: number; unread: number; hidden: string[] }>(`${SW}/badges`));
    return {
      counts: { s_assignments: counts.work, s_messages: counts.unread },
      tones: { s_assignments: counts.work ? (counts.late ? "danger" : "warning") : undefined },
      hidden: counts.hidden ?? [],
    };
  } catch {
    return { counts: {}, tones: {}, hidden: [] };
  }
});

export type StudentChrome = {
  /** The lesson running right now, if one is. */
  live: { tag: string; text: string } | null;
  /** The one after it, named so a student can see what is coming without opening the timetable. */
  next: string;
  /** The identity chip in the corner. */
  who: { name: string; initials: string; line: string };
  /** The block at the foot of the rail: which school, which term, who the form master is. */
  school: { name: string; term: string; formMaster: string };
};

/**
 * What the student portal's own chrome needs.
 *
 * The staff header is built from the school's context — its name, its address,
 * the term. A student already knows all three. What they do not know, and ask
 * constantly, is which lesson is running and what follows it, so the mockup
 * gives the top bar over to that and moves the school down to the foot of the
 * rail. This is the one read that answers both.
 */
export const getStudentChrome = cache(async (role: string): Promise<StudentChrome | null> => {
  if (role !== "STUDENT") return null;
  try {
    const session = await getServerSession();
    if (!session) return null;
    return await ttlCached(`schrome:${session.schoolId}:${session.userId}`, 60_000, async () => {
      const [me, timetable] = await Promise.all([
        apiGet<StudentMe>(`${SW}/me`),
        apiGet<StudentTimetable>(`${SW}/timetable`).catch(() => ({ slots: [], published: false }) as StudentTimetable),
      ]);
      const weekday = new Date(`${me.today}T00:00:00Z`).getUTCDay();
      const today = timetable.published
        ? timetable.slots.filter((slot) => slot.day === weekday).sort((a, b) => a.from.localeCompare(b.from))
        : [];
      const current = today.find((slot) => slot.from <= me.now && me.now < slot.to) ?? null;
      const after = current ? today.find((slot) => slot.kind === "lesson" && slot.from >= current.to) : today.find((slot) => slot.kind === "lesson" && slot.from > me.now);
      const first = me.first || me.name.split(" ")[0] || me.name;
      return {
        // There is always something true to say here, and an empty corner of
        // the bar reads as broken. A day with no lessons on the timetable at
        // all is not a "school day" with a gap in it — it is a Saturday.
        live: current
          ? {
              tag: "Now",
              text: current.kind === "lesson" ? `${current.subject} · Period ${current.n} · until ${current.to}` : `${current.subject} until ${current.to}`,
            }
          : today.length
            ? { tag: "School day", text: "No lesson right now" }
            : { tag: "Today", text: timetable.published ? "No lessons today" : "No timetable published yet" },
        next: after ? `Next: ${after.subject} at ${after.from}${after.teacher ? ` with ${after.teacher}` : ""}` : "",
        who: {
          name: me.name,
          initials: `${first[0] ?? ""}${(me.name.split(" ")[1] ?? "")[0] ?? ""}`.toUpperCase() || first.slice(0, 2).toUpperCase(),
          line: `Student · ${me.arm}`,
        },
        school: {
          name: me.school,
          term: me.term ? `${me.term.name} · Week ${me.term.week}` : "No term is running",
          formMaster: me.formMaster ? `Form master · ${me.formMaster.name}` : "No form master named yet",
        },
      };
    });
  } catch {
    return null;
  }
});

type StudentMe = {
  name: string; first: string; arm: string; school: string; today: string; now: string;
  formMaster: { name: string } | null;
  term: { name: string; week: number } | null;
};
type StudentTimetable = { published: boolean; slots: Array<{ day: number; n: number; from: string; to: string; kind: string; subject: string; teacher: string }> };
