import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { getDemoStudentPortalByEmail } from "../../../../src/lib/demo/data";
import { buildPortalSubjectResults, resolveGradeLabel } from "../../../../src/lib/domain/grading";
import {
  PortalFinanceItem,
  PortalResultHistory,
  PortalTimetableEntry,
  StudentPortalAssignmentView,
  StudentPortalAttendanceView,
  StudentPortalCalendarEvent,
  StudentPortalExamEntry,
  StudentPortalHostelView,
  StudentPortalLibraryLoanView,
  StudentPortalNotificationView,
  StudentPortalProfileView,
  StudentPortalTransportView,
  StudentPortalView
} from "../../../../src/lib/domain/types";
import { formatNigeriaClassName } from "../../../../src/lib/school-options";
import { env } from "../../../../src/lib/utils/env";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatClassName(name?: string | null, arm?: string | null) {
  if (!name) return "Unassigned";
  return formatNigeriaClassName(arm ? `${name} - ${arm}` : name);
}

function formatStudentName(student: { firstName: string; lastName: string; middleName?: string | null }) {
  return [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
}

function isStudentAudience(audience: string, className?: string) {
  const normalized = audience.toLowerCase();
  return (
    normalized.includes("student") ||
    normalized.includes("learner") ||
    normalized.includes("school") ||
    normalized.includes("all") ||
    Boolean(className && normalized.includes(className.toLowerCase()))
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
export class StudentPortalService {
  private assertStudentSession(session: SessionPayload) {
    if (session.role !== "STUDENT") {
      throw new ForbiddenException("Student portal data is only available to student accounts.");
    }
  }

  private async getStudentContext(session: SessionPayload) {
    this.assertStudentSession(session);

    const student = await prisma.student.findFirst({
      where: { schoolId: session.schoolId, userId: session.userId },
      include: {
        user: true,
        currentClass: true,
        currentSession: true,
        guardians: { include: { guardian: true } },
        medicalRecord: true
      }
    });

    if (!student) {
      throw new NotFoundException("No enrolled student profile is linked to this account.");
    }

    return student;
  }

  private async currentTerm(schoolId: string) {
    return prisma.term.findFirst({
      where: { schoolId, isCurrent: true },
      include: { academicSession: true }
    });
  }

  async getStudentProfile(session: SessionPayload): Promise<StudentPortalProfileView> {
    this.assertStudentSession(session);
    if (env.DEMO_MODE) {
      const portal = getDemoStudentPortalByEmail(session.email);
      return {
        studentId: portal.studentId ?? "demo-student",
        studentName: portal.studentName,
        admissionNumber: portal.admissionNumber ?? "GFC/25/0001",
        className: portal.className,
        session: portal.session ?? "2025/2026",
        term: portal.term ?? "Second Term",
        status: "ACTIVE",
        guardianSummary: { name: "Primary guardian", relationship: "Parent" },
        subjects: Array.from(new Set(portal.weeklyTimetable.map((item) => item.subject)))
      };
    }

    const [student, term] = await Promise.all([this.getStudentContext(session), this.currentTerm(session.schoolId)]);
    const subjects = student.currentClassId
      ? await prisma.classSubject.findMany({
          where: { schoolId: session.schoolId, classId: student.currentClassId },
          include: { subject: true },
          orderBy: { subject: { name: "asc" } }
        })
      : [];
    const primaryGuardian = student.guardians.find((item) => item.isPrimary)?.guardian ?? student.guardians[0]?.guardian;

    return {
      studentId: student.id,
      studentName: formatStudentName(student),
      admissionNumber: student.admissionNumber,
      studentNumber: student.studentNumber ?? undefined,
      className: formatClassName(student.currentClass?.name, student.currentClass?.arm),
      session: student.currentSession?.name ?? term?.academicSession.name,
      term: term?.name,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth.toISOString(),
      admissionDate: student.admissionDate.toISOString(),
      status: student.status,
      nationality: student.nationality,
      stateOfOrigin: student.stateOfOrigin ?? undefined,
      religion: student.religion ?? undefined,
      guardianSummary: {
        name: primaryGuardian ? `${primaryGuardian.firstName} ${primaryGuardian.lastName}` : "No guardian recorded",
        relationship: primaryGuardian?.relationship,
        phone: primaryGuardian?.phone,
        email: primaryGuardian?.email ?? undefined
      },
      contactInfo: {
        email: student.user?.email,
        phone: student.user?.phone ?? undefined
      },
      medical: {
        bloodGroup: student.medicalRecord?.bloodGroup ?? undefined,
        genotype: student.medicalRecord?.genotype ?? undefined,
        allergies: student.medicalRecord?.allergies ?? undefined,
        conditions: student.medicalRecord?.conditions ?? undefined,
        notes: student.medicalRecord?.notes ?? undefined
      },
      subjects: subjects.map((item) => item.subject.name)
    };
  }

  async getStudentAttendance(session: SessionPayload): Promise<StudentPortalAttendanceView> {
    this.assertStudentSession(session);
    if (env.DEMO_MODE) {
      const portal = getDemoStudentPortalByEmail(session.email);
      const rate = Number(portal.stats.find((item) => item.label === "Attendance")?.value.replace("%", "") ?? 0);
      return {
        summary: {
          totalDays: 20,
          present: Math.round((rate / 100) * 20),
          absent: Math.max(20 - Math.round((rate / 100) * 20), 0),
          late: rate < 90 ? 2 : 1,
          excused: 0,
          attendanceRate: rate,
          lowAttendanceWarning: rate < 90 ? "Attendance is below the 90% watch threshold." : undefined
        },
        records: [],
        chart: [
          { label: "Present", value: Math.round((rate / 100) * 20) },
          { label: "Absent", value: Math.max(20 - Math.round((rate / 100) * 20), 0) }
        ]
      };
    }

    const student = await this.getStudentContext(session);
    const records = await prisma.studentAttendance.findMany({
      where: { schoolId: session.schoolId, studentId: student.id },
      orderBy: { date: "desc" },
      take: 120
    });

    return buildAttendanceView(records);
  }

  async getStudentResults(session: SessionPayload): Promise<PortalResultHistory[]> {
    this.assertStudentSession(session);
    if (env.DEMO_MODE) {
      return getDemoStudentPortalByEmail(session.email).resultHistory;
    }

    const student = await this.getStudentContext(session);
    const sheets = await prisma.resultSheet.findMany({
      where: {
        schoolId: session.schoolId,
        studentId: student.id,
        status: "PUBLISHED",
        publishedAt: { not: null }
      },
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

  async getStudentTimetable(session: SessionPayload) {
    this.assertStudentSession(session);
    if (env.DEMO_MODE) {
      const portal = getDemoStudentPortalByEmail(session.email);
      return {
        weeklyTimetable: portal.weeklyTimetable,
        examTimetable: portal.examTimetable ?? [],
        calendar: portal.calendar ?? []
      };
    }

    const student = await this.getStudentContext(session);
    if (!student.currentClassId) {
      return { weeklyTimetable: [], examTimetable: [], calendar: [] };
    }

    const [term, timetable, exams, events] = await Promise.all([
      this.currentTerm(session.schoolId),
      prisma.timetableEntry.findMany({
        where: { schoolId: session.schoolId, classId: student.currentClassId },
        include: { subject: true },
        orderBy: [{ dayOfWeek: "asc" }, { startsAt: "asc" }]
      }),
      prisma.examTimetableEntry.findMany({
        where: { schoolId: session.schoolId, classId: student.currentClassId },
        include: { subject: true },
        orderBy: { examDate: "asc" }
      }),
      prisma.calendarEvent.findMany({
        where: {
          schoolId: session.schoolId,
          endsAt: { gte: new Date() }
        },
        orderBy: { startsAt: "asc" },
        take: 20
      })
    ]);
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

    const className = formatClassName(student.currentClass?.name, student.currentClass?.arm);
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
        .filter((item) => isStudentAudience(item.audience, className))
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

  async getStudentAssignments(session: SessionPayload): Promise<StudentPortalAssignmentView[]> {
    this.assertStudentSession(session);
    if (env.DEMO_MODE) {
      return getDemoStudentPortalByEmail(session.email).assignments ?? [];
    }

    const student = await this.getStudentContext(session);
    if (!student.currentClassId) return [];

    const assignments = await prisma.assignment.findMany({
      where: {
        schoolId: session.schoolId,
        classId: student.currentClassId,
        status: "PUBLISHED"
      },
      include: {
        subject: true,
        teacher: true,
        submissions: { where: { studentId: student.id } }
      },
      orderBy: { dueAt: "asc" }
    });

    const now = Date.now();
    return assignments.map((assignment) => {
      const submission = assignment.submissions[0];
      const status: StudentPortalAssignmentView["status"] = submission?.gradedAt
        ? "GRADED"
        : submission?.submittedAt
          ? "SUBMITTED"
          : assignment.dueAt.getTime() < now
            ? "OVERDUE"
            : "NOT_STARTED";

      return {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description ?? undefined,
        subject: assignment.subject.name,
        className: formatClassName(student.currentClass?.name, student.currentClass?.arm),
        dueAt: assignment.dueAt.toISOString(),
        status,
        teacherName: `${assignment.teacher.firstName} ${assignment.teacher.lastName}`,
        feedback: submission?.feedback ?? undefined,
        attachmentUrl: assignment.attachmentUrl ?? undefined
      };
    });
  }

  async getStudentFees(session: SessionPayload): Promise<PortalFinanceItem[]> {
    this.assertStudentSession(session);
    if (env.DEMO_MODE) {
      return getDemoStudentPortalByEmail(session.email).finance;
    }

    const student = await this.getStudentContext(session);
    const invoices = await prisma.invoice.findMany({
      where: { schoolId: session.schoolId, studentId: student.id },
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

  async getStudentAnnouncements(session: SessionPayload) {
    this.assertStudentSession(session);
    if (env.DEMO_MODE) {
      return getDemoStudentPortalByEmail(session.email).announcements;
    }

    const student = await this.getStudentContext(session);
    const className = formatClassName(student.currentClass?.name, student.currentClass?.arm);
    const announcements = await prisma.announcement.findMany({
      where: {
        schoolId: session.schoolId,
        publishedAt: { lte: new Date() },
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }]
      },
      orderBy: { publishedAt: "desc" },
      take: 40
    });

    return announcements.filter((item) => isStudentAudience(item.audience, className)).map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.body,
      time: item.publishedAt.toISOString()
    }));
  }

  async getStudentNotifications(session: SessionPayload): Promise<StudentPortalNotificationView[]> {
    this.assertStudentSession(session);
    if (env.DEMO_MODE) {
      return getDemoStudentPortalByEmail(session.email).notifications ?? [];
    }

    await this.getStudentContext(session);
    const notifications = await prisma.notificationLog.findMany({
      where: {
        schoolId: session.schoolId,
        OR: [{ userId: session.userId }, { userId: null }]
      },
      orderBy: { sentAt: "desc" },
      take: 40
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

  async getStudentLibrary(session: SessionPayload): Promise<StudentPortalLibraryLoanView[]> {
    this.assertStudentSession(session);
    if (env.DEMO_MODE) return getDemoStudentPortalByEmail(session.email).library ?? [];

    const student = await this.getStudentContext(session);
    const loans = await prisma.libraryLoan.findMany({
      where: { schoolId: session.schoolId, studentId: student.id },
      include: { book: true },
      orderBy: { dueAt: "asc" }
    });

    return loans.map((loan) => ({
      id: loan.id,
      title: loan.book.title,
      author: loan.book.author,
      borrowedAt: loan.borrowedAt.toISOString(),
      dueAt: loan.dueAt.toISOString(),
      returnedAt: loan.returnedAt?.toISOString(),
      fineAmount: Number(loan.fineAmount)
    }));
  }

  async getStudentHostel(session: SessionPayload): Promise<StudentPortalHostelView[]> {
    this.assertStudentSession(session);
    if (env.DEMO_MODE) return getDemoStudentPortalByEmail(session.email).hostel ?? [];

    const student = await this.getStudentContext(session);
    const allocations = await prisma.hostelAllocation.findMany({
      where: { schoolId: session.schoolId, studentId: student.id },
      include: { room: { include: { building: true } } },
      orderBy: { startDate: "desc" }
    });

    return allocations.map((item) => ({
      building: item.room.building.name,
      room: item.room.name,
      startDate: item.startDate.toISOString(),
      endDate: item.endDate?.toISOString()
    }));
  }

  async getStudentTransport(session: SessionPayload): Promise<StudentPortalTransportView[]> {
    this.assertStudentSession(session);
    if (env.DEMO_MODE) return getDemoStudentPortalByEmail(session.email).transport ?? [];

    const student = await this.getStudentContext(session);
    const assignments = await prisma.transportAssignment.findMany({
      where: { schoolId: session.schoolId, studentId: student.id },
      include: { route: true },
      orderBy: { stopName: "asc" }
    });

    return assignments.map((item) => ({
      routeName: item.route.name,
      driverName: item.route.driverName,
      driverPhone: item.route.driverPhone,
      vehicleRegNo: item.route.vehicleRegNo,
      stopName: item.stopName,
      amount: Number(item.amount)
    }));
  }

  async getStudentServices(session: SessionPayload) {
    this.assertStudentSession(session);
    const [library, hostel, transport] = await Promise.all([
      this.getStudentLibrary(session),
      this.getStudentHostel(session),
      this.getStudentTransport(session)
    ]);

    return { library, hostel, transport };
  }

  async getStudentDashboard(session: SessionPayload): Promise<StudentPortalView> {
    this.assertStudentSession(session);
    if (env.DEMO_MODE) return getDemoStudentPortalByEmail(session.email);

    const [profile, attendance, results, timetable, assignments, finance, announcements, notifications, library, hostel, transport] =
      await Promise.all([
        this.getStudentProfile(session),
        this.getStudentAttendance(session),
        this.getStudentResults(session),
        this.getStudentTimetable(session),
        this.getStudentAssignments(session),
        this.getStudentFees(session),
        this.getStudentAnnouncements(session),
        this.getStudentNotifications(session),
        this.getStudentLibrary(session),
        this.getStudentHostel(session),
        this.getStudentTransport(session)
      ]);
    const outstanding = finance.reduce((sum, item) => sum + item.balance, 0);
    const latestResult = results[0];

    return {
      studentId: profile.studentId,
      studentName: profile.studentName,
      className: profile.className,
      admissionNumber: profile.admissionNumber,
      session: profile.session,
      term: profile.term,
      headline: "Your school week, results, fees, and notices in one place",
      stats: [
        { label: "Attendance", value: `${attendance.summary.attendanceRate}%` },
        { label: "Latest average", value: latestResult ? `${latestResult.average.toFixed(1)}%` : "No result" },
        { label: "Outstanding", value: `NGN ${outstanding.toLocaleString("en-NG")}` }
      ],
      profile,
      attendance,
      latestResult,
      timetablePreview: timetable.weeklyTimetable.slice(0, 3),
      weeklyTimetable: timetable.weeklyTimetable,
      examTimetable: timetable.examTimetable,
      calendar: timetable.calendar,
      assignments,
      resultHistory: results,
      finance,
      announcements,
      notifications,
      library,
      hostel,
      transport
    };
  }
}
