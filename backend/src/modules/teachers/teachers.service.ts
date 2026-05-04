import { Injectable } from "@nestjs/common";

import { prisma } from "../../../../src/lib/db/prisma";
import {
  TeacherActivityView,
  TeacherProfileView,
  TeacherRecordView
} from "../../../../src/lib/domain/types";
import { formatNigeriaClassName } from "../../../../src/lib/school-options";

function formatClassName(name?: string | null, arm?: string | null) {
  if (!name) return "Unassigned";
  return formatNigeriaClassName(arm ? `${name} - ${arm}` : name);
}

function resolveLeaveStatus(leaveRequests: Array<{ status: "PENDING" | "APPROVED" | "REJECTED" }>) {
  const pending = leaveRequests.filter((item) => item.status === "PENDING").length;
  if (pending > 0) {
    return `${pending} pending leave request${pending > 1 ? "s" : ""}`;
  }

  const approved = leaveRequests.find((item) => item.status === "APPROVED");
  if (approved) {
    return "Approved leave on record";
  }

  return "No active leave";
}

@Injectable()
export class TeachersService {
  async listTeacherActivities(schoolId: string): Promise<TeacherActivityView[]> {
    const staffProfiles = await prisma.staffProfile.findMany({
      where: {
        schoolId,
        user: {
          role: "TEACHER"
        }
      },
      include: {
        user: true,
        leaveRequests: {
          orderBy: { startDate: "desc" },
          take: 3
        }
      }
    });
    const teacherIds = staffProfiles.map((item) => item.userId);
    const staffByUserId = new Map(staffProfiles.map((item) => [item.userId, item]));

    const [staffAttendance, pendingResults] = await Promise.all([
      prisma.staffAttendance.findMany({
        where: {
          schoolId,
          userId: { in: teacherIds }
        },
        select: { id: true, userId: true, date: true, status: true, checkInAt: true, checkOutAt: true, notes: true },
        orderBy: { date: "desc" },
        take: 15
      }),
      prisma.resultSheet.groupBy({
        by: ["createdById"],
        where: {
          schoolId,
          createdById: { in: teacherIds },
          publishedAt: null
        },
        _count: {
          _all: true
        }
      })
    ]);

    const attendanceActivities: TeacherActivityView[] = staffAttendance.flatMap((item) => {
      const staff = staffByUserId.get(item.userId);
      if (!staff) return [];
      const teacherName = `${staff.user.firstName} ${staff.user.lastName}`;
      return [
        {
          id: `attendance_${item.id}`,
          teacherId: staff.id,
          teacherName,
          type: "ATTENDANCE",
          title: `${teacherName} marked ${item.status.toLowerCase().replace("_", " ")}`,
          detail: item.notes ?? `Attendance record captured for ${teacherName}.`,
          occurredAt: item.checkInAt?.toISOString() ?? item.date.toISOString(),
          tone: item.status === "PRESENT" ? "success" : item.status === "LATE" ? "warning" : "danger"
        }
      ] satisfies TeacherActivityView[];
    });

    const leaveActivities: TeacherActivityView[] = staffProfiles.flatMap((staff) =>
      staff.leaveRequests.map((item) => ({
        id: `leave_${item.id}`,
        teacherId: staff.id,
        teacherName: `${staff.user.firstName} ${staff.user.lastName}`,
        type: "LEAVE",
        title: `${item.status.toLowerCase()} ${item.type}`,
        detail: item.reason,
        occurredAt: item.reviewedAt?.toISOString() ?? item.startDate.toISOString(),
        tone: item.status === "PENDING" ? "warning" : item.status === "APPROVED" ? "neutral" : "danger"
      }))
    );

    const resultActivities: TeacherActivityView[] = pendingResults.flatMap((item) => {
      const staff = staffByUserId.get(item.createdById);
      if (!staff) return [];
      const teacherName = `${staff.user.firstName} ${staff.user.lastName}`;
      return [
        {
          id: `results_${staff.id}`,
          teacherId: staff.id,
          teacherName,
          type: "RESULTS",
          title: "Pending result workflow",
          detail: `${item._count._all} result workflow item(s) need completion before publishing.`,
          occurredAt: new Date().toISOString(),
          tone: "warning"
        }
      ] satisfies TeacherActivityView[];
    });

    return [...attendanceActivities, ...leaveActivities, ...resultActivities]
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
      .slice(0, 30);
  }

  async listTeachers(schoolId: string): Promise<TeacherRecordView[]> {
    const staffProfiles = await prisma.staffProfile.findMany({
      where: {
        schoolId,
        user: {
          role: "TEACHER"
        }
      },
      include: {
        user: true,
        department: true,
        campus: true,
        leaveRequests: {
          orderBy: { startDate: "desc" }
        }
      },
      orderBy: {
        employeeNo: "asc"
      }
    });

    const teacherIds = staffProfiles.map((item) => item.userId);
    const [classSubjects, staffAttendance, pendingResults] = await Promise.all([
      prisma.classSubject.findMany({
        where: {
          schoolId,
          teacherId: { in: teacherIds }
        },
        include: {
          subject: true,
          classRoom: true
        }
      }),
      prisma.staffAttendance.findMany({
        where: {
          schoolId,
          userId: { in: teacherIds }
        },
        select: { id: true, userId: true, date: true, status: true, checkInAt: true, checkOutAt: true, notes: true },
        orderBy: {
          date: "desc"
        }
      }),
      prisma.resultSheet.groupBy({
        by: ["createdById"],
        where: {
          schoolId,
          createdById: { in: teacherIds },
          publishedAt: null
        },
        _count: {
          _all: true
        }
      })
    ]);

    const subjectMap = new Map<string, Set<string>>();
    const classMap = new Map<string, Set<string>>();
    classSubjects.forEach((item) => {
      if (!item.teacherId) return;
      const subjects = subjectMap.get(item.teacherId) ?? new Set<string>();
      subjects.add(item.subject.name);
      subjectMap.set(item.teacherId, subjects);

      const classes = classMap.get(item.teacherId) ?? new Set<string>();
      classes.add(formatClassName(item.classRoom.name, item.classRoom.arm));
      classMap.set(item.teacherId, classes);
    });

    const latestAttendanceMap = new Map<string, (typeof staffAttendance)[number]>();
    staffAttendance.forEach((item) => {
      if (!latestAttendanceMap.has(item.userId)) {
        latestAttendanceMap.set(item.userId, item);
      }
    });

    const pendingResultsMap = new Map<string, number>();
    pendingResults.forEach((item) => {
      pendingResultsMap.set(item.createdById, item._count._all);
    });

    return staffProfiles.map((profile) => {
      const latestAttendance = latestAttendanceMap.get(profile.userId);
      return {
        id: profile.id,
        fullName: `${profile.user.firstName} ${profile.user.lastName}`,
        email: profile.user.email,
        employeeNo: profile.employeeNo,
        designation: profile.designation,
        departmentName: profile.department?.name ?? undefined,
        campusName: profile.campus?.name ?? undefined,
        subjects: Array.from(subjectMap.get(profile.userId) ?? []),
        classAssignments: Array.from(classMap.get(profile.userId) ?? []),
        attendanceStatusToday: latestAttendance?.status ?? "NOT_MARKED",
        checkInAt: latestAttendance?.checkInAt?.toISOString(),
        leaveStatus: resolveLeaveStatus(profile.leaveRequests),
        pendingResults: pendingResultsMap.get(profile.userId) ?? 0,
        employmentDate: profile.employmentDate.toISOString()
      };
    });
  }

  async getTeacherProfile(schoolId: string, teacherId: string): Promise<TeacherProfileView> {
    const profile = await prisma.staffProfile.findFirstOrThrow({
      where: {
        id: teacherId,
        schoolId,
        user: {
          role: "TEACHER"
        }
      },
      include: {
        user: true,
        department: true,
        campus: true,
        leaveRequests: {
          orderBy: { startDate: "desc" }
        }
      }
    });

    const [classSubjects, staffAttendance, pendingResults, activities] = await Promise.all([
      prisma.classSubject.findMany({
        where: {
          schoolId,
          teacherId: profile.userId
        },
        include: {
          subject: true,
          classRoom: true
        }
      }),
      prisma.staffAttendance.findMany({
        where: {
          schoolId,
          userId: profile.userId
        },
        select: { id: true, userId: true, date: true, status: true, checkInAt: true, checkOutAt: true, notes: true },
        orderBy: {
          date: "desc"
        },
        take: 5
      }),
      prisma.resultSheet.count({
        where: {
          schoolId,
          createdById: profile.userId,
          publishedAt: null
        }
      }),
      this.listTeacherActivities(schoolId)
    ]);

    const subjects = Array.from(new Set(classSubjects.map((item) => item.subject.name)));
    const classAssignments = Array.from(
      new Set(classSubjects.map((item) => formatClassName(item.classRoom.name, item.classRoom.arm)))
    );
    const latestAttendance = staffAttendance[0];
    const leaveStatus = resolveLeaveStatus(profile.leaveRequests);

    return {
      id: profile.id,
      fullName: `${profile.user.firstName} ${profile.user.lastName}`,
      email: profile.user.email,
      phone: profile.user.phone ?? undefined,
      employeeNo: profile.employeeNo,
      designation: profile.designation,
      departmentName: profile.department?.name ?? undefined,
      campusName: profile.campus?.name ?? undefined,
      employmentDate: profile.employmentDate.toISOString(),
      emergencyContactName: profile.emergencyContactName ?? undefined,
      emergencyContactPhone: profile.emergencyContactPhone ?? undefined,
      subjects,
      classAssignments,
      attendanceStatusToday: latestAttendance?.status ?? "NOT_MARKED",
      pendingResults,
      leaveStatus,
      attendanceHistory: staffAttendance.map((item) => ({
        id: item.id,
        date: item.date.toISOString(),
        status: item.status,
        checkInAt: item.checkInAt?.toISOString(),
        checkOutAt: item.checkOutAt?.toISOString(),
        notes: item.notes ?? undefined
      })),
      leaveRequests: profile.leaveRequests.map((item) => ({
        id: item.id,
        type: item.type,
        startDate: item.startDate.toISOString(),
        endDate: item.endDate.toISOString(),
        reason: item.reason,
        status: item.status
      })),
      recentActivities: activities.filter((item) => item.teacherId === profile.id),
      operationalNotes: [
        pendingResults > 0
          ? `${pendingResults} unpublished result workflow item(s) still require attention.`
          : "All currently assigned result sheets are published.",
        classAssignments.length > 0
          ? `Currently teaches ${classAssignments.length} class assignment(s).`
          : "No active class subject assignment is recorded.",
        leaveStatus.includes("pending")
          ? "Substitution planning may be needed if leave is approved."
          : "No immediate leave-driven substitution risk."
      ]
    };
  }
}
