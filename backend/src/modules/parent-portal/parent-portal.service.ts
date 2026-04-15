import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { getDemoParentPortalByEmail } from "../../../../src/lib/demo/data";
import { buildPortalSubjectResults, resolveGradeLabel } from "../../../../src/lib/domain/grading";
import {
  ParentChildPortalView,
  ParentPortalView,
  ParentProfileView,
  PortalFinanceItem,
  PortalResultHistory,
  PortalTimetableEntry,
  StudentPortalAttendanceView,
  StudentPortalCalendarEvent,
  StudentPortalExamEntry,
  StudentPortalNotificationView
} from "../../../../src/lib/domain/types";
import { formatNigeriaClassName } from "../../../../src/lib/school-options";
import { env } from "../../../../src/lib/utils/env";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type LinkedChild = {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  currentClass?: { id: string; name: string; arm: string | null } | null;
};

function formatClassName(name?: string | null, arm?: string | null) {
  if (!name) return "Unassigned";
  return formatNigeriaClassName(arm ? `${name} - ${arm}` : name);
}

function formatStudentName(student: { firstName: string; lastName: string; middleName?: string | null }) {
  return [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
}

function isAudienceForParent(audience: string, classNames: string[]) {
  const normalized = audience.toLowerCase();
  return (
    normalized.includes("parent") ||
    normalized.includes("guardian") ||
    normalized.includes("school") ||
    normalized.includes("all") ||
    classNames.some((className) => normalized.includes(className.toLowerCase()))
  );
}

function buildAttendanceView(records: Array<{ id: string; date: Date; status: string; reason?: string | null }>): StudentPortalAttendanceView {
  const present = records.filter((item) => item.status === "PRESENT").length;
  const absent = records.filter((item) => item.status === "ABSENT").length;
  const late = records.filter((item) => item.status === "LATE").length;
  const excused = records.filter((item) => item.status === "EXCUSED").length;
  const attended = present + late + excused;
  const attendanceRate = records.length === 0 ? 0 : Number(((attended / records.length) * 100).toFixed(1));

  return {
    summary: {
      totalDays: records.length,
      present,
      absent,
      late,
      excused,
      attendanceRate,
      lowAttendanceWarning: records.length > 0 && attendanceRate < 90 ? "Attendance is below the 90% watch threshold." : undefined
    },
    records: records.map((item) => ({
      id: item.id,
      date: item.date.toISOString(),
      status: item.status as StudentPortalAttendanceView["records"][number]["status"],
      reason: item.reason ?? undefined
    })),
    chart: [
      { label: "Present", value: present },
      { label: "Late", value: late },
      { label: "Excused", value: excused },
      { label: "Absent", value: absent }
    ]
  };
}

@Injectable()
export class ParentPortalService {
  private assertParentSession(session: SessionPayload) {
    if (session.role !== "PARENT") {
      throw new ForbiddenException("Parent portal data is only available to parent or guardian accounts.");
    }
  }

  private async getGuardianContext(session: SessionPayload) {
    this.assertParentSession(session);
    const guardian = await prisma.guardian.findFirst({
      where: { schoolId: session.schoolId, userId: session.userId },
      include: {
        user: true,
        students: {
          include: {
            student: { include: { currentClass: true } }
          },
          orderBy: { student: { admissionNumber: "asc" } }
        }
      }
    });

    if (!guardian) {
      throw new NotFoundException("No guardian profile is linked to this parent account.");
    }

    return guardian;
  }

  private getDemoAuthorizedChild(session: SessionPayload, studentId: string) {
    const child = getDemoParentPortalByEmail(session.email).children.find((item) => item.studentId === studentId);
    if (!child) throw new ForbiddenException("This child is not linked to your guardian account.");
    return child;
  }

  private async getAuthorizedChild(session: SessionPayload, studentId: string): Promise<LinkedChild> {
    const guardian = await this.getGuardianContext(session);
    const link = guardian.students.find((item) => item.studentId === studentId);
    if (!link) {
      throw new ForbiddenException("This child is not linked to your guardian account.");
    }

    return link.student;
  }

  async listLinkedChildren(session: SessionPayload) {
    this.assertParentSession(session);
    if (env.DEMO_MODE) {
      return getDemoParentPortalByEmail(session.email).children;
    }

    const guardian = await this.getGuardianContext(session);
    return Promise.all(guardian.students.map((item) => this.buildChildOverview(session, item.student)));
  }

  private async getAttendance(session: SessionPayload, studentId: string) {
    const records = await prisma.studentAttendance.findMany({
      where: { schoolId: session.schoolId, studentId },
      orderBy: { date: "desc" },
      take: 120
    });
    return buildAttendanceView(records);
  }

  private async getResults(session: SessionPayload, student: LinkedChild): Promise<PortalResultHistory[]> {
    const sheets = await prisma.resultSheet.findMany({
      where: { schoolId: session.schoolId, studentId: student.id, status: "PUBLISHED", publishedAt: { not: null } },
      include: {
        term: { include: { academicSession: true } },
        scoreEntries: {
          include: { subject: true, assessmentComponent: true },
          orderBy: { recordedAt: "asc" }
        }
      },
      orderBy: { publishedAt: "desc" }
    });

    return sheets.map((sheet) => {
      const subjects = buildPortalSubjectResults(sheet.scoreEntries);

      return {
        id: sheet.id,
        session: sheet.term.academicSession.name,
        term: sheet.term.name,
        average: Number(sheet.averageScore),
        grade: sheet.grade ?? resolveGradeLabel(Number(sheet.averageScore)).label,
        position: sheet.position ?? undefined,
        publishedAt: sheet.publishedAt?.toISOString() ?? new Date(0).toISOString(),
        teacherComment: sheet.teacherComment ?? undefined,
        principalComment: sheet.principalComment ?? undefined,
        reportCardUrl: `/api/v1/reports/report-card/${student.id}`,
        subjects
      };
    });
  }

  private async getFees(session: SessionPayload, studentId: string): Promise<PortalFinanceItem[]> {
    const invoices = await prisma.invoice.findMany({
      where: { schoolId: session.schoolId, studentId },
      include: { payments: { include: { receipts: true } }, items: true },
      orderBy: { issuedOn: "desc" }
    });

    return invoices.map((invoice) => ({
      id: invoice.id,
      title: invoice.items[0]?.description ?? invoice.invoiceNumber,
      amount: Number(invoice.total),
      balance: Number(invoice.balance),
      dueOn: invoice.dueOn.toISOString(),
      issuedOn: invoice.issuedOn.toISOString(),
      status: invoice.status,
      payments: invoice.payments.map((payment) => ({
        id: payment.id,
        reference: payment.reference,
        amount: Number(payment.amount),
        paidAt: payment.paidAt?.toISOString(),
        status: payment.status,
        method: payment.method,
        receiptNumber: payment.receipts[0]?.receiptNumber
      }))
    }));
  }

  private async getTimetable(session: SessionPayload, student: LinkedChild) {
    if (!student.currentClass) return { weeklyTimetable: [], examTimetable: [], calendar: [] };

    const [term, timetable, exams, events] = await Promise.all([
      prisma.term.findFirst({ where: { schoolId: session.schoolId, isCurrent: true } }),
      prisma.timetableEntry.findMany({
        where: { schoolId: session.schoolId, classId: student.currentClass.id },
        include: { subject: true },
        orderBy: [{ dayOfWeek: "asc" }, { startsAt: "asc" }]
      }),
      prisma.examTimetableEntry.findMany({
        where: { schoolId: session.schoolId, classId: student.currentClass.id },
        include: { subject: true },
        orderBy: { examDate: "asc" }
      }),
      prisma.calendarEvent.findMany({
        where: { schoolId: session.schoolId, endsAt: { gte: new Date() } },
        orderBy: { startsAt: "asc" },
        take: 20
      })
    ]);
    const className = formatClassName(student.currentClass.name, student.currentClass.arm);
    const teacherIds = timetable.map((item) => item.teacherId).filter(Boolean) as string[];
    const teachers =
      teacherIds.length === 0
        ? new Map<string, string>()
        : new Map(
            (
              await prisma.user.findMany({
                where: { schoolId: session.schoolId, id: { in: teacherIds } },
                select: { id: true, firstName: true, lastName: true }
              })
            ).map((item) => [item.id, `${item.firstName} ${item.lastName}`])
          );

    return {
      weeklyTimetable: timetable
        .filter((item) => !item.termId || item.termId === term?.id)
        .map<PortalTimetableEntry>((item) => ({
          id: item.id,
          day: dayNames[item.dayOfWeek] ?? `Day ${item.dayOfWeek}`,
          time: `${item.startsAt} - ${item.endsAt}`,
          subject: item.subject.name,
          venue: item.venue ?? "Classroom",
          teacherName: item.teacherId ? teachers.get(item.teacherId) : undefined,
          className
        })),
      examTimetable: exams
        .filter((item) => !item.termId || item.termId === term?.id)
        .map<StudentPortalExamEntry>((item) => ({
          id: item.id,
          subject: item.subject.name,
          examDate: item.examDate.toISOString(),
          time: `${item.startsAt} - ${item.endsAt}`,
          venue: item.venue ?? undefined
        })),
      calendar: events
        .filter((item) => isAudienceForParent(item.audience, [className]))
        .map<StudentPortalCalendarEvent>((item) => ({
          id: item.id,
          title: item.title,
          description: item.description ?? undefined,
          startsAt: item.startsAt.toISOString(),
          endsAt: item.endsAt.toISOString(),
          audience: item.audience
        }))
    };
  }

  private async getServices(session: SessionPayload, studentId: string) {
    const [transport, hostel, library] = await Promise.all([
      prisma.transportAssignment.findMany({
        where: { schoolId: session.schoolId, studentId },
        include: { route: true },
        orderBy: { stopName: "asc" }
      }),
      prisma.hostelAllocation.findMany({
        where: { schoolId: session.schoolId, studentId },
        include: { room: { include: { building: true } } },
        orderBy: { startDate: "desc" }
      }),
      prisma.libraryLoan.findMany({
        where: { schoolId: session.schoolId, studentId },
        include: { book: true },
        orderBy: { dueAt: "asc" }
      })
    ]);

    return {
      transport: transport.map((item) => ({
        routeName: item.route.name,
        driverName: item.route.driverName,
        driverPhone: item.route.driverPhone,
        vehicleRegNo: item.route.vehicleRegNo,
        stopName: item.stopName,
        amount: Number(item.amount)
      })),
      hostel: hostel.map((item) => ({
        building: item.room.building.name,
        room: item.room.name,
        startDate: item.startDate.toISOString(),
        endDate: item.endDate?.toISOString()
      })),
      library: library.map((loan) => ({
        id: loan.id,
        title: loan.book.title,
        author: loan.book.author,
        borrowedAt: loan.borrowedAt.toISOString(),
        dueAt: loan.dueAt.toISOString(),
        returnedAt: loan.returnedAt?.toISOString(),
        fineAmount: Number(loan.fineAmount)
      }))
    };
  }

  private async buildChildOverview(session: SessionPayload, student: LinkedChild): Promise<ParentChildPortalView> {
    const [attendance, resultHistory, finance, timetable, services] = await Promise.all([
      this.getAttendance(session, student.id),
      this.getResults(session, student),
      this.getFees(session, student.id),
      this.getTimetable(session, student),
      this.getServices(session, student.id)
    ]);
    const latestResult = resultHistory[0];
    const outstandingBalance = finance.reduce((sum, item) => sum + item.balance, 0);
    const notes = [
      attendance.summary.lowAttendanceWarning,
      outstandingBalance > 0 ? "Outstanding fee balance" : undefined,
      latestResult ? undefined : "No published result yet"
    ].filter(Boolean) as string[];

    return {
      studentId: student.id,
      studentName: formatStudentName(student),
      admissionNumber: student.admissionNumber,
      className: formatClassName(student.currentClass?.name, student.currentClass?.arm),
      attendanceRate: attendance.summary.attendanceRate,
      averageScore: latestResult?.average ?? 0,
      outstandingBalance,
      nextClass: timetable.weeklyTimetable[0] ? `${timetable.weeklyTimetable[0].subject} ${timetable.weeklyTimetable[0].time}` : "No next class",
      latestResult,
      attendance,
      examTimetable: timetable.examTimetable,
      calendar: timetable.calendar,
      weeklyTimetable: timetable.weeklyTimetable,
      resultHistory,
      finance,
      transport: services.transport,
      hostel: services.hostel,
      library: services.library,
      notes: notes.length ? notes : ["Stable student profile"]
    };
  }

  async getParentDashboard(session: SessionPayload): Promise<ParentPortalView> {
    this.assertParentSession(session);
    if (env.DEMO_MODE) return getDemoParentPortalByEmail(session.email);

    const guardian = await this.getGuardianContext(session);
    const children = await Promise.all(guardian.students.map((item) => this.buildChildOverview(session, item.student)));
    const outstanding = children.reduce((sum, child) => sum + child.outstandingBalance, 0);
    const announcements = await this.getParentAnnouncements(session);
    const notifications = await this.getParentNotifications(session);

    return {
      parentId: guardian.id,
      parentName: `${guardian.firstName} ${guardian.lastName}`,
      contactEmail: guardian.email ?? guardian.user?.email,
      contactPhone: guardian.phone,
      headline: children.length > 1 ? "All your children in one family view" : "Monitor your child's school progress",
      familyStats: [
        { label: "Children", value: String(children.length) },
        { label: "Outstanding", value: `NGN ${outstanding.toLocaleString("en-NG")}` },
        { label: "Alerts", value: String(children.filter((child) => child.notes.some((note) => note !== "Stable student profile")).length) }
      ],
      children,
      announcements,
      notifications
    };
  }

  async getChildOverviewForParent(session: SessionPayload, studentId: string) {
    this.assertParentSession(session);
    if (env.DEMO_MODE) {
      return this.getDemoAuthorizedChild(session, studentId);
    }
    const child = await this.getAuthorizedChild(session, studentId);
    return this.buildChildOverview(session, child);
  }

  async getChildAttendanceForParent(session: SessionPayload, studentId: string) {
    this.assertParentSession(session);
    if (env.DEMO_MODE) return this.getDemoAuthorizedChild(session, studentId).attendance;
    await this.getAuthorizedChild(session, studentId);
    return this.getAttendance(session, studentId);
  }

  async getChildResultsForParent(session: SessionPayload, studentId: string) {
    this.assertParentSession(session);
    if (env.DEMO_MODE) return this.getDemoAuthorizedChild(session, studentId).resultHistory;
    const child = await this.getAuthorizedChild(session, studentId);
    return this.getResults(session, child);
  }

  async getChildFeesForParent(session: SessionPayload, studentId: string) {
    this.assertParentSession(session);
    if (env.DEMO_MODE) return this.getDemoAuthorizedChild(session, studentId).finance;
    await this.getAuthorizedChild(session, studentId);
    return this.getFees(session, studentId);
  }

  async getChildTimetableForParent(session: SessionPayload, studentId: string) {
    this.assertParentSession(session);
    if (env.DEMO_MODE) {
      const child = this.getDemoAuthorizedChild(session, studentId);
      return {
        weeklyTimetable: child.weeklyTimetable,
        examTimetable: child.examTimetable ?? [],
        calendar: child.calendar ?? []
      };
    }
    const child = await this.getAuthorizedChild(session, studentId);
    return this.getTimetable(session, child);
  }

  async getParentAnnouncements(session: SessionPayload) {
    this.assertParentSession(session);
    if (env.DEMO_MODE) return getDemoParentPortalByEmail(session.email).announcements;

    const guardian = await this.getGuardianContext(session);
    const classNames = guardian.students.map((item) => formatClassName(item.student.currentClass?.name, item.student.currentClass?.arm));
    const announcements = await prisma.announcement.findMany({
      where: {
        schoolId: session.schoolId,
        publishedAt: { lte: new Date() },
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }]
      },
      orderBy: { publishedAt: "desc" },
      take: 50
    });

    return announcements.filter((item) => isAudienceForParent(item.audience, classNames)).map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.body,
      time: item.publishedAt.toISOString()
    }));
  }

  async getParentNotifications(session: SessionPayload): Promise<StudentPortalNotificationView[]> {
    this.assertParentSession(session);
    if (env.DEMO_MODE) return getDemoParentPortalByEmail(session.email).notifications ?? [];

    const notifications = await prisma.notificationLog.findMany({
      where: {
        schoolId: session.schoolId,
        OR: [{ userId: session.userId }, { userId: null }]
      },
      orderBy: { sentAt: "desc" },
      take: 50
    });

    return notifications.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      channel: item.channel,
      status: item.status,
      sentAt: item.sentAt?.toISOString()
    }));
  }

  async getParentProfile(session: SessionPayload): Promise<ParentProfileView> {
    this.assertParentSession(session);
    if (env.DEMO_MODE) {
      const portal = getDemoParentPortalByEmail(session.email);
      return {
        parentId: "demo-parent",
        parentName: portal.parentName,
        email: session.email,
        canReceiveSms: true,
        canReceiveEmail: true,
        linkedChildren: portal.children.map((child) => ({
          studentId: child.studentId,
          studentName: child.studentName,
          className: child.className,
          admissionNumber: child.admissionNumber ?? child.studentId
        }))
      };
    }

    const guardian = await this.getGuardianContext(session);
    return {
      parentId: guardian.id,
      parentName: `${guardian.firstName} ${guardian.lastName}`,
      relationship: guardian.relationship,
      phone: guardian.phone,
      email: guardian.email ?? guardian.user?.email,
      address: guardian.address ?? undefined,
      canReceiveSms: guardian.canReceiveSms,
      canReceiveEmail: guardian.canReceiveEmail,
      linkedChildren: guardian.students.map((item) => ({
        studentId: item.student.id,
        studentName: formatStudentName(item.student),
        className: formatClassName(item.student.currentClass?.name, item.student.currentClass?.arm),
        admissionNumber: item.student.admissionNumber
      }))
    };
  }
}
