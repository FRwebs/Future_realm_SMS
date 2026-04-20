import { Injectable } from "@nestjs/common";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import type { ParentDirectoryRecordView } from "../../../../src/lib/domain/types";
import { formatNigeriaClassName } from "../../../../src/lib/school-options";

function studentName(student: { firstName: string; middleName?: string | null; lastName: string }) {
  return [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
}

function className(classRoom?: { name: string; arm?: string | null } | null) {
  if (!classRoom) return "Unassigned";
  return formatNigeriaClassName(classRoom.arm ? `${classRoom.name} - ${classRoom.arm}` : classRoom.name);
}

@Injectable()
export class ParentsService {
  async listParents(session: SessionPayload): Promise<ParentDirectoryRecordView[]> {
    const teacherScopedRoles = new Set(["TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER"]);
    const guardianWhere =
      teacherScopedRoles.has(session.role)
        ? {
            schoolId: session.schoolId,
            students: {
              some: {
                student: {
                  currentClass: {
                    OR: [
                      { classTeacherId: session.userId },
                      { assistantClassTeacherId: session.userId },
                      { classSubjects: { some: { teacherId: session.userId } } },
                    ],
                  },
                },
              },
            },
          }
        : { schoolId: session.schoolId };

    const guardians = await prisma.guardian.findMany({
      where: guardianWhere,
      include: {
        students: {
          include: {
            student: { include: { currentClass: true } },
          },
          orderBy: { student: { admissionNumber: "asc" } },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return guardians.map((guardian) => ({
      id: guardian.id,
      parentName: `${guardian.firstName} ${guardian.lastName}`,
      relationship: guardian.relationship,
      phone: guardian.phone,
      email: guardian.email ?? undefined,
      occupation: guardian.occupation ?? undefined,
      address: guardian.address ?? undefined,
      canReceiveSms: guardian.canReceiveSms,
      canReceiveEmail: guardian.canReceiveEmail,
      linkedChildren: guardian.students.map((link) => ({
        studentId: link.student.id,
        studentName: studentName(link.student),
        className: className(link.student.currentClass),
        admissionNumber: link.student.admissionNumber,
      })),
    }));
  }
}
