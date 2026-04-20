"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Award,
  BarChart2,
  Bell,
  BookMarked,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  Bus,
  Calendar,
  CalendarDays,
  CalendarOff,
  CheckSquare,
  ChevronDown,
  Clock,
  CreditCard,
  DollarSign,
  Eye,
  FileCheck,
  FileText,
  Flag,
  GraduationCap,
  Headphones,
  HeartPulse,
  HelpCircle,
  Key,
  KeyRound,
  LayoutGrid,
  List,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  RefreshCcw,
  ScrollText,
  Settings,
  Shield,
  Terminal,
  TrendingUp,
  User,
  UserCog,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";

import { roleLabels } from "@/lib/auth/roles";
import type {
  SessionUser,
  StudentPortalNotificationView,
} from "@/lib/domain/types";
import type { PortalType } from "@/lib/navigation/registry";
import { getRoleAccent } from "@/lib/navigation/registry";
import { getWorkflowNavItemForPath } from "@/lib/navigation/workflows";
import { cn } from "@/lib/utils/cn";

type TopbarProps = {
  session: SessionUser;
  onOpenMobileSidebar: () => void;
  permissions?: string[];
  portalType?: PortalType;
  schoolName?: string;
};

type DropdownItem = {
  label: string;
  icon: keyof typeof iconMap;
  path?: string;
  action?: "logout";
  permission?: string;
  danger?: boolean;
};

const iconMap = {
  AlertCircle,
  Award,
  BarChart2,
  Bell,
  BookMarked,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  Bus,
  Calendar,
  CalendarDays,
  CalendarOff,
  CheckSquare,
  Clock,
  CreditCard,
  DollarSign,
  Eye,
  FileCheck,
  FileText,
  Flag,
  GraduationCap,
  Headphones,
  HeartPulse,
  HelpCircle,
  Key,
  KeyRound,
  LayoutGrid,
  List,
  Lock,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCcw,
  ScrollText,
  Settings,
  Shield,
  Terminal,
  TrendingUp,
  User,
  UserCog,
  UserPlus,
  Users,
  Zap,
};

const chromeButton =
  "inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/80 bg-white/78 text-ink/55 shadow-[0_8px_22px_rgba(18,33,23,0.06)] ring-1 ring-ink/[0.03] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:text-ink hover:shadow-[0_12px_28px_rgba(18,33,23,0.10)]";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function pageTitle(pathname: string) {
  const workflowItem = getWorkflowNavItemForPath(pathname);
  if (workflowItem?.label) return workflowItem.label;
  const segment = pathname.split("/").filter(Boolean).at(-1);
  if (!segment) return "Dashboard";
  return segment
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function notificationsEndpoint(session: SessionUser, portalType: PortalType) {
  if (portalType === "super_admin") return null;
  if (session.role === "PARENT") return "/api/v1/parent-portal/notifications";
  if (session.role === "STUDENT") return "/api/v1/student-portal/notifications";
  if (["TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER"].includes(session.role))
    return "/api/v1/teacher-portal/notifications";
  return null;
}

function dropdownItemsFor(session: SessionUser): DropdownItem[] {
  const profilePath =
    session.role === "PARENT"
      ? "/portals/parent/profile"
      : session.role === "STUDENT"
        ? "/portals/student/profile"
        : session.role.startsWith("PLATFORM_") || session.role === "SUPER_ADMIN"
          ? "/super-admin"
          : "/school/profile";

  const common: DropdownItem[] = [
    {
      label: "My Profile",
      icon: "User",
      path: profilePath,
    },
  ];

  return [
    ...common,
    {
      label: "My Permissions",
      icon: "KeyRound",
      path: "/school/my-permissions",
    },
  ];
}

function Icon({
  name,
  className,
}: {
  name: keyof typeof iconMap;
  className?: string;
}) {
  const Component = iconMap[name];
  return <Component className={cn("h-3.5 w-3.5", className)} />;
}

function DropdownShell({
  open,
  className,
  children,
}: {
  open: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute right-0 top-[calc(100%+0.85rem)] z-[200] origin-top-right transition-all duration-200 ease-out",
        open
          ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
          : "pointer-events-none -translate-y-1 scale-95 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

function NotificationBell({
  session,
  portalType,
}: {
  session: SessionUser;
  portalType: PortalType;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<
    StudentPortalNotificationView[]
  >([]);
  const bellRef = useRef<HTMLDivElement>(null);
  const endpoint = notificationsEndpoint(session, portalType);

  useEffect(() => {
    if (!endpoint) return;
    let cancelled = false;
    fetch(endpoint, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { data?: StudentPortalNotificationView[] } | null) => {
        if (!cancelled) setNotifications(body?.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setNotifications([]);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const count = notifications.filter((item) => item.status !== "READ").length;

  return (
    <div ref={bellRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(chromeButton, "relative")}
        aria-label={`${count} unread notifications`}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {count > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[0.56rem] font-bold leading-none text-white shadow-sm">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      <DropdownShell open={open} className="w-72">
        <div className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/95 shadow-[0_20px_50px_rgba(18,33,23,0.14)] backdrop-blur-xl">
          <div className="border-b border-ink/10 px-4 py-3.5">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            <p className="text-xs text-ink/50">{count} unread updates</p>
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            {notifications.length ? (
              notifications.slice(0, 6).map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-2xl px-3 py-2.5 text-left transition hover:bg-sand/60"
                >
                  <p className="text-xs font-semibold text-ink">
                    {notification.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink/55">
                    {notification.body}
                  </p>
                </div>
              ))
            ) : (
              <p className="px-3 py-6 text-center text-xs text-ink/50">
                No notifications yet.
              </p>
            )}
          </div>
        </div>
      </DropdownShell>
    </div>
  );
}

function ProfileDropdown({
  session,
  schoolName,
  permissions,
  onClose,
}: {
  session: SessionUser;
  schoolName?: string;
  permissions: string[];
  onClose: () => void;
}) {
  const router = useRouter();

  const items = useMemo(
    () =>
      dropdownItemsFor(session).filter(
        (item) => !item.permission || permissions.includes(item.permission),
      ),
    [permissions, session],
  );

  async function handleAction(item: DropdownItem) {
    if (item.action === "logout") {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      router.push("/login");
      router.refresh();
      return;
    }

    if (item.path) {
      router.push(item.path as Parameters<typeof router.push>[0]);
    }

    onClose();
  }

  return (
    <div className="w-64 overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white shadow-[0_20px_50px_rgba(18,33,23,0.16)]">
      <div className="border-b border-ink/10 px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink text-xs font-bold text-white shadow-sm">
            {initials(session.name)}
          </div>

          <div className="min-w-0">
            <p className="truncate text-[0.84rem] font-semibold text-ink">
              {session.name}
            </p>
            <p className="truncate text-[0.72rem] text-ink/55">
              {roleLabels[session.role]}
            </p>
            {schoolName ? (
              <p className="truncate text-[0.72rem] text-ink/40">
                {schoolName}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="py-1.5">
        {items.map((item) => (
          <button
            key={`${item.label}-${item.path ?? item.action}`}
            type="button"
            onClick={() => handleAction(item)}
            className={cn(
              "mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[0.82rem] transition",
              item.danger
                ? "text-rose-600 hover:bg-rose-50"
                : "text-ink/75 hover:bg-sand/60 hover:text-ink",
            )}
          >
            <Icon
              name={item.icon}
              className={item.danger ? "text-rose-500" : "text-ink/45"}
            />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="border-t border-ink/10 py-1.5">
        <button
          type="button"
          onClick={() =>
            handleAction({
              label: "Sign Out",
              icon: "LogOut",
              action: "logout",
              danger: true,
            })
          }
          className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[0.82rem] text-rose-600 transition hover:bg-rose-50"
        >
          <LogOut className="h-3.5 w-3.5 text-rose-500" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

export function Topbar({
  session,
  onOpenMobileSidebar,
  permissions = [],
  portalType = "school",
  schoolName,
}: TopbarProps) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const accent = getRoleAccent(session.role);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <header className="sticky top-0 z-30 w-full shrink-0 px-3 pt-3 md:px-4 md:pt-4">
      <div className="relative flex h-20 items-center justify-between gap-4 overflow-visible rounded-[1.75rem] border border-white/75 bg-white/90 px-4 shadow-[0_16px_44px_rgba(18,33,23,0.09)] ring-1 ring-ink/[0.03] backdrop-blur-xl md:px-5">
        <span
          className={cn(
            "absolute inset-y-3 left-0 w-1 rounded-r-full",
            accent.active,
          )}
        />
        <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />

        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className={cn(chromeButton, "md:hidden")}
            aria-label="Toggle menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="min-w-0">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-ink/38">
              {portalType === "super_admin"
                ? "Platform workspace"
                : "School workspace"}
            </p>
            <h1 className="truncate text-[1.06rem] font-black leading-tight text-ink">
              {pageTitle(pathname)}
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell session={session} portalType={portalType} />

          <Link
            href={
              portalType === "super_admin"
                ? "/super-admin/support"
                : "/communications"
            }
            className={chromeButton}
            aria-label="Help"
          >
            <HelpCircle className="h-4 w-4" />
          </Link>

          <div className="mx-1 hidden h-7 w-px bg-ink/10 md:block" />

          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen((value) => !value)}
              aria-expanded={dropdownOpen}
              className="flex h-12 items-center gap-2 rounded-2xl border border-white/80 bg-white/78 py-1.5 pl-1.5 pr-3 text-ink/70 shadow-[0_8px_22px_rgba(18,33,23,0.06)] ring-1 ring-ink/[0.03] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:text-ink hover:shadow-[0_12px_28px_rgba(18,33,23,0.10)]"
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[0.68rem] font-bold text-white shadow-sm ring-2 ring-white/80",
                  accent.active,
                )}
              >
                {initials(session.name)}
              </span>

              <span className="hidden max-w-[130px] truncate text-[0.83rem] font-medium md:block">
                {session.name.split(" ")[0]}
              </span>

              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-ink/40 transition-transform duration-200",
                  dropdownOpen && "rotate-180",
                )}
              />
            </button>

            <DropdownShell open={dropdownOpen}>
              <ProfileDropdown
                session={session}
                schoolName={schoolName}
                permissions={permissions}
                onClose={() => setDropdownOpen(false)}
              />
            </DropdownShell>
          </div>
        </div>
      </div>
    </header>
  );
}
