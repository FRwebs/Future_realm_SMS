import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, PermissionOverrideType, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

import { canManageRole, isOwnerRole, isPlatformRole, isSchoolStaffRole } from "../../../../src/lib/auth/role-architecture";
import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import {
  schoolModuleActions,
  schoolModules,
  schoolPermissionKey,
  schoolPermissionKeysForRoleTemplate,
  schoolRoleTemplates,
  type SchoolModule,
  type SchoolModuleAction
} from "../../../../src/lib/modules/school-modules";
import { roleTemplateFor } from "../../../../src/lib/modules/school-access";
import { RolesManagementService } from "../roles-management/roles-management.service";
import { accountState, fullName, store, templateName } from "./staff-access.shared";

/**
 * Who can reach what — read from the permission keys themselves.
 *
 * The sixteen modules × their tabs × six actions are real permission keys
 * (`attendance.register.view`). A person holds the keys their role template carries,
 * plus any custom role they were put on, plus whatever was granted or taken from them
 * individually. This service reads that and writes the last of those: an individual grant
 * or refusal, which is exactly what "above" and "below their template" mean.
 */

export const ACTIONS = schoolModuleActions;
export type Action = SchoolModuleAction;

const LEVELS = ["No access", "View only", "Can work", "Full"] as const;

/** The role each template name belongs to when somebody is moved onto it. */
const ROLE_FOR_TEMPLATE: Record<string, UserRole> = {
  Proprietor: UserRole.PROPRIETOR,
  Principal: UserRole.PRINCIPAL,
  "Exam Officer": UserRole.EXAM_OFFICER,
  Bursar: UserRole.BURSAR,
  Registrar: UserRole.ADMIN_OFFICER,
  "Head of Department": UserRole.HEAD_OF_DEPARTMENT,
  "Form Master": UserRole.CLASS_TEACHER,
  "Subject Teacher": UserRole.SUBJECT_TEACHER,
  "School Nurse": UserRole.SCHOOL_NURSE,
  Counsellor: UserRole.GUIDANCE_COUNSELLOR,
  "ICT Officer": UserRole.ICT_CBT_ADMIN
};

const FEE_DEFAULT: Record<string, string> = {
  Proprietor: "Full amounts",
  Principal: "Full amounts",
  Bursar: "Full amounts",
  Registrar: "Status only",
  "Head of Department": "Status only",
  "Form Master": "Status only"
};

export type AccessProfile = {
  scope?: string;
  fees?: string;
  approve?: string;
  scopeEnds?: string;
  twoStep?: boolean;
  exports?: boolean;
  messaging?: string[];
  accessEnds?: string;
  historic?: string;
};

export type SensitiveGroup = {
  name: string;
  why: string;
  covers: string[];
  roles: string[];
  holders: string[];
  typedReason: boolean;
  password: boolean;
  notify: string;
  approval: string;
  expiry: string;
  review: string;
  tellHolders: boolean;
  createdAt: string;
};

export type Delegation = {
  userId: string;
  holds: string;
  grantedBy: string;
  grantedById: string | null;
  grantedOn: string;
  expiresOn: string | null;
  reason: string;
};

const gridRowKey = (module: SchoolModule, tabSlug: string) => `${module.slug}.${tabSlug}`;
const allGridKeys = schoolModules.flatMap((module) => module.tabs.flatMap((tab) => ACTIONS.map((action) => schoolPermissionKey(module.slug, tab.slug, action))));
const gridKeySet = new Set(allGridKeys);

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const gridSchema = z.object({
  /** "module": ticks are `moduleSlug|Action`; "tabs": ticks are `moduleSlug.tabSlug|Action` inside `moduleSlug`; "full": every row. */
  scope: z.enum(["module", "tabs", "full"]),
  moduleSlug: z.string().optional(),
  ticks: z.array(z.string()),
  reason: z.string().trim().optional()
});

const profileSchema = z.object({
  scope: z.string().trim().optional(),
  fees: z.string().trim().optional(),
  approve: z.string().trim().optional(),
  scopeEnds: z.string().trim().optional().or(z.literal("")),
  historic: z.string().trim().optional(),
  reason: z.string().trim().optional()
});

const changeRoleSchema = z.object({
  role: z.string().min(1, "Choose the new role."),
  scope: z.string().optional(),
  approve: z.string().optional(),
  individual: z.string().optional(),
  sensitive: z.string().optional(),
  routed: z.string().optional(),
  effective: z.string().optional(),
  effectiveDate: z.string().optional().or(z.literal("")),
  reason: z.string().trim().min(3, "Say why the role is changing."),
  tell: z.coerce.boolean().optional()
});

const sensitiveSchema = z.object({
  name: z.string().trim().min(3, "Name the group."),
  why: z.string().trim().min(3, "Say why these are held separately."),
  covers: z.array(z.string()).min(1, "Tick at least one record type."),
  roles: z.array(z.string()).default([]),
  holders: z.array(z.string()).default([]),
  typedReason: z.coerce.boolean().default(true),
  password: z.coerce.boolean().default(true),
  notify: z.string().default("Nobody — the log is enough"),
  approval: z.string().default("The Proprietor’s approval"),
  expiry: z.string().default("At the end of each session"),
  review: z.string().default("Term · at recertification"),
  tellHolders: z.coerce.boolean().default(true)
});

const customRoleSchema = z.object({
  name: z.string().trim().min(2, "Name the role."),
  purpose: z.string().trim().min(3, "Say what the role is for."),
  startFrom: z.string().default("An empty role"),
  modules: z.array(z.string()).default([]),
  ticks: z.array(z.string()).default([]),
  scope: z.string().default("Only their own subject-arms"),
  fees: z.string().default("Cannot see fee information"),
  approve: z.string().default("Nothing"),
  teaching: z.coerce.boolean().default(false),
  people: z.array(z.string()).default([]),
  mode: z.string().default("Add this role on top of what they hold"),
  tell: z.coerce.boolean().default(true)
});

const delegationSchema = z.object({
  userId: z.string().min(1, "Choose who holds it."),
  holds: z.string().trim().min(3, "Say what is being delegated."),
  expiresOn: z.string().optional().or(z.literal("")),
  reason: z.string().trim().min(3, "Say why.")
});

@Injectable()
export class AccessService {
  constructor(private readonly roles: RolesManagementService) {}

  async ok<T>(dataPromise: Promise<T>, message?: string) {
    return { ok: true, success: true, ...(message ? { message } : {}), data: await dataPromise };
  }

  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType, entityId, metadata } });
  }

  /* ───────────────────────── people ───────────────────────── */

  private async staffUsers(schoolId: string) {
    const users = await prisma.user.findMany({
      where: { schoolId, deletedAt: null, staffProfile: { isNot: null } },
      include: { staffProfile: { include: { department: { select: { name: true } } } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }]
    });
    return users.filter((user) => isSchoolStaffRole(user.role));
  }

  /** Everything the grid needs to know about one person's keys. */
  private async keysFor(user: { id: string; role: UserRole }, schoolId: string) {
    const base = await this.roles.basePermissionSet(user.id, schoolId, user.role);
    const overrides = await prisma.userPermissionOverride.findMany({ where: { schoolId, userId: user.id }, include: { permission: true } });
    const effective = new Set(base);
    for (const override of overrides) {
      if (override.type === "GRANT") effective.add(override.permission.key);
      if (override.type === "REVOKE") effective.delete(override.permission.key);
    }
    const above = Array.from(effective).filter((key) => gridKeySet.has(key) && !base.has(key));
    const below = Array.from(base).filter((key) => gridKeySet.has(key) && !effective.has(key));
    return { base, effective, above, below, overrides };
  }

  private grantsOf(keys: Set<string>, module: SchoolModule) {
    const tabs = module.tabs.map((tab) => {
      const a = Object.fromEntries(ACTIONS.map((action) => [action, keys.has(schoolPermissionKey(module.slug, tab.slug, action))])) as Record<Action, boolean>;
      return { slug: tab.slug, label: tab.label, rowKey: gridRowKey(module, tab.slug), a, on: ACTIONS.filter((action) => a[action]).length };
    });
    const viewTabs = tabs.filter((tab) => tab.a.View).length;
    const works = tabs.filter((tab) => tab.a.Create || tab.a.Edit).length;
    const level = viewTabs === 0 ? 0 : works === 0 ? 1 : viewTabs === tabs.length && tabs.every((tab) => tab.a.Create && tab.a.Edit) ? 3 : 2;
    const all = Object.fromEntries(ACTIONS.map((action) => [action, tabs.length > 0 && tabs.every((tab) => tab.a[action])])) as Record<Action, boolean>;
    const any = Object.fromEntries(ACTIONS.map((action) => [action, tabs.some((tab) => tab.a[action])])) as Record<Action, boolean>;
    return { tabs, level, levelLabel: LEVELS[level], viewTabs, all, any, ticks: tabs.reduce((sum, tab) => sum + tab.on, 0) };
  }

  private async profileOf(schoolId: string, userId: string, role: UserRole): Promise<Required<Pick<AccessProfile, "scope" | "fees" | "approve">> & AccessProfile> {
    const stored = (await store(schoolId, "access-profiles").get<AccessProfile>(userId))?.data ?? {};
    const template = roleTemplateFor(role as never);
    const info = schoolRoleTemplates.find((item) => item.name === template);
    return {
      ...stored,
      scope: stored.scope ?? info?.dataScope ?? "Only what they have been assigned",
      fees: stored.fees ?? (template ? FEE_DEFAULT[template] ?? "None" : "None"),
      approve: stored.approve ?? info?.canApprove ?? "Nothing"
    };
  }

  private async sensitiveGroups(schoolId: string): Promise<Array<{ id: string; slug: string } & SensitiveGroup>> {
    const rows = await store(schoolId, "sensitive-groups").list<SensitiveGroup>();
    return rows.map((row) => ({ id: row.id, slug: row.code ?? row.id, ...row.data, name: row.name }));
  }

  private async delegationRows(schoolId: string): Promise<Array<{ id: string } & Delegation>> {
    const rows = await store(schoolId, "delegations").list<Delegation>();
    return rows.map((row) => ({ id: row.code ?? row.id, ...row.data }));
  }

  /** The directory of people for the Permissions tab. */
  async overview(session: SessionPayload) {
    const schoolId = session.schoolId;
    const [users, groups, delegations, recerts] = await Promise.all([
      this.staffUsers(schoolId),
      this.sensitiveGroups(schoolId),
      this.delegationRows(schoolId),
      store(schoolId, "recertifications").list<{ by: string; at: string; people: number; note?: string }>()
    ]);

    type Person = {
      userId: string; staffId: string | null; name: string; department: string; role: string; roleCode: UserRole; hasTemplate: boolean;
      reach: number; moduleSlugs: string[]; tabs: number; scope: string; fees: string; approve: string; sensitive: string[]; account: string; accountDays: number;
      above: number; aboveWhere: string[]; below: number; isYou: boolean;
    };
    const people: Person[] = [];
    for (const user of users) {
      const { effective, above, below } = await this.keysFor(user, schoolId);
      const profile = await this.profileOf(schoolId, user.id, user.role);
      const grants = schoolModules.map((module) => this.grantsOf(effective, module));
      const reach = grants.filter((grant) => grant.level > 0).length;
      const state = accountState(user);
      const template = roleTemplateFor(user.role as never);
      const held = groups.filter((group) => group.holders.includes(user.id)).map((group) => group.name);
      const aboveModules = Array.from(new Set(above.map((key) => schoolModules.find((module) => key.startsWith(`${module.slug}.`))?.name).filter((value): value is string => Boolean(value))));
      people.push({
        userId: user.id,
        staffId: user.staffProfile?.id ?? null,
        name: fullName(user),
        department: user.staffProfile?.department?.name ?? "No department",
        role: template ?? templateName(user.role),
        roleCode: user.role,
        hasTemplate: Boolean(template),
        reach,
        moduleSlugs: schoolModules.filter((_, index) => grants[index].level > 0).map((module) => module.slug),
        tabs: grants.reduce((sum, grant) => sum + grant.viewTabs, 0),
        scope: profile.scope,
        fees: profile.fees,
        approve: profile.approve,
        sensitive: held,
        account: state.state,
        accountDays: state.days,
        above: above.length,
        aboveWhere: aboveModules,
        below: below.length,
        isYou: user.id === session.userId
      });
    }

    const templates = [
      ...schoolRoleTemplates.map((template) => ({
        name: template.name,
        custom: false,
        id: null as string | null,
        people: people.filter((person) => person.role === template.name).length,
        reach: schoolModules.filter((module) => this.templateReach(template.name, module) > 0).length,
        moduleSlugs: schoolModules.filter((module) => this.templateReach(template.name, module) > 0).map((module) => module.slug),
        scope: template.dataScope,
        approve: template.canApprove
      }))
    ];
    const customRoles = await prisma.role.findMany({
      where: { schoolId, deletedAt: null, isSystem: false },
      include: { rolePermissions: { include: { permission: true } }, _count: { select: { userRoles: true } } },
      orderBy: { name: "asc" }
    });
    for (const role of customRoles) {
      const keys = new Set(role.rolePermissions.map((item) => item.permission.key));
      const profile = (await store(schoolId, "role-profiles").get<{ scope?: string; approve?: string }>(role.id))?.data ?? {};
      templates.push({
        name: role.name,
        custom: true,
        id: role.id,
        people: role._count.userRoles,
        reach: schoolModules.filter((module) => this.grantsOf(keys, module).level > 0).length,
        moduleSlugs: schoolModules.filter((module) => this.grantsOf(keys, module).level > 0).map((module) => module.slug),
        scope: profile.scope ?? "Only what they are assigned",
        approve: profile.approve ?? "Nothing"
      });
    }

    const lastRecert = recerts.sort((a, b) => b.data.at.localeCompare(a.data.at))[0]?.data ?? null;
    const now = new Date();
    return {
      people,
      templates,
      groups: groups.map((group) => ({
        id: group.id,
        slug: group.slug,
        name: group.name,
        holders: group.holders.map((id) => users.find((user) => user.id === id)).filter(Boolean).map((user) => fullName(user)),
        holderIds: group.holders,
        covers: group.covers
      })),
      delegations: delegations.map((delegation) => ({
        ...delegation,
        person: fullName(users.find((user) => user.id === delegation.userId)) || "Someone",
        status: delegation.expiresOn && new Date(delegation.expiresOn) < now ? "Expired" : "Active"
      })),
      recertification: {
        last: lastRecert,
        dueOn: lastRecert ? new Date(new Date(lastRecert.at).getTime() + 120 * 86_400_000).toISOString() : null
      },
      modules: schoolModules.map((module) => ({ code: module.code, slug: module.slug, name: module.name, tabs: module.tabs }))
    };
  }

  private templateReach(template: string, module: SchoolModule): number {
    const keys = new Set(schoolPermissionKeysForRoleTemplate(template));
    return module.tabs.some((tab) => keys.has(schoolPermissionKey(module.slug, tab.slug, "View"))) ? 1 : 0;
  }

  /* ───────────────────────── one person ───────────────────────── */

  async person(session: SessionPayload, userId: string) {
    const schoolId = session.schoolId;
    const found = await prisma.user.findFirst({
      where: { id: userId, schoolId, deletedAt: null },
      include: { staffProfile: { include: { department: { select: { name: true } } } } }
    });
    if (!found) throw new NotFoundException("That person is not on this school's staff.");

    const { base, effective, above, below } = await this.keysFor(found, schoolId);
    const profile = await this.profileOf(schoolId, found.id, found.role);
    const groups = await this.sensitiveGroups(schoolId);
    const state = accountState(found);
    const template = roleTemplateFor(found.role as never);
    const modules = schoolModules.map((module) => {
      const grant = this.grantsOf(effective, module);
      const baseGrant = this.grantsOf(base, module);
      return {
        code: module.code,
        slug: module.slug,
        name: module.name,
        description: module.description,
        level: grant.level,
        levelLabel: grant.levelLabel,
        all: grant.all,
        any: grant.any,
        ticks: grant.ticks,
        baseTicks: baseGrant.ticks,
        tabs: grant.tabs.map((tab, index) => ({ ...tab, base: baseGrant.tabs[index].a }))
      };
    });
    const [audit, recerts] = await Promise.all([
      prisma.auditLog.findMany({
        where: { schoolId, entityId: found.id, entityType: { in: ["AccessGrant", "StaffRoleAssignment", "SensitiveGroup", "StaffProfile", "AccessProfile"] } },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { actor: { select: { firstName: true, lastName: true } } }
      }),
      store(schoolId, "recertifications").list<{ by: string; at: string; people: string[] }>()
    ]);
    const mine = recerts.filter((entry) => entry.data.people?.includes(found.id)).sort((a, b) => b.data.at.localeCompare(a.data.at))[0]?.data ?? null;

    return {
      userId: found.id,
      staffId: found.staffProfile?.id ?? null,
      name: fullName(found),
      email: found.email,
      phone: found.phone,
      staffNo: found.staffProfile?.employeeNo ?? null,
      department: found.staffProfile?.department?.name ?? "No department",
      since: found.staffProfile?.employmentDate?.toISOString() ?? null,
      role: template ?? templateName(found.role),
      roleCode: found.role,
      hasTemplate: Boolean(template),
      account: state.state,
      accountDays: state.days,
      lastLoginAt: found.lastLoginAt?.toISOString() ?? null,
      mfa: found.mfaEnabled,
      scope: profile.scope,
      fees: profile.fees,
      approve: profile.approve,
      accessEnds: profile.accessEnds ?? null,
      scopeEnds: profile.scopeEnds ?? null,
      sensitive: groups.filter((group) => group.holders.includes(found.id)).map((group) => group.name),
      above: above.length,
      aboveKeys: above,
      below: below.length,
      modules,
      changes: audit.map((entry) => {
        const meta = (entry.metadata ?? {}) as { summary?: string; reason?: string };
        return {
          id: entry.id,
          label: meta.summary ?? `${entry.action.toLowerCase()} · ${entry.entityType}`,
          detail: `${fullName(entry.actor) || "Someone"} · ${entry.createdAt.toISOString().slice(0, 10)}${meta.reason ? ` · ${meta.reason}` : ""}`
        };
      }),
      recertified: mine,
      canEdit: await this.canManage(session, found)
    };
  }

  private async canManage(session: SessionPayload, target: { id: string; role: UserRole }): Promise<boolean> {
    if (isPlatformRole(session.role as never)) return true;
    if (target.id === session.userId) return false;
    return canManageRole(session.role as never, target.role as never);
  }

  private async assertCanManage(session: SessionPayload, target: { id: string; role: UserRole }) {
    if (target.id === session.userId) throw new ForbiddenException("Nobody changes their own access. Ask somebody above you.");
    if (!(await this.canManage(session, target))) {
      throw new ForbiddenException("You cannot change the access of somebody with equal or higher authority than yours.");
    }
  }

  /** The keys the actor may hand on: nobody gives away what they do not hold. */
  private async assertCanUse(session: SessionPayload, keys: string[]) {
    if (isPlatformRole(session.role as never) || isOwnerRole(session.role as never)) return;
    const own = new Set(await this.roles.resolveUserPermissions(session.userId, session.schoolId, session));
    const missing = keys.filter((key) => !own.has(key));
    if (missing.length) throw new ForbiddenException(`You cannot grant access you do not hold yourself: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? " and more" : ""}.`);
  }

  /* ───────────────────────── writing the grid ───────────────────────── */

  /**
   * Turn a set of ticks into the set of keys they mean. A module-level tick means the action on
   * every tab of that module; it only changes what the person's grid shows when the tick moved.
   */
  private desiredKeys(current: Set<string>, input: z.infer<typeof gridSchema>): { keys: Set<string>; touched: Set<string> } {
    const keys = new Set(current);
    const touched = new Set<string>();

    if (input.scope === "module") {
      for (const module of schoolModules) {
        const grant = this.grantsOf(current, module);
        for (const action of ACTIONS) {
          const wanted = input.ticks.includes(`${module.slug}|${action}`);
          const shown = grant.all[action];
          if (wanted === shown) continue;
          for (const tab of module.tabs) {
            const key = schoolPermissionKey(module.slug, tab.slug, action);
            touched.add(key);
            if (wanted) keys.add(key);
            else keys.delete(key);
            // Taking View away takes the rest of the actions on that tab with it.
            if (!wanted && action === "View") {
              for (const other of ACTIONS) {
                const otherKey = schoolPermissionKey(module.slug, tab.slug, other);
                touched.add(otherKey);
                keys.delete(otherKey);
              }
            }
          }
        }
      }
      return { keys, touched };
    }

    const modulesInScope = input.scope === "tabs" ? schoolModules.filter((module) => module.slug === input.moduleSlug) : schoolModules;
    if (input.scope === "tabs" && !modulesInScope.length) throw new BadRequestException("That module does not exist.");
    for (const module of modulesInScope) {
      for (const tab of module.tabs) {
        const row = gridRowKey(module, tab.slug);
        const viewWanted = input.ticks.includes(`${row}|View`) || input.ticks.includes(`${tab.slug}|View`);
        for (const action of ACTIONS) {
          const key = schoolPermissionKey(module.slug, tab.slug, action);
          const tick = input.ticks.includes(`${row}|${action}`) || input.ticks.includes(`${tab.slug}|${action}`);
          const wanted = tick && (action === "View" || viewWanted);
          if (wanted !== keys.has(key)) touched.add(key);
          if (wanted) keys.add(key);
          else keys.delete(key);
        }
      }
    }
    return { keys, touched };
  }

  /** Make a person's effective keys equal `keys` by granting and refusing individually against their base. */
  private async writeOverrides(session: SessionPayload, user: { id: string; role: UserRole }, desired: Set<string>, touched: Set<string>) {
    const schoolId = session.schoolId;
    const base = await this.roles.basePermissionSet(user.id, schoolId, user.role);
    const [permissions, existing] = await Promise.all([
      prisma.permission.findMany({ where: { key: { in: Array.from(touched) } } }),
      prisma.userPermissionOverride.findMany({ where: { schoolId, userId: user.id } })
    ]);
    const byKey = new Map(permissions.map((permission) => [permission.key, permission]));
    const held = new Map(existing.map((item) => [item.permissionId, item]));
    const granting = Array.from(touched).filter((key) => desired.has(key) && !base.has(key));
    await this.assertCanUse(session, granting);

    let granted = 0;
    let refused = 0;
    let cleared = 0;
    for (const key of touched) {
      const permission = byKey.get(key);
      if (!permission) continue;
      const want = desired.has(key);
      const have = base.has(key);
      const current = held.get(permission.id);
      if (want === have) {
        if (current) {
          await prisma.userPermissionOverride.delete({ where: { id: current.id } });
          cleared += 1;
        }
        continue;
      }
      const type = want ? PermissionOverrideType.GRANT : PermissionOverrideType.REVOKE;
      if (current?.type === type) {
        if (want) granted += 1;
        else refused += 1;
        continue;
      }
      await prisma.userPermissionOverride.upsert({
        where: { schoolId_userId_permissionId: { schoolId, userId: user.id, permissionId: permission.id } },
        update: { type, setById: session.userId },
        create: { schoolId, userId: user.id, permissionId: permission.id, type, setById: session.userId }
      });
      if (want) granted += 1;
      else refused += 1;
    }
    this.roles.invalidatePermissionCache(user.id, schoolId);
    return { granted, refused, cleared };
  }

  /** Give a new account exactly the access chosen for it: every tick is a key, everything else is closed. */
  async setAccessFromTicks(session: SessionPayload, user: { id: string; role: UserRole }, ticks: string[]) {
    const keys = new Set<string>();
    for (const tick of ticks) {
      const [row, action] = tick.split("|");
      const key = `${row}.${(action ?? "").toLowerCase()}`;
      if (gridKeySet.has(key)) keys.add(key);
    }
    return this.writeOverrides(session, user, keys, new Set(allGridKeys));
  }

  async saveGrid(session: SessionPayload, userId: string, body: unknown) {
    const input = gridSchema.parse(body);
    const user = await prisma.user.findFirst({ where: { id: userId, schoolId: session.schoolId, deletedAt: null } });
    if (!user) throw new NotFoundException("That person is not on this school's staff.");
    await this.assertCanManage(session, user);
    const { effective } = await this.keysFor(user, session.schoolId);
    const { keys, touched } = this.desiredKeys(effective, input);
    const result = await this.writeOverrides(session, user, keys, touched);
    await this.audit(session, AuditAction.UPDATE, "AccessGrant", user.id, {
      summary: `Access map changed · ${result.granted} granted, ${result.refused} taken away`,
      reason: input.reason,
      scope: input.scope,
      module: input.moduleSlug
    });
    return result;
  }

  /** A template or custom role's own grid. Changing a built-in template records the difference against the code. */
  async saveTemplateGrid(session: SessionPayload, name: string, body: unknown) {
    const input = gridSchema.parse(body);
    const schoolId = session.schoolId;
    const custom = await prisma.role.findFirst({ where: { schoolId, deletedAt: null, isSystem: false, OR: [{ id: name }, { name }] }, include: { rolePermissions: { include: { permission: true } } } });
    if (custom) {
      const current = new Set(custom.rolePermissions.map((item) => item.permission.key));
      const { keys } = this.desiredKeys(current, input);
      await this.assertCanUse(session, Array.from(keys).filter((key) => !current.has(key)));
      const permissions = await prisma.permission.findMany({ where: { key: { in: Array.from(keys).filter((key) => gridKeySet.has(key)) } } });
      const keepOutside = custom.rolePermissions.filter((item) => !gridKeySet.has(item.permission.key)).map((item) => ({ permissionId: item.permissionId }));
      await prisma.$transaction([
        prisma.rolePermission.deleteMany({ where: { roleId: custom.id } }),
        prisma.rolePermission.createMany({ data: [...keepOutside, ...permissions.map((permission) => ({ permissionId: permission.id }))].map((item) => ({ roleId: custom.id, ...item })), skipDuplicates: true })
      ]);
      this.roles.invalidatePermissionCache();
      await this.audit(session, AuditAction.UPDATE, "Role", custom.id, { summary: `${custom.name} template saved`, reason: input.reason });
      return { template: custom.name, custom: true };
    }

    const template = schoolRoleTemplates.find((item) => item.name === name);
    if (!template) throw new NotFoundException("That template does not exist.");
    const staticKeys = new Set(schoolPermissionKeysForRoleTemplate(template.name));
    const saved = (await store(schoolId, "template-grids").get<{ grant?: string[]; revoke?: string[] }>(template.name))?.data ?? {};
    const current = new Set(staticKeys);
    for (const key of saved.grant ?? []) current.add(key);
    for (const key of saved.revoke ?? []) current.delete(key);
    const { keys } = this.desiredKeys(current, input);
    await this.assertCanUse(session, Array.from(keys).filter((key) => !current.has(key)));
    const grant = Array.from(keys).filter((key) => gridKeySet.has(key) && !staticKeys.has(key));
    const revoke = Array.from(staticKeys).filter((key) => !keys.has(key));
    await store(schoolId, "template-grids").put(template.name, template.name, { grant, revoke });
    this.roles.invalidatePermissionCache();
    await this.audit(session, AuditAction.UPDATE, "Role", template.name, { summary: `${template.name} template saved · +${grant.length} / −${revoke.length} against the standard`, reason: input.reason });
    return { template: template.name, custom: false, grant: grant.length, revoke: revoke.length };
  }

  async templateGrid(session: SessionPayload, name: string) {
    const schoolId = session.schoolId;
    const custom = await prisma.role.findFirst({ where: { schoolId, deletedAt: null, isSystem: false, OR: [{ id: name }, { name }] }, include: { rolePermissions: { include: { permission: true } } } });
    let keys: Set<string>;
    let scope: string;
    let approve: string;
    let people: Array<{ userId: string; name: string; department: string; above: number; below: number }> = [];
    let purpose: string | null = null;
    if (custom) {
      keys = new Set(custom.rolePermissions.map((item) => item.permission.key));
      const profile = (await store(schoolId, "role-profiles").get<{ scope?: string; approve?: string; purpose?: string }>(custom.id))?.data ?? {};
      scope = profile.scope ?? "Only what they are assigned";
      approve = profile.approve ?? "Nothing";
      purpose = custom.description ?? profile.purpose ?? null;
      const assigned = await prisma.userRoleAssignment.findMany({ where: { schoolId, roleId: custom.id }, include: { user: { include: { staffProfile: { include: { department: true } } } } } });
      people = [];
      for (const item of assigned) {
        const k = await this.keysFor(item.user, schoolId);
        people.push({ userId: item.userId, name: fullName(item.user), department: item.user.staffProfile?.department?.name ?? "No department", above: k.above.length, below: k.below.length });
      }
    } else {
      const template = schoolRoleTemplates.find((item) => item.name === name);
      if (!template) throw new NotFoundException("That template does not exist.");
      keys = new Set(schoolPermissionKeysForRoleTemplate(template.name));
      const saved = (await store(schoolId, "template-grids").get<{ grant?: string[]; revoke?: string[] }>(template.name))?.data ?? {};
      for (const key of saved.grant ?? []) keys.add(key);
      for (const key of saved.revoke ?? []) keys.delete(key);
      scope = template.dataScope;
      approve = template.canApprove;
      const users = await this.staffUsers(schoolId);
      for (const user of users.filter((item) => roleTemplateFor(item.role as never) === template.name)) {
        const k = await this.keysFor(user, schoolId);
        people.push({ userId: user.id, name: fullName(user), department: user.staffProfile?.department?.name ?? "No department", above: k.above.length, below: k.below.length });
      }
    }
    const modules = schoolModules.map((module) => {
      const grant = this.grantsOf(keys, module);
      return {
        code: module.code,
        slug: module.slug,
        name: module.name,
        description: module.description,
        level: grant.level,
        levelLabel: grant.levelLabel,
        all: grant.all,
        any: grant.any,
        ticks: grant.ticks,
        tabs: grant.tabs
      };
    });
    return { name: custom?.name ?? name, custom: Boolean(custom), id: custom?.id ?? null, purpose, scope, approve, people, modules };
  }

  /* ───────────────────────── role, scope, scope ends ───────────────────────── */

  async setProfile(session: SessionPayload, userId: string, body: unknown) {
    const input = profileSchema.parse(body);
    const user = await prisma.user.findFirst({ where: { id: userId, schoolId: session.schoolId, deletedAt: null } });
    if (!user) throw new NotFoundException("That person is not on this school's staff.");
    await this.assertCanManage(session, user);
    const current = await this.profileOf(session.schoolId, user.id, user.role);
    const next = {
      ...(await store(session.schoolId, "access-profiles").get<AccessProfile>(user.id))?.data,
      ...(input.scope ? { scope: input.scope } : {}),
      ...(input.fees ? { fees: input.fees } : {}),
      ...(input.approve ? { approve: input.approve } : {}),
      ...(input.scopeEnds !== undefined ? { scopeEnds: input.scopeEnds } : {}),
      ...(input.historic ? { historic: input.historic } : {})
    };
    await store(session.schoolId, "access-profiles").put(user.id, fullName(user), next);
    await this.audit(session, AuditAction.UPDATE, "AccessProfile", user.id, {
      summary: `Data scope · ${current.scope} → ${next.scope ?? current.scope}`,
      reason: input.reason
    });
    return { userId: user.id };
  }

  async changeRole(session: SessionPayload, userId: string, body: unknown) {
    const input = changeRoleSchema.parse(body);
    const schoolId = session.schoolId;
    const user = await prisma.user.findFirst({ where: { id: userId, schoolId, deletedAt: null } });
    if (!user) throw new NotFoundException("That person is not on this school's staff.");
    await this.assertCanManage(session, user);

    const customRole = await prisma.role.findFirst({ where: { schoolId, deletedAt: null, isSystem: false, name: input.role } });
    const target = ROLE_FOR_TEMPLATE[input.role];
    if (!customRole && !target) throw new BadRequestException("That role does not exist.");
    if (target && !canManageRole(session.role as never, target as never) && !isPlatformRole(session.role as never)) {
      throw new ForbiddenException(`You cannot put somebody on the ${input.role} template: it is equal to or above your own authority.`);
    }
    const before = templateName(user.role);

    if (target) {
      await prisma.user.update({ where: { id: user.id }, data: { role: target } });
    } else if (customRole) {
      const already = await prisma.userRoleAssignment.findFirst({ where: { schoolId, userId: user.id, roleId: customRole.id } });
      if (!already) {
        await prisma.userRoleAssignment.create({ data: { schoolId, userId: user.id, roleId: customRole.id, assignedById: session.userId } });
      }
    }

    if (input.individual === "Remove it with the old role") {
      await prisma.userPermissionOverride.deleteMany({ where: { schoolId, userId: user.id } });
    }
    if (input.scope || input.approve) {
      const existing = (await store(schoolId, "access-profiles").get<AccessProfile>(user.id))?.data ?? {};
      await store(schoolId, "access-profiles").put(user.id, fullName(user), { ...existing, ...(input.scope ? { scope: input.scope } : {}), ...(input.approve ? { approve: input.approve } : {}) });
    }
    if (input.sensitive === "Remove them with the old role") {
      for (const group of await this.sensitiveGroups(schoolId)) {
        if (group.holders.includes(user.id)) {
          await store(schoolId, "sensitive-groups").put(group.slug, group.name, { ...group, holders: group.holders.filter((id) => id !== user.id) });
        }
      }
    }
    this.roles.invalidatePermissionCache(user.id, schoolId);
    await this.audit(session, AuditAction.UPDATE, "StaffRoleAssignment", user.id, {
      summary: `Role changed · ${before} → ${input.role}`,
      reason: input.reason,
      routed: input.routed,
      individual: input.individual
    });
    if (input.tell) {
      await prisma.announcement.create({
        data: { schoolId, createdById: session.userId, channel: "IN_APP", audience: "Teachers and staff", title: `Your role is now ${input.role}`, body: `${fullName(user)}, your access matches the ${input.role} role from your next screen. Reason: ${input.reason}` }
      });
    }
    return { userId: user.id, role: input.role };
  }

  /** Put several people back exactly on their template: every individual grant and refusal goes. */
  async applyTemplate(session: SessionPayload, body: unknown) {
    const input = z.object({ userIds: z.array(z.string()).min(1, "Tick at least one person."), role: z.string().optional(), reason: z.string().optional() }).parse(body);
    let reset = 0;
    for (const userId of input.userIds) {
      const user = await prisma.user.findFirst({ where: { id: userId, schoolId: session.schoolId, deletedAt: null } });
      if (!user) continue;
      await this.assertCanManage(session, user);
      if (input.role && input.role !== templateName(user.role)) {
        await this.changeRole(session, userId, { role: input.role, individual: "Remove it with the old role", reason: input.reason ?? "Applied a role template", tell: false });
      } else {
        const removed = await prisma.userPermissionOverride.deleteMany({ where: { schoolId: session.schoolId, userId } });
        reset += removed.count;
        this.roles.invalidatePermissionCache(userId, session.schoolId);
      }
    }
    await this.audit(session, AuditAction.UPDATE, "AccessGrant", input.userIds[0], { summary: `Template applied to ${input.userIds.length} ${input.userIds.length === 1 ? "person" : "people"}`, reason: input.reason });
    return { people: input.userIds.length, individualRemoved: reset };
  }

  /** Copy one module's actions from one person to others — scope, fees and sensitive groups stay their own. */
  async copyModule(session: SessionPayload, userId: string, body: unknown) {
    const input = z.object({ moduleSlug: z.string().min(1), to: z.array(z.string()).min(1, "Choose who to copy it to."), mode: z.string().optional() }).parse(body);
    const schoolId = session.schoolId;
    const module = schoolModules.find((item) => item.slug === input.moduleSlug);
    if (!module) throw new BadRequestException("That module does not exist.");
    const source = await prisma.user.findFirst({ where: { id: userId, schoolId, deletedAt: null } });
    if (!source) throw new NotFoundException("That person is not on this school's staff.");
    const { effective: from } = await this.keysFor(source, schoolId);
    const moduleKeys = module.tabs.flatMap((tab) => ACTIONS.map((action) => schoolPermissionKey(module.slug, tab.slug, action)));
    for (const targetId of input.to) {
      const target = await prisma.user.findFirst({ where: { id: targetId, schoolId, deletedAt: null } });
      if (!target) continue;
      await this.assertCanManage(session, target);
      const { effective } = await this.keysFor(target, schoolId);
      const desired = new Set(effective);
      for (const key of moduleKeys) {
        if (from.has(key)) desired.add(key);
        else if (input.mode?.startsWith("Replace")) desired.delete(key);
      }
      await this.writeOverrides(session, target, desired, new Set(moduleKeys));
    }
    await this.audit(session, AuditAction.UPDATE, "AccessGrant", userId, { summary: `${module.name} copied to ${input.to.length} ${input.to.length === 1 ? "person" : "people"}` });
    return { copied: input.to.length, module: module.name };
  }

  /* ───────────────────────── custom roles ───────────────────────── */

  async createRole(session: SessionPayload, body: unknown) {
    const input = customRoleSchema.parse(body);
    const schoolId = session.schoolId;
    if (await prisma.role.findFirst({ where: { schoolId, deletedAt: null, name: { equals: input.name, mode: "insensitive" } } })) {
      throw new BadRequestException(`There is already a role called ${input.name}.`);
    }
    const keys = new Set<string>();
    for (const tick of input.ticks) {
      const [row, action] = tick.split("|");
      const key = `${row}.${action.toLowerCase()}`;
      if (gridKeySet.has(key)) keys.add(key);
    }
    if (!keys.size) throw new BadRequestException("A role that grants nothing is not a role. Tick at least one action.");
    await this.assertCanUse(session, Array.from(keys));
    const permissions = await prisma.permission.findMany({ where: { key: { in: Array.from(keys) } } });
    const role = await prisma.role.create({
      data: {
        schoolId,
        name: input.name,
        slug: `${slugify(input.name)}-${Date.now().toString(36)}`,
        description: input.purpose,
        createdById: session.userId,
        rolePermissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) }
      }
    });
    await store(schoolId, "role-profiles").put(role.id, role.name, { scope: input.scope, fees: input.fees, approve: input.approve, teaching: input.teaching, purpose: input.purpose, startedFrom: input.startFrom });
    let mapped = 0;
    for (const userId of input.people) {
      const user = await prisma.user.findFirst({ where: { id: userId, schoolId, deletedAt: null } });
      if (!user) continue;
      await this.assertCanManage(session, user);
      await prisma.userRoleAssignment.create({ data: { schoolId, userId, roleId: role.id, assignedById: session.userId } });
      if (input.mode.startsWith("Replace")) await prisma.userPermissionOverride.deleteMany({ where: { schoolId, userId } });
      this.roles.invalidatePermissionCache(userId, schoolId);
      mapped += 1;
    }
    if (mapped && input.tell) {
      await prisma.announcement.create({
        data: { schoolId, createdById: session.userId, channel: "IN_APP", audience: "Teachers and staff", title: `You are now on the ${role.name} role`, body: `${mapped} ${mapped === 1 ? "person has" : "people have"} been put on the ${role.name} role. Your access follows from your next screen.` }
      });
    }
    await this.audit(session, AuditAction.CREATE, "Role", role.id, { summary: `Role created · ${role.name}`, actions: keys.size, mapped });
    return { id: role.id, name: role.name, actions: keys.size, mapped };
  }

  async deleteRole(session: SessionPayload, roleId: string) {
    const role = await prisma.role.findFirst({ where: { id: roleId, schoolId: session.schoolId, deletedAt: null, isSystem: false }, include: { _count: { select: { userRoles: true } } } });
    if (!role) throw new NotFoundException("That custom role does not exist.");
    if (role._count.userRoles) throw new BadRequestException(`${role._count.userRoles} ${role._count.userRoles === 1 ? "person is" : "people are"} on ${role.name}. Move them first.`);
    await prisma.role.update({ where: { id: roleId }, data: { deletedAt: new Date() } });
    await this.audit(session, AuditAction.DELETE, "Role", roleId, { summary: `Role deleted · ${role.name}` });
    return { id: roleId };
  }

  /* ───────────────────────── sensitive groups ───────────────────────── */

  async saveSensitiveGroup(session: SessionPayload, slug: string | null, body: unknown) {
    const input = sensitiveSchema.parse(body);
    const schoolId = session.schoolId;
    const code = slug ?? slugify(input.name);
    const existing = slug ? (await store(schoolId, "sensitive-groups").get<SensitiveGroup>(slug))?.data : null;
    if (!slug && (await store(schoolId, "sensitive-groups").get(code))) throw new BadRequestException(`There is already a group called ${input.name}.`);
    if (input.holders.length > 8) throw new BadRequestException("A group with more than eight holders is not a sensitive group.");
    const users = await prisma.user.findMany({ where: { id: { in: input.holders }, schoolId, deletedAt: null } });
    if (users.length !== new Set(input.holders).size) throw new BadRequestException("One of the holders is not on this school's staff.");
    await store(schoolId, "sensitive-groups").put(code, input.name, { ...input, createdAt: existing?.createdAt ?? new Date().toISOString() });
    await this.audit(session, AuditAction.UPDATE, "SensitiveGroup", code, { summary: `${slug ? "Saved" : "Created"} sensitive group · ${input.name}`, holders: input.holders.length });
    if (input.tellHolders && input.holders.length) {
      await prisma.announcement.create({
        data: { schoolId, createdById: session.userId, channel: "IN_APP", audience: "Teachers and staff", title: `You hold a sensitive group: ${input.name}`, body: `Every time you open these records, your name, the record and the time are written to the audit log.` }
      });
    }
    return { slug: code };
  }

  async deleteSensitiveGroup(session: SessionPayload, slug: string) {
    await store(session.schoolId, "sensitive-groups").remove(slug);
    await this.audit(session, AuditAction.DELETE, "SensitiveGroup", slug, { summary: `Sensitive group deleted · ${slug}` });
    return { slug };
  }

  /* ───────────────────────── delegations ───────────────────────── */

  async addDelegation(session: SessionPayload, body: unknown) {
    const input = delegationSchema.parse(body);
    const user = await prisma.user.findFirst({ where: { id: input.userId, schoolId: session.schoolId, deletedAt: null } });
    if (!user) throw new BadRequestException("That person is not on this school's staff.");
    const actor = await prisma.user.findUnique({ where: { id: session.userId } });
    const id = `d${Date.now().toString(36)}`;
    const data: Delegation = {
      userId: user.id,
      holds: input.holds,
      grantedBy: fullName(actor),
      grantedById: session.userId,
      grantedOn: new Date().toISOString(),
      expiresOn: input.expiresOn ? new Date(input.expiresOn).toISOString() : null,
      reason: input.reason
    };
    await store(session.schoolId, "delegations").put(id, `${fullName(user)} · ${input.holds}`.slice(0, 190), data);
    await this.audit(session, AuditAction.CREATE, "AccessGrant", user.id, { summary: `Delegation · ${input.holds}`, reason: input.reason });
    return { id };
  }

  async endDelegation(session: SessionPayload, id: string) {
    await store(session.schoolId, "delegations").remove(id);
    await this.audit(session, AuditAction.DELETE, "AccessGrant", id, { summary: "Delegation ended" });
    return { id };
  }

  /* ───────────────────────── recertification ───────────────────────── */

  async recertify(session: SessionPayload, body: unknown) {
    const input = z.object({ userIds: z.array(z.string()).optional(), note: z.string().optional() }).parse(body ?? {});
    const staff = await this.staffUsers(session.schoolId);
    const people = (input.userIds?.length ? staff.filter((user) => input.userIds!.includes(user.id)) : staff).map((user) => user.id);
    const actor = await prisma.user.findUnique({ where: { id: session.userId } });
    const id = `r${Date.now().toString(36)}`;
    await store(session.schoolId, "recertifications").put(id, `Recertified ${new Date().toISOString().slice(0, 10)}`, { by: fullName(actor), at: new Date().toISOString(), people, note: input.note });
    await this.audit(session, AuditAction.APPROVE, "AccessGrant", people[0] ?? id, { summary: `Access confirmed for ${people.length} ${people.length === 1 ? "person" : "people"}`, note: input.note });
    return { people: people.length };
  }

  /* ───────────────────────── the simulator ───────────────────────── */

  async simulate(session: SessionPayload, userId: string) {
    const person = await this.person(session, userId);
    const visible = person.modules.filter((module) => module.level > 0);
    return {
      name: person.name,
      role: person.role,
      modulesVisible: visible.length,
      modulesAbsent: person.modules.length - visible.length,
      navigation: visible.map((module) => ({ name: module.name, tabs: module.tabs.filter((tab) => tab.a.View).map((tab) => tab.label) })),
      absent: person.modules.filter((module) => module.level === 0).map((module) => module.name),
      scope: person.scope,
      approve: person.approve,
      fees: person.fees,
      sensitive: person.sensitive
    };
  }
}
