"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Award,
  BarChart2,
  BedDouble,
  BookMarked,
  BookOpen,
  Brain,
  Briefcase,
  Bus,
  Calendar,
  CalendarDays,
  CalendarOff,
  ChevronDown,
  ClipboardCheck,
  DollarSign,
  FileCheck,
  GraduationCap,
  HeartPulse,
  Library,
  Lock,
  Megaphone,
  MessageSquare,
  Package,
  Settings,
  Shield,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

import type { PermissionGroupView, SchoolRoleView } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

const moduleIcons = {
  Students: GraduationCap,
  Teachers: Users,
  Parents: UserCheck,
  Classes: BookOpen,
  Subjects: BookMarked,
  Timetable: Calendar,
  Attendance: ClipboardCheck,
  Results: Award,
  Fees: DollarSign,
  Admissions: UserPlus,
  Exams: FileCheck,
  Library,
  Transport: Bus,
  Hostel: BedDouble,
  Health: HeartPulse,
  Discipline: Shield,
  Counseling: Brain,
  Events: CalendarDays,
  Messaging: MessageSquare,
  Announcements: Megaphone,
  Staff: Briefcase,
  HR: CalendarOff,
  Inventory: Package,
  Reports: BarChart2,
  Roles: Lock,
  Settings,
};

function rolePermissions(role: SchoolRoleView) {
  return new Set(role.permissions ?? []);
}

function actionLabel(permissionKey: string) {
  const action = permissionKey.split(".").at(-1) ?? permissionKey;
  const labels: Record<string, string> = {
    view: "View",
    create: "Create",
    edit: "Edit",
    delete: "Delete",
    approve: "Approve",
    reject: "Reject",
    publish: "Publish",
    export: "Export",
    assign: "Assign",
    collect: "Collect Fees",
    mark: "Mark Attendance",
    compile: "Compile Results",
    send: "Send Message",
    broadcast: "Broadcast",
    generate: "Generate Report",
    configure: "Configure",
    promote: "Promote Students",
    transfer: "Transfer Students",
    reset_password: "Reset Password",
  };
  return labels[action] ?? action.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function RoleItem({
  role,
  selected,
  onClick,
}: {
  role: SchoolRoleView;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mb-1 flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition",
        selected
          ? "bg-[var(--color-accent-primary-dim)] text-[var(--color-text-primary)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]"
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
          selected ? "bg-[var(--color-text-primary)] text-white" : "bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]"
        )}
      >
        <Shield className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.84rem] font-semibold">{role.name}</span>
        <span className="block truncate text-[0.7rem] text-[var(--color-text-muted)]">{role.staffCount ?? 0} staff members</span>
      </span>
      {role.isSystem ? (
        <span className="rounded bg-[var(--color-bg-subtle)] px-1.5 py-0.5 text-[0.58rem] font-bold text-[var(--color-text-muted)]">
          SYSTEM
        </span>
      ) : null}
    </button>
  );
}

function PermissionModuleCard({
  group,
  selectedPermissions,
}: {
  group: PermissionGroupView;
  selectedPermissions: Set<string>;
}) {
  const checkedCount = group.permissions.filter((permission) => selectedPermissions.has(permission.key)).length;
  const [expanded, setExpanded] = useState(checkedCount > 0);
  const Icon = moduleIcons[group.module as keyof typeof moduleIcons] ?? Shield;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[10px] border transition",
        checkedCount ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary-dim)]" : "border-[var(--color-border-default)] bg-[var(--color-bg-surface)]"
      )}
    >
      <button type="button" onClick={() => setExpanded((value) => !value)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
            checkedCount ? "bg-[var(--color-text-primary)] text-white" : "bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.86rem] font-semibold text-[var(--color-text-primary)]">{group.module}</span>
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[0.7rem] font-bold",
            checkedCount ? "bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]" : "bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]"
          )}
        >
          {checkedCount}/{group.permissions.length}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-[var(--color-text-muted)] transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded ? (
        <div className="border-t border-[var(--color-border-default)] px-4 pb-4 pt-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {group.permissions.map((permission) => {
              const checked = selectedPermissions.has(permission.key);
              return (
                <div key={permission.key} className={cn("rounded-[10px] px-3 py-2", checked ? "bg-[var(--color-accent-primary-dim)]" : "bg-[var(--color-bg-subtle)]")}>
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-0.5 h-3.5 w-3.5 rounded border",
                        checked ? "border-[var(--color-text-primary)] bg-[var(--color-text-primary)]" : "border-[var(--color-border-strong)] bg-[var(--color-bg-surface)]"
                      )}
                    />
                    <span className="min-w-0">
                      <span className={cn("block text-[0.78rem] font-semibold", checked ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]")}>
                        {actionLabel(permission.key)}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[0.65rem] text-[var(--color-text-muted)]">{permission.key}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function PermissionsAccessPanel({
  roles,
  permissionGroups,
  schoolId,
  canCreate,
  canEdit,
  canAssign,
}: {
  roles: SchoolRoleView[];
  permissionGroups: PermissionGroupView[];
  schoolId: string;
  canCreate: boolean;
  canEdit: boolean;
  canAssign: boolean;
}) {
  const [selectedRoleId, setSelectedRoleId] = useState(roles[0]?.id ?? "");
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0];
  const selectedPermissions = useMemo(() => rolePermissions(selectedRole), [selectedRole]);
  const systemRoles = roles.filter((role) => role.isSystem);
  const customRoles = roles.filter((role) => !role.isSystem);

  return (
    <section className="surface-card overflow-hidden">
      <div className="flex min-h-[680px] flex-col md:flex-row">
        <aside className="w-full shrink-0 border-b border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3 md:w-64 md:border-b-0 md:border-r">
          <div className="flex items-center justify-between px-2 py-2">
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">Access Control</p>
              <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{roles.length} roles</p>
            </div>
            {canCreate ? (
              <Link href="/school/settings/roles/new" className="rounded-[10px] bg-[var(--color-text-primary)] px-3 py-1.5 text-xs font-semibold text-white">
                New
              </Link>
            ) : null}
          </div>
          <div className="mt-2">
            <p className="px-2 pb-1 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">System Roles</p>
            {systemRoles.map((role) => (
              <RoleItem key={role.id} role={role} selected={selectedRole?.id === role.id} onClick={() => setSelectedRoleId(role.id)} />
            ))}
          </div>
          <div className="mx-2 my-3 border-t border-[var(--color-border-default)]" />
          <div>
            <p className="px-2 pb-1 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">Custom Roles</p>
            {customRoles.length ? (
              customRoles.map((role) => (
                <RoleItem key={role.id} role={role} selected={selectedRole?.id === role.id} onClick={() => setSelectedRoleId(role.id)} />
              ))
            ) : (
              <p className="px-2 py-3 text-xs text-[var(--color-text-muted)]">No custom roles yet.</p>
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {selectedRole ? (
            <>
              <header className="flex flex-col gap-3 border-b border-[var(--color-border-default)] p-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{selectedRole.name}</h2>
                    <span className="rounded-full bg-[var(--color-bg-subtle)] px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                      {selectedRole.isSystem ? "System" : "Custom"}
                    </span>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)]">
                    {selectedRole.isSystem
                      ? "System role permissions are fixed to protect core school workflows."
                      : selectedRole.description ?? "Custom role permissions can be edited from the role editor."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canAssign ? (
                    <Link href="/school/settings/roles/staff" className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]">
                      Staff Assignment
                    </Link>
                  ) : null}
                  {!selectedRole.isSystem && canEdit ? (
                    <Link href={`/school/settings/roles/${selectedRole.id}/edit`} className="rounded-[10px] bg-[var(--color-text-primary)] px-3 py-2 text-xs font-semibold text-white">
                      Edit Permissions
                    </Link>
                  ) : null}
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[10px] bg-[var(--color-bg-subtle)] p-4">
                    <p className="text-xs font-semibold text-[var(--color-text-muted)]">Permissions</p>
                    <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{selectedRole.permissionsCount ?? selectedPermissions.size}</p>
                  </div>
                  <div className="rounded-[10px] bg-[var(--color-bg-subtle)] p-4">
                    <p className="text-xs font-semibold text-[var(--color-text-muted)]">Staff Assigned</p>
                    <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{selectedRole.staffCount ?? 0}</p>
                  </div>
                  <div className="rounded-[10px] bg-[var(--color-bg-subtle)] p-4">
                    <p className="text-xs font-semibold text-[var(--color-text-muted)]">School Scope</p>
                    <p className="mt-1 truncate text-sm font-bold text-[var(--color-text-primary)]">{schoolId}</p>
                  </div>
                </div>
                <div className="grid gap-3">
                  {permissionGroups.map((group) => (
                    <PermissionModuleCard key={group.module} group={group} selectedPermissions={selectedPermissions} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-sm text-[var(--color-text-muted)]">No roles have been configured yet.</div>
          )}
        </div>
      </div>
    </section>
  );
}
