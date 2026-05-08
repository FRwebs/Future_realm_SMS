import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../../../src/lib/db/prisma";
import {
  StudentBehaviorLogView,
  StudentProfileView,
  StudentPromotionView,
  StudentRecordView
} from "../../../../src/lib/domain/types";
import {
  formatNigeriaClassName,
  getNigeriaClassLookupNames,
  normalizeNigeriaClassValue
} from "../../../../src/lib/school-options";

const nigeriaClassInputSchema = z
  .string()
  .min(2)
  .refine((value) => Boolean(normalizeNigeriaClassValue(value)), "Select a valid Nigerian class.");

export const createStudentSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  middleName: z.string().optional().or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).default("MALE"),
  dateOfBirth: z.string().min(1),
  guardianName: z.string().min(3),
  guardianPhone: z.string().min(10),
  guardianEmail: z.string().email().optional().or(z.literal("")),
  guardianRelationship: z.string().min(3).default("Parent"),
  className: nigeriaClassInputSchema,
  stateOfOrigin: z.string().optional().or(z.literal("")),
  religion: z.string().optional().or(z.literal("")),
  bloodGroup: z.string().optional().or(z.literal("")),
  genotype: z.string().optional().or(z.literal("")),
  allergies: z.string().optional().or(z.literal("")),
  conditions: z.string().optional().or(z.literal(""))
});

const behaviorLogSchema = z.object({
  category: z.string().min(2),
  description: z.string().min(8),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]).default("LOW")
});

const promotionSchema = z.object({
  toClassName: nigeriaClassInputSchema,
  toSessionName: z.string().optional().or(z.literal("")),
  decision: z.string().min(4)
});

function resolveRiskFlags(student: {
  attendanceRate: number;
  outstandingBalance: number;
  averageScore: number;
  behaviorLogs?: Array<{ severity: "LOW" | "MEDIUM" | "HIGH" | string }>;
}) {
  const flags: string[] = [];

  if (student.attendanceRate < 90) {
    flags.push("Low attendance");
  }

  if (student.outstandingBalance > 0) {
    flags.push("Outstanding fee balance");
  }

  if (student.averageScore > 0 && student.averageScore < 50) {
    flags.push("Academic support recommended");
  }

  if (student.behaviorLogs?.some((item) => item.severity === "HIGH")) {
    flags.push("High-severity behavior log");
  }

  return flags;
}

function formatClassName(className?: string | null, arm?: string | null) {
  if (!className) return "Unassigned";
  return formatNigeriaClassName(arm ? `${className} - ${arm}` : className);
}

function splitClassName(value: string) {
  const [name, arm] = formatNigeriaClassName(value).split(" - ").map((item) => item.trim());
  return { name, arm };
}

function classLookupConditions(value: string) {
  const { arm } = splitClassName(value);
  const names = getNigeriaClassLookupNames(value);
  const formatted = formatNigeriaClassName(value);

  return [
    { name: formatted },
    ...names.flatMap((name) => (arm ? [{ name, arm }] : [{ name }]))
  ];
}

@Injectable()
export class StudentsService {
  async listStudents(
    schoolId: string,
    filters?: {
      className?: string;
      status?: string;
      search?: string;
    },
  ) {
    const normalizedClassName = filters?.className
      ? normalizeNigeriaClassValue(filters.className)
      : null;
    const status = filters?.status?.trim();
    const search = filters?.search?.trim();
    const where: Prisma.StudentWhereInput = { schoolId };

    if (normalizedClassName) {
      where.currentClass = {
        is: {
          OR: classLookupConditions(normalizedClassName),
        },
      };
    }

    if (status) {
      where.status = status as never;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { middleName: { contains: search, mode: "insensitive" } },
        { admissionNumber: { contains: search, mode: "insensitive" } },
        {
          guardians: {
            some: {
              guardian: {
                is: {
                  OR: [
                    { firstName: { contains: search, mode: "insensitive" } },
                    { lastName: { contains: search, mode: "insensitive" } },
                  ],
                },
              },
            },
          },
        },
      ];
    }

    const students = await prisma.student.findMany({
      where,
      select: {
        id: true,
        admissionNumber: true,
        firstName: true,
        lastName: true,
        currentClassId: true,
        status: true,
        currentClass: {
          select: {
            name: true,
            arm: true,
          },
        },
        guardians: {
          select: {
            isPrimary: true,
            guardian: {
              select: {
                firstName: true,
              },
            },
          }
        },
      },
      orderBy: { admissionNumber: "asc" }
    });

    const studentIds = students.map((student) => student.id);
    if (studentIds.length === 0) {
      return [];
    }

    const [attendanceStats, resultAverages, invoiceBalances] = await Promise.all([
      prisma.studentAttendance.groupBy({
        by: ["studentId", "status"],
        where: { schoolId, studentId: { in: studentIds } },
        _count: { _all: true },
      }),
      prisma.resultSheet.groupBy({
        by: ["studentId"],
        where: { schoolId, studentId: { in: studentIds } },
        _avg: { averageScore: true },
      }),
      prisma.invoice.groupBy({
        by: ["studentId"],
        where: { schoolId, studentId: { in: studentIds } },
        _sum: { balance: true },
      }),
    ]);

    const attendanceMap = new Map<string, { total: number; presentLike: number }>();
    for (const row of attendanceStats) {
      const current = attendanceMap.get(row.studentId) ?? { total: 0, presentLike: 0 };
      current.total += row._count._all;
      if (row.status !== "ABSENT") {
        current.presentLike += row._count._all;
      }
      attendanceMap.set(row.studentId, current);
    }

    const resultAverageMap = new Map(
      resultAverages.map((row) => [row.studentId, Number(row._avg.averageScore ?? 0)]),
    );
    const invoiceBalanceMap = new Map(
      invoiceBalances.map((row) => [row.studentId, Number(row._sum.balance ?? 0)]),
    );

    return students.map<StudentRecordView>((student) => ({
      id: student.id,
      admissionNumber: student.admissionNumber,
      fullName: `${student.firstName} ${student.lastName}`,
      classId: student.currentClassId ?? undefined,
      className: formatClassName(student.currentClass?.name, student.currentClass?.arm),
      guardianName:
        student.guardians.find((item) => item.isPrimary)?.guardian.firstName ??
        student.guardians[0]?.guardian.firstName ??
        "No guardian",
      status: student.status,
      attendanceRate: (() => {
        const stats = attendanceMap.get(student.id);
        if (!stats || stats.total === 0) return 0;
        return Number(((stats.presentLike / stats.total) * 100).toFixed(1));
      })(),
      averageScore: resultAverageMap.get(student.id) ?? 0,
      outstandingBalance: invoiceBalanceMap.get(student.id) ?? 0,
    }));
  }

  async getStudentProfile(schoolId: string, studentId: string): Promise<StudentProfileView> {
    const student = await prisma.student.findFirstOrThrow({
      where: { id: studentId, schoolId },
      include: {
        currentClass: true,
        guardians: {
          include: {
            guardian: true
          }
        },
        medicalRecord: true,
        documents: {
          orderBy: { createdAt: "desc" }
        },
        behaviorLogs: {
          orderBy: { loggedAt: "desc" }
        },
        promotions: {
          orderBy: { promotedAt: "desc" },
          include: {
            fromSession: true,
            toSession: true
          }
        },
        attendance: {
          select: { status: true }
        },
        resultSheets: {
          orderBy: { publishedAt: "desc" },
          select: { averageScore: true }
        },
        invoices: {
          select: { balance: true }
        }
      }
    });

    const classIds = student.promotions.flatMap((item) => [item.fromClassId, item.toClassId]).filter(Boolean) as string[];
    const classMap =
      classIds.length === 0
        ? new Map<string, string>()
        : new Map(
            (
              await prisma.classRoom.findMany({
                where: {
                  schoolId,
                  id: { in: classIds }
                },
                select: { id: true, name: true, arm: true }
              })
            ).map((item) => [item.id, formatClassName(item.name, item.arm)])
          );

    const attendanceRate =
      student.attendance.length === 0
        ? 0
        : Number(
            (
              (student.attendance.filter((record) => record.status !== "ABSENT").length /
                student.attendance.length) *
              100
            ).toFixed(1)
          );
    const averageScore = Number(student.resultSheets[0]?.averageScore ?? 0);
    const outstandingBalance = student.invoices.reduce((sum, invoice) => sum + Number(invoice.balance), 0);
    const primaryGuardian = student.guardians.find((item) => item.isPrimary)?.guardian ?? student.guardians[0]?.guardian;

    return {
      id: student.id,
      admissionNumber: student.admissionNumber,
      fullName: `${student.firstName} ${student.lastName}`,
      className: formatClassName(student.currentClass?.name, student.currentClass?.arm),
      guardianName: primaryGuardian ? `${primaryGuardian.firstName} ${primaryGuardian.lastName}` : "No guardian",
      guardianPhone: primaryGuardian?.phone ?? "Not recorded",
      guardianEmail: primaryGuardian?.email ?? undefined,
      status: student.status,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth.toISOString(),
      admissionDate: student.admissionDate.toISOString(),
      nationality: student.nationality,
      stateOfOrigin: student.stateOfOrigin ?? undefined,
      religion: student.religion ?? undefined,
      attendanceRate,
      averageScore,
      outstandingBalance,
      riskFlags: resolveRiskFlags({
        attendanceRate,
        outstandingBalance,
        averageScore,
        behaviorLogs: student.behaviorLogs
      }),
      medical: {
        bloodGroup: student.medicalRecord?.bloodGroup ?? undefined,
        genotype: student.medicalRecord?.genotype ?? undefined,
        allergies: student.medicalRecord?.allergies ?? undefined,
        conditions: student.medicalRecord?.conditions ?? undefined,
        notes: student.medicalRecord?.notes ?? undefined
      },
      documents: student.documents.map((item) => ({
        id: item.id,
        label: item.label,
        fileName: item.fileName,
        createdAt: item.createdAt.toISOString()
      })),
      behaviorLogs: student.behaviorLogs.map((item) => ({
        id: item.id,
        category: item.category,
        description: item.description,
        severity: item.severity as "LOW" | "MEDIUM" | "HIGH",
        loggedAt: item.loggedAt.toISOString()
      })),
      promotions: student.promotions.map((item) => ({
        id: item.id,
        decision: item.decision,
        fromClassName: item.fromClassId ? classMap.get(item.fromClassId) : undefined,
        toClassName: item.toClassId ? classMap.get(item.toClassId) : undefined,
        fromSessionName: item.fromSession?.name ?? undefined,
        toSessionName: item.toSession?.name ?? undefined,
        promotedAt: item.promotedAt.toISOString()
      }))
    };
  }

  async createStudent(schoolId: string, payload: unknown) {
    const parsed = createStudentSchema.parse(payload);
    const className = formatNigeriaClassName(parsed.className);

    const [currentClass, currentSession] = await Promise.all([
      prisma.classRoom.findFirst({
        where: {
          schoolId,
          OR: classLookupConditions(className)
        }
      }),
      prisma.academicSession.findFirst({
        where: { schoolId, isCurrent: true }
      })
    ]);

    const guardian = await prisma.guardian.create({
      data: {
        schoolId,
        firstName: parsed.guardianName.split(" ")[0] ?? parsed.guardianName,
        lastName: parsed.guardianName.split(" ").slice(1).join(" ") || "Guardian",
        phone: parsed.guardianPhone,
        email: parsed.guardianEmail || null,
        relationship: parsed.guardianRelationship
      }
    });

    const student = await prisma.student.create({
      data: {
        schoolId,
        admissionNumber: `ADM/${Date.now().toString().slice(-6)}`,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        middleName: parsed.middleName || null,
        gender: parsed.gender,
        dateOfBirth: new Date(parsed.dateOfBirth),
        admissionDate: new Date(),
        stateOfOrigin: parsed.stateOfOrigin || null,
        religion: parsed.religion || null,
        currentClassId: currentClass?.id,
        currentSessionId: currentSession?.id,
        guardians: {
          create: {
            guardianId: guardian.id,
            isPrimary: true
          }
        },
        medicalRecord: {
          create: {
            bloodGroup: parsed.bloodGroup || null,
            genotype: parsed.genotype || null,
            allergies: parsed.allergies || null,
            conditions: parsed.conditions || null
          }
        }
      }
    });

    return {
      id: student.id,
      admissionNumber: student.admissionNumber,
      fullName: `${student.firstName} ${student.lastName}`,
      className,
      guardianName: parsed.guardianName,
      status: student.status,
      attendanceRate: 0,
      averageScore: 0,
      outstandingBalance: 0
    };
  }

  async createBehaviorLog(schoolId: string, studentId: string, payload: unknown): Promise<StudentBehaviorLogView> {
    const parsed = behaviorLogSchema.parse(payload);

    await prisma.student.findFirstOrThrow({
      where: { id: studentId, schoolId },
      select: { id: true }
    });

    const created = await prisma.behaviorLog.create({
      data: {
        studentId,
        category: parsed.category,
        description: parsed.description,
        severity: parsed.severity
      }
    });

    return {
      id: created.id,
      category: created.category,
      description: created.description,
      severity: created.severity as "LOW" | "MEDIUM" | "HIGH",
      loggedAt: created.loggedAt.toISOString()
    };
  }

  async createPromotion(schoolId: string, studentId: string, payload: unknown): Promise<StudentPromotionView> {
    const parsed = promotionSchema.parse(payload);
    const toClassName = formatNigeriaClassName(parsed.toClassName);

    const student = await prisma.student.findFirstOrThrow({
      where: { id: studentId, schoolId },
      include: {
        currentClass: true,
        currentSession: true
      }
    });
    const [toClass, toSession] = await Promise.all([
      prisma.classRoom.findFirst({
        where: {
          schoolId,
          OR: classLookupConditions(toClassName)
        }
      }),
      parsed.toSessionName
        ? prisma.academicSession.findFirst({
            where: { schoolId, name: parsed.toSessionName }
          })
        : prisma.academicSession.findFirst({
            where: { schoolId, isCurrent: true }
          })
    ]);

    const created = await prisma.$transaction(async (tx) => {
      const promotion = await tx.promotionRecord.create({
        data: {
          schoolId,
          studentId,
          fromClassId: student.currentClassId,
          toClassId: toClass?.id,
          fromSessionId: student.currentSessionId,
          toSessionId: toSession?.id,
          decision: parsed.decision
        }
      });

      await tx.student.update({
        where: { id: student.id },
        data: {
          currentClassId: toClass?.id ?? student.currentClassId,
          currentSessionId: toSession?.id ?? student.currentSessionId
        }
      });

      return promotion;
    });

    return {
      id: created.id,
      decision: created.decision,
      fromClassName: formatClassName(student.currentClass?.name, student.currentClass?.arm),
      toClassName: formatClassName(toClass?.name ?? toClassName, toClass?.arm),
      fromSessionName: student.currentSession?.name ?? undefined,
      toSessionName: toSession?.name ?? (parsed.toSessionName || undefined),
      promotedAt: created.promotedAt.toISOString()
    };
  }
}
