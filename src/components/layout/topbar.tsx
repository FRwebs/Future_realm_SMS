"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { accountPath } from "@/lib/modules/account";
import {
  Activity,
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
  Megaphone,
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
  Activity,
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
      {
        label: "Your admin profile",
        icon: "User",
        path: "/super-admin/profile",
        note: "Role, portfolio, logged actions",
      },
      {
        label: "Risk review queue",
        icon: "List",
        path: "/super-admin/schools?tab=approval-queue",
        note: "Flagged schools — never gating",
        badge: context?.reviewQueueCount,
      },
      {
        label: "Security & audit",
        icon: "Shield",
        path: "/super-admin/security",
        note: "Your sessions and audit trail",
      },
      {
        label: "Internal team",
        icon: "Users",
        path: "/super-admin/internal-team",
        note: "Who else has Platform Admin access",
      },
    ];
  }

  // Staff share one account page, reached from this menu rather than the
  // sidebar; students and guardians keep the profile inside their own portal.
  const profilePath =
    session.role === "PARENT"
      ? "/portals/parent/profile"
      : session.role === "STUDENT"
        ? "/portals/student/profile"
        : accountPath;

  const common: DropdownItem[] = [
    {
      label: "My Profile",
      icon: "User",
      path: profilePath,
    },
  ];

  if (session.role === "PARENT" || session.role === "STUDENT") {
    return common;
  }

  // Staff: the mockup's account menu — the four account tabs, then help.
  return [
    { label: "View profile", icon: "User", path: accountPath },
    { label: "Preferences", icon: "Settings", path: "/account/preferences" },
    {
      label: "Security and sessions",
      icon: "Shield",
      path: "/account/security",
    },
    { label: "My activity", icon: "Activity", path: "/account/my-activity" },
    {
      label: "Help and support",
      icon: "HelpCircle",
      path: "/sync-support/help-support",
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

  // Staff have no personal feed yet, but the mockup still gives them the bell:
  // it shows an honest zero rather than disappearing.
  if (!endpoint && portalType === "super_admin") return null;

  const count = notifications.filter((item) => item.status !== "READ").length;

  return (
    <div ref={bellRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex flex-none items-center gap-[6px] rounded-[9px] border border-[#DEE8E2] bg-[var(--color-bg-surface)] px-[10px] py-[6.5px] transition hover:border-[#BFDCD1] hover:bg-[#F7FAF8]"
        aria-label={`${count} unread notifications`}
        aria-expanded={open}
      >
        <Bell
          className="h-[13.5px] w-[13.5px] text-[#435048]"
          strokeWidth={1.8}
        />
        <span className="text-[11px] font-semibold tabular-nums text-[#435048]">
          {count > 99 ? "99+" : count}
        </span>
      </button>

      <DropdownShell open={open} className="w-72">
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-lg)]">
          <div className="border-b border-[var(--color-border-default)] px-4 py-3.5">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              Notifications
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {count} unread · everything routed to you
            </p>
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
              <div className="px-3 py-6 text-center">
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Nothing is routed to you right now.
                </p>
                {!endpoint ? (
                  <Link
                    href="/approvals-workflow/queue"
                    className="mt-2 inline-block text-[11px] font-semibold text-[#12796A] hover:underline"
                  >
                    Open the approvals queue
                  </Link>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </DropdownShell>
    </div>
  );
}

/** Only the head of the school may send to every family at once. */
function canBroadcast(session: SessionUser) {
  return ["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL"].includes(session.role);
}

/**
 * Whether the work on this device is saved. The mockup keeps it in the top bar
 * on every screen; it follows the browser's own connectivity, so it flips to
 * "Offline · saved on device" the moment the connection drops.
 */
function SyncPill() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const tone = online
    ? { bg: "#EAF6F0", fg: "#17714F", dot: "#22A06B", bd: "#CFE4DB" }
    : { bg: "#F4F6F5", fg: "#5A6862", dot: "#8A9A92", bd: "#E2E8E5" };

  return (
    <Link
      href="/sync-support/sync"
      title="Sync status"
      className="hidden flex-none items-center gap-[6px] whitespace-nowrap rounded-full border px-[12px] py-[6px] text-[11px] font-semibold lg:flex"
      style={{ background: tone.bg, borderColor: tone.bd, color: tone.fg }}
    >
      <span
        className="h-[6px] w-[6px] flex-none rounded-full"
        style={{ background: tone.dot }}
      />
      <span>{online ? "All work saved" : "Offline · saved on device"}</span>
    </Link>
  );
}

function ProfileDropdown({
  session,
  schoolName,
  permissions,
  portalType,
  reviewQueueCount,
  onClose,
  onToggleTheme,
  currentThemeMode,
}: {
  session: SessionUser;
  schoolName?: string;
  permissions: string[];
  portalType: PortalType;
  reviewQueueCount?: number;
  onClose: () => void;
  onToggleTheme?: () => void;
  currentThemeMode?: "dark" | "light";
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

  if (!isSuperAdmin) {
    // The mockup's account menu: who you are in a tinted band, the account
    // pages, then sign-out with the reassurance that unsynced work is kept.
    return (
      <div className="w-[246px] overflow-hidden rounded-[13px] border border-[#DEE8E2] bg-[var(--color-bg-surface)] shadow-[0_20px_44px_-18px_rgba(13,35,21,0.42)]">
        <div className="flex items-center gap-[10px] border-b border-[#EDF3EF] bg-[#F7FAF8] px-[14px] py-[13px]">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#0D2315] font-[family-name:var(--font-heading)] text-[11px] font-extrabold text-white">
            {initials(session.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11.5px] font-semibold text-[#0D2315]">
              {session.name}
            </p>
            <p className="truncate text-[9.5px] text-[#67766D]">
              {roleLabels[session.role]}
              {schoolName ? ` · ${schoolName}` : ""}
            </p>
          </div>
        </div>
        {session.impersonation ? (
          <div className="mx-[6px] mt-[6px] rounded-[9px] border border-[var(--color-warning)] bg-[var(--color-warning-dim)] px-[11px] py-[7px] text-[11px] font-semibold text-[var(--color-warning)]">
            Impersonating account
          </div>
        ) : null}
        <div className="p-[6px]">
          {items.map((item) => (
            <button
              key={`${item.label}-${item.path ?? item.action}`}
              type="button"
              onClick={() => handleAction(item)}
              className="flex w-full items-center gap-[9px] rounded-[9px] px-[11px] py-[8px] text-left text-[11.5px] font-medium text-[#2A3B31] transition hover:bg-[#F1F8F4]"
            >
              <Icon
                name={item.icon}
                className="h-[14px] w-[14px] flex-none text-[#5F6E65]"
              />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </button>
          ))}
          {onToggleTheme ? (
            <button
              type="button"
              onClick={() => {
                onToggleTheme();
                onClose();
              }}
              className="flex w-full items-center gap-[9px] rounded-[9px] px-[11px] py-[8px] text-left text-[11.5px] font-medium text-[#2A3B31] transition hover:bg-[#F1F8F4]"
            >
              {currentThemeMode === "dark" ? (
                <Sun className="h-[14px] w-[14px] flex-none text-[#5F6E65]" />
              ) : (
                <Moon className="h-[14px] w-[14px] flex-none text-[#5F6E65]" />
              )}
              <span className="min-w-0 flex-1 truncate">
                {currentThemeMode === "dark" ? "Light mode" : "Dark mode"}
              </span>
            </button>
          ) : null}
        </div>
        <div className="border-t border-[#EDF3EF] p-[6px]">
          <button
            type="button"
            onClick={() =>
              handleAction({
                label: "Sign out",
                icon: "LogOut",
                action: "logout",
                danger: true,
              })
            }
            className="flex w-full items-center gap-[9px] rounded-[9px] px-[11px] py-[8px] text-left text-[11.5px] font-semibold text-[#B23B3B] transition hover:bg-[#FDF3F3]"
          >
            <LogOut className="h-[14px] w-[14px] flex-none" strokeWidth={1.9} />
            <span>Sign out</span>
          </button>
          <p className="px-[11px] pb-[5px] pt-[2px] text-[9.5px] leading-[1.45] text-[#6B7A71]">
            Anything not yet synced stays saved on this device.
          </p>
        </div>
      </div>
    );
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
              className={
                item.danger
                  ? "text-[var(--color-danger)]"
                  : "text-[var(--color-text-muted)]"
              }
            />
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block text-[0.82rem] font-semibold",
                  item.danger
                    ? "text-[var(--color-danger)]"
                    : "text-[var(--color-text-primary)]",
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
      : (currentTermName ?? compactSession ?? null);
  const schoolAddress = schoolSlug
    ? `${schoolSlug}.futurerealm.school`
    : "futurerealm.school";
  const contextTitle =
    portalType === "super_admin"
      ? "FutureRealm Platform Admin"
      : (schoolName ?? "School Admin");
  const contextMeta =
    portalType === "super_admin"
      ? [
          `${formatCount(platformStats?.totalSchools, "All")} schools`,
          `${formatCount(platformStats?.reviewQueueCount, "0")} in review queue`,
          timeZone,
        ]
      : [schoolAddress, academicContextLabel].filter(Boolean);
  /** The term, lifted out of the meta line into its own chip. */
  const termChipLabel =
    portalType === "super_admin" ? null : academicContextLabel;
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
    setTimeZone(
      Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos",
    );
  }, []);

  return (
    <header className="sticky top-0 z-30 w-full shrink-0 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
      <div className="relative flex h-[var(--layout-topbar-height)] items-center justify-between gap-4 overflow-visible px-4 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-[10px]">
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

          <div className="min-w-[96px] max-w-[340px] flex-[0_1_auto]">
            <h1
              className={cn(
                "truncate text-[var(--color-text-primary)]",
                portalType === "super_admin"
                  ? "text-[13.5px] font-semibold leading-[1.22]"
                  : "font-[family-name:var(--font-heading)] text-[12.5px] font-bold leading-[1.25]",
              )}
            >
              {contextTitle}
            </h1>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9.5px] font-medium leading-[1.3] text-[var(--color-text-muted)]">
              {contextMeta
                .filter(
                  (item) =>
                    portalType === "super_admin" || item !== termChipLabel,
                )
                .map((item, index) => (
                  <span
                    key={item}
                    className="inline-flex min-w-0 items-center gap-1.5"
                  >
                    {index > 0 ? (
                      <span className="text-[var(--color-text-muted)]">·</span>
                    ) : null}
                    <span className="truncate">{item}</span>
                  </span>
                ))}
            </div>
          </div>

          {/* The term is the one piece of context every screen is read against,
              so the mockup gives it its own chip rather than a meta clause. */}
          {portalType !== "super_admin" && termChipLabel ? (
            <>
              <span className="hidden h-[22px] w-px flex-none bg-[#E6EEE9] sm:block" />
              <span
                className="hidden flex-none items-center gap-1.5 rounded-full border px-[11px] py-[5px] sm:inline-flex"
                style={{ background: "#F4F0E7", borderColor: "#EBE1CC" }}
              >
                <CalendarDays
                  className="h-3 w-3"
                  style={{ color: "#8A6410" }}
                  strokeWidth={1.9}
                />
                <span
                  className="whitespace-nowrap text-[10.5px] font-semibold"
                  style={{ color: "#8A6410" }}
                >
                  {termChipLabel}
                </span>
              </span>
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {portalType === "super_admin" ? (
            <div className="hidden items-center gap-2 lg:flex">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-success-dim)] px-3 py-1.5 text-[12px] font-semibold leading-[1.2] text-[var(--color-success)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
                {isProduction ? "Production" : "Development"}
              </span>
              <Link
                href="/super-admin/schools?tab=approval-queue"
                className="relative inline-flex items-center gap-1.5 rounded-[9px] border border-[var(--color-border-default)] px-[11px] py-[7px] text-[12.5px] font-semibold leading-[1.2] text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]"
              >
                <BellRing className="h-3.5 w-3.5" />
                Alerts
                {platformStats?.reviewQueueCount ? (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[0.6rem] font-bold leading-none text-white">
                    {platformStats.reviewQueueCount > 99
                      ? "99+"
                      : platformStats.reviewQueueCount}
                  </span>
                ) : null}
              </Link>
            </div>
          ) : null}

          {portalType !== "super_admin" ? <SyncPill /> : null}

          {portalType !== "super_admin" && canBroadcast(session) ? (
            <Link
              href="/communication-center/compose"
              className="hidden flex-none items-center gap-[6px] rounded-[9px] border border-[#F0D3D3] bg-[#FDF3F3] px-[10px] py-[6.5px] transition hover:bg-[#FAE7E7] sm:flex"
              title="Send an emergency broadcast to every family"
            >
              <Megaphone
                className="h-[13px] w-[13px] text-[#B23B3B]"
                strokeWidth={1.9}
              />
              <span className="whitespace-nowrap text-[11px] font-semibold text-[#B23B3B]">
                Emergency
              </span>
            </Link>
          ) : null}

          <NotificationBell session={session} portalType={portalType} />

          {portalType === "super_admin" && onToggleTheme ? (
            <button
              type="button"
              onClick={onToggleTheme}
              className={chromeButton()}
              aria-label={`Switch to ${currentThemeMode === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${currentThemeMode === "dark" ? "light" : "dark"} mode`}
            >
              {mounted && currentThemeMode === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          ) : null}

          {portalType === "super_admin" ? (
            <Link
              href="/super-admin/support"
              className={chromeButton()}
              aria-label="Help"
            >
              <HelpCircle className="h-4 w-4" />
            </Link>
          ) : null}

          <div className="mx-0.5 hidden h-6 w-px bg-[#E6EEE9] md:block" />

          <div ref={dropdownRef} className="relative">
            {portalType === "super_admin" ? (
              <button
                type="button"
                onClick={() => setDropdownOpen((value) => !value)}
                aria-expanded={dropdownOpen}
                className="flex items-center gap-1.5 rounded-full border border-[var(--color-border-default)] py-1 pl-1 pr-2.5 transition hover:border-[var(--color-border-strong)]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0d2315] text-[0.6rem] font-black text-white">
                  {initials(session.name)}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block truncate text-[0.76rem] font-semibold text-[var(--color-text-primary)]">
                    {session.name}
                  </span>
                  <span className="block truncate text-[0.64rem] text-[var(--color-text-muted)]">
                    {roleLabels[session.role]}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-[var(--color-text-muted)] transition-transform duration-200",
                    dropdownOpen && "rotate-180",
                  )}
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setDropdownOpen((value) => !value)}
                aria-expanded={dropdownOpen}
                className="flex items-center gap-2 rounded-full border border-[#DEE8E2] py-[3.5px] pl-1 pr-[10px] transition-[background,border-color] duration-150 hover:border-[#BFDCD1] hover:bg-[#F7FAF8]"
              >
                <span className="flex h-[27px] w-[27px] flex-none items-center justify-center rounded-full bg-[#0D2315] font-[family-name:var(--font-heading)] text-[10px] font-extrabold text-white">
                  {initials(session.name)}
                </span>
                <span className="hidden min-w-0 text-left sm:block">
                  <span className="block whitespace-nowrap text-[11px] font-semibold leading-[1.25] text-[var(--color-text-primary)]">
                    {session.name}
                  </span>
                  <span className="block whitespace-nowrap text-[9.5px] leading-[1.25] text-[#67766D]">
                    {roleLabels[session.role]}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 flex-none text-[#6B7A71] transition-transform duration-200",
                    dropdownOpen && "rotate-180",
                  )}
                  strokeWidth={2.4}
                />
              </button>
            )}

            <DropdownShell open={dropdownOpen}>
              <ProfileDropdown
                session={session}
                portalType={portalType}
                reviewQueueCount={platformStats?.reviewQueueCount}
                schoolName={schoolName}
                permissions={permissions}
                onClose={() => setDropdownOpen(false)}
                onToggleTheme={onToggleTheme}
                currentThemeMode={currentThemeMode}
              />
            </DropdownShell>
          </div>
        </div>
      </div>
    </header>
  );
}
