import type { Route } from "next";
import {
  Activity,
  Award,
  BarChart3,
  BellRing,
  Book,
  BookMarked,
  BookOpen,
  Building2,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileCheck,
  FileClock,
  FileText,
  Flag,
  FolderInput,
  GraduationCap,
  Handshake,
  Headphones,
  HeartPulse,
  IdCard,
  Key,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  ListChecks,
  Lock,
  Map,
  MapPinned,
  Megaphone,
  MessageSquareText,
  Package,
  Phone,
  School,
  Server,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  UserCheck,
  UserCircle,
  UserCog,
  UserPlus,
  UserRoundCog,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/lib/domain/types";
import {
  buildNavigation,
  getNavigationItemForPath,
  type NavigationRegistryItem,
} from "@/lib/navigation/registry";

export type WorkflowNavItem = {
  id: string;
  href: Route;
  label: string;
  description: string;
  icon: LucideIcon;
  requiredPermission?: string;
  badge?: string;
  /** An unresolved problem in that module, per the mockup's amber dot. */
  dot?: boolean;
  /** A drawn icon (SVG path on a 24px grid) instead of a named one — the teaching workspace's rail uses these. */
  iconPath?: string;
};

export type WorkflowNavGroup = {
  title: string;
  eyebrow: string;
  description: string;
  items: WorkflowNavItem[];
};

const iconMap: Record<string, LucideIcon> = {
  Activity,
  Award,
  BarChart3,
  BellRing,
  Book,
  BookMarked,
  BookOpen,
  Building2,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileCheck,
  FileClock,
  FileText,
  Flag,
  FolderInput,
  GraduationCap,
  Handshake,
  Headphones,
  HeartPulse,
  IdCard,
  Key,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  ListChecks,
  Lock,
  Map,
  MapPinned,
  Megaphone,
  MessageSquareText,
  Package,
  Phone,
  School,
  Server,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  UserCheck,
  UserCircle,
  UserCog,
  UserPlus,
  UserRoundCog,
  Users,
};

function descriptionFor(item: NavigationRegistryItem) {
  if (item.id.startsWith("sa_")) {
    return "Platform operations workspace for authorized internal users.";
  }

  if (item.group === "Student Portal" || item.group === "Parent Portal") {
    return "Role-scoped self-service workspace.";
  }

  return "Permission-scoped school workflow.";
}

function mapItem(item: NavigationRegistryItem): WorkflowNavItem {
  return {
    id: item.id,
    href: item.path as Route,
    label: item.label,
    description: descriptionFor(item),
    icon: iconMap[item.icon] ?? LayoutDashboard,
    requiredPermission: item.requiredPermissions?.[0],
    badge: item.badge,
    dot: item.dot,
  };
}

function dedupeItemsByHref(items: WorkflowNavItem[]): WorkflowNavItem[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = item.href;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeGroups(groups: WorkflowNavGroup[]): WorkflowNavGroup[] {
  const seenAcrossGroups = new Set<string>();

  return groups
    .map((group) => {
      const uniqueItems = group.items.filter((item) => {
        const key = item.href;
        if (seenAcrossGroups.has(key)) return false;
        seenAcrossGroups.add(key);
        return true;
      });

      return {
        ...group,
        items: uniqueItems,
      };
    })
    .filter((group) => group.items.length > 0);
}

export function getVisibleWorkflowNavGroups(
  role: Role,
  permissions?: string[],
  portalType: "school" | "super_admin" = "school",
  hiddenIds: string[] = [],
): WorkflowNavGroup[] {
  const rawGroups = buildNavigation(portalType, role, permissions);

  const mappedGroups = rawGroups
    .map((group) => ({
      title: group.title,
      eyebrow: group.title,
      description: `${group.title} navigation`,
      items: dedupeItemsByHref(group.items.map(mapItem)).filter((item) => !hiddenIds.includes(item.id)),
    }))
    .filter((group) => group.items.length > 0 || hiddenIds.length === 0);

  return dedupeGroups(mappedGroups);
}

export type TeacherRail = {
  items: Array<{ id: string; href: string; label: string; iconPath: string }>;
  extra: Array<{ id: string; href: string; label: string }>;
  /** A rail kept in titled sections (a student's: My learning, My school, Me). Used instead of `items` when set. */
  groups?: Array<{ title: string; items: Array<{ id: string; href: string; label: string; iconPath: string }> }>;
};

/** The teaching workspace's rail: one flat list in the teacher's order, then whatever more an administrator has granted. */
export function teacherRailGroups(rail: TeacherRail, badges: Record<string, number | undefined> = {}): WorkflowNavGroup[] {
  if (rail.groups) {
    return rail.groups.map((group) => ({
      title: group.title,
      eyebrow: group.title,
      description: group.title || "Your workspace",
      items: group.items.map((item) => ({ id: item.id, href: item.href as Route, label: item.label, description: "Your student workspace", icon: LayoutDashboard, iconPath: item.iconPath, badge: badges[item.id] ? String(badges[item.id]) : undefined })),
    }));
  }
  const groups: WorkflowNavGroup[] = [
    {
      title: "",
      eyebrow: "",
      description: "Your modules",
      items: rail.items.map((item) => ({ id: item.id, href: item.href as Route, label: item.label, description: "Your teaching workspace", icon: LayoutDashboard, iconPath: item.iconPath, badge: badges[item.id] ? String(badges[item.id]) : undefined })),
    },
  ];
  if (rail.extra.length) {
    groups.push({
      title: "Also granted to you",
      eyebrow: "Also granted to you",
      description: "Modules your school has added",
      items: rail.extra.map((item) => ({ id: item.id, href: item.href as Route, label: item.label, description: "Granted by your school", icon: iconMap[getNavigationItemForPath(item.href)?.icon ?? ""] ?? LayoutDashboard })),
    });
  }
  return groups;
}

export function getWorkflowNavItemForPath(path: string) {
  const item = getNavigationItemForPath(path);
  return item ? mapItem(item) : undefined;
}
