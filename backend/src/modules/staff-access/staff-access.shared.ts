import { Prisma, UserRole } from "@prisma/client";

import { roleTemplateFor } from "../../../../src/lib/modules/school-access";
import { prisma } from "../../../../src/lib/db/prisma";

/**
 * Small things every part of Staff & Access reads the same way: how a person is named,
 * what state their account is in, and a store for the records the school keeps here that
 * are not worth a table of their own (delegations, sensitive groups, leave policies,
 * process flows, KPI sets).
 */

export const DAY_MS = 86_400_000;

export function fullName(user: { firstName: string; lastName: string; preferredName?: string | null } | null | undefined): string {
  return user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : "";
}

export function daysSince(date: Date | null | undefined, now = new Date()): number {
  return date ? Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS)) : 0;
}

/** A role as a title: HEAD_OF_DEPARTMENT → "Head Of Department". */
export function roleTitle(role: string): string {
  return role
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** The name of the template a role starts from, or its own title where it has none. */
export function templateName(role: UserRole): string {
  return roleTemplateFor(role as never) ?? roleTitle(role);
}

export type AccountState = "Active" | "Dormant" | "Never activated" | "Suspended";

export const ACTIVE_WITHIN_DAYS = 90;

/**
 * What state a staff account is in, read from what has actually happened to it.
 * Nobody types this: it is a fact about sign-ins.
 */
export function accountState(user: {
  accountStatus: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}): { state: AccountState; days: number } {
  if (!user.isActive || user.accountStatus === "SUSPENDED" || user.accountStatus === "LOCKED" || user.accountStatus === "INACTIVE") {
    return { state: "Suspended", days: daysSince(user.lastLoginAt ?? user.createdAt) };
  }
  if (!user.lastLoginAt) return { state: "Never activated", days: daysSince(user.createdAt) };
  const days = daysSince(user.lastLoginAt);
  return { state: days >= ACTIVE_WITHIN_DAYS ? "Dormant" : "Active", days };
}

/* ───────────────────────── a store for what the school keeps here ───────────────────────── */

export class ConfigStore {
  constructor(private readonly schoolId: string, private readonly resource: string) {}

  async list<T = Record<string, unknown>>(): Promise<Array<{ id: string; code: string | null; name: string; data: T; updatedAt: Date }>> {
    const rows = await prisma.configurationItem.findMany({
      where: { schoolId: this.schoolId, resource: this.resource, deletedAt: null },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
    });
    return rows.map((row) => ({ id: row.id, code: row.code, name: row.name, data: (row.data ?? {}) as T, updatedAt: row.updatedAt }));
  }

  async get<T = Record<string, unknown>>(code: string): Promise<{ id: string; name: string; data: T } | null> {
    const row = await prisma.configurationItem.findFirst({ where: { schoolId: this.schoolId, resource: this.resource, code, deletedAt: null } });
    return row ? { id: row.id, name: row.name, data: (row.data ?? {}) as T } : null;
  }

  async put(code: string, name: string, data: unknown, displayOrder = 0): Promise<string> {
    const existing = await prisma.configurationItem.findFirst({ where: { schoolId: this.schoolId, resource: this.resource, code } });
    const json = data as Prisma.InputJsonValue;
    if (existing) {
      await prisma.configurationItem.update({ where: { id: existing.id }, data: { name, data: json, deletedAt: null, status: "ACTIVE", displayOrder } });
      return existing.id;
    }
    const created = await prisma.configurationItem.create({ data: { schoolId: this.schoolId, resource: this.resource, code, name, data: json, displayOrder } });
    return created.id;
  }

  async remove(code: string): Promise<void> {
    await prisma.configurationItem.updateMany({ where: { schoolId: this.schoolId, resource: this.resource, code, deletedAt: null }, data: { deletedAt: new Date(), status: "ARCHIVED" } });
  }
}

export const store = (schoolId: string, resource: string) => new ConfigStore(schoolId, resource);

export function formatDay(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const parsed = typeof date === "string" ? new Date(date) : date;
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function monthYear(date: Date | null | undefined): string {
  return date ? date.toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—";
}
