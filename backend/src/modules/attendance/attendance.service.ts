import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";

import { prisma } from "../../../../src/lib/db/prisma";
import type { AttendanceRecordView } from "../../../../src/lib/domain/types";
import { sendNotification } from "../../../../src/lib/integrations/notifications";
import { formatNigeriaClassName, normalizeNigeriaClassValue } from "../../../../src/lib/school-options";

const nigeriaClassInputSchema = z
  .string()
  .min(2)
  .refine((value) => Boolean(normalizeNigeriaClassValue(value)), "Select a valid Nigerian class.");

export const attendanceSchema = z.object({
  studentId: z.string().optional(),
  studentName: z.string().min(2).optional(),
  classId: z.string().optional(),
  className: nigeriaClassInputSchema.optional(),
  subjectId: z.string().optional(),
  subject: z.string().min(2).optional(),
  date: z.coerce.date().optional(),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
  reason: z.string().optional()
});

type AttendanceFilters = {
  classId?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  termId?: string;
  studentId?: string;
  status?: string;
};

function formatClassName(classRoom?: { name: string; arm?: string | null } | null) {
  if (!classRoom) return "Unassigned";
  return formatNigeriaClassName(classRoom.arm ? `${classRoom.name} - ${classRoom.arm}` : classRoom.name);
}

function normalizeAttendanceDate(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

@Injectable()
export class AttendanceService {
  async listAttendance(schoolId: string, filters: AttendanceFilters = {}) {
    const status = ["PRESENT", "ABSENT", "LATE", "EXCUSED"].includes(filters.status ?? "")
      ? (filters.status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED")
      : undefined;
    const term = filters.termId
      ? null
      : await prisma.term.findFirst({
          where: { schoolId, isCurrent: true },
          select: { id: true }
        });

    const attendance = await prisma.studentAttendance.findMany({
      where: {
        schoolId,
        ...(filters.termId ? { termId: filters.termId } : term?.id ? { termId: term.id } : {}),
        ...(filters.classId ? { classId: filters.classId } : {}),
        ...(filters.studentId ? { studentId: filters.studentId } : {}),
        ...(status ? { status } : {}),
        ...(filters.date ? { date: normalizeAttendanceDate(new Date(filters.date)) } : {}),
        ...(filters.startDate && filters.endDate
          ? {
              date: {
                gte: normalizeAttendanceDate(new Date(filters.startDate)),
                lte: normalizeAttendanceDate(new Date(filters.endDate))
              }
            }
          : {})
      },
      include: {
        student: true,
        classRoom: true,
        markedBy: { select: { firstName: true, lastName: true } },
        term: { select: { name: true } }
      },
      orderBy: { date: "desc" },
      take: 250
    });
    const subjectIds = attendance.flatMap((item) => (item.subjectId ? [item.subjectId] : []));
    const subjects = subjectIds.length
      ? await prisma.subject.findMany({
          where: { schoolId, id: { in: subjectIds } },
          select: { id: true, name: true }
        })
      : [];
    const subjectsById = new Map(subjects.map((subject) => [subject.id, subject.name]));

    return attendance.map<AttendanceRecordView>((item) => ({
      id: item.id,
      studentId: item.studentId,
      studentName: `${item.student.firstName} ${item.student.lastName}`,
      classId: item.classId,
      className: formatClassName(item.classRoom),
      subjectId: item.subjectId ?? undefined,
      subject: item.subjectId ? subjectsById.get(item.subjectId) ?? "Subject attendance" : "Morning attendance",
      status: item.status,
      date: item.date.toISOString(),
      reason: item.reason ?? undefined,
      markedByName: `${item.markedBy.firstName} ${item.markedBy.lastName}`,
      termName: item.term.name
    }));
  }

  async summarizeAttendance(schoolId: string, filters: AttendanceFilters = {}) {
    const term = filters.termId
      ? null
      : await prisma.term.findFirst({
          where: { schoolId, isCurrent: true },
          select: { id: true }
        });

    const records = await prisma.studentAttendance.findMany({
      where: {
        schoolId,
        subjectId: null,
        ...(filters.termId ? { termId: filters.termId } : term?.id ? { termId: term.id } : {}),
        ...(filters.classId ? { classId: filters.classId } : {})
      },
      include: { student: true, classRoom: true }
    });
    const grouped = new Map<string, typeof records>();
    for (const record of records) {
      grouped.set(record.studentId, [...(grouped.get(record.studentId) ?? []), record]);
    }

    return Array.from(grouped.values())
      .map((items) => {
        const [first] = items;
        const present = items.filter((item) => item.status === "PRESENT").length;
        const late = items.filter((item) => item.status === "LATE").length;
        const absent = items.filter((item) => item.status === "ABSENT").length;
        const excused = items.filter((item) => item.status === "EXCUSED").length;
        const attended = present + late + excused;
        const percentage = items.length > 0 ? Math.round((attended / items.length) * 1000) / 10 : 0;
        return {
          studentId: first.studentId,
          studentName: `${first.student.firstName} ${first.student.lastName}`,
          admissionNumber: first.student.admissionNumber,
          classId: first.classId,
          className: formatClassName(first.classRoom),
          totalDays: items.length,
          present,
          late,
          absent,
          excused,
          percentage
        };
      })
      .sort((a, b) => a.percentage - b.percentage || a.studentName.localeCompare(b.studentName));
  }

  async recordAttendance(schoolId: string, markedById: string, payload: unknown) {
    const parsed = attendanceSchema.parse(payload);

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

    if (!term) {
      throw new NotFoundException("No active term is configured for this school.");
    }
    if (!student?.currentClassId || student.schoolId !== schoolId) {
      throw new BadRequestException("Select a valid enrolled student before saving attendance.");
    }
    const classId = parsed.classId ?? student.currentClassId;
    if (student.currentClassId !== classId) {
      throw new BadRequestException("Selected student is not enrolled in the selected class.");
    }
    const subject = parsed.subjectId
      ? await prisma.subject.findFirst({
          where: { schoolId, id: parsed.subjectId },
          select: { id: true, name: true }
        })
      : null;

    const attendanceDate = normalizeAttendanceDate(parsed.date);
    const existingRecord = await prisma.studentAttendance.findFirst({
      where: {
        studentId: student.id,
        termId: term.id,
        date: attendanceDate,
        subjectId: parsed.subjectId ?? null
      },
      select: { id: true }
    });

    const record = existingRecord
      ? await prisma.studentAttendance.update({
          where: { id: existingRecord.id },
          data: {
            markedById,
            status: parsed.status,
            reason: parsed.reason
          },
          include: {
            student: true,
            classRoom: true,
            markedBy: { select: { firstName: true, lastName: true } },
            term: { select: { name: true } }
          }
        })
      : await prisma.studentAttendance.create({
          data: {
            schoolId,
            studentId: student.id,
            classId,
            termId: term.id,
            markedById,
            subjectId: parsed.subjectId,
            date: attendanceDate,
            status: parsed.status,
            reason: parsed.reason
          },
          include: {
            student: true,
            classRoom: true,
            markedBy: { select: { firstName: true, lastName: true } },
            term: { select: { name: true } }
          }
        });

    const view: AttendanceRecordView = {
      id: record.id,
      studentId: record.studentId,
      studentName: `${record.student.firstName} ${record.student.lastName}`,
      classId: record.classId,
      className: formatClassName(record.classRoom),
      subjectId: record.subjectId ?? undefined,
      subject: subject?.name ?? parsed.subject ?? "Morning attendance",
      status: record.status,
      date: record.date.toISOString(),
      reason: record.reason ?? undefined,
      markedByName: `${record.markedBy.firstName} ${record.markedBy.lastName}`,
      termName: record.term.name
    };
    if (view.status === "ABSENT") {
      await sendNotification({
        channel: "SMS",
        recipient: "parent",
        title: "Attendance alert",
        body: `${view.studentName} was marked absent in ${view.className}.`
      });
    }
    return view;
  }
}
