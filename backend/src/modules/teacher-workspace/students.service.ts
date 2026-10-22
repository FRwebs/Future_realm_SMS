import { Injectable, NotFoundException } from "@nestjs/common";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { loadPolicy } from "../attendance-management/attendance.shared";
import { armName, fullName } from "../fee-management/fees.shared";
import { initials, portalOf } from "../student-records/records.shared";
import { SupportPlansService } from "../student-records/support-plans.service";
import { TeacherWorkspaceService } from "./workspace.service";

/**
 * "My students": the children this person is answerable for — their class in full, and the children they teach — and nobody else's.
 * Wellbeing is a flag and nothing behind it, family is a number to call, and a fee is never shown: the emergency flag is enough for a
 * child's safety and deliberately not enough for a staff room conversation.
 */
@Injectable()
export class TeacherStudentsService {
  constructor(private readonly workspace: TeacherWorkspaceService, private readonly plans: SupportPlansService) {}

  async students(session: SessionPayload) {
    const me = await this.workspace.me(session);
    if (!me.term) throw new NotFoundException("No term is current, so there is no class to read.");
    const schoolId = session.schoolId;
    const policy = await loadPolicy(schoolId);
    const ownIds = [...me.formArms.map((arm) => arm.id), ...me.assistantArms.map((arm) => arm.id)];
    const taughtIds = [...new Set(me.teaching.map((row) => row.classId))].filter((id) => !ownIds.includes(id));
    const classIds = [...ownIds, ...taughtIds];
    if (!classIds.length) return { persona: me.persona, formArms: me.formArms, assistantArms: me.assistantArms, taught: [], rows: [], policy: { chronic: policy.chronic, target: policy.target }, kpis: { children: 0, belowLine: 0, medical: 0, support: 0, notActivated: 0 } };

    const students = await prisma.student.findMany({
      where: { schoolId, currentClassId: { in: classIds }, status: "ACTIVE" },
      select: {
        id: true, firstName: true, lastName: true, admissionNumber: true, currentClassId: true, currentClass: { select: { name: true, arm: true } },
        medicalRecord: { select: { conditions: true, allergies: true } },
        guardians: { select: { isPrimary: true, relation: true, guardian: { select: { id: true, firstName: true, lastName: true, phone: true, relationship: true, user: { select: { lastLoginAt: true } } } } } }
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    });
    const marks = await prisma.studentAttendance.groupBy({ by: ["studentId", "status"], where: { schoolId, termId: me.term.id, subjectId: null, studentId: { in: students.map((student) => student.id) } }, _count: { _all: true } });
    const tally = new Map<string, { counted: number; ok: number }>();
    for (const row of marks) {
      if (row.status === "EXCUSED") continue;
      const entry = tally.get(row.studentId) ?? { counted: 0, ok: 0 };
      entry.counted += row._count._all;
      if (row.status !== "ABSENT") entry.ok += row._count._all;
      tally.set(row.studentId, entry);
    }
    const withPlan = await this.plans.activeFor(schoolId, students.map((student) => student.id));
    const rows = students.map((student, index) => {
      const link = student.guardians.find((entry) => entry.isPrimary) ?? student.guardians[0];
      const t = tally.get(student.id);
      const attendance = t?.counted ? Math.round((t.ok / t.counted) * 1000) / 10 : null;
      const medical = Boolean(student.medicalRecord && (student.medicalRecord.conditions?.trim() || student.medicalRecord.allergies?.trim()));
      const flags = [...(medical ? ["Medical alert"] : []), ...(withPlan.has(student.id) ? ["Learning support"] : []), ...(attendance !== null && attendance < policy.chronic ? ["Chronic absence"] : [])];
      return {
        id: student.id, roll: index + 1, name: fullName(student), initials: initials(fullName(student)), adm: student.admissionNumber, classId: student.currentClassId, arm: student.currentClass ? armName(student.currentClass) : "No arm",
        own: ownIds.includes(student.currentClassId ?? ""), attendance, flags,
        guardian: link ? { id: link.guardian.id, name: fullName(link.guardian), relation: link.relation ?? link.guardian.relationship, phone: link.guardian.phone, portal: portalOf(link.guardian.user) } : null
      };
    });
    return {
      persona: me.persona, formArms: me.formArms, assistantArms: me.assistantArms, taught: me.teaching, policy: { chronic: policy.chronic, target: policy.target }, rows,
      kpis: {
        children: rows.length, belowLine: rows.filter((row) => row.attendance !== null && row.attendance < policy.chronic).length, medical: rows.filter((row) => row.flags.includes("Medical alert")).length, support: rows.filter((row) => row.flags.includes("Learning support")).length,
        notActivated: rows.filter((row) => row.guardian && row.guardian.portal !== "Active").length
      }
    };
  }
}
