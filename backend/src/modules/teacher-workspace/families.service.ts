import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { CasesService } from "../attendance-management/cases.service";
import { armName, fullName } from "../fee-management/fees.shared";
import { deliveryOf, guardianPortal } from "../guardian-management/guardians.shared";
import { daysSince } from "../student-records/records.shared";
import { TeacherWorkspaceService } from "./workspace.service";

/**
 * Guardians, as a form master holds them: a number to call, and what the families of their class have sent in. Contact details only —
 * never a fee, never consent files, never a restricted contact (which is simply not here, and the teacher is not told why).
 */
@Injectable()
export class TeacherFamiliesService {
  constructor(private readonly workspace: TeacherWorkspaceService, private readonly cases: CasesService) {}

  private async classes(session: SessionPayload) {
    const me = await this.workspace.me(session);
    return { me, ids: me.formArms.map((arm) => arm.id) };
  }

  async guardians(session: SessionPayload) {
    const { me, ids } = await this.classes(session);
    if (!ids.length) return { arms: [], rows: [], kpis: { households: 0, reachable: 0, noPhone: 0, otherLanguage: 0 } };
    const links = await prisma.studentGuardian.findMany({
      where: { student: { schoolId: session.schoolId, currentClassId: { in: ids }, status: "ACTIVE" }, guardian: { mergedIntoId: null, safeguardingRestrictedAt: null } },
      include: { student: { select: { id: true, firstName: true, lastName: true, currentClass: { select: { name: true, arm: true } } } }, guardian: { include: { user: { select: { lastLoginAt: true } } } } },
      orderBy: [{ guardian: { lastName: "asc" } }]
    });
    const byGuardian = new Map<string, { guardian: (typeof links)[number]["guardian"]; relation: string; children: Array<{ id: string; name: string; arm: string }> }>();
    for (const link of links) {
      const entry = byGuardian.get(link.guardianId) ?? { guardian: link.guardian, relation: link.relation ?? link.guardian.relationship, children: [] };
      entry.children.push({ id: link.student.id, name: fullName(link.student), arm: link.student.currentClass ? armName(link.student.currentClass) : "No arm" });
      byGuardian.set(link.guardianId, entry);
    }
    const rows = [...byGuardian.entries()].map(([id, entry]) => ({
      id, name: fullName(entry.guardian), relation: entry.relation, phone: entry.guardian.phone, children: entry.children, portal: guardianPortal(entry.guardian.user), delivery: deliveryOf(entry.guardian),
      language: entry.guardian.language, channel: entry.guardian.canReceiveSms ? (entry.guardian.canReceiveEmail ? "SMS or email" : "SMS") : entry.guardian.canReceiveEmail ? "Email" : "In-app", phoneOnly: entry.guardian.phoneOnly
    }));
    return {
      arms: me.formArms, rows,
      kpis: { households: rows.length, reachable: rows.filter((row) => row.portal === "Active").length, noPhone: rows.filter((row) => !row.phone?.trim()).length, otherLanguage: rows.filter((row) => row.language !== "English").length }
    };
  }

  async submissions(session: SessionPayload) {
    const { me, ids } = await this.classes(session);
    if (!ids.length) return { arms: [], items: [], kpis: { waiting: 0, decided: 0, median: null, withoutEvidence: 0 }, oldest: 0 };
    const rows = await prisma.guardianSubmission.findMany({
      where: { schoolId: session.schoolId, student: { currentClassId: { in: ids } } },
      include: { guardian: { select: { firstName: true, lastName: true, relationship: true } }, student: { select: { id: true, firstName: true, lastName: true, currentClass: { select: { name: true, arm: true } } } } },
      orderBy: { createdAt: "desc" }, take: 60
    });
    const term = await prisma.term.findFirst({ where: { schoolId: session.schoolId, isCurrent: true }, select: { startDate: true } });
    const items = [];
    for (const row of rows) {
      const open = row.state !== "RESOLVED" && row.state !== "DECLINED";
      const absence = row.type === "Absence explanation";
      items.push({
        id: row.id, type: row.type, child: row.student ? fullName(row.student) : "—", childId: row.studentId, arm: row.student?.currentClass ? armName(row.student.currentClass) : "",
        guardian: fullName(row.guardian), relation: row.guardian.relationship, detail: row.detail, state: open ? "New" : row.state === "DECLINED" ? "Declined" : "Resolved", open, canDecide: open && absence,
        days: daysSince(row.createdAt), outcome: row.outcome, at: row.createdAt.toISOString(), decidedAt: row.resolvedAt?.toISOString() ?? null,
        absences: open && absence && row.studentId ? await this.cases.openAbsences(session, row.studentId) : []
      });
    }
    const decided = rows.filter((row) => row.resolvedAt && (!term || row.resolvedAt >= term.startDate));
    const spans = decided.map((row) => ((row.resolvedAt as Date).getTime() - row.createdAt.getTime()) / 86_400_000).sort((a, b) => a - b);
    const open = items.filter((item) => item.open);
    return {
      arms: me.formArms, items,
      kpis: { waiting: open.length, decided: decided.length, accepted: decided.filter((row) => row.state === "RESOLVED").length, declined: decided.filter((row) => row.state === "DECLINED").length, median: spans.length ? Math.round(spans[Math.floor(spans.length / 2)]! * 10) / 10 : null, withoutEvidence: open.filter((item) => item.canDecide).length },
      oldest: open.reduce((max, item) => Math.max(max, item.days), 0)
    };
  }

  /** Decide one explanation from the class: accept (naming the days it covers) or decline (with a reason the family reads). */
  async decide(session: SessionPayload, id: string, body: Record<string, unknown>) {
    const { ids } = await this.classes(session);
    const row = await prisma.guardianSubmission.findFirst({ where: { id, schoolId: session.schoolId }, select: { type: true, student: { select: { currentClassId: true } } } });
    if (!row) throw new NotFoundException("That submission does not exist.");
    if (!row.student?.currentClassId || !ids.includes(row.student.currentClassId)) throw new ForbiddenException("That child is not in a class you are form master of, so the submission is not yours to decide.");
    if (row.type !== "Absence explanation") throw new BadRequestException(`A ${row.type.toLowerCase()} is decided by the office, not from a class.`);
    return this.cases.decideExplanation(session, id, body);
  }
}
