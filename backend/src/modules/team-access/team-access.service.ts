import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AuditAction, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { ACTIONS, type ActionId, actionAllowed, actionsFor, BACK_OFFICE_MODULES, RANK, forgetAccess, levelFor, levelsFor, type Level } from "./access";

const DAY = 86_400_000;
const PLATFORM_ROLES: UserRole[] = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN"];
/** Working hours at Future Realm, in the platform's own day (Africa/Lagos, UTC+1). Access outside them is worth a look. */
const WORKDAY_FROM = 6;
const WORKDAY_TO = 22;
const LARGE_EXPORT_ROWS = 1000;

export const RESPONSIBILITIES = [
  { value: "SUPPORT_LEAD", label: "Support Lead" },
  { value: "DPO", label: "Data Protection Officer" },
  { value: "FINANCE_LEAD", label: "Finance Lead" },
  { value: "PRODUCT_LEAD", label: "Product Lead" },
  { value: "COMMS_LEAD", label: "Comms Lead" },
  { value: "SALES_LEAD", label: "Sales Lead" },
  { value: "MIGRATION_SPECIALIST", label: "Migration Specialist" },
  { value: "CTO", label: "CTO / Engineering on call" }
] as const;

const profileSchema = z.object({
  responsibilities: z.preprocess((v) => (Array.isArray(v) ? v : typeof v === "string" && v.startsWith("[") ? JSON.parse(v) : typeof v === "string" && v ? v.split(",").map((x) => x.trim()).filter(Boolean) : []), z.array(z.enum(RESPONSIBILITIES.map((r) => r.value) as [string, ...string[]]))).default([]),
  departmentId: z.string().trim().optional().transform((v) => v || null),
  level: z.string().trim().optional().transform((v) => v || null),
  scopeStates: z.preprocess((v) => (Array.isArray(v) ? v : typeof v === "string" && v ? v.split(/[,\n]/).map((x) => x.trim()).filter(Boolean) : []), z.array(z.string())).default([]),
  managerId: z.string().trim().optional().transform((v) => v || null),
  staffNumber: z.string().trim().optional().transform((v) => v || null),
  isExternal: z.preprocess((v) => v === true || v === "true", z.boolean()).default(false),
  customRoleId: z.string().trim().optional().transform((v) => v || null)
});
const LEVEL_SET = new Set(["NONE", "VIEW", "EDIT", "FULL"]);
const roleSchema = z.object({
  name: z.string().trim().min(3, "Give the role a name of at least three letters.").max(60),
  description: z.string().trim().max(300).optional().transform((v) => v || undefined),
  baseRole: z.enum(["PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER"]).default("PLATFORM_ADMIN"),
  copyFrom: z.string().trim().optional().transform((v) => v || undefined),
  grid: z.record(z.string(), z.string()).default({})
});
const cleanGrid = (grid: Record<string, string>) => Object.fromEntries(Object.entries(grid).filter(([module, level]) => BACK_OFFICE_MODULES.some((m) => m.id === module) && LEVEL_SET.has(level)));
const reviewSchema = z.object({ note: z.string().trim().min(3, "Say what you found.").max(1000), outcome: z.enum(["BENIGN", "ESCALATE"]).default("BENIGN") });
const gridSchema = z.object({ userId: z.string().min(1), moduleId: z.string().trim().min(1), accessLevel: z.enum(["NONE", "VIEW", "EDIT", "FULL"]) });

const scopeCache = new Map<string, { at: number; states: string[] | null }>();

/** The states a Back Office person is limited to, or null for the whole platform. */
export async function scopeStatesFor(session: SessionPayload): Promise<string[] | null> {
  if (["PLATFORM_OWNER", "SUPER_ADMIN"].includes(String(session.role))) return null;
  const hit = scopeCache.get(session.userId);
  if (hit && Date.now() - hit.at < 10_000) return hit.states;
  const profile = await prisma.internalProfile.findUnique({ where: { userId: session.userId }, select: { scopeStates: true } });
  const states = profile && profile.scopeStates.length ? profile.scopeStates : null;
  scopeCache.set(session.userId, { at: Date.now(), states });
  return states;
}
export const forgetScope = (userId: string) => scopeCache.delete(userId);

@Injectable()
export class TeamAccessService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("TeamAccess");
  private timer: NodeJS.Timeout | null = null;

  onModuleInit() {
    if (process.env.ANOMALY_SCANNER === "off") return;
    this.timer = setInterval(() => void this.scan().catch((error) => this.log.error(error)), 15 * 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async audit(session: SessionPayload | null, action: AuditAction, entityType: string, entityId: string, metadata: Prisma.InputJsonValue) {
    const actor = session ? await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } }) : null;
    await prisma.auditLog.create({ data: { actorId: actor?.id ?? null, action, entityType, entityId, metadata } });
  }

  /* ───────────────────────── who may do what ───────────────────────── */

  modules() {
    return BACK_OFFICE_MODULES.map((m) => ({ ...m }));
  }

  /** What the signed-in person holds in every module — read by the sidebar to hide what is switched off. */
  async mine(session: SessionPayload) {
    return { levels: await levelsFor(session.userId, String(session.role)), modules: this.modules() };
  }

  /**
   * Setting a person's access. Super Admin sets anything. A department lead may set it for the members of their own
   * department, and only up to the ceiling the department carries — they can lower a member, never raise past it.
   */
  async setGrid(session: SessionPayload, body: unknown) {
    const input = gridSchema.parse(body);
    if (!BACK_OFFICE_MODULES.some((m) => m.id === input.moduleId)) throw new BadRequestException(`${input.moduleId} is not a Back Office module.`);
    const target = await prisma.user.findFirst({ where: { id: input.userId, role: { in: PLATFORM_ROLES }, deletedAt: null } });
    if (!target) throw new NotFoundException("That person is not on the platform team.");
    const isAdmin = ["PLATFORM_OWNER", "SUPER_ADMIN"].includes(String(session.role));
    if (!isAdmin) {
      const ceilingDept = await prisma.internalDepartment.findFirst({ where: { leadId: session.userId } });
      const member = await prisma.internalProfile.findUnique({ where: { userId: input.userId } });
      if (!ceilingDept || member?.departmentId !== ceilingDept.id) throw new BadRequestException("Only a Super Admin, or the lead of this person's department, can change their access.");
      const ceiling = ((ceilingDept.permissionCeiling ?? {}) as Record<string, string>)[input.moduleId];
      if (!ceiling) throw new BadRequestException(`${ceilingDept.name} has no ceiling for this module, so its lead cannot grant it.`);
      if (RANK[input.accessLevel] > RANK[ceiling as Level]) throw new BadRequestException(`${ceilingDept.name}'s ceiling for this module is ${ceiling.toLowerCase()}; a lead can lower access but never raise it past that.`);
      const mine = await levelFor(session.userId, String(session.role), input.moduleId);
      if (mine !== "UNSET" && RANK[input.accessLevel] > RANK[mine]) throw new BadRequestException("You cannot give someone more access than you hold yourself.");
    }
    const before = await prisma.internalPermissionGrid.findUnique({ where: { userId_moduleId: { userId: input.userId, moduleId: input.moduleId } } });
    const row = await prisma.internalPermissionGrid.upsert({ where: { userId_moduleId: { userId: input.userId, moduleId: input.moduleId } }, create: input, update: { accessLevel: input.accessLevel } });
    forgetAccess(input.userId);
    await this.audit(session, AuditAction.UPDATE, "InternalPermissionGrid", row.id, { userId: input.userId, moduleId: input.moduleId, from: before?.accessLevel ?? "unset", to: input.accessLevel });
    return { id: row.id };
  }

  /**
   * Give somebody an exact set of actions in a module (view, export, create, edit, approve, delete) — or clear it to go back to
   * what their level allows. A department lead can narrow but never go beyond their own ceiling or what they hold themselves.
   */
  async setActions(session: SessionPayload, body: unknown) {
    const input = z.object({
      userId: z.string().min(1),
      moduleId: z.string().trim().min(1),
      actions: z.preprocess((v) => (Array.isArray(v) ? v : typeof v === "string" && v.startsWith("[") ? JSON.parse(v) : []), z.array(z.enum(ACTIONS.map((a) => a.id) as [ActionId, ...ActionId[]]))),
      reset: z.preprocess((v) => v === true || v === "true", z.boolean()).default(false)
    }).parse(body);
    if (!BACK_OFFICE_MODULES.some((m) => m.id === input.moduleId)) throw new BadRequestException(`${input.moduleId} is not a Back Office module.`);
    const target = await prisma.user.findFirst({ where: { id: input.userId, role: { in: PLATFORM_ROLES }, deletedAt: null } });
    if (!target) throw new NotFoundException("That person is not on the platform team.");
    if (["PLATFORM_OWNER", "SUPER_ADMIN"].includes(String(target.role))) throw new BadRequestException("A Super Admin always holds every action; there is nothing to narrow.");
    const isAdmin = ["PLATFORM_OWNER", "SUPER_ADMIN"].includes(String(session.role));
    if (!isAdmin) {
      for (const action of input.actions) if (!(await actionAllowed(session.userId, String(session.role), input.moduleId, action))) throw new BadRequestException("You cannot give someone an action you do not hold yourself.");
    }
    const key = { userId_moduleId: { userId: input.userId, moduleId: input.moduleId } };
    const before = await prisma.internalPermissionGrid.findUnique({ where: key });
    if (input.reset || !input.actions.length) {
      if (before?.accessLevel === "INHERIT") await prisma.internalPermissionGrid.delete({ where: key });
      else if (before) await prisma.internalPermissionGrid.update({ where: key, data: { customActions: false, actions: [] } });
      forgetAccess(input.userId);
      await this.audit(session, AuditAction.UPDATE, "InternalPermissionGrid", before?.id ?? input.userId, { userId: input.userId, moduleId: input.moduleId, from: before?.customActions ? before.actions : "level", to: "level" });
      return { custom: false };
    }
    const level = input.actions.includes("delete") ? "FULL" : input.actions.some((a) => ["create", "edit", "approve"].includes(a)) ? "EDIT" : "VIEW";
    const row = await prisma.internalPermissionGrid.upsert({ where: key, create: { userId: input.userId, moduleId: input.moduleId, accessLevel: "INHERIT", customActions: true, actions: input.actions }, update: { customActions: true, actions: input.actions, ...(before && before.accessLevel === "NONE" ? { accessLevel: level } : {}) } });
    forgetAccess(input.userId);
    await this.audit(session, AuditAction.UPDATE, "InternalPermissionGrid", row.id, { userId: input.userId, moduleId: input.moduleId, from: before?.customActions ? before.actions : "level", to: input.actions });
    return { custom: true, actions: input.actions };
  }

  /** What each person may do in each module: the exact set, or what their level allows. */
  async actionsMatrix() {
    const members = await prisma.user.findMany({ where: { role: { in: PLATFORM_ROLES }, deletedAt: null }, select: { id: true, firstName: true, lastName: true, role: true } });
    const out: Record<string, Record<string, { actions: ActionId[]; custom: boolean }>> = {};
    for (const member of members) {
      out[member.id] = {};
      for (const module of BACK_OFFICE_MODULES) out[member.id][module.id] = await actionsFor(member.id, String(member.role), module.id);
    }
    return { actions: ACTIONS, modules: BACK_OFFICE_MODULES, people: out };
  }

  /** The matrix every Back Office person against every module, with what is set, and what is merely inherited from the role. */
  async matrix() {
    const [members, rows, templates, customRoles, customHolders] = await Promise.all([
      prisma.user.findMany({ where: { role: { in: PLATFORM_ROLES }, deletedAt: null }, select: { id: true, firstName: true, lastName: true, role: true }, orderBy: { createdAt: "asc" } }),
      prisma.internalPermissionGrid.findMany(),
      prisma.internalPermissionTemplate.findMany(),
      prisma.internalRole.findMany({ where: { retiredAt: null } }),
      prisma.internalProfile.findMany({ where: { customRoleId: { not: null } }, select: { userId: true, customRoleId: true } })
    ]);
    const customGrid = new Map(customRoles.map((role) => [role.id, (role.grid ?? {}) as Record<string, string>]));
    const holderRole = new Map(customHolders.map((row) => [row.userId, row.customRoleId as string]));
    const byUser = new Map<string, Record<string, string>>();
    for (const row of rows.filter((r) => r.accessLevel !== "INHERIT")) byUser.set(row.userId, { ...(byUser.get(row.userId) ?? {}), [row.moduleId]: row.accessLevel });
    const template = new Map(templates.map((t) => [t.roleName, (t.defaultGrid ?? {}) as Record<string, string>]));
    return {
      modules: BACK_OFFICE_MODULES.map((m) => m.id),
      labels: Object.fromEntries(BACK_OFFICE_MODULES.map((m) => [m.id, m.label])),
      members: members.map((m) => ({ id: m.id, name: `${m.firstName} ${m.lastName}`, role: m.role, access: { ...(holderRole.has(m.id) && customGrid.has(holderRole.get(m.id) as string) ? customGrid.get(holderRole.get(m.id) as string)! : (template.get(m.role) ?? {})), ...(byUser.get(m.id) ?? {}) }, explicit: Object.keys(byUser.get(m.id) ?? {}) }))
    };
  }

  /* ───────────────────────── where a person sits ───────────────────────── */

  async saveProfile(session: SessionPayload, userId: string, body: unknown) {
    const input = profileSchema.parse(body);
    const user = await prisma.user.findFirst({ where: { id: userId, role: { in: PLATFORM_ROLES }, deletedAt: null } });
    if (!user) throw new NotFoundException("That person is not on the platform team.");
    if (input.managerId && input.managerId === userId) throw new BadRequestException("Nobody reports to themselves.");
    if (input.managerId && !(await prisma.user.findFirst({ where: { id: input.managerId, role: { in: PLATFORM_ROLES }, deletedAt: null } }))) throw new BadRequestException("The manager is not on the platform team.");
    if (input.departmentId && !(await prisma.internalDepartment.findUnique({ where: { id: input.departmentId } }))) throw new BadRequestException("That department does not exist.");
    if (input.customRoleId && !(await prisma.internalRole.findFirst({ where: { id: input.customRoleId, retiredAt: null } }))) throw new BadRequestException("That role does not exist or has been retired.");
    const row = await prisma.internalProfile.upsert({ where: { userId }, create: { userId, ...input }, update: input });
    forgetScope(userId);
    await this.audit(session, AuditAction.UPDATE, "InternalProfile", userId, { departmentId: row.departmentId, level: row.level, scopeStates: row.scopeStates, managerId: row.managerId, isExternal: row.isExternal });
    return { userId };
  }

  /* ───────────────────────── roles made in the Back Office ───────────────────────── */

  async roles() {
    const [roles, holders] = await Promise.all([prisma.internalRole.findMany({ orderBy: { createdAt: "asc" } }), prisma.internalProfile.findMany({ where: { customRoleId: { not: null } }, select: { userId: true, customRoleId: true } })]);
    const people = await prisma.user.findMany({ where: { id: { in: holders.map((row) => row.userId) }, deletedAt: null }, select: { id: true, firstName: true, lastName: true } });
    const name = new Map(people.map((person) => [person.id, `${person.firstName} ${person.lastName}`]));
    return roles.map((role) => ({ id: role.id, name: role.name, description: role.description, baseRole: role.baseRole, grid: role.grid as Record<string, string>, retired: Boolean(role.retiredAt), holders: holders.filter((row) => row.customRoleId === role.id && name.has(row.userId)).map((row) => name.get(row.userId) as string) }));
  }

  /** A new role starts from nothing, or from a copy of a built-in role's template or another role's grid. */
  async createRole(session: SessionPayload, body: unknown) {
    const input = roleSchema.parse(body);
    if (await prisma.internalRole.findUnique({ where: { name: input.name } })) throw new BadRequestException("A role with that name already exists.");
    let grid = cleanGrid(input.grid);
    if (input.copyFrom && Object.keys(grid).length === 0) {
      const custom = await prisma.internalRole.findUnique({ where: { id: input.copyFrom } });
      const built = custom ? null : await prisma.internalPermissionTemplate.findUnique({ where: { roleName: input.copyFrom } });
      grid = cleanGrid(((custom?.grid ?? built?.defaultGrid ?? {}) as Record<string, string>));
    }
    const actor = await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } });
    const role = await prisma.internalRole.create({ data: { name: input.name, description: input.description, baseRole: input.baseRole, grid, createdById: actor?.id ?? session.userId } });
    await this.audit(session, AuditAction.CREATE, "InternalRole", role.id, { name: role.name, baseRole: role.baseRole, modules: Object.keys(grid).length });
    return { id: role.id };
  }

  async setRoleGrid(session: SessionPayload, id: string, body: unknown) {
    const input = z.object({ grid: z.record(z.string(), z.string()), description: z.string().trim().max(300).optional().transform((v) => v || undefined) }).parse(body);
    const role = await prisma.internalRole.findFirst({ where: { id, retiredAt: null } });
    if (!role) throw new NotFoundException("That role does not exist or has been retired.");
    const grid = cleanGrid(input.grid);
    await prisma.internalRole.update({ where: { id }, data: { grid, ...(input.description !== undefined ? { description: input.description } : {}) } });
    const holders = await prisma.internalProfile.findMany({ where: { customRoleId: id }, select: { userId: true } });
    for (const holder of holders) forgetAccess(holder.userId);
    await this.audit(session, AuditAction.UPDATE, "InternalRole", id, { name: role.name, modules: Object.keys(grid).length, holders: holders.length });
    return { id, holders: holders.length };
  }

  /** A role somebody still holds cannot be retired — they are moved first, so nobody is left on a role that no longer exists. */
  async retireRole(session: SessionPayload, id: string, body: unknown) {
    const { reason } = z.object({ reason: z.string().trim().min(5, "Say why the role is being retired.") }).parse(body);
    const role = await prisma.internalRole.findFirst({ where: { id, retiredAt: null } });
    if (!role) throw new NotFoundException("That role does not exist or has been retired.");
    const holders = await prisma.internalProfile.count({ where: { customRoleId: id } });
    if (holders > 0) throw new BadRequestException(`${holders} ${holders === 1 ? "person holds" : "people hold"} this role. Move ${holders === 1 ? "them" : "everyone"} to another role first.`);
    await prisma.internalRole.update({ where: { id }, data: { retiredAt: new Date() } });
    await this.audit(session, AuditAction.DELETE, "InternalRole", id, { name: role.name, reason });
    return { id };
  }

  async profiles() {
    const [rows, departments, users] = await Promise.all([
      prisma.internalProfile.findMany(),
      prisma.internalDepartment.findMany({ select: { id: true, name: true } }),
      prisma.user.findMany({ where: { role: { in: PLATFORM_ROLES }, deletedAt: null }, select: { id: true, firstName: true, lastName: true, mfaEnabled: true } })
    ]);
    const dept = new Map(departments.map((d) => [d.id, d.name]));
    const name = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    return Object.fromEntries(users.map((user) => {
      const p = rows.find((row) => row.userId === user.id);
      return [user.id, { departmentId: p?.departmentId ?? null, department: p?.departmentId ? (dept.get(p.departmentId) ?? null) : null, level: p?.level ?? null, scopeStates: p?.scopeStates ?? [], managerId: p?.managerId ?? null, manager: p?.managerId ? (name.get(p.managerId) ?? null) : null, staffNumber: p?.staffNumber ?? null, isExternal: p?.isExternal ?? false, responsibilities: p?.responsibilities ?? [], mfaEnabled: user.mfaEnabled }];
    }));
  }

  async departmentMembers() {
    const rows = await prisma.internalProfile.findMany({ where: { departmentId: { not: null } } });
    const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) }, deletedAt: null }, select: { id: true, firstName: true, lastName: true } });
    const name = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    const out: Record<string, string[]> = {};
    for (const row of rows) if (name.has(row.userId)) (out[row.departmentId!] ??= []).push(name.get(row.userId)!);
    return out;
  }

  /** How many people are outside the company, and how many privilege changes were made lately. */
  async headlines() {
    const since = new Date(Date.now() - 90 * DAY);
    const [external, changes, openAnomalies] = await Promise.all([
      prisma.internalProfile.count({ where: { isExternal: true } }),
      prisma.auditLog.count({ where: { entityType: { in: ["InternalPermissionGrid", "InternalAccessGrant", "InternalPermissionTemplate", "InternalProfile"] }, createdAt: { gte: since } } }),
      prisma.internalAnomaly.count({ where: { status: "OPEN" } })
    ]);
    return { external, privilegeChanges90d: changes, openAnomalies };
  }

  /* ───────────────────────── behaviour worth a look ───────────────────────── */

  private async raise(userId: string, kind: string, detail: string, withinHours = 12) {
    const recent = await prisma.internalAnomaly.findFirst({ where: { userId, kind, detectedAt: { gte: new Date(Date.now() - withinHours * 3_600_000) } } });
    if (recent) return null;
    return prisma.internalAnomaly.create({ data: { userId, kind, detail } });
  }

  /** Called as a Back Office person signs in. */
  async onSignIn(user: { id: string; role: string; email: string }, context: { ipAddress?: string; device?: string; newDevice: boolean }) {
    if (!PLATFORM_ROLES.includes(user.role as UserRole)) return;
    const hour = (new Date().getUTCHours() + 1) % 24;
    if (hour < WORKDAY_FROM || hour >= WORKDAY_TO) await this.raise(user.id, "OUT_OF_HOURS", `${user.email} signed in at ${String(hour).padStart(2, "0")}:00 Lagos time, outside ${WORKDAY_FROM}:00–${WORKDAY_TO}:00.`);
    if (context.newDevice) await this.raise(user.id, "NEW_DEVICE", `${user.email} signed in from a device not seen before${context.device ? `: ${context.device.slice(0, 120)}` : ""}.`);
    const others = await prisma.platformSession.findMany({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() }, lastActivityAt: { gte: new Date(Date.now() - 30 * 60_000) } }, select: { ipAddress: true } });
    const elsewhere = others.filter((s) => s.ipAddress && context.ipAddress && s.ipAddress !== context.ipAddress);
    if (elsewhere.length) await this.raise(user.id, "TWO_PLACES", `${user.email} is signed in from ${context.ipAddress} while a session from ${elsewhere[0].ipAddress} was active in the last 30 minutes.`, 2);
  }

  /** Looks back over the audit trail for large exports by Back Office accounts. */
  async scan() {
    const since = new Date(Date.now() - 20 * 60_000);
    const exports = await prisma.auditLog.findMany({ where: { action: "EXPORT", createdAt: { gte: since }, actor: { role: { in: PLATFORM_ROLES } } }, select: { actorId: true, metadata: true, entityType: true } });
    let raised = 0;
    for (const row of exports) {
      const rows = Number(((row.metadata ?? {}) as { rowCount?: number }).rowCount ?? 0);
      if (row.actorId && rows >= LARGE_EXPORT_ROWS && (await this.raise(row.actorId, "LARGE_EXPORT", `An export of ${rows.toLocaleString()} ${row.entityType} rows was taken.`, 1))) raised += 1;
    }
    return { raised };
  }

  async anomalies() {
    const rows = await prisma.internalAnomaly.findMany({ orderBy: { detectedAt: "desc" }, take: 100 });
    const users = await prisma.user.findMany({ where: { id: { in: Array.from(new Set([...rows.map((r) => r.userId), ...rows.map((r) => r.reviewedById).filter((id): id is string => Boolean(id))])) } }, select: { id: true, firstName: true, lastName: true } });
    const name = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    return rows.map((r) => ({ id: r.id, person: name.get(r.userId) ?? "Former team member", kind: r.kind, detail: r.detail, detectedAt: r.detectedAt.toISOString(), status: r.status, reviewedBy: r.reviewedById ? (name.get(r.reviewedById) ?? "—") : null, reviewedAt: r.reviewedAt?.toISOString() ?? null, note: r.note }));
  }

  async review(session: SessionPayload, id: string, body: unknown) {
    const input = reviewSchema.parse(body);
    const row = await prisma.internalAnomaly.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("That flag no longer exists.");
    if (row.status !== "OPEN") throw new BadRequestException("This flag has already been reviewed.");
    const reviewer = await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } });
    await prisma.internalAnomaly.update({ where: { id }, data: { status: input.outcome === "ESCALATE" ? "ESCALATED" : "REVIEWED", reviewedById: reviewer?.id ?? null, reviewedAt: new Date(), note: input.note } });
    if (input.outcome === "ESCALATE") await prisma.securityIncident.create({ data: { type: `TEAM_${row.kind}`, severity: "MEDIUM", description: `${row.detail} — escalated after review: ${input.note}`, reportedById: reviewer?.id } });
    await this.audit(session, AuditAction.UPDATE, "InternalAnomaly", id, { outcome: input.outcome, kind: row.kind });
    return { id };
  }

  /** The devices a person has signed in from, from their own sign-in record. */
  async devices(userId: string) {
    const rows = await prisma.loginAttempt.findMany({ where: { userId, success: true, device: { not: null } }, select: { device: true, ipAddress: true, createdAt: true }, orderBy: { createdAt: "asc" }, take: 500 });
    const byDevice = new Map<string, { device: string; first: string; last: string; count: number; ip: string | null }>();
    for (const row of rows) {
      const key = row.device as string;
      const entry = byDevice.get(key);
      if (entry) { entry.last = row.createdAt.toISOString(); entry.count += 1; entry.ip = row.ipAddress ?? entry.ip; } else byDevice.set(key, { device: key, first: row.createdAt.toISOString(), last: row.createdAt.toISOString(), count: 1, ip: row.ipAddress });
    }
    return Array.from(byDevice.values()).sort((a, b) => b.last.localeCompare(a.last));
  }

  /** What a person currently holds: open tickets, schools they manage, flags raised on them. */
  async owns(userId: string) {
    const [tickets, schools, anomalies] = await Promise.all([
      prisma.supportTicket.count({ where: { assignedToId: userId, status: { notIn: ["RESOLVED", "CLOSED"] } } }).catch(() => 0),
      prisma.school.count({ where: { accountManagerId: userId, deletedAt: null } }),
      prisma.internalAnomaly.count({ where: { userId, status: "OPEN" } })
    ]);
    return { openTickets: tickets, schools, openFlags: anomalies };
  }
}

export const teamAccess = new TeamAccessService();
