import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, PermissionOverrideType, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { canAssignRole, canManageRole, isOwnerRole, isPlatformRole, isSchoolStaffRole } from "../../../../src/lib/auth/role-architecture";
import { prisma } from "../../../../src/lib/db/prisma";
import { allPermissionKeys, groupPermissions, permissionModules, systemRolePermissionKeys } from "../../../../src/lib/permissions/catalog";

const roleSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().max(500).optional(),
  permissions: z.array(z.string()).default([])
});

const assignSchema = z.object({
  userId: z.string().min(1),
  roleIds: z.array(z.string().min(1)).min(1)
});

const revokeSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1)
});

const overrideSchema = z.object({
  permissionId: z.string().min(1),
  type: z.enum(["grant", "revoke"])
});

const schoolOwnerRoles = new Set<UserRole>(["SCHOOL_OWNER", "PROPRIETOR"]);
const roleManagerFallback = new Set<UserRole>(["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL", "HEAD_TEACHER"]);

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function userName(user: { firstName: string; lastName: string }) {
  return `${user.firstName} ${user.lastName}`.trim();
}

@Injectable()
export class RolesManagementService {
  private static permissionCache = new Map<string, string[]>();

  invalidatePermissionCache(userId?: string, schoolId?: string) {
    if (!userId || !schoolId) {
      RolesManagementService.permissionCache.clear();
      return;
    }
    for (const key of RolesManagementService.permissionCache.keys()) {
      if (key.startsWith(`${schoolId}:${userId}:`)) RolesManagementService.permissionCache.delete(key);
    }
  }

  private response<T>(data: T, message = "Request completed") {
    return { ok: true, success: true, message, data };
  }

  private async sessionUser(session?: SessionPayload) {
    if (!session) return null;
    return prisma.user.findFirst({
      where: { OR: [{ id: session.userId }, { email: session.email }] },
      select: { id: true, role: true, email: true, schoolId: true, firstName: true, lastName: true }
    });
  }

  private async audit(session: SessionPayload, schoolId: string, action: AuditAction, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    const actor = await this.sessionUser(session);
    await prisma.auditLog.create({
      data: {
        schoolId,
        actorId: actor?.id ?? null,
        action,
        entityType,
        entityId,
        metadata
      }
    });
  }

  private assertSchoolScope(session: SessionPayload, schoolId: string) {
    if (!isPlatformRole(session.role) && session.schoolId !== schoolId) {
      throw new ForbiddenException("You cannot manage roles outside your school.");
    }
  }

  private async assertCanManageUser(session: SessionPayload, schoolId: string, targetUser: { id: string; role: UserRole }, action: string) {
    const actor = await this.sessionUser(session);
    if (!actor) throw new ForbiddenException("You must be signed in to manage roles.");
    if (isPlatformRole(actor.role)) return;
    if (actor.schoolId !== schoolId) throw new ForbiddenException("You cannot manage roles outside your school.");
    const targetRoles = await prisma.userRoleAssignment.findMany({
      where: { schoolId, userId: targetUser.id, role: { deletedAt: null, systemRole: { not: null } } },
      include: { role: true }
    });
    const managedRoles = [targetUser.role, ...targetRoles.map((assignment) => assignment.role.systemRole).filter((role): role is UserRole => Boolean(role))];
    if (managedRoles.some((role) => !canManageRole(actor.role, role))) {
      throw new ForbiddenException(`You cannot ${action} a user with equal or higher school authority.`);
    }
  }

  private assertCanAssignSystemRole(actorRole: UserRole, role: { systemRole: UserRole | null; name: string }) {
    if (!role.systemRole) return;
    if (isPlatformRole(actorRole)) return;
    if (!isSchoolStaffRole(role.systemRole)) {
      throw new ForbiddenException(`You cannot assign the ${role.name} role from the school portal.`);
    }
    if (!canAssignRole(actorRole, role.systemRole)) {
      throw new ForbiddenException(`You cannot assign the ${role.name} role because it is equal to or above your authority.`);
    }
  }

  private async actorPermissionSet(session: SessionPayload, schoolId: string) {
    return new Set(await this.resolveUserPermissions(session.userId, schoolId, session));
  }

  private async assertCanUsePermissions(session: SessionPayload, schoolId: string, permissionKeys: string[]) {
    const actor = await this.sessionUser(session);
    if (actor && (isPlatformRole(actor.role) || isOwnerRole(actor.role))) return;
    const ownPermissions = await this.actorPermissionSet(session, schoolId);
    const missing = permissionKeys.filter((permission) => !ownPermissions.has(permission));
    if (missing.length) {
      throw new ForbiddenException(`You cannot assign permissions you do not have: ${missing.join(", ")}`);
    }
  }

  async resolveUserPermissions(userId: string, schoolId: string, session?: SessionPayload): Promise<string[]> {
    const sessionUser = await this.sessionUser(session);
    const realUserId = sessionUser?.id ?? userId;
    const cacheKey = `${schoolId}:${realUserId}:${session?.role ?? ""}`;
    const cached = RolesManagementService.permissionCache.get(cacheKey);
    if (cached) return cached;

    const user =
      sessionUser ??
      (await prisma.user.findFirst({ where: { id: userId, schoolId, deletedAt: null }, select: { id: true, role: true, email: true, schoolId: true, firstName: true, lastName: true } }));
    const role = user?.role ?? session?.role;
    if (!role) return [];
    if (isPlatformRole(role) && (role === "SUPER_ADMIN" || role === "PLATFORM_OWNER" || role === "PLATFORM_ADMIN")) return allPermissionKeys;

    const resolved = new Set<string>(systemRolePermissionKeys[role] ?? []);
    if (roleManagerFallback.has(role)) {
      resolved.add("roles.view");
      resolved.add("roles.create");
      resolved.add("roles.edit");
      resolved.add("roles.assign");
      if (schoolOwnerRoles.has(role)) resolved.add("roles.delete");
    }

    if (user) {
      const assignments = await prisma.userRoleAssignment.findMany({
        where: { schoolId, userId: user.id, role: { deletedAt: null } },
        include: { role: { include: { rolePermissions: { include: { permission: true } } } } }
      });
      for (const assignment of assignments) {
        for (const rolePermission of assignment.role.rolePermissions) resolved.add(rolePermission.permission.key);
      }

      const overrides = await prisma.userPermissionOverride.findMany({
        where: { schoolId, userId: user.id },
        include: { permission: true }
      });
      for (const override of overrides) {
        if (override.type === "GRANT") resolved.add(override.permission.key);
        if (override.type === "REVOKE") resolved.delete(override.permission.key);
      }
    }

    const permissions = Array.from(resolved).sort();
    RolesManagementService.permissionCache.set(cacheKey, permissions);
    return permissions;
  }

  async listRoles(session: SessionPayload, schoolId: string) {
    this.assertSchoolScope(session, schoolId);
    const roles = await prisma.role.findMany({
      where: { schoolId, deletedAt: null },
      include: { rolePermissions: true, _count: { select: { userRoles: true } } },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }]
    });
    return this.response(roles.map((role) => ({
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: role.isSystem,
      systemRole: role.systemRole,
      permissionsCount: role.rolePermissions.length,
      staffCount: role._count.userRoles,
      createdAt: role.createdAt.toISOString()
    })));
  }

  async createRole(session: SessionPayload, schoolId: string, payload: unknown) {
    this.assertSchoolScope(session, schoolId);
    const parsed = roleSchema.parse(payload);
    const invalid = parsed.permissions.filter((permission) => !allPermissionKeys.includes(permission));
    if (invalid.length) throw new BadRequestException(`Invalid permissions: ${invalid.join(", ")}`);
    await this.assertCanUsePermissions(session, schoolId, parsed.permissions);
    const actor = await this.sessionUser(session);
    const permissions = await prisma.permission.findMany({ where: { key: { in: parsed.permissions } } });
    const role = await prisma.role.create({
      data: {
        schoolId,
        name: parsed.name,
        slug: `${slugify(parsed.name)}-${Date.now().toString(36)}`,
        description: parsed.description,
        createdById: actor?.id,
        rolePermissions: {
          create: permissions.map((permission) => ({ permissionId: permission.id }))
        }
      }
    });
    await this.audit(session, schoolId, "CREATE", "Role", role.id, { name: role.name, permissions: parsed.permissions });
    return this.response({ id: role.id }, "Role created");
  }

  async getRole(session: SessionPayload, schoolId: string, roleId: string) {
    this.assertSchoolScope(session, schoolId);
    const role = await prisma.role.findFirst({
      where: { id: roleId, schoolId, deletedAt: null },
      include: { rolePermissions: { include: { permission: true } }, _count: { select: { userRoles: true } } }
    });
    if (!role) throw new NotFoundException("Role not found.");
    return this.response({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      systemRole: role.systemRole,
      staffCount: role._count.userRoles,
      permissions: role.rolePermissions.map((item) => item.permission.key)
    });
  }

  async updateRole(session: SessionPayload, schoolId: string, roleId: string, payload: unknown) {
    this.assertSchoolScope(session, schoolId);
    const parsed = roleSchema.partial({ name: true }).parse(payload);
    const role = await prisma.role.findFirst({ where: { id: roleId, schoolId, deletedAt: null }, include: { rolePermissions: true } });
    if (!role) throw new NotFoundException("Role not found.");
    if (role.isSystem) throw new BadRequestException("System roles cannot be edited.");
    const permissionKeys = parsed.permissions ?? [];
    const invalid = permissionKeys.filter((permission) => !allPermissionKeys.includes(permission));
    if (invalid.length) throw new BadRequestException(`Invalid permissions: ${invalid.join(", ")}`);
    await this.assertCanUsePermissions(session, schoolId, permissionKeys);
    const permissions = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId } }),
      prisma.role.update({
        where: { id: roleId },
        data: {
          ...(parsed.name ? { name: parsed.name } : {}),
          ...(parsed.description !== undefined ? { description: parsed.description } : {}),
          rolePermissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) }
        }
      })
    ]);
    this.invalidatePermissionCache(undefined, schoolId);
    await this.audit(session, schoolId, "UPDATE", "Role", roleId, { permissions: permissionKeys });
    return this.response({ id: roleId }, "Role updated");
  }

  async deleteRole(session: SessionPayload, schoolId: string, roleId: string) {
    this.assertSchoolScope(session, schoolId);
    const role = await prisma.role.findFirst({ where: { id: roleId, schoolId }, include: { _count: { select: { userRoles: true } } } });
    if (!role) throw new NotFoundException("Role not found.");
    if (role.isSystem) throw new BadRequestException("System roles cannot be deleted.");
    if (role._count.userRoles > 0) {
      throw new BadRequestException(`This role is assigned to ${role._count.userRoles} staff member(s). Reassign or revoke staff before deletion.`);
    }
    await prisma.role.update({ where: { id: roleId }, data: { deletedAt: new Date() } });
    await this.audit(session, schoolId, "DELETE", "Role", roleId, { name: role.name, softDelete: true });
    return this.response({ id: roleId }, "Role deleted");
  }

  async listRoleStaff(session: SessionPayload, schoolId: string, roleId: string) {
    this.assertSchoolScope(session, schoolId);
    const assignments = await prisma.userRoleAssignment.findMany({
      where: { schoolId, roleId },
      include: { user: { include: { staffProfile: { include: { department: true } } } } },
      orderBy: { createdAt: "desc" }
    });
    return this.response(assignments.map((assignment) => ({
      id: assignment.user.id,
      name: userName(assignment.user),
      email: assignment.user.email,
      department: assignment.user.staffProfile?.department?.name ?? "-"
    })));
  }

  async listPermissions(session: SessionPayload, schoolId: string) {
    this.assertSchoolScope(session, schoolId);
    const permissionRows = await prisma.permission.findMany({ orderBy: [{ module: "asc" }, { key: "asc" }] });
    const permissionsByKey = new Map(permissionRows.map((permission) => [permission.key, permission.id]));
    return this.response(permissionModules.map((group) => ({
      module: group.module,
      permissions: group.permissions.map((permissionItem) => ({
        ...permissionItem,
        module: group.module,
        id: permissionsByKey.get(permissionItem.key) ?? permissionItem.key
      }))
    })));
  }

  async myPermissions(session: SessionPayload, schoolId: string) {
    this.assertSchoolScope(session, schoolId);
    const permissions = await this.resolveUserPermissions(session.userId, schoolId, session);
    return this.response({ permissions, grouped: groupPermissions(permissions) });
  }

  async listStaffRoles(session: SessionPayload, schoolId: string) {
    this.assertSchoolScope(session, schoolId);
    const schoolStaffRoles = Object.values(UserRole).filter((role) => isSchoolStaffRole(role));
    const users = await prisma.user.findMany({
      where: {
        schoolId,
        deletedAt: null,
        role: { in: schoolStaffRoles }
      },
      include: {
        staffProfile: { include: { department: true } },
        roleAssignments: { where: { schoolId, role: { deletedAt: null } }, include: { role: true } }
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }]
    });
    return this.response(users.map((user) => ({
      id: user.id,
      name: userName(user),
      email: user.email,
      department: user.staffProfile?.department?.name ?? "-",
      roles: user.roleAssignments.map((assignment) => ({ id: assignment.role.id, name: assignment.role.name, isSystem: assignment.role.isSystem, systemRole: assignment.role.systemRole }))
    })));
  }

  async assignRoles(session: SessionPayload, schoolId: string, payload: unknown) {
    this.assertSchoolScope(session, schoolId);
    const parsed = assignSchema.parse(payload);
    const [targetUser, roles] = await Promise.all([
      prisma.user.findFirst({ where: { id: parsed.userId, schoolId, deletedAt: null } }),
      prisma.role.findMany({ where: { schoolId, id: { in: parsed.roleIds }, deletedAt: null }, include: { rolePermissions: { include: { permission: true } } } })
    ]);
    if (!targetUser) throw new NotFoundException("Staff member not found.");
    if (roles.length !== parsed.roleIds.length) throw new BadRequestException("One or more roles were not found.");
    await this.assertCanManageUser(session, schoolId, targetUser, "assign roles to");
    const actor = await this.sessionUser(session);
    for (const role of roles) {
      this.assertCanAssignSystemRole(actor?.role ?? session.role, role);
    }
    await this.assertCanUsePermissions(session, schoolId, roles.flatMap((role) => role.rolePermissions.map((item) => item.permission.key)));
    await prisma.userRoleAssignment.createMany({
      data: roles.map((role) => ({ schoolId, userId: targetUser.id, roleId: role.id, assignedById: actor?.id })),
      skipDuplicates: true
    });
    this.invalidatePermissionCache(targetUser.id, schoolId);
    await this.audit(session, schoolId, "UPDATE", "UserRoleAssignment", targetUser.id, { assignedRoles: roles.map((role) => role.name) });
    return this.response({ userId: targetUser.id }, "Role assigned");
  }

  async revokeRole(session: SessionPayload, schoolId: string, payload: unknown) {
    this.assertSchoolScope(session, schoolId);
    const parsed = revokeSchema.parse(payload);
    const role = await prisma.role.findFirst({ where: { id: parsed.roleId, schoolId } });
    const user = await prisma.user.findFirst({ where: { id: parsed.userId, schoolId } });
    if (!role || !user) throw new NotFoundException("Role or staff member not found.");
    await this.assertCanManageUser(session, schoolId, user, "revoke roles from");
    if (role.systemRole && schoolOwnerRoles.has(role.systemRole)) {
      throw new BadRequestException("School Owner roles cannot be revoked.");
    }
    await prisma.userRoleAssignment.deleteMany({ where: { schoolId, userId: parsed.userId, roleId: parsed.roleId } });
    this.invalidatePermissionCache(parsed.userId, schoolId);
    await this.audit(session, schoolId, "UPDATE", "UserRoleAssignment", parsed.userId, { revokedRole: role.name });
    return this.response({ userId: parsed.userId, roleId: parsed.roleId }, "Role revoked");
  }

  async getStaffRoleDetail(session: SessionPayload, schoolId: string, userId: string) {
    this.assertSchoolScope(session, schoolId);
    const user = await prisma.user.findFirst({
      where: { id: userId, schoolId, deletedAt: null },
      include: {
        staffProfile: { include: { department: true } },
        roleAssignments: { include: { role: true } },
        permissionOverrides: { include: { permission: true, setBy: true } }
      }
    });
    if (!user) throw new NotFoundException("Staff member not found.");
    const permissions = await this.resolveUserPermissions(user.id, schoolId);
    return this.response({
      id: user.id,
      name: userName(user),
      email: user.email,
      department: user.staffProfile?.department?.name ?? "-",
      roles: user.roleAssignments.map((assignment) => ({ id: assignment.role.id, name: assignment.role.name, isSystem: assignment.role.isSystem, systemRole: assignment.role.systemRole })),
      permissions,
      groupedPermissions: groupPermissions(permissions),
      overrides: user.permissionOverrides.map((override) => this.mapOverride(override))
    });
  }

  async listOverrides(session: SessionPayload, schoolId: string, userId: string) {
    this.assertSchoolScope(session, schoolId);
    const overrides = await prisma.userPermissionOverride.findMany({
      where: { schoolId, userId },
      include: { permission: true, setBy: true },
      orderBy: { createdAt: "desc" }
    });
    return this.response(overrides.map((override) => this.mapOverride(override)));
  }

  async createOverride(session: SessionPayload, schoolId: string, userId: string, payload: unknown) {
    this.assertSchoolScope(session, schoolId);
    const parsed = overrideSchema.parse(payload);
    const permission = await prisma.permission.findUnique({ where: { id: parsed.permissionId } });
    if (!permission) throw new NotFoundException("Permission not found.");
    const targetUser = await prisma.user.findFirst({ where: { id: userId, schoolId, deletedAt: null } });
    if (!targetUser) throw new NotFoundException("Staff member not found.");
    await this.assertCanManageUser(session, schoolId, targetUser, "override permissions for");
    await this.assertCanUsePermissions(session, schoolId, [permission.key]);
    const actor = await this.sessionUser(session);
    const override = await prisma.userPermissionOverride.upsert({
      where: { schoolId_userId_permissionId: { schoolId, userId, permissionId: permission.id } },
      update: { type: parsed.type.toUpperCase() as PermissionOverrideType, setById: actor?.id },
      create: { schoolId, userId, permissionId: permission.id, type: parsed.type.toUpperCase() as PermissionOverrideType, setById: actor?.id },
      include: { permission: true, setBy: true }
    });
    this.invalidatePermissionCache(userId, schoolId);
    await this.audit(session, schoolId, "UPDATE", "UserPermissionOverride", userId, { permission: permission.key, type: parsed.type });
    return this.response(this.mapOverride(override), "Permission override saved");
  }

  async deleteOverride(session: SessionPayload, schoolId: string, userId: string, overrideId: string) {
    this.assertSchoolScope(session, schoolId);
    const targetUser = await prisma.user.findFirst({ where: { id: userId, schoolId, deletedAt: null } });
    if (!targetUser) throw new NotFoundException("Staff member not found.");
    await this.assertCanManageUser(session, schoolId, targetUser, "remove permission overrides for");
    await prisma.userPermissionOverride.deleteMany({ where: { id: overrideId, schoolId, userId } });
    this.invalidatePermissionCache(userId, schoolId);
    await this.audit(session, schoolId, "UPDATE", "UserPermissionOverride", userId, { removedOverrideId: overrideId });
    return this.response({ overrideId }, "Permission override removed");
  }

  private mapOverride(override: { id: string; type: PermissionOverrideType; createdAt: Date; permission: { id: string; key: string; module: string; label: string }; setBy?: { firstName: string; lastName: string } | null }) {
    return {
      id: override.id,
      type: override.type,
      createdAt: override.createdAt.toISOString(),
      permission: override.permission,
      setBy: override.setBy ? userName(override.setBy) : "System"
    };
  }
}
