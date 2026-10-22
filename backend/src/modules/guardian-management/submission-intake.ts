import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { prisma } from "../../../../src/lib/db/prisma";
import { ConfigStore } from "../staff-access/staff-access.shared";
import { fullName } from "../student-records/records.shared";
import { notifyStaff } from "../attendance-management/attendance.shared";
import { SUBMISSION_DEFAULTS, type SubmissionType } from "./submissions.service";

const REVIEWER_ROLES: Record<string, string[]> = {
  Registrar: ["ADMIN_OFFICER", "ADMISSIONS_OFFICER"],
  Bursar: ["BURSAR", "ACCOUNTANT", "ACCOUNT_OFFICER"],
  "Exam Officer": ["EXAM_OFFICER", "EXAMINATION_OFFICER"],
  Principal: ["PRINCIPAL"],
  "Form master": ["CLASS_TEACHER"],
};

/** The submission types a school accepts, with how fast it promises to answer and who reviews each: the school's own list, or the defaults. */
export async function submissionTypes(schoolId: string): Promise<SubmissionType[]> {
  const rows = await new ConfigStore(schoolId, "submission-types").list<SubmissionType>();
  if (!rows.length) return SUBMISSION_DEFAULTS;
  // A school that edited its list before a type existed still gets the types the product added since — they are only hidden if it switched them off.
  const own = rows.map((row) => ({ ...row.data, name: row.name }));
  return [...own, ...SUBMISSION_DEFAULTS.filter((entry) => !own.some((item) => item.name === entry.name))];
}

export type Intake = {
  guardianId: string; childId?: string | null; type: string; detail: string; channel: string;
  evidence?: string | null; dates?: string[]; payload?: Prisma.InputJsonValue; deliveryId?: string | null; owner?: string | null;
  /** A reply to a message goes to the office whatever the school's list says — it is not a type a family chooses. */
  office?: boolean;
};

/**
 * Something a family sent in, given an owner and a clock: the form master of the child's class where the type is theirs, otherwise whoever
 * holds the reviewing role. The owner is told in-app at once — a family who wrote in is already waiting.
 */
export async function openSubmission(schoolId: string, input: Intake) {
  const types = await submissionTypes(schoolId);
  const type = input.office ? { name: input.type, target: 2, reviewer: "Registrar", accepted: true } : types.find((entry) => entry.name === input.type);
  if (!type) throw new BadRequestException("That is not a type of submission.");
  if (!type.accepted) throw new BadRequestException(`${type.name} is not accepted here — it is handled in person.`);
  const guardian = await prisma.guardian.findFirst({ where: { id: input.guardianId, schoolId } });
  if (!guardian) throw new BadRequestException("That family is not in this school.");
  let owner = input.owner ? await prisma.user.findFirst({ where: { schoolId, id: input.owner }, select: { id: true, firstName: true, lastName: true, role: true } }) : null;
  if (!owner) {
    const roles = REVIEWER_ROLES[type.reviewer] ?? [];
    if (type.reviewer === "Form master" && input.childId) {
      const child = await prisma.student.findFirst({ where: { id: input.childId, schoolId }, select: { currentClass: { select: { classTeacherId: true } } } });
      const teacher = child?.currentClass?.classTeacherId;
      if (teacher) owner = await prisma.user.findFirst({ where: { id: teacher }, select: { id: true, firstName: true, lastName: true, role: true } });
    }
    if (!owner && roles.length) owner = await prisma.user.findFirst({ where: { schoolId, isActive: true, role: { in: roles as never[] } }, select: { id: true, firstName: true, lastName: true, role: true } });
  }
  const created = await prisma.guardianSubmission.create({
    data: {
      schoolId, guardianId: guardian.id, studentId: input.childId || null, type: type.name, detail: input.detail, state: owner ? "ASSIGNED" : "NEW", ownerUserId: owner?.id, ownerName: owner ? fullName(owner) : null, ownerRole: type.reviewer,
      channel: input.channel, evidence: input.evidence || null, dates: input.dates ?? [], payload: input.payload, deliveryId: input.deliveryId || null,
    },
  });
  if (owner) await notifyStaff(schoolId, guardian.userId ?? owner.id, [owner.id], { title: `From ${fullName(guardian)}: ${type.name.toLowerCase()}`, body: input.detail.slice(0, 200), channels: ["In-app"], link: type.reviewer === "Form master" ? "/guardians/submissions" : undefined });
  return { id: created.id, owner: owner ? fullName(owner) : null, type: type.name };
}
