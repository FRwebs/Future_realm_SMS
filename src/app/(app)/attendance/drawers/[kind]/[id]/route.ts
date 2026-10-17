import { NextResponse } from "next/server";

import { apiGet } from "@/lib/api/server";
import { AT, closeCaseDrawer, decideExplanationDrawer, notifyPersonDrawer, openCaseDrawer, sendRecordDrawer, studentCaseFacts, teacherFacts, viewExplanationDrawer } from "@/lib/modules/live/m4-forms";
import { loadTeacher } from "@/lib/modules/live/m4-compliance";
import { loadOptions } from "@/lib/modules/live/m4-register";
import type { ExplanationDetail, StudentCase } from "@/lib/modules/live/m4-types";
import type { DrawerSpec } from "@/lib/modules/panels";

/**
 * The records Attendance opens in a drawer, prepared when they are opened rather than for every row
 * of every list. The drawer asks for this; the answer is the rest of the drawer.
 */

const toneOf = (flag: string) => (flag === "Chronic" ? "negative" : flag === "Falling" || flag === "Watch" ? "attention" : flag === "No concern" ? "positive" : "neutral");

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  try {
    if (kind === "student") {
      const c = await apiGet<StudentCase>(`${AT}/students/${encodeURIComponent(id)}`);
      const spec: Partial<DrawerSpec> = {
        mode: "view", kicker: "Log", title: `${c.student.name} · attendance`,
        sub: "The whole term, and what the school has already done about it.",
        tone: toneOf(c.flag), facts: studentCaseFacts(c), readOnly: true,
        readOnlyNote: c.case?.status === "Closed" ? "This case is closed. Its outcome stays on the record." : "A case cannot be closed without a recorded outcome.",
        edit: c.case && c.case.status === "Open" ? closeCaseDrawer(c) : c.case ? undefined : openCaseDrawer([{ id: c.student.id, name: c.student.name }]),
        editLabel: c.case && c.case.status === "Open" ? "Close the case" : "Open a case",
      };
      if (!spec.edit) {
        spec.edit = sendRecordDrawer([{ id: c.student.id, name: c.student.name }], `${c.student.name} · attendance`);
        spec.editLabel = "Message the guardians";
      }
      return NextResponse.json(spec);
    }
    if (kind === "teacher") {
      const [t, options] = await Promise.all([loadTeacher(id), loadOptions()]);
      const spec: Partial<DrawerSpec> = {
        mode: "view", kicker: "Attendance · by teacher", title: t.name, sub: "Everything this teacher answers for, and how they are doing it.",
        facts: teacherFacts(t), readOnly: true,
        edit: notifyPersonDrawer({ id: t.id, name: t.name, role: "Form master", phone: t.phone, email: t.email, kicker: "Attendance", owes: t.row && t.row.todayMissing ? `${t.row.todayMissing} ${t.row.todayMissing === 1 ? "register" : "registers"} still unmarked` : "Their registers", items: t.row?.todayMissing ?? 0, oldest: "Today", last: t.lastNotified ?? "Never", href: "/attendance/mark", school: options.school || "the school" }),
        editLabel: "Notify them",
      };
      return NextResponse.json(spec);
    }
    if (kind === "explanation") {
      const detail = await apiGet<ExplanationDetail>(`${AT}/explanations/${encodeURIComponent(id)}`);
      return NextResponse.json(detail.open ? decideExplanationDrawer(detail) : viewExplanationDrawer(detail));
    }
    return NextResponse.json({ error: "That record is not one Attendance opens." }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "That record could not be read." }, { status: 403 });
  }
}
