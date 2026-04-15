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
  Users
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
    description: "Begin with the school-wide snapshot before drilling into operational work.",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        description: "Today's attendance, finance, admissions, alerts, and term context.",
        icon: LayoutDashboard
      }
    ]
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
        description: "Intake, documents, fee checks, screening, decisions, offers, clearance, settings, and reports.",
        icon: UserPlus
      },
      {
        href: "/students",
        label: "Students",
        description: "Admin Officer registration, student profiles, guardians, medical notes, risk flags, and promotion.",
        icon: Users
      }
    ]
  },
  {
    title: "Academic Operations",
    eyebrow: "Teaching week",
    description: "Capture what happens in class before producing results and report cards.",
    items: [
      {
        href: "/attendance",
        label: "Attendance",
        description: "Daily class attendance, late/absent reasons, and parent alert follow-up.",
        icon: BellRing
      },
      {
        href: "/academics/curriculum" as Route,
        label: "Scheme of Work",
        description: "Termly Nigerian curriculum topics, weekly coverage, and teaching progress.",
        icon: BookOpen
      },
      {
        href: "/academics/subjects" as Route,
        label: "Subjects",
        description: "Nigerian subject setup, class applicability, optional tracks, and trade subjects.",
        icon: BookOpen
      },
      {
        href: "/academics/results/assessments" as Route,
        label: "Assessments & Exams",
        description: "Assignments, tests, practicals, exams, candidate lists, and score-entry readiness.",
        icon: GraduationCap
      },
      {
        href: "/academics/results",
        label: "Results & Broadsheets",
        description: "Weighted grading, broadsheets, approvals, publishing, and report cards.",
        icon: GraduationCap
      }
    ]
  },
  {
    title: "People & Staffing",
    eyebrow: "Teacher oversight",
    description: "See teacher workload, subject ownership, attendance, leave, and activity follow-up.",
    items: [
      {
        href: "/teachers",
        label: "Teachers",
        description: "Teacher list, subjects, classes, leave, attendance, result tasks, and activities.",
        icon: BookOpen
      },
      {
        href: "/teachers/attendance" as Route,
        label: "Staff Attendance",
        description: "Teacher resumption, closing, punctuality, and attendance corrections.",
        icon: BellRing
      },
      {
        href: "/teachers/training" as Route,
        label: "Teacher Training",
        description: "CPD, seminars, curriculum orientation, certificates, and compliance.",
        icon: GraduationCap
      }
    ]
  },
  {
    title: "Finance & Collections",
    eyebrow: "Money workflow",
    description: "Generate bills, track balances, collect payments, and watch outstanding exposure.",
    items: [
      {
        href: "/finance",
        label: "Fees & Payments",
        description: "Invoices, receipts, Paystack/Flutterwave initiation, balances, and audit context.",
        icon: CreditCard
      }
    ]
  },
  {
    title: "Engagement",
    eyebrow: "School community",
    description: "Communicate with parents, students, staff, classes, and role-based audiences.",
    items: [
      {
        href: "/communications",
        label: "Communication",
        description: "Announcements, broadcasts, attendance alerts, reminders, and audience messaging.",
        icon: Megaphone
      }
    ]
  },
  {
    title: "Leadership & Setup",
    eyebrow: "Review and control",
    description: "Use reports for decisions, then configure sessions, grading, branding, and permissions.",
    items: [
      {
        href: "/analytics",
        label: "Analytics",
        description: "Enrollment trends, attendance analytics, fee collection, risk, and performance reports.",
        icon: BarChart3
      },
      {
        href: "/settings",
        label: "Settings",
        description: "School setup, terms, grading schemas, branding, permissions, and templates.",
        icon: Settings2
      }
    ]
  },
  {
    title: "Personal Portals",
    eyebrow: "Self-service",
    description: "Role-specific access for parents, teachers, and students.",
    items: [
      {
        href: "/portals/parent",
        label: "Parent Portal",
        description: "Children, attendance, results, invoices, announcements, assignments, and messages.",
        icon: Building2
      },
      {
        href: "/portals/teacher",
        label: "Teacher Portal",
        description: "Teaching schedule, assigned classes, score entry, comments, and class updates.",
        icon: BookOpen
      },
      {
        href: "/portals/student",
        label: "Student Portal",
        description: "Timetable, results, assignments, fees, announcements, and study updates.",
        icon: GraduationCap
      }
    ]
  }
];

export function getVisibleWorkflowNavGroups(role: Role) {
  return workflowNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessPath(role, item.href))
    }))
    .filter((group) => group.items.length > 0);
}

export function getWorkflowNavItemForPath(path: string) {
  const items = workflowNavGroups.flatMap((group) => group.items);
  return items
    .filter((item) => path === item.href || path.startsWith(`${item.href}/`))
    .sort((left, right) => right.href.length - left.href.length)[0];
}
