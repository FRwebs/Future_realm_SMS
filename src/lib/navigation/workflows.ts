import type { Route } from "next";
import {
  BarChart3,
  BellRing,
  BookOpen,
  Building2,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  Settings2,
  UserPlus,
  Users,
} from "lucide-react";

import { canAccessPath } from "@/lib/auth/roles";
import type { Role } from "@/lib/domain/types";

export type WorkflowNavItem = {
  href: Route;
  label: string;
  description: string;
  icon: LucideIcon;
};

export type WorkflowNavGroup = {
  title: string;
  eyebrow: string;
  description: string;
  items: WorkflowNavItem[];
};

export const workflowNavGroups: WorkflowNavGroup[] = [
  {
    title: "Start Here",
    eyebrow: "Daily command",
    description:
      "Begin with the school-wide snapshot before drilling into operational work.",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        description:
          "Today's attendance, finance, admissions, alerts, and term context.",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Student Lifecycle",
    eyebrow: "From applicant to alumnus",
    description:
      "Admissions Officer manages intake/review, Principal/Admin decides, Bursar clears payment, and Admin Officer enrolls.",
    items: [
      {
        href: "/admissions",
        label: "Admissions",
        description:
          "Intake, documents, fee checks, screening, decisions, offers, clearance, settings, and reports.",
        icon: UserPlus,
      },
      {
        href: "/students",
        label: "Students",
        description:
          "Admin Officer registration, student profiles, guardians, medical notes, risk flags, and promotion.",
        icon: Users,
      },
    ],
  },
  {
    title: "Academic Operations",
    eyebrow: "Teaching week",
    description:
      "Capture what happens in class before producing results and report cards.",
    items: [
      {
        href: "/attendance",
        label: "Attendance",
        description:
          "Daily class attendance, late/absent reasons, and parent alert follow-up.",
        icon: BellRing,
      },
      {
        href: "/academics/curriculum" as Route,
        label: "Scheme of Work",
        description:
          "Termly Nigerian curriculum topics, weekly coverage, and teaching progress.",
        icon: BookOpen,
      },
      {
        href: "/academics/subjects" as Route,
        label: "Subjects",
        description:
          "Nigerian subject setup, class applicability, optional tracks, and trade subjects.",
        icon: BookOpen,
      },
      {
        href: "/academics/results/assessments" as Route,
        label: "Assessments & Exams",
        description:
          "Assignments, tests, practicals, exams, candidate lists, and score-entry readiness.",
        icon: GraduationCap,
      },
      {
        href: "/academics/results",
        label: "Results & Broadsheets",
        description:
          "Weighted grading, broadsheets, approvals, publishing, and report cards.",
        icon: GraduationCap,
      },
    ],
  },
  {
    title: "People & Staffing",
    eyebrow: "Teacher oversight",
    description:
      "See teacher workload, subject ownership, attendance, leave, and activity follow-up.",
    items: [
      {
        href: "/teachers",
        label: "Teachers",
        description:
          "Teacher list, subjects, classes, leave, attendance, result tasks, and activities.",
        icon: BookOpen,
      },
      {
        href: "/teachers/attendance" as Route,
        label: "Staff Attendance",
        description:
          "Teacher resumption, closing, punctuality, and attendance corrections.",
        icon: BellRing,
      },
      {
        href: "/teachers/training" as Route,
        label: "Teacher Training",
        description:
          "CPD, seminars, curriculum orientation, certificates, and compliance.",
        icon: GraduationCap,
      },
    ],
  },
  {
    title: "Finance & Collections",
    eyebrow: "Money workflow",
    description:
      "Generate bills, track balances, collect payments, and watch outstanding exposure.",
    items: [
      {
        href: "/finance",
        label: "Fees & Payments",
        description:
          "Invoices, receipts, Paystack/Flutterwave initiation, balances, and audit context.",
        icon: CreditCard,
      },
    ],
  },
  {
    title: "Engagement",
    eyebrow: "School community",
    description:
      "Communicate with parents, students, staff, classes, and role-based audiences.",
    items: [
      {
        href: "/communications",
        label: "Communication",
        description:
          "Announcements, broadcasts, attendance alerts, reminders, and audience messaging.",
        icon: Megaphone,
      },
    ],
  },
  {
    title: "Leadership & Setup",
    eyebrow: "Review and control",
    description:
      "Use reports for decisions, then configure sessions, grading, branding, and permissions.",
    items: [
      {
        href: "/analytics",
        label: "Analytics",
        description:
          "Enrollment trends, attendance analytics, fee collection, risk, and performance reports.",
        icon: BarChart3,
      },
      {
        href: "/settings",
        label: "Settings",
        description:
          "School setup, terms, grading schemas, branding, permissions, and templates.",
        icon: Settings2,
      },
    ],
  },

  {
    title: "My Portal",
    eyebrow: "Student self-service",
    description: "Your personal school portal.",
    items: [
      {
        href: "/portals/student" as Route,
        label: "Dashboard",
        description: "Your student overview and summary.",
        icon: LayoutDashboard,
      },
      {
        href: "/portals/student/profile" as Route,
        label: "My Profile",
        description: "View your personal profile details.",
        icon: Users,
      },
      {
        href: "/portals/student/attendance" as Route,
        label: "Attendance",
        description: "Your attendance record.",
        icon: BellRing,
      },
      {
        href: "/portals/student/results" as Route,
        label: "Results",
        description: "Your term-by-term results.",
        icon: GraduationCap,
      },
      {
        href: "/portals/student/curriculum" as Route,
        label: "Scheme of Work",
        description: "Your class curriculum topics.",
        icon: BookOpen,
      },
      {
        href: "/portals/student/timetable" as Route,
        label: "Timetable",
        description: "Your weekly class schedule.",
        icon: LayoutDashboard,
      },
      {
        href: "/portals/student/assignments" as Route,
        label: "Assignments",
        description: "Tasks and study assignments.",
        icon: BookOpen,
      },
      {
        href: "/portals/student/fees" as Route,
        label: "Fees",
        description: "Your invoices and payment status.",
        icon: CreditCard,
      },
      {
        href: "/portals/student/services" as Route,
        label: "Services",
        description: "School services available to you.",
        icon: Building2,
      },
      {
        href: "/portals/student/announcements" as Route,
        label: "Announcements",
        description: "School notices and updates.",
        icon: Megaphone,
      },
      {
        href: "/portals/student/notifications" as Route,
        label: "Notifications",
        description: "Your personal notifications.",
        icon: BellRing,
      },
    ],
  },
  // ADD: Parent portal group
  {
    title: "My Portal",
    eyebrow: "Parent self-service",
    description: "Your family school portal.",
    items: [
      {
        href: "/portals/parent" as Route,
        label: "Dashboard",
        description: "Family overview and summary.",
        icon: LayoutDashboard,
      },
      {
        href: "/portals/parent/children" as Route,
        label: "My Children",
        description: "View and switch between your children.",
        icon: Users,
      },
      {
        href: "/portals/parent/announcements" as Route,
        label: "Announcements",
        description: "School notices and family updates.",
        icon: Megaphone,
      },
      {
        href: "/portals/parent/curriculum" as Route,
        label: "Scheme of Work",
        description: "Your child's class curriculum topics.",
        icon: BookOpen,
      },
      {
        href: "/portals/parent/notifications" as Route,
        label: "Notifications",
        description: "Your personal notifications.",
        icon: BellRing,
      },
      {
        href: "/portals/parent/profile" as Route,
        label: "Profile",
        description: "Your parent profile and contact details.",
        icon: Users,
      },
    ],
  },

  {
    title: "My Portal",
    eyebrow: "Teacher self-service",
    description: "Your personal teaching portal.",
    items: [
      {
        href: "/portals/teacher" as Route,
        label: "Dashboard",
        description: "Your teaching overview and summary.",
        icon: LayoutDashboard,
      },
      {
        href: "/portals/teacher/classes" as Route,
        label: "My Classes",
        description: "All classes assigned to you.",
        icon: Users,
      },
      {
        href: "/portals/teacher/attendance" as Route,
        label: "Mark Attendance",
        description: "Record student attendance for your classes.",
        icon: BellRing,
      },
      {
        href: "/portals/teacher/scores" as Route,
        label: "Enter Scores",
        description: "Submit assessment and exam scores.",
        icon: GraduationCap,
      },
      {
        href: "/portals/teacher/curriculum" as Route,
        label: "Scheme of Work",
        description: "Your teaching curriculum and weekly coverage.",
        icon: BookOpen,
      },
      {
        href: "/portals/teacher/staff-attendance" as Route,
        label: "Clock In / Out",
        description: "Record your daily resumption and closing.",
        icon: BellRing,
      },
      {
        href: "/portals/teacher/training" as Route,
        label: "Training",
        description: "CPD, seminars, and certificates.",
        icon: GraduationCap,
      },
      {
        href: "/portals/teacher/assignments" as Route,
        label: "Assignments",
        description: "Create and manage learning tasks.",
        icon: BookOpen,
      },
      {
        href: "/portals/teacher/timetable" as Route,
        label: "Timetable",
        description: "Your weekly teaching schedule.",
        icon: LayoutDashboard,
      },
    ],
  },
];

export function getVisibleWorkflowNavGroups(role: Role) {
  // Portal roles only ever see their own group
  if (role === "STUDENT") {
    const group = workflowNavGroups.find(
      (g) => g.eyebrow === "Student self-service",
    );
    return group ? [group] : [];
  }

  if (role === "PARENT") {
    const group = workflowNavGroups.find(
      (g) => g.eyebrow === "Parent self-service",
    );
    return group ? [group] : [];
  }

  if (
    role === "TEACHER" ||
    role === "CLASS_TEACHER" ||
    role === "SUBJECT_TEACHER"
  ) {
    const group = workflowNavGroups.find(
      (g) => g.eyebrow === "Teacher self-service",
    );
    return group ? [group] : [];
  }

  // All other roles see their permitted admin nav groups
  return workflowNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessPath(role, item.href)),
    }))
    .filter((group) => group.items.length > 0);
}

export function getWorkflowNavItemForPath(path: string) {
  const items = workflowNavGroups.flatMap((group) => group.items);
  return items
    .filter((item) => path === item.href || path.startsWith(`${item.href}/`))
    .sort((left, right) => right.href.length - left.href.length)[0];
}
