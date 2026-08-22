import type { Route } from "next";
import {
  Activity,
  Award,
  BarChart3,
  BellRing,
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
  GraduationCap,
  Headphones,
  HeartPulse,
  Key,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  Map,
  MapPinned,
  Megaphone,
  Package,
  Phone,
  Settings2,
  ShieldCheck,
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
  href: Route;
  label: string;
  description: string;
  icon: LucideIcon;
  requiredPermission?: string;
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
  GraduationCap,
  Headphones,
  HeartPulse,
  Key,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  Map,
  MapPinned,
  Megaphone,
  Package,
  Phone,
  Settings2,
  ShieldCheck,
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

  if (
    item.group === "Student Portal" ||
    item.group === "Parent Portal" ||
    item.group === "Teacher Portal"
  ) {
    return "Role-scoped self-service workspace.";
  }

  return "Permission-scoped school workflow.";
}

function mapItem(item: NavigationRegistryItem): WorkflowNavItem {
  return {
    href: item.path as Route,
    label: item.label,
    description: descriptionFor(item),
    icon: iconMap[item.icon] ?? LayoutDashboard,
    requiredPermission: item.requiredPermissions?.[0],
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
): WorkflowNavGroup[] {
  const rawGroups = buildNavigation(portalType, role, permissions);

  const mappedGroups = rawGroups.map((group) => ({
    title: group.title,
    eyebrow: group.title,
    description: `${group.title} navigation`,
    items: dedupeItemsByHref(group.items.map(mapItem)),
  }));

  return dedupeGroups(mappedGroups);
}

export function getWorkflowNavItemForPath(path: string) {
  const item = getNavigationItemForPath(path);
  return item ? mapItem(item) : undefined;
}
