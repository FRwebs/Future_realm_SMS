import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { z } from "zod";

import { prisma } from "../../../../src/lib/db/prisma";
import { getDemoStore } from "../../../../src/lib/demo/data";
import { AttendanceRecordView } from "../../../../src/lib/domain/types";
import { sendNotification } from "../../../../src/lib/integrations/notifications";
import { formatNigeriaClassName, normalizeNigeriaClassValue } from "../../../../src/lib/school-options";
import { env } from "../../../../src/lib/utils/env";

const nigeriaClassInputSchema = z
  .string()
  .min(2)
  .refine((value) => Boolean(normalizeNigeriaClassValue(value)), "Select a valid Nigerian class.");

export const attendanceSchema = z.object({
  studentId: z.string().optional(),
  studentName: z.string().min(2),
  className: nigeriaClassInputSchema,
  subject: z.string().min(2),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
  reason: z.string().optional()
});

@Injectable()
export class AttendanceService {
  async listAttendance(schoolId: string) {
    if (env.DEMO_MODE) {
      return getDemoStore().attendance;
    }

    const attendance = await prisma.studentAttendance.findMany({
      where: { schoolId },
      include: {
        student: true,
        classRoom: true
      },
      orderBy: { date: "desc" },
      take: 50
    });

    return attendance.map<AttendanceRecordView>((item) => ({
      id: item.id,
      studentId: item.studentId,
      studentName: `${item.student.firstName} ${item.student.lastName}`,
      className: formatNigeriaClassName(item.classRoom.arm ? `${item.classRoom.name} - ${item.classRoom.arm}` : item.classRoom.name),
      subject: "General attendance",
      status: item.status,
      date: item.date.toISOString(),
      reason: item.reason ?? undefined
    }));
  }

  async recordAttendance(schoolId: string, markedById: string, payload: unknown) {
    const parsed = attendanceSchema.parse(payload);
    const className = formatNigeriaClassName(parsed.className);

    if (env.DEMO_MODE) {
      const record: AttendanceRecordView = {
        id: randomUUID(),
        studentId: parsed.studentId ?? randomUUID(),
        studentName: parsed.studentName,
        className,
        subject: parsed.subject,
        status: parsed.status,
        date: new Date().toISOString(),
        reason: parsed.reason
      };
      getDemoStore().attendance.unshift(record);
      if (record.status === "ABSENT") {
        await sendNotification({
          channel: "SMS",
          recipient: "parent",
          title: "Attendance alert",
          body: `${record.studentName} was marked absent in ${record.className}.`
        });
      }
      return record;
    }

    const student = parsed.studentId
      ? await prisma.student.findUnique({
          where: { id: parsed.studentId },
          include: { currentClass: true }
        })
      : null;
    const term = await prisma.term.findFirst({
      where: {
        schoolId,
        isCurrent: true
      }
    });

    if (!student?.currentClassId || !term) {
      throw new Error("Student or active term not available");
    }

    const record = await prisma.studentAttendance.create({
      data: {
        schoolId,
        studentId: student.id,
        classId: student.currentClassId,
        termId: term.id,
        markedById,
        date: new Date(),
        status: parsed.status,
        reason: parsed.reason
      },
      include: {
        student: true,
        classRoom: true
      }
    });

    return {
      id: record.id,
      studentId: record.studentId,
      studentName: `${record.student.firstName} ${record.student.lastName}`,
      className: formatNigeriaClassName(record.classRoom.arm ? `${record.classRoom.name} - ${record.classRoom.arm}` : record.classRoom.name),
      subject: parsed.subject,
      status: record.status,
      date: record.date.toISOString(),
      reason: record.reason ?? undefined
    };
  }
}
