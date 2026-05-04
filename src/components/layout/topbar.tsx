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
  Sun,
  Terminal,
  TrendingUp,
  User,
  UserCog,
  UserPlus,
  Users,
  Moon,
  Zap,
} from "lucide-react";

import { roleLabels } from "@/lib/auth/roles";
import type {
  SessionUser,
  StudentPortalNotificationView,
} from "@/lib/domain/types";
import type { PortalType } from "@/lib/navigation/registry";
import { getWorkflowNavItemForPath } from "@/lib/navigation/workflows";
import { cn } from "@/lib/utils/cn";

type TopbarProps = {
  session: SessionUser;
  onOpenMobileSidebar: () => void;
  permissions?: string[];
  portalType?: PortalType;
  schoolName?: string;
  currentSessionName?: string;
  currentTermName?: string;
  theme?: "default" | "finance-dark" | "finance-light";
  onToggleTheme?: () => void;
  currentThemeMode?: "dark" | "light";
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

function chromeButton(theme: "default" | "finance-dark" | "finance-light") {
  return theme === "finance-light"
    ? "inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--finance-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,250,248,0.94))] text-[var(--finance-text-secondary)] shadow-[0_12px_24px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--finance-border-active)] hover:bg-white hover:text-[var(--finance-text-primary)] hover:shadow-[0_16px_28px_rgba(15,23,42,0.12)]"
    : "inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--finance-border)] bg-[linear-gradient(180deg,rgba(26,46,32,0.96),rgba(18,33,23,0.98))] text-[var(--finance-text-secondary)] shadow-[0_16px_28px_rgba(0,0,0,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--finance-border-active)] hover:bg-[var(--finance-surface-soft)] hover:text-[var(--finance-text-primary)] hover:shadow-[0_18px_34px_rgba(0,0,0,0.36)]";
}

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
        : ["TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER"].includes(session.role)
          ? "/portals/teacher/profile"
        : session.role === "ADMISSIONS_OFFICER"
          ? "/portals/admission-officer/profile"
        : session.role === "PRINCIPAL"
          ? "/portals/principal/profile"
        : ["EXAM_OFFICER", "EXAMINATION_OFFICER"].includes(session.role)
          ? "/portals/exam-officer/profile"
        : ["SCHOOL_NURSE", "NURSE"].includes(session.role)
          ? "/portals/nurse/profile"
        : session.role === "LIBRARIAN"
          ? "/portals/librarian/profile"
        : session.role === "RECEPTIONIST"
          ? "/portals/front-desk/profile"
        : ["HOSTEL_MANAGER", "HOSTEL_MASTER", "HOSTEL_MATRON", "HOSTEL_MISTRESS"].includes(session.role)
          ? "/portals/hostel/profile"
        : ["TRANSPORT_COORDINATOR", "TRANSPORT_MANAGER"].includes(session.role)
          ? "/portals/transport/profile"
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
  theme,
}: {
  session: SessionUser;
  portalType: PortalType;
  theme: "default" | "finance-dark" | "finance-light";
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
        className={cn(chromeButton(theme), "relative")}
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
        <div className={cn(
          "overflow-hidden rounded-[1.5rem] backdrop-blur-xl",
          theme === "finance-light"
            ? "border border-[var(--finance-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_16px_34px_rgba(15,23,42,0.10)]"
            : "border border-[var(--finance-border)] bg-[linear-gradient(180deg,rgba(26,46,32,0.98),rgba(18,33,23,0.98))] shadow-[0_24px_50px_rgba(0,0,0,0.45)]"
        )}>
          <div className="border-b border-[var(--finance-border)] px-4 py-3.5">
            <p className="text-sm font-semibold text-[var(--finance-text-primary)]">Notifications</p>
            <p className="text-xs text-[var(--finance-text-secondary)]">{count} unread updates</p>
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            {notifications.length ? (
              notifications.slice(0, 6).map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "rounded-2xl px-3 py-2.5 text-left transition",
                    theme === "finance-light" ? "hover:bg-black/[0.03]" : "hover:bg-[var(--finance-surface-soft)]",
                  )}
                >
                  <p className="text-xs font-semibold text-[var(--finance-text-primary)]">
                    {notification.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--finance-text-secondary)]">
                    {notification.body}
                  </p>
                </div>
              ))
            ) : (
              <p className="px-3 py-6 text-center text-xs text-[var(--finance-text-secondary)]">
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
  theme,
}: {
  session: SessionUser;
  schoolName?: string;
  permissions: string[];
  onClose: () => void;
  theme: "default" | "finance-dark" | "finance-light";
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
    <div className={cn(
      "w-64 overflow-hidden rounded-[1.5rem]",
      theme === "finance-light"
          ? "border border-[var(--finance-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_16px_34px_rgba(15,23,42,0.10)]"
        : "border border-[var(--finance-border)] bg-[linear-gradient(180deg,rgba(26,46,32,0.98),rgba(18,33,23,0.98))] shadow-[0_24px_50px_rgba(0,0,0,0.45)]"
    )}>
      <div className="border-b border-[var(--finance-border)] px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xs font-bold text-white",
            theme === "finance-light"
              ? "bg-gradient-to-br from-[#0d9488] via-[#0f766e] to-[#122117] shadow-[0_12px_28px_rgba(15,23,42,0.18)]"
              : "bg-gradient-to-br from-[#2dd4bf] via-[#0f766e] to-[#122117] shadow-[0_14px_28px_rgba(45,212,191,0.18)]"
          )}>
            {initials(session.name)}
          </div>

          <div className="min-w-0">
            <p className="truncate text-[0.84rem] font-semibold text-[var(--finance-text-primary)]">
              {session.name}
            </p>
            <p className="truncate text-[0.72rem] text-[var(--finance-text-secondary)]">
              {roleLabels[session.role]}
            </p>
            {schoolName ? (
              <p className="truncate text-[0.72rem] text-[var(--finance-text-muted)]">
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
                : theme === "finance-light"
                  ? "text-[var(--finance-text-secondary)] hover:bg-black/[0.03] hover:text-[var(--finance-text-primary)]"
                  : "text-[var(--finance-text-secondary)] hover:bg-[var(--finance-surface-soft)] hover:text-[var(--finance-text-primary)]",
            )}
          >
            <Icon
              name={item.icon}
              className={item.danger ? "text-rose-500" : "text-[var(--finance-text-muted)]"}
            />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="border-t border-[var(--finance-border)] py-1.5">
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
  currentSessionName,
  currentTermName,
  theme = "default",
  onToggleTheme,
  currentThemeMode,
}: TopbarProps) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const academicContextLabel =
    currentTermName && currentSessionName
      ? `${currentTermName} · ${currentSessionName}`
      : currentTermName ?? currentSessionName ?? null;

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
    <header className="sticky top-0 z-30 w-full shrink-0 px-3 pt-3 md:px-4 md:pt-3">
      <div className={cn(
        "relative flex h-[var(--layout-topbar-height)] items-center justify-between gap-4 overflow-visible rounded-[20px] px-4 backdrop-blur-xl md:px-5",
        theme === "finance-light"
            ? "border border-[var(--finance-border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98),rgba(241,245,249,0.96))] shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
          : "border border-[var(--finance-border)] bg-[linear-gradient(135deg,rgba(18,33,23,0.94),rgba(26,46,32,0.94),rgba(15,28,19,0.98))] shadow-[0_16px_40px_rgba(0,0,0,0.32)]",
      )}>
        <span
          className={cn(
            "absolute inset-y-3 left-0 w-1 rounded-r-full",
            theme === "finance-light"
              ? "bg-gradient-to-b from-[#0d9488] via-[#0f766e] to-[#122117]"
              : "bg-gradient-to-b from-[#2dd4bf] via-[#0f766e] to-[#122117]",
          )}
        />
        <span className={cn("pointer-events-none absolute inset-x-6 top-0 h-px", theme === "finance-light" ? "bg-gradient-to-r from-transparent via-[#b9efe7] to-transparent" : "bg-gradient-to-r from-transparent via-white/20 to-transparent")} />
        <span className={cn("pointer-events-none absolute inset-x-0 top-0 h-full", theme === "finance-light" ? "bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.10),transparent_32%)]" : "bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.14),transparent_32%)]")} />

        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className={cn(chromeButton(theme), "md:hidden")}
            aria-label="Toggle menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="min-w-0">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--finance-text-muted)]">
              {portalType === "super_admin"
                ? "Platform workspace"
                : "School workspace"}
            </p>
            <h1 className="truncate text-[1.06rem] font-black leading-tight text-[var(--finance-text-primary)]">
              {pageTitle(pathname)}
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {academicContextLabel ? (
            <div className="hidden xl:flex">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-2 text-[11px] font-semibold",
                  theme === "finance-light"
                    ? "border-[var(--finance-border)] bg-[var(--finance-surface-soft)] text-[var(--finance-accent-primary)] shadow-[0_10px_20px_rgba(15,23,42,0.08)]"
                    : "border-[var(--finance-border)] bg-[var(--finance-surface-soft)] text-[var(--finance-accent-primary)] shadow-[0_10px_20px_rgba(0,0,0,0.2)]"
                )}
              >
                {academicContextLabel}
              </span>
            </div>
          ) : null}

          <NotificationBell session={session} portalType={portalType} theme={theme} />

          {onToggleTheme ? (
            <button
              type="button"
              onClick={onToggleTheme}
              className={chromeButton(theme)}
              aria-label={`Switch to ${currentThemeMode === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${currentThemeMode === "dark" ? "light" : "dark"} mode`}
            >
              {currentThemeMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          ) : null}

          <Link
            href={
              portalType === "super_admin"
                ? "/super-admin/support"
                : "/communications"
            }
            className={chromeButton(theme)}
            aria-label="Help"
          >
            <HelpCircle className="h-4 w-4" />
          </Link>

          <div className={cn("mx-1 hidden h-7 w-px md:block", theme === "finance-light" ? "bg-[var(--finance-border)]" : "bg-white/10")} />

          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen((value) => !value)}
              aria-expanded={dropdownOpen}
              className={cn(
                "flex h-12 items-center gap-2 rounded-2xl py-1.5 pl-1.5 pr-3 transition-all duration-200",
                theme === "finance-light"
                    ? "border border-[var(--finance-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.92))] text-[var(--finance-text-secondary)] shadow-[0_12px_24px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 hover:border-[var(--finance-border-active)] hover:bg-white hover:text-[var(--finance-text-primary)]"
                  : "border border-[var(--finance-border)] bg-[linear-gradient(180deg,rgba(26,46,32,0.98),rgba(18,33,23,0.96))] text-[var(--finance-text-secondary)] shadow-[0_16px_28px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 hover:border-[var(--finance-border-active)] hover:bg-[var(--finance-surface-soft)] hover:text-[var(--finance-text-primary)]",
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[0.68rem] font-bold text-white",
                  theme === "finance-light"
                    ? "bg-gradient-to-br from-[#0d9488] via-[#0f766e] to-[#122117] shadow-[0_12px_28px_rgba(15,23,42,0.18)] ring-2 ring-white/80"
                    : "bg-gradient-to-br from-[#2dd4bf] via-[#0f766e] to-[#122117] shadow-[0_14px_28px_rgba(45,212,191,0.18)] ring-2 ring-white/10"
                )}
              >
                {initials(session.name)}
              </span>

              <span className="hidden max-w-[130px] truncate text-[0.83rem] font-medium text-[var(--finance-text-primary)] md:block">
                {session.name.split(" ")[0]}
              </span>

              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  "text-[var(--finance-text-muted)]",
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
                theme={theme}
              />
            </DropdownShell>
          </div>
        </div>
      </div>
    </header>
  );
}
