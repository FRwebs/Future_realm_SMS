"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Award,
  BarChart2,
  Bell,
  BellRing,
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
import { cn } from "@/lib/utils/cn";

type TopbarProps = {
  session: SessionUser;
  onOpenMobileSidebar: () => void;
  permissions?: string[];
  portalType?: PortalType;
  schoolName?: string;
  schoolSlug?: string;
  currentSessionName?: string;
  currentTermName?: string;
  platformStats?: {
    totalSchools?: number;
    reviewQueueCount?: number;
  };
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
  note?: string;
  badge?: number;
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

function chromeButton() {
  return "inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] shadow-[var(--shadow-sm)] transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)]";
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function compactAcademicSession(value?: string) {
  if (!value) return null;
  return value.replace(/\/20(\d{2})$/, "/$1");
}

function formatCount(value: number | undefined, fallback: string) {
  return typeof value === "number" ? value.toLocaleString() : fallback;
}

function notificationsEndpoint(session: SessionUser, portalType: PortalType) {
  if (portalType === "super_admin") return null;
  if (session.role === "PARENT") return "/api/v1/parent-portal/notifications";
  if (session.role === "STUDENT") return "/api/v1/student-portal/notifications";
  if (["TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER"].includes(session.role))
    return "/api/v1/teacher-portal/notifications";
  return null;
}

export function dropdownItemsFor(
  session: SessionUser,
  context?: { reviewQueueCount?: number },
): DropdownItem[] {
  if (session.role === "SUPER_ADMIN" || session.role.startsWith("PLATFORM_")) {
    return [
      { label: "Your admin profile", icon: "User", path: "/super-admin/profile", note: "Role, portfolio, logged actions" },
      {
        label: "Risk review queue",
        icon: "List",
        path: "/super-admin/schools?tab=approval-queue",
        note: "Flagged schools — never gating",
        badge: context?.reviewQueueCount,
      },
      { label: "Security & audit", icon: "Shield", path: "/super-admin/security", note: "Your sessions and audit trail" },
      { label: "Internal team", icon: "Users", path: "/super-admin/internal-team", note: "Who else has Platform Admin access" },
    ];
  }

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
          : "/school/profile";

  const common: DropdownItem[] = [
    {
      label: "My Profile",
      icon: "User",
      path: profilePath,
    },
  ];

  if (session.role === "PRINCIPAL") {
    return [
      ...common,
      { label: "Verification", icon: "Shield", path: `${profilePath}?tab=verification` },
      { label: "Security & sessions", icon: "Lock", path: `${profilePath}?tab=security` },
    ];
  }

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

  if (!endpoint) return null;

  const count = notifications.filter((item) => item.status !== "READ").length;

  return (
    <div ref={bellRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(chromeButton(), "relative")}
        aria-label={`${count} unread notifications`}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {count > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[0.56rem] font-bold leading-none text-white shadow-sm">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      <DropdownShell open={open} className="w-72">
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-lg)]">
          <div className="border-b border-[var(--color-border-default)] px-4 py-3.5">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Notifications</p>
            <p className="text-xs text-[var(--color-text-secondary)]">{count} unread updates</p>
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            {notifications.length ? (
              notifications.slice(0, 6).map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-2xl px-3 py-2.5 text-left transition hover:bg-[var(--color-bg-subtle)]"
                >
                  <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                    {notification.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                    {notification.body}
                  </p>
                </div>
              ))
            ) : (
              <p className="px-3 py-6 text-center text-xs text-[var(--color-text-secondary)]">
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
  portalType,
  reviewQueueCount,
  onClose,
}: {
  session: SessionUser;
  schoolName?: string;
  permissions: string[];
  portalType: PortalType;
  reviewQueueCount?: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const isSuperAdmin = portalType === "super_admin";

  const items = useMemo(
    () =>
      dropdownItemsFor(session, { reviewQueueCount }).filter(
        (item) => !item.permission || permissions.includes(item.permission),
      ),
    [permissions, session, reviewQueueCount],
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
    <div className="w-72 overflow-hidden rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-lg)]">
      <div className="border-b border-[var(--color-border-default)] px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#0d2315] text-xs font-black text-white shadow-[0_10px_24px_-8px_rgba(13,35,21,0.4)]">
            {initials(session.name)}
          </div>

          <div className="min-w-0">
            <p className="truncate text-[0.84rem] font-semibold text-[var(--color-text-primary)]">
              {session.name}
            </p>
            {isSuperAdmin ? (
              <p className="truncate text-[0.72rem] text-[var(--color-text-secondary)]">
                {session.email}
              </p>
            ) : (
              <p className="truncate text-[0.72rem] text-[var(--color-text-secondary)]">
                {roleLabels[session.role]}
              </p>
            )}
            {schoolName ? (
              <p className="truncate text-[0.72rem] text-[var(--color-text-muted)]">
                {schoolName}
              </p>
            ) : null}
          </div>
        </div>
        {isSuperAdmin ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[var(--color-bg-subtle)] px-2.5 py-1 text-[0.66rem] font-bold text-[var(--color-text-secondary)]">
              {roleLabels[session.role]}
            </span>
          </div>
        ) : null}
        {session.impersonation ? (
          <div className="mt-3 rounded-[12px] border border-[var(--color-warning)] bg-[var(--color-warning-dim)] px-3 py-2 text-[11.5px] font-semibold text-[var(--color-warning)]">
            Impersonating account
          </div>
        ) : null}
      </div>

      <div className="p-2">
        {items.map((item) => (
          <button
            key={`${item.label}-${item.path ?? item.action}`}
            type="button"
            onClick={() => handleAction(item)}
            className={cn(
              "flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition",
              item.danger
                ? "text-[var(--color-danger)] hover:bg-[var(--color-danger-dim)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)]",
            )}
          >
            <Icon
              name={item.icon}
              className={item.danger ? "text-[var(--color-danger)]" : "text-[var(--color-text-muted)]"}
            />
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block text-[0.82rem] font-semibold",
                  item.danger ? "text-[var(--color-danger)]" : "text-[var(--color-text-primary)]",
                )}
              >
                {item.label}
              </span>
              {item.note ? (
                <span className="mt-0.5 block truncate text-[0.68rem] font-normal text-[var(--color-text-muted)]">
                  {item.note}
                </span>
              ) : null}
            </span>
            {typeof item.badge === "number" && item.badge > 0 ? (
              <span className="shrink-0 rounded-full bg-[var(--color-warning-dim)] px-2 py-0.5 text-[0.66rem] font-bold text-[var(--color-warning)]">
                {item.badge} open
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="border-t border-[var(--color-border-default)] p-2">
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
          className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-[0.82rem] font-semibold text-[var(--color-danger)] transition hover:bg-[var(--color-danger-dim)]"
        >
          <LogOut className="h-3.5 w-3.5 text-[var(--color-danger)]" />
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
  schoolSlug,
  currentSessionName,
  currentTermName,
  platformStats,
  onToggleTheme,
  currentThemeMode,
}: TopbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [timeZone, setTimeZone] = useState("Africa/Lagos");
  const compactSession = compactAcademicSession(currentSessionName);
  const academicContextLabel =
    currentTermName && compactSession
      ? `${currentTermName} ${compactSession}`
      : currentTermName ?? compactSession ?? null;
  const schoolAddress = schoolSlug ? `${schoolSlug}.futurerealm.school` : "futurerealm.school";
  const contextTitle = portalType === "super_admin" ? "FutureRealm Platform Admin" : (schoolName ?? "School Admin");
  const contextMeta =
    portalType === "super_admin"
      ? [
          `${formatCount(platformStats?.totalSchools, "All")} schools`,
          `${formatCount(platformStats?.reviewQueueCount, "0")} in review queue`,
          timeZone,
        ]
      : [schoolAddress, academicContextLabel].filter(Boolean);
  const isProduction = process.env.NODE_ENV === "production";

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

  useEffect(() => {
    setMounted(true);
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos");
  }, []);

  return (
    <header className="sticky top-0 z-30 w-full shrink-0 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
      <div className="relative flex h-[var(--layout-topbar-height)] items-center justify-between gap-4 overflow-visible px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className={cn(chromeButton(), "md:hidden")}
            aria-label="Toggle menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          {portalType === "super_admin" ? (
            <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#0d2315] text-[0.68rem] font-black text-white sm:flex">
              FR
            </span>
          ) : null}

          <div className="min-w-0">
            <h1 className="truncate text-[0.98rem] font-bold leading-tight text-[var(--color-text-primary)]">
              {contextTitle}
            </h1>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] font-medium leading-tight text-[var(--color-text-secondary)]">
              {contextMeta.map((item, index) => (
                <span key={item} className="inline-flex min-w-0 items-center gap-1.5">
                  {index > 0 ? <span className="text-[var(--color-text-muted)]">·</span> : null}
                  <span className="truncate">{item}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {portalType === "super_admin" ? (
            <div className="hidden items-center gap-2 lg:flex">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-success-dim)] px-3 py-2 text-[12px] font-semibold text-[var(--color-success)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
                {isProduction ? "Production" : "Development"}
              </span>
              <Link
                href="/super-admin/schools?tab=approval-queue"
                className="relative inline-flex items-center gap-1.5 rounded-[9px] border border-[var(--color-border-default)] px-2.5 py-2 text-[12.5px] font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]"
              >
                <BellRing className="h-3.5 w-3.5" />
                Alerts
                {platformStats?.reviewQueueCount ? (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[0.6rem] font-bold leading-none text-white">
                    {platformStats.reviewQueueCount > 99 ? "99+" : platformStats.reviewQueueCount}
                  </span>
                ) : null}
              </Link>
            </div>
          ) : null}

          <NotificationBell session={session} portalType={portalType} />

          {onToggleTheme ? (
            <button
              type="button"
              onClick={onToggleTheme}
              className={chromeButton()}
              aria-label={`Switch to ${currentThemeMode === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${currentThemeMode === "dark" ? "light" : "dark"} mode`}
            >
              {mounted && currentThemeMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          ) : null}

          <Link
            href={
              portalType === "super_admin"
                ? "/super-admin/support"
                : "/communications"
            }
            className={chromeButton()}
            aria-label="Help"
          >
            <HelpCircle className="h-4 w-4" />
          </Link>

          <div className="mx-1 hidden h-7 w-px bg-[var(--color-border-default)] md:block" />

          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen((value) => !value)}
              aria-expanded={dropdownOpen}
              className={cn(
                "flex items-center gap-1.5 transition",
                portalType === "super_admin"
                  ? "rounded-full border border-[var(--color-border-default)] py-1 pl-1 pr-2.5 hover:border-[var(--color-border-strong)]"
                  : "rounded-[10px] p-1 hover:bg-[var(--color-bg-subtle)]",
              )}
            >
              <span
                className={cn(
                  "flex shrink-0 items-center justify-center bg-[#0d2315] font-black text-white",
                  portalType === "super_admin" ? "h-7 w-7 rounded-full text-[0.6rem]" : "h-8 w-8 rounded-[9px] text-[0.65rem]",
                )}
              >
                {initials(session.name)}
              </span>

              {portalType === "super_admin" ? (
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block truncate text-[0.76rem] font-semibold text-[var(--color-text-primary)]">
                    {session.name}
                  </span>
                  <span className="block truncate text-[0.64rem] text-[var(--color-text-muted)]">
                    {roleLabels[session.role]}
                  </span>
                </span>
              ) : null}

              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-[var(--color-text-muted)] transition-transform duration-200",
                  dropdownOpen && "rotate-180",
                )}
              />
            </button>

            <DropdownShell open={dropdownOpen}>
              <ProfileDropdown
                session={session}
                portalType={portalType}
                reviewQueueCount={platformStats?.reviewQueueCount}
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
