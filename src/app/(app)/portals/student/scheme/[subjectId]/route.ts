import { NextResponse } from "next/server";

import { apiGet } from "@/lib/api/server";
import { getServerSession } from "@/lib/auth/session";
import type { PanelFact } from "@/lib/modules/panels";

export const dynamic = "force-dynamic";

type Scheme = {
  subjectName: string; teacherName?: string; termName: string; status: string;
  topics: Array<{ weekNumber: number; topic: string; weekType: string; isCovered: boolean; subtopics?: string[]; assignment?: string }>;
  stats: { teachingWeeks: number; coveredWeeks: number; coveragePercent: number };
};

/** A subject's scheme of work for the term, as the student's drawer reads it: each week, what it is about, and where the class has got to. */
export async function GET(_request: Request, context: { params: Promise<{ subjectId: string }> }) {
  const session = await getServerSession();
  if (!session || session.role !== "STUDENT") return NextResponse.json({ error: "This is for students." }, { status: 403 });
  const { subjectId } = await context.params;
  try {
    const scheme = await apiGet<Scheme>(`/api/v1/student-portal/subjects/${encodeURIComponent(subjectId)}/scheme-of-work`);
    const current = scheme.topics.find((topic) => topic.weekType === "TEACHING" && !topic.isCovered)?.weekNumber;
    const facts: PanelFact[] = scheme.topics.map((topic) => [
      `Week ${topic.weekNumber}`, topic.topic,
      topic.weekType !== "TEACHING" ? topic.weekType.toLowerCase().replace(/^./, (c) => c.toUpperCase()) : topic.isCovered ? "Covered" : topic.weekNumber === current ? "This week" : "Coming up",
    ]);
    return NextResponse.json({
      kicker: `Scheme of work · ${scheme.termName}`, title: scheme.subjectName, sub: `${scheme.teacherName ?? "Your teacher"} · ${scheme.stats.coveredWeeks} of ${scheme.stats.teachingWeeks} teaching weeks covered`,
      mode: "view", readOnly: true, facts: facts.length ? facts : [["Scheme of work", "No weeks yet", "The teacher has not set the weeks out."]],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ kicker: "Scheme of work", title: "No scheme of work yet", mode: "view", readOnly: true, facts: [["Scheme of work", "Not published", "Your teacher has not published this subject’s scheme of work for the term yet."]] }, { headers: { "Cache-Control": "no-store" } });
  }
}
