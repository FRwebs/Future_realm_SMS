import { Injectable, NotFoundException } from "@nestjs/common";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

function startOfToday() {
  return new Date(new Date().toDateString());
}

function fullName(parts?: {
  firstName?: string | null;
  lastName?: string | null;
} | null) {
  return [parts?.firstName, parts?.lastName].filter(Boolean).join(" ").trim() || "Unknown";
}

function studentName(student?: {
  firstName?: string | null;
  lastName?: string | null;
  user?: { firstName?: string | null; lastName?: string | null } | null;
} | null) {
  if (!student) return "Unknown";
  return fullName(student.user) || fullName(student);
}

function classLabel(classRoom?: { name?: string | null; arm?: string | null } | null) {
  return [classRoom?.name, classRoom?.arm].filter(Boolean).join("") || "Unassigned";
}

function guardianName(guardian?: { firstName?: string | null; lastName?: string | null } | null) {
  return fullName(guardian);
}

@Injectable()
export class SupportPortalsService {
  async getNurseDashboard(session: SessionPayload) {
    const schoolId = session.schoolId;
    const today = startOfToday();
    const [school, visits, inventory] = await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
      prisma.healthVisit.findMany({
        where: { schoolId, deletedAt: null },
        include: {
          student: { include: { currentClass: true, user: true } },
          nurse: true,
        },
        orderBy: { visitedAt: "desc" },
        take: 50,
      }),
      prisma.inventoryItem.findMany({
        where: { schoolId, deletedAt: null },
        orderBy: [{ quantity: "asc" }, { name: "asc" }],
        take: 100,
      }),
    ]);

    const visitsToday = visits.filter((item) => item.visitedAt >= today);
    const lowStock = inventory.filter((item) => item.quantity <= item.reorderLevel);
    const complaintBuckets = new Map<string, number>();

    for (const visit of visits) {
      const key = visit.complaint?.trim() || "General care";
      complaintBuckets.set(key, (complaintBuckets.get(key) ?? 0) + 1);
    }

    return {
      schoolName: school?.name ?? "School",
      currentSession: "Current session",
      currentTerm: "Current term",
      metrics: {
        visitsToday: visitsToday.length,
        activeQueue: visitsToday.length,
        activeSickLeave: 0,
        lowStockCount: lowStock.length,
        emergenciesThisMonth: 0,
      },
      alerts: lowStock.slice(0, 4).map((item) => ({
        id: item.id,
        tone: item.quantity === 0 ? "danger" : "warning",
        text: `${item.name} is at ${item.quantity}${item.unit ? ` ${item.unit}` : ""} against reorder level ${item.reorderLevel}.`,
      })),
      recentVisits: visits.slice(0, 12).map((item) => ({
        id: item.id,
        patientName: studentName(item.student),
        className: classLabel(item.student.currentClass),
        complaint: item.complaint,
        treatment: item.treatment,
        medication: item.medication,
        referral: item.referral,
        visitedAt: item.visitedAt.toISOString(),
        nurseName: fullName(item.nurse),
      })),
      lowStock: lowStock.slice(0, 8).map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        reorderLevel: item.reorderLevel,
        location: item.location,
      })),
      commonConditions: Array.from(complaintBuckets.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 6)
        .map(([label, count]) => ({ label, count })),
      inventory: inventory.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        reorderLevel: item.reorderLevel,
        unit: item.unit,
        location: item.location,
      })),
    };
  }

  async listNurseVisits(session: SessionPayload) {
    return prisma.healthVisit.findMany({
      where: { schoolId: session.schoolId, deletedAt: null },
      include: {
        student: { include: { currentClass: true, user: true } },
        nurse: true,
      },
      orderBy: { visitedAt: "desc" },
      take: 100,
    });
  }

  async getNurseHealthProfile(session: SessionPayload, studentId: string) {
    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId: session.schoolId },
      include: {
        user: true,
        currentClass: true,
        medicalRecord: true,
        guardians: {
          include: { guardian: true },
          take: 3,
        },
        healthVisits: {
          where: { deletedAt: null },
          include: { nurse: true },
          orderBy: { visitedAt: "desc" },
          take: 10,
        },
      },
    });

    if (!student) throw new NotFoundException("Student not found.");

    return {
      studentId: student.id,
      studentName: studentName(student),
      admissionNumber: student.admissionNumber,
      className: classLabel(student.currentClass),
      bloodGroup: student.medicalRecord?.bloodGroup ?? null,
      genotype: student.medicalRecord?.genotype ?? null,
      allergies: student.medicalRecord?.allergies ?? null,
      conditions: student.medicalRecord?.conditions ?? null,
      guardians: student.guardians.map((item) => ({
        name: guardianName(item.guardian),
        phone: item.guardian.phone,
        relationship: item.guardian.relationship,
      })),
      visits: student.healthVisits.map((visit) => ({
        id: visit.id,
        patientName: studentName(student),
        className: classLabel(student.currentClass),
        complaint: visit.complaint,
        treatment: visit.treatment,
        medication: visit.medication,
        referral: visit.referral,
        visitedAt: visit.visitedAt.toISOString(),
        nurseName: fullName(visit.nurse),
      })),
    };
  }

  async getLibraryDashboard(session: SessionPayload) {
    const schoolId = session.schoolId;
    const today = startOfToday();

    const [books, loans] = await Promise.all([
      prisma.libraryBook.findMany({
        where: { schoolId },
        include: { loans: true },
        orderBy: { title: "asc" },
        take: 120,
      }),
      prisma.libraryLoan.findMany({
        where: { schoolId },
        include: {
          book: true,
          student: { include: { currentClass: true, user: true } },
          staff: { include: { user: true, department: true } },
        },
        orderBy: { borrowedAt: "desc" },
        take: 200,
      }),
    ]);

    const activeLoans = loans.filter((item) => !item.returnedAt);
    const overdueLoans = activeLoans.filter((item) => item.dueAt < new Date());
    const returnedToday = loans.filter((item) => item.returnedAt && item.returnedAt >= today);
    const issuedToday = loans.filter((item) => item.borrowedAt >= today);

    return {
      metrics: {
        booksIssuedToday: issuedToday.length,
        booksReturnedToday: returnedToday.length,
        overdueCount: overdueLoans.length,
        outstandingFines: overdueLoans.reduce((sum, item) => sum + Number(item.fineAmount ?? 0), 0),
        activeMembers: new Set(activeLoans.map((item) => item.studentId ?? item.staffId ?? item.id)).size,
      },
      recentActivity: loans.slice(0, 12).map((loan) => ({
        id: loan.id,
        memberName: loan.student ? studentName(loan.student) : fullName(loan.staff?.user),
        memberMeta: loan.student ? classLabel(loan.student.currentClass) : loan.staff?.department?.name ?? "Staff",
        bookTitle: loan.book.title,
        action: loan.returnedAt ? "Returned" : "Issued",
        at: (loan.returnedAt ?? loan.borrowedAt).toISOString(),
      })),
      overdue: overdueLoans.slice(0, 12).map((loan) => ({
        id: loan.id,
        memberName: loan.student ? studentName(loan.student) : fullName(loan.staff?.user),
        memberMeta: loan.student ? classLabel(loan.student.currentClass) : loan.staff?.department?.name ?? "Staff",
        bookTitle: loan.book.title,
        dueAt: loan.dueAt.toISOString(),
        fineAmount: Number(loan.fineAmount ?? 0),
      })),
      popularBooks: books
        .map((book) => ({
          id: book.id,
          title: book.title,
          author: book.author,
          borrowed: book.loans.length,
          available: book.copiesAvailable,
          total: book.copiesTotal,
        }))
        .sort((left, right) => right.borrowed - left.borrowed)
        .slice(0, 8),
    };
  }

  async listLibraryBooks(session: SessionPayload) {
    return prisma.libraryBook.findMany({
      where: { schoolId: session.schoolId },
      include: { loans: true },
      orderBy: { title: "asc" },
      take: 200,
    });
  }

  async listLibraryLoans(session: SessionPayload) {
    return prisma.libraryLoan.findMany({
      where: { schoolId: session.schoolId },
      include: {
        book: true,
        student: { include: { currentClass: true, user: true } },
        staff: { include: { user: true, department: true } },
      },
      orderBy: { borrowedAt: "desc" },
      take: 200,
    });
  }

  async listLibraryMembers(session: SessionPayload) {
    const [students, staff, loans] = await Promise.all([
      prisma.student.findMany({
        where: { schoolId: session.schoolId },
        include: { user: true, currentClass: true },
        take: 200,
        orderBy: { admissionNumber: "asc" },
      }),
      prisma.staffProfile.findMany({
        where: { schoolId: session.schoolId },
        include: { user: true, department: true },
        take: 100,
        orderBy: { employeeNo: "asc" },
      }),
      prisma.libraryLoan.findMany({
        where: { schoolId: session.schoolId, returnedAt: null },
        select: { studentId: true, staffId: true },
      }),
    ]);

    const studentCounts = new Map<string, number>();
    const staffCounts = new Map<string, number>();

    for (const loan of loans) {
      if (loan.studentId) studentCounts.set(loan.studentId, (studentCounts.get(loan.studentId) ?? 0) + 1);
      if (loan.staffId) staffCounts.set(loan.staffId, (staffCounts.get(loan.staffId) ?? 0) + 1);
    }

    return {
      students: students.map((student) => ({
        id: student.id,
        name: studentName(student),
        memberType: "STUDENT",
        memberNumber: student.admissionNumber,
        className: classLabel(student.currentClass),
        activeLoans: studentCounts.get(student.id) ?? 0,
      })),
      staff: staff.map((item) => ({
        id: item.id,
        name: fullName(item.user),
        memberType: "STAFF",
        memberNumber: item.employeeNo,
        className: item.department?.name ?? "Staff",
        activeLoans: staffCounts.get(item.id) ?? 0,
      })),
    };
  }

  async getFrontDeskDashboard(session: SessionPayload) {
    const schoolId = session.schoolId;
    const today = startOfToday();

    const [visitors, meetings] = await Promise.all([
      prisma.visitorLog.findMany({
        where: { schoolId, deletedAt: null },
        include: { hostUser: true, createdBy: true },
        orderBy: { timeIn: "desc" },
        take: 100,
      }),
      prisma.parentMeeting.findMany({
        where: { schoolId, deletedAt: null },
        include: {
          student: { include: { currentClass: true, user: true } },
          guardian: true,
          staff: { include: { user: true } },
        },
        orderBy: { scheduledAt: "asc" },
        take: 60,
      }),
    ]);

    const activeVisitors = visitors.filter((item) => !item.timeOut);
    const todayVisitors = visitors.filter((item) => item.timeIn >= today);
    const todayMeetings = meetings.filter((item) => item.scheduledAt >= today);

    return {
      now: new Date().toISOString(),
      metrics: {
        activeVisitors: activeVisitors.length,
        todaysVisitors: todayVisitors.length,
        todayMeetings: todayMeetings.length,
        pendingCallbacks: 0,
        parcelsPending: 0,
        studentMovements: 0,
      },
      activeVisitors: activeVisitors.slice(0, 12).map((item) => ({
        id: item.id,
        visitorName: item.visitorName,
        phone: item.phone,
        purpose: item.purpose,
        hostName: item.hostName ?? fullName(item.hostUser),
        passNumber: item.passNumber,
        status: item.status,
        timeIn: item.timeIn.toISOString(),
        timeOut: item.timeOut?.toISOString() ?? null,
      })),
      meetings: todayMeetings.slice(0, 10).map((meeting) => ({
        id: meeting.id,
        title: meeting.title,
        scheduledAt: meeting.scheduledAt.toISOString(),
        studentName: meeting.student ? studentName(meeting.student) : null,
        className: meeting.student ? classLabel(meeting.student.currentClass) : null,
        guardianName: guardianName(meeting.guardian),
        staffName: fullName(meeting.staff?.user),
        status: meeting.status,
      })),
    };
  }

  async listFrontDeskVisitors(session: SessionPayload) {
    const visitors = await prisma.visitorLog.findMany({
      where: { schoolId: session.schoolId, deletedAt: null },
      include: { hostUser: true, createdBy: true },
      orderBy: { timeIn: "desc" },
      take: 200,
    });

    return visitors.map((item) => ({
      id: item.id,
      visitorName: item.visitorName,
      phone: item.phone,
      purpose: item.purpose,
      hostName: item.hostName ?? fullName(item.hostUser),
      passNumber: item.passNumber,
      status: item.status,
      timeIn: item.timeIn.toISOString(),
      timeOut: item.timeOut?.toISOString() ?? null,
    }));
  }

  async listFrontDeskMeetings(session: SessionPayload) {
    const meetings = await prisma.parentMeeting.findMany({
      where: { schoolId: session.schoolId, deletedAt: null },
      include: {
        student: { include: { currentClass: true, user: true } },
        guardian: true,
        staff: { include: { user: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 100,
    });

    return meetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      scheduledAt: meeting.scheduledAt.toISOString(),
      studentName: meeting.student ? studentName(meeting.student) : null,
      className: meeting.student ? classLabel(meeting.student.currentClass) : null,
      guardianName: guardianName(meeting.guardian),
      staffName: fullName(meeting.staff?.user),
      status: meeting.status,
    }));
  }

  async getHostelDashboard(session: SessionPayload) {
    const allocations = await prisma.hostelAllocation.findMany({
      where: { schoolId: session.schoolId, endDate: null },
      include: {
        room: { include: { building: true } },
        student: { include: { currentClass: true, user: true } },
      },
      orderBy: { startDate: "desc" },
      take: 300,
    });

    const roomMap = new Map<
      string,
      {
        id: string;
        roomName: string;
        buildingName: string;
        capacity: number;
        occupants: Array<(typeof allocations)[number]>;
      }
    >();

    for (const allocation of allocations) {
      const current = roomMap.get(allocation.roomId) ?? {
        id: allocation.room.id,
        roomName: allocation.room.name,
        buildingName: allocation.room.building.name,
        capacity: allocation.room.capacity,
        occupants: [],
      };
      current.occupants.push(allocation);
      roomMap.set(allocation.roomId, current);
    }

    const rooms = Array.from(roomMap.values());
    const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0);
    const totalOccupied = rooms.reduce((sum, room) => sum + room.occupants.length, 0);

    return {
      metrics: {
        totalBoarders: allocations.length,
        occupiedBeds: totalOccupied,
        vacantBeds: Math.max(totalCapacity - totalOccupied, 0),
        pendingExeats: 0,
        overdueReturns: 0,
        openIncidents: 0,
      },
      rooms: rooms.map((room) => ({
        id: room.id,
        buildingName: room.buildingName,
        roomName: room.roomName,
        capacity: room.capacity,
        occupied: room.occupants.length,
        available: Math.max(room.capacity - room.occupants.length, 0),
      })),
      boarders: allocations.slice(0, 80).map((item) => ({
        id: item.id,
        studentId: item.student.id,
        studentName: studentName(item.student),
        admissionNumber: item.student.admissionNumber,
        className: classLabel(item.student.currentClass),
        buildingName: item.room.building.name,
        roomName: item.room.name,
        startDate: item.startDate.toISOString(),
      })),
    };
  }

  async listHostelBoarders(session: SessionPayload) {
    return prisma.hostelAllocation.findMany({
      where: { schoolId: session.schoolId },
      include: {
        room: { include: { building: true } },
        student: { include: { currentClass: true, user: true } },
        academicSession: true,
      },
      orderBy: { startDate: "desc" },
      take: 200,
    });
  }

  async listHostelRooms(session: SessionPayload) {
    return prisma.hostelRoom.findMany({
      where: { schoolId: session.schoolId },
      include: {
        building: true,
        allocations: {
          where: { endDate: null },
          include: { student: { include: { currentClass: true, user: true } } },
        },
      },
      orderBy: { name: "asc" },
      take: 200,
    });
  }

  async getTransportDashboard(session: SessionPayload) {
    const schoolId = session.schoolId;
    const [routes, vehicles, assignments] = await Promise.all([
      prisma.transportRoute.findMany({
        where: { schoolId },
        include: {
          assignments: { include: { student: { include: { currentClass: true, user: true } } } },
          vehicles: true,
        },
        orderBy: { code: "asc" },
        take: 100,
      }),
      prisma.transportVehicle.findMany({
        where: { schoolId, deletedAt: null },
        include: { route: true },
        orderBy: { plateNumber: "asc" },
        take: 100,
      }),
      prisma.transportAssignment.findMany({
        where: { schoolId },
        include: { student: { include: { currentClass: true, user: true } }, route: true },
        orderBy: { stopName: "asc" },
        take: 300,
      }),
    ]);

    return {
      metrics: {
        activeRoutes: routes.length,
        vehiclesOnRoad: vehicles.filter((item) => item.status === "ACTIVE").length,
        studentsAssigned: assignments.length,
        incidentsThisMonth: 0,
        fuelSpendThisMonth: 0,
      },
      vehicles: vehicles.map((vehicle) => ({
        id: vehicle.id,
        plateNumber: vehicle.plateNumber,
        model: vehicle.model,
        capacity: vehicle.capacity,
        driverName: vehicle.driverName,
        driverPhone: vehicle.driverPhone,
        status: vehicle.status,
        routeName: vehicle.route?.name ?? null,
        routeCode: vehicle.route?.code ?? null,
      })),
      routes: routes.map((route) => ({
        id: route.id,
        routeName: route.name,
        routeCode: route.code,
        driverName: route.driverName,
        driverPhone: route.driverPhone,
        vehicleRegNo: route.vehicleRegNo,
        capacity: route.capacity,
        assignedStudents: route.assignments.length,
      })),
      students: assignments.map((item) => ({
        id: item.id,
        studentId: item.student.id,
        studentName: studentName(item.student),
        admissionNumber: item.student.admissionNumber,
        className: classLabel(item.student.currentClass),
        routeName: item.route.name,
        routeCode: item.route.code,
        stopName: item.stopName,
        amount: Number(item.amount),
      })),
      complianceAlerts: [] as Array<{ id: string; entity: string; documentType: string; expiresAt: string; severity: string }>,
    };
  }

  async listTransportVehicles(session: SessionPayload) {
    return prisma.transportVehicle.findMany({
      where: { schoolId: session.schoolId, deletedAt: null },
      include: { route: true },
      orderBy: { plateNumber: "asc" },
      take: 100,
    });
  }

  async listTransportRoutes(session: SessionPayload) {
    return prisma.transportRoute.findMany({
      where: { schoolId: session.schoolId },
      include: {
        assignments: { include: { student: { include: { currentClass: true, user: true } } } },
        vehicles: true,
      },
      orderBy: { code: "asc" },
      take: 100,
    });
  }

  async listTransportStudents(session: SessionPayload) {
    return prisma.transportAssignment.findMany({
      where: { schoolId: session.schoolId },
      include: { student: { include: { currentClass: true, user: true } }, route: true },
      orderBy: { stopName: "asc" },
      take: 250,
    });
  }

  async listTransportComplianceAlerts(_session: SessionPayload) {
    return [] as Array<{
      id: string;
      entity: string;
      documentType: string;
      expiresAt: string;
      severity: string;
    }>;
  }
}
