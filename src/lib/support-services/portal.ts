import type { Route } from "next";

import { apiGet } from "@/lib/api/server";

export type SupportPortalTab = {
  href: Route;
  label: string;
};

export type SupportPortalLayoutConfig = {
  title: string;
  description: string;
  tabs: Array<{ href: string; label: string }>;
};

export type SupportAlertTone = "neutral" | "warning" | "danger";

export type NurseDashboardView = {
  schoolName: string;
  currentSession: string;
  currentTerm: string;
  metrics: {
    visitsToday: number;
    activeQueue: number;
    activeSickLeave: number;
    lowStockCount: number;
    emergenciesThisMonth: number;
  };
  alerts: Array<{ id: string; tone: SupportAlertTone; text: string }>;
  recentVisits: Array<{
    id: string;
    patientName: string;
    className: string;
    complaint: string;
    treatment?: string | null;
    medication?: string | null;
    referral?: string | null;
    visitedAt: string;
    nurseName: string;
  }>;
  lowStock: Array<{
    id: string;
    name: string;
    category: string;
    quantity: number;
    reorderLevel: number;
    location?: string | null;
  }>;
  commonConditions: Array<{ label: string; count: number }>;
  inventory: Array<{
    id: string;
    name: string;
    category: string;
    quantity: number;
    reorderLevel: number;
    unit?: string | null;
    location?: string | null;
  }>;
};

export type NurseHealthProfileView = {
  studentId: string;
  studentName: string;
  admissionNumber?: string | null;
  className: string;
  guardians: Array<{ name: string; phone?: string | null; relationship?: string | null }>;
  visits: NurseDashboardView["recentVisits"];
};

export type LibraryDashboardView = {
  metrics: {
    booksIssuedToday: number;
    booksReturnedToday: number;
    overdueCount: number;
    outstandingFines: number;
    activeMembers: number;
  };
  recentActivity: Array<{
    id: string;
    memberName: string;
    memberMeta: string;
    bookTitle: string;
    action: string;
    at: string;
  }>;
  overdue: Array<{
    id: string;
    memberName: string;
    memberMeta: string;
    bookTitle: string;
    dueAt: string;
    fineAmount: number;
  }>;
  popularBooks: Array<{
    id: string;
    title: string;
    author: string;
    borrowed: number;
    available: number;
    total: number;
  }>;
};

export type FrontDeskDashboardView = {
  now: string;
  metrics: {
    activeVisitors: number;
    todaysVisitors: number;
    todayMeetings: number;
    pendingCallbacks: number;
    parcelsPending: number;
    studentMovements: number;
  };
  activeVisitors: Array<{
    id: string;
    visitorName: string;
    phone?: string | null;
    purpose: string;
    hostName?: string | null;
    passNumber?: string | null;
    status: string;
    timeIn: string;
    timeOut?: string | null;
  }>;
  meetings: Array<{
    id: string;
    title: string;
    scheduledAt: string;
    studentName?: string | null;
    className?: string | null;
    guardianName?: string | null;
    staffName?: string | null;
    status: string;
  }>;
};

export type HostelDashboardView = {
  metrics: {
    totalBoarders: number;
    occupiedBeds: number;
    vacantBeds: number;
    pendingExeats: number;
    overdueReturns: number;
    openIncidents: number;
  };
  rooms: Array<{
    id: string;
    buildingName: string;
    roomName: string;
    capacity: number;
    occupied: number;
    available: number;
  }>;
  boarders: Array<{
    id: string;
    studentId: string;
    studentName: string;
    admissionNumber?: string | null;
    className: string;
    buildingName: string;
    roomName: string;
    startDate: string;
  }>;
};

export type TransportDashboardView = {
  metrics: {
    activeRoutes: number;
    vehiclesOnRoad: number;
    studentsAssigned: number;
    incidentsThisMonth: number;
    fuelSpendThisMonth: number;
  };
  vehicles: Array<{
    id: string;
    plateNumber: string;
    model: string;
    capacity: number;
    driverName?: string | null;
    driverPhone?: string | null;
    status: string;
    routeName?: string | null;
    routeCode?: string | null;
  }>;
  routes: Array<{
    id: string;
    routeName: string;
    routeCode: string;
    driverName?: string | null;
    driverPhone?: string | null;
    vehicleRegNo?: string | null;
    capacity: number;
    assignedStudents: number;
  }>;
  students: Array<{
    id: string;
    studentId: string;
    studentName: string;
    admissionNumber?: string | null;
    className: string;
    routeName: string;
    routeCode: string;
    stopName: string;
    amount: number;
  }>;
  complianceAlerts: Array<{
    id: string;
    entity: string;
    documentType: string;
    expiresAt: string;
    severity: string;
  }>;
};

export async function safeApiGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiGet<T>(path);
  } catch {
    return fallback;
  }
}

export const nursePortalLayout: SupportPortalLayoutConfig = {
  title: "Clinic lanes",
  description:
    "Move between the nurse command center, visit operations, patient records, supply control, and health reporting without dropping out of the clinic workflow.",
  tabs: [
    { href: "/portals/nurse", label: "Dashboard" },
    { href: "/portals/nurse/queue", label: "Clinic Queue" },
    { href: "/portals/nurse/health-profiles", label: "Profiles" },
    { href: "/portals/nurse/inventory", label: "Inventory" },
    { href: "/portals/nurse/health-summary", label: "Reports" },
  ],
};

export const librarianPortalLayout: SupportPortalLayoutConfig = {
  title: "Library lanes",
  description:
    "Stay inside one circulation-driven workspace while switching between issuing, returns, catalog control, members, and reporting.",
  tabs: [
    { href: "/portals/librarian", label: "Dashboard" },
    { href: "/portals/librarian/issue-book", label: "Issue" },
    { href: "/portals/librarian/return-book", label: "Return" },
    { href: "/portals/librarian/all-books", label: "Catalog" },
    { href: "/portals/librarian/all-members", label: "Members" },
  ],
};

export const frontDeskPortalLayout: SupportPortalLayoutConfig = {
  title: "Reception lanes",
  description:
    "Keep the front desk tight and fast by moving between visitor flow, reception meetings, desk reporting, and parent-facing operations from one surface.",
  tabs: [
    { href: "/portals/front-desk", label: "Dashboard" },
    { href: "/portals/front-desk/check-in-visitor", label: "Visitors" },
    { href: "/portals/front-desk/room-availability", label: "Meetings" },
    { href: "/portals/front-desk/daily-activity-report", label: "Reports" },
  ],
};

export const hostelPortalLayout: SupportPortalLayoutConfig = {
  title: "Boarding lanes",
  description:
    "Switch between occupancy, room placement, roll-call readiness, and reporting while staying inside the hostel operating system.",
  tabs: [
    { href: "/portals/hostel", label: "Dashboard" },
    { href: "/portals/hostel/all-boarders", label: "Boarders" },
    { href: "/portals/hostel/room-bed-map", label: "Bed Map" },
    { href: "/portals/hostel/take-roll-call", label: "Roll Call" },
    { href: "/portals/hostel/occupancy-report", label: "Reports" },
  ],
};

export const transportPortalLayout: SupportPortalLayoutConfig = {
  title: "Transport lanes",
  description:
    "Operate fleet, routes, student assignment load, and transport risk from one structured command surface.",
  tabs: [
    { href: "/portals/transport", label: "Dashboard" },
    { href: "/portals/transport/vehicles", label: "Fleet" },
    { href: "/portals/transport/all-routes", label: "Routes" },
    { href: "/portals/transport/transport-students", label: "Students" },
    { href: "/portals/transport/compliance-alerts", label: "Compliance" },
  ],
};

export function supportLabel(value?: string | null) {
  if (!value) return "Not set";
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatSupportDate(value?: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-NG", options ?? { dateStyle: "medium" }).format(new Date(value));
}

export function formatSupportCurrency(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function relativeDaysFromNow(value?: string | null) {
  if (!value) return "No due date";
  const now = new Date();
  const target = new Date(value);
  const diffDays = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays > 0) return `In ${diffDays} day${diffDays === 1 ? "" : "s"}`;
  const abs = Math.abs(diffDays);
  return `${abs} day${abs === 1 ? "" : "s"} ago`;
}

export async function loadNursePortalBundle() {
  const [dashboard, visits] = await Promise.all([
    safeApiGet<NurseDashboardView>("/api/v1/nurse/dashboard", {
      schoolName: "School",
      currentSession: "Current session",
      currentTerm: "Current term",
      metrics: {
        visitsToday: 0,
        activeQueue: 0,
        activeSickLeave: 0,
        lowStockCount: 0,
        emergenciesThisMonth: 0,
      },
      alerts: [],
      recentVisits: [],
      lowStock: [],
      commonConditions: [],
      inventory: [],
    }),
    safeApiGet<Array<NurseDashboardView["recentVisits"][number]>>("/api/v1/nurse/visits", []),
  ]);

  return { dashboard, visits };
}

export async function loadLibraryPortalBundle() {
  const [dashboard, books, loans, members] = await Promise.all([
    safeApiGet<LibraryDashboardView>("/api/v1/library/dashboard", {
      metrics: {
        booksIssuedToday: 0,
        booksReturnedToday: 0,
        overdueCount: 0,
        outstandingFines: 0,
        activeMembers: 0,
      },
      recentActivity: [],
      overdue: [],
      popularBooks: [],
    }),
    safeApiGet<Array<{
      id: string;
      isbn?: string | null;
      title: string;
      author: string;
      copiesTotal: number;
      copiesAvailable: number;
      shelfCode?: string | null;
      loans?: Array<{ id: string }>;
    }>>("/api/v1/library/books", []),
    safeApiGet<Array<{
      id: string;
      borrowedAt: string;
      dueAt: string;
      returnedAt?: string | null;
      fineAmount: number | string;
      book: { title: string; author: string };
      student?: { user?: { firstName: string; lastName: string } | null; classRoom?: { name: string; arm?: string | null } | null } | null;
      staff?: { user?: { firstName: string; lastName: string } | null; department?: { name: string } | null } | null;
    }>>("/api/v1/library/loans", []),
    safeApiGet<{
      students: Array<{ id: string; name: string; memberType: string; memberNumber?: string | null; className: string; activeLoans: number }>;
      staff: Array<{ id: string; name: string; memberType: string; memberNumber?: string | null; className: string; activeLoans: number }>;
    }>("/api/v1/library/members", { students: [], staff: [] }),
  ]);

  return { dashboard, books, loans, members };
}

export async function loadFrontDeskPortalBundle() {
  const [dashboard, visitors, meetings] = await Promise.all([
    safeApiGet<FrontDeskDashboardView>("/api/v1/front-desk/dashboard", {
      now: new Date().toISOString(),
      metrics: {
        activeVisitors: 0,
        todaysVisitors: 0,
        todayMeetings: 0,
        pendingCallbacks: 0,
        parcelsPending: 0,
        studentMovements: 0,
      },
      activeVisitors: [],
      meetings: [],
    }),
    safeApiGet<Array<{
      id: string;
      visitorName: string;
      phone?: string | null;
      purpose: string;
      hostName?: string | null;
      passNumber?: string | null;
      status: string;
      timeIn: string;
      timeOut?: string | null;
    }>>("/api/v1/front-desk/visitors", []),
    safeApiGet<FrontDeskDashboardView["meetings"]>("/api/v1/front-desk/meetings", []),
  ]);

  return { dashboard, visitors, meetings };
}

export async function loadHostelPortalBundle() {
  const [dashboard, boarders, rooms] = await Promise.all([
    safeApiGet<HostelDashboardView>("/api/v1/hostel/dashboard", {
      metrics: {
        totalBoarders: 0,
        occupiedBeds: 0,
        vacantBeds: 0,
        pendingExeats: 0,
        overdueReturns: 0,
        openIncidents: 0,
      },
      rooms: [],
      boarders: [],
    }),
    safeApiGet<Array<{
      id: string;
      student: { admissionNo?: string | null; user?: { firstName: string; lastName: string } | null; classRoom?: { name: string; arm?: string | null } | null };
      room: { name: string; building: { name: string } };
      startDate: string;
      endDate?: string | null;
    }>>("/api/v1/hostel/boarders", []),
    safeApiGet<Array<{
      id: string;
      name: string;
      capacity: number;
      building: { name: string };
      allocations: Array<{ id: string; student: { user?: { firstName: string; lastName: string } | null; classRoom?: { name: string; arm?: string | null } | null } }>;
    }>>("/api/v1/hostel/rooms", []),
  ]);

  return { dashboard, boarders, rooms };
}

export async function loadTransportPortalBundle() {
  const [dashboard, vehicles, routes, students, complianceAlerts] = await Promise.all([
    safeApiGet<TransportDashboardView>("/api/v1/transport/dashboard", {
      metrics: {
        activeRoutes: 0,
        vehiclesOnRoad: 0,
        studentsAssigned: 0,
        incidentsThisMonth: 0,
        fuelSpendThisMonth: 0,
      },
      vehicles: [],
      routes: [],
      students: [],
      complianceAlerts: [],
    }),
    safeApiGet<TransportDashboardView["vehicles"]>("/api/v1/transport/vehicles", []),
    safeApiGet<TransportDashboardView["routes"]>("/api/v1/transport/routes", []),
    safeApiGet<TransportDashboardView["students"]>("/api/v1/transport/students", []),
    safeApiGet<TransportDashboardView["complianceAlerts"]>("/api/v1/transport/compliance-alerts", []),
  ]);

  return { dashboard, vehicles, routes, students, complianceAlerts };
}
