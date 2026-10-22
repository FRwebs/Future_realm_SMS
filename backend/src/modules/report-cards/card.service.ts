import { Injectable, NotFoundException } from "@nestjs/common";
import { assertClassReadable } from "../../common/teaching-scope";
import { AuditAction, Prisma } from "@prisma/client";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { currentTerm, dayOf, iso, longDay } from "../attendance-management/attendance.shared";
import { notifyGuardian } from "../guardian-management/guardians.shared";
import { type ArmData, loadArm, studentResults } from "../score-results/arm";
import { CREDIT_MARK, fullName, gradeOf, round2 } from "../score-results/scores.shared";
import { type RemarkRow, cardReference, remarkState } from "./cards.shared";

/**
 * The card itself. A published card is a snapshot — what the family holds — so a score changing later
 * cannot quietly change it; a correction adds a revision beside it. A card not yet published is read
 * live, and says it is a draft.
 */

export type Term = { id: string; name: string; session: string; sessionId: string; startDate: Date; endDate: Date };

export type CardData = {
  version: 2;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  gender: string;
  dob: string | null;
  classId: string;
  className: string;
  arm: string;
  formMaster: string | null;
  term: string;
  termId: string;
  session: string;
  attendance: { days: number; present: number; absent: number; pct: number | null };
  subjects: Array<{
    subjectId: string; subject: string; teacher: string | null;
    components: Array<{ name: string; short: string; max: number; score: number | "ABS" | null }>;
    total: number | null; grade: string | null; remark: string; pos: number | null; outOf: number; classAvg: number | null; caTotal: number | null; examTotal: number | null;
  }>;
  total: number;
  average: number | null;
  grade: string | null;
  gradeRemark: string | null;
  position: number | null;
  outOf: number;
  passed: number;
  credits: number;
  expected: number;
  classTeacherRemark: string;
  principalRemark: string;
  classTeacherBy: string | null;
  principalBy: string | null;
  traits: Array<{ title: string; items: Array<{ label: string; value: string }> }>;
  resumption: string | null;
  issuedAt: string | null;
  scheme: string;
  frameworkNote: string;
  promotionStatus: string | null;
};

@Injectable()
export class CardService {
  async term(schoolId: string, termId?: string): Promise<Term> {
    const term = termId ? await prisma.term.findFirst({ where: { id: termId, schoolId }, include: { academicSession: { select: { name: true } } } }) : await currentTerm(schoolId);
    if (!term) throw new NotFoundException("No term is current, so there are no cards to read. Set one in School Configuration.");
    return { id: term.id, name: term.name, session: term.academicSession?.name ?? "", sessionId: term.academicSessionId, startDate: term.startDate, endDate: term.endDate };
  }

  /** Builds the card for one child from the arm's sheets. `approvedOnly` is what is published; a draft preview reads what is entered. */
  async build(schoolId: string, term: Term, arm: ArmData, studentId: string, approvedOnly: boolean): Promise<CardData> {
    const student = await prisma.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true, firstName: true, middleName: true, lastName: true, admissionNumber: true, gender: true, dateOfBirth: true } });
    if (!student) throw new NotFoundException("That child is not in this school.");
    const results = studentResults(arm, approvedOnly);
    const mine = results.find((entry) => entry.id === studentId);
    const [attendance, sheet, remarks, room, next, skills] = await Promise.all([
      prisma.studentAttendance.groupBy({ by: ["status"], where: { schoolId, studentId, termId: term.id, subjectId: null }, _count: { _all: true } }),
      prisma.resultSheet.findFirst({ where: { schoolId, studentId, termId: term.id }, select: { teacherComment: true, principalComment: true } }),
      prisma.reportRemark.findMany({ where: { schoolId, studentId, termId: term.id, state: "SUBMITTED" } }),
      prisma.classRoom.findFirst({ where: { id: arm.room.id }, select: { classTeacher: { select: { firstName: true, lastName: true } } } }),
      prisma.term.findFirst({ where: { schoolId, startDate: { gt: term.endDate } }, orderBy: { startDate: "asc" }, select: { startDate: true } }),
      prisma.studentSkill.findMany({ where: { schoolId, studentId, termId: term.id }, include: { skill: { select: { name: true, category: true, displayOrder: true } } } })
    ]);
    const days = attendance.reduce((total, row) => total + row._count._all, 0);
    const absent = attendance.find((row) => row.status === "ABSENT")?._count._all ?? 0;
    const excused = attendance.find((row) => row.status === "EXCUSED")?._count._all ?? 0;
    const counted = days - excused;
    const present = counted - absent;
    const remarkOf = (author: string) => remarkState(remarks.find((row) => row.author === author) as RemarkRow | undefined, author === "FORM_MASTER" ? sheet?.teacherComment : sheet?.principalComment);

    const subjects = arm.subjects.map((subject) => {
      const row = subject.rows.find((entry) => entry.id === studentId);
      const usable = !approvedOnly || subject.state === "Approved";
      const total = usable ? row?.total ?? null : null;
      const grade = total === null ? null : gradeOf(arm.bands, total);
      const exam = subject.columns.filter((column) => column.exam).reduce((sum, column) => (typeof row?.cells[column.key] === "number" ? sum + (row?.cells[column.key] as number) : sum), 0);
      const ca = subject.columns.filter((column) => !column.exam).reduce((sum, column) => (typeof row?.cells[column.key] === "number" ? sum + (row?.cells[column.key] as number) : sum), 0);
      return {
        subjectId: subject.subjectId, subject: subject.name, teacher: subject.teacher,
        components: subject.columns.map((column) => ({ name: column.name, short: column.short, max: column.max, score: usable ? (row?.cells[column.key] ?? null) : null })),
        total, grade: grade?.label ?? null, remark: grade?.remark ?? (total === null ? "Awaiting the score sheet" : ""), pos: usable ? row?.pos ?? null : null, outOf: subject.scored, classAvg: usable ? subject.mean : null,
        caTotal: total === null ? null : round2(ca), examTotal: total === null ? null : round2(exam), counts: subject.counts
      };
    });
    const counting = subjects.filter((entry) => entry.counts && entry.total !== null);
    const sum = round2(counting.reduce((total, entry) => total + (entry.total as number), 0));
    const average = mine?.average ?? null;
    const grouped = new Map<string, Array<{ label: string; value: string; order: number }>>();
    for (const skill of skills) grouped.set(skill.skill.category, [...(grouped.get(skill.skill.category) ?? []), { label: skill.skill.name, value: String(skill.rating), order: skill.skill.displayOrder }]);
    const fmRow = remarks.find((row) => row.author === "FORM_MASTER");
    const prRow = remarks.find((row) => row.author === "PRINCIPAL");
    const names = await prisma.user.findMany({ where: { id: { in: [fmRow?.authorId ?? "", prRow?.authorId ?? ""].filter(Boolean) } }, select: { id: true, firstName: true, lastName: true } });
    const nameOf = (id: string | undefined) => (id ? fullName(names.find((user) => user.id === id)) || null : null);

    return {
      version: 2, studentId, studentName: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "), admissionNumber: student.admissionNumber,
      gender: student.gender === "MALE" ? "Male" : student.gender === "FEMALE" ? "Female" : "Other", dob: student.dateOfBirth ? iso(dayOf(student.dateOfBirth)) : null,
      classId: arm.room.id, className: arm.room.levelName, arm: arm.room.name, formMaster: room?.classTeacher ? fullName(room.classTeacher) : null,
      term: term.name, termId: term.id, session: term.session, attendance: { days, present, absent, pct: counted > 0 ? Math.round((present / counted) * 1000) / 10 : null },
      subjects: subjects.map((entry) => ({ subjectId: entry.subjectId, subject: entry.subject, teacher: entry.teacher, components: entry.components, total: entry.total, grade: entry.grade, remark: entry.remark, pos: entry.pos, outOf: entry.outOf, classAvg: entry.classAvg, caTotal: entry.caTotal, examTotal: entry.examTotal })),
      total: sum, average, grade: mine?.grade ?? null, gradeRemark: average === null ? null : gradeOf(arm.bands, average)?.remark ?? null, position: mine?.pos ?? null, outOf: results.filter((entry) => entry.average !== null).length,
      passed: counting.filter((entry) => (entry.total as number) >= arm.passMark).length, credits: counting.filter((entry) => (entry.total as number) >= CREDIT_MARK).length, expected: subjects.filter((entry) => entry.counts).length,
      classTeacherRemark: remarkOf("FORM_MASTER").text, principalRemark: remarkOf("PRINCIPAL").text, classTeacherBy: nameOf(fmRow?.authorId), principalBy: nameOf(prRow?.authorId),
      traits: Array.from(grouped.entries()).map(([title, items]) => ({ title, items: items.sort((a, b) => a.order - b.order).map(({ label, value }) => ({ label, value })) })),
      resumption: next ? iso(dayOf(next.startDate)) : null, issuedAt: null, scheme: arm.scheme, frameworkNote: `Graded on ${arm.scheme}. Pass mark ${arm.passMark}.`, promotionStatus: null
    };
  }

  /** The card as it should be shown: what the family holds if it is published, otherwise a live draft. */
  async view(session: SessionPayload, studentId: string, termId?: string) {
    const schoolId = session.schoolId;
    const term = await this.term(schoolId, termId);
    const student = await prisma.student.findFirst({ where: { id: studentId, schoolId }, select: { currentClassId: true } });
    if (!student) throw new NotFoundException("That child is not in this school.");
    if (student.currentClassId) await assertClassReadable(session, student.currentClassId, "that child's arm");
    const sheet = await prisma.resultSheet.findFirst({ where: { schoolId, studentId, termId: term.id }, select: { id: true, classId: true, status: true, publishedAt: true } });
    const classId = student.currentClassId ?? sheet?.classId;
    if (!classId) throw new NotFoundException("That child sits in no arm, so there is no card to show.");
    const [card, school, revisions] = await Promise.all([
      prisma.reportCard.findFirst({ where: { schoolId, studentId, termId: term.id } }),
      prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, address: true, city: true, mainPhone: true, ownerEmail: true } }),
      prisma.reportCardRevision.findMany({ where: { schoolId, studentId, termId: term.id }, orderBy: { revision: "asc" }, select: { revision: true, kind: true, reason: true, createdAt: true, notified: true } })
    ]);
    const published = sheet?.status === "PUBLISHED" || Boolean(sheet?.publishedAt) || card?.status === "PUBLISHED";
    const snapshot = published && card && (card.data as { version?: number })?.version === 2 ? (card.data as unknown as CardData) : null;
    let data = snapshot;
    let live = false;
    if (!data) {
      const arm = await loadArm(schoolId, term, classId);
      if (!arm) throw new NotFoundException("That arm is not in this school.");
      data = await this.build(schoolId, term, arm, studentId, published);
      live = true;
    }
    const peers = await prisma.student.findMany({ where: { schoolId, currentClassId: classId, status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: 40 });
    const withheld = Boolean(card?.withheldAt) && !published;
    return {
      school: { name: school?.name ?? "", place: [school?.address, school?.city].filter(Boolean).join(", "), contact: [school?.mainPhone, school?.ownerEmail].filter(Boolean).join(" · ") },
      card: data, live, snapshot: !live,
      state: published ? (card && card.revision > 1 ? "Revised" : "Published") : withheld ? "Withheld" : "Draft",
      revision: card?.revision ?? 1, reference: card?.reference ?? cardReference(data.admissionNumber, term.name), published: card?.publishedAt?.toISOString() ?? sheet?.publishedAt?.toISOString() ?? null,
      withheldReason: card?.withheldReason ?? null, delivery: card?.deliveryState ?? null, revisions: revisions.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() })),
      peers: peers.map((peer) => ({ id: peer.id, name: fullName(peer) })), term: { id: term.id, name: term.name, session: term.session }, generated: longDay(new Date())
    };
  }

  /**
   * A correction after publishing: a new revision stored beside the original, the card's snapshot brought up to
   * date from the approved sheets, and the family told what changed and why. The earlier version is kept.
   */
  async reissue(schoolId: string, actorId: string, studentId: string, termId: string, reason: string, kind: "CORRECTION" | "REISSUE" = "CORRECTION") {
    const term = await this.term(schoolId, termId);
    const student = await prisma.student.findFirst({ where: { id: studentId, schoolId }, select: { currentClassId: true } });
    if (!student?.currentClassId) return null;
    const arm = await loadArm(schoolId, term, student.currentClassId);
    if (!arm) return null;
    const data = await this.build(schoolId, term, arm, studentId, true);
    const existing = await prisma.reportCard.findFirst({ where: { schoolId, studentId, termId } });
    const stamp = new Date();
    const nextRevision = existing ? existing.revision + 1 : 1;
    const json = { ...data, issuedAt: stamp.toISOString() } as unknown as Prisma.InputJsonValue;
    const card = existing
      ? await prisma.reportCard.update({ where: { id: existing.id }, data: { data: json, revision: nextRevision, status: "PUBLISHED", publishedAt: existing.publishedAt ?? stamp, lockedAt: stamp } })
      : await prisma.reportCard.create({ data: { schoolId, studentId, termId, classId: student.currentClassId, status: "PUBLISHED", data: json, publishedAt: stamp, lockedAt: stamp, revision: 1, reference: cardReference(data.admissionNumber, term.name), publishedById: actorId, generatedById: actorId } });
    const links = await prisma.studentGuardian.findMany({ where: { studentId }, select: { guardianId: true } });
    let told = 0;
    for (const link of links) {
      const sent = await notifyGuardian(schoolId, link.guardianId, "A revised report card", `${data.studentName}'s ${term.name} report card was revised (revision ${card.revision}): ${reason}. The earlier version is kept on record.`, ["In-app", "SMS"]);
      if (sent.sent.length) told += 1;
    }
    await prisma.reportCardRevision.create({ data: { schoolId, cardId: card.id, studentId, termId, revision: card.revision, kind, reason, data: json, createdById: actorId, notified: told > 0 } });
    await prisma.auditLog.create({ data: { schoolId, actorId, action: AuditAction.UPDATE, entityType: "ReportCard", entityId: card.id, metadata: { summary: `Report card revised · ${data.studentName} · revision ${card.revision}`, reason } } });
    return { cardId: card.id, revision: card.revision, told };
  }
}

