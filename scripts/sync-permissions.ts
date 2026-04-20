import { PrismaClient, UserRole } from "@prisma/client";

import { permissionCatalog, systemRolePermissionKeys } from "../src/lib/permissions/catalog";

const prisma = new PrismaClient();

async function main() {
  await prisma.permission.createMany({
    data: permissionCatalog.map((permissionItem) => ({
      key: permissionItem.key,
      module: permissionItem.module,
      label: permissionItem.label,
      description: permissionItem.description,
    })),
    skipDuplicates: true,
  });

  const permissions = await prisma.permission.findMany();
  const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));
  const schools = await prisma.school.findMany({ select: { id: true } });

  for (const school of schools) {
    for (const [roleName, permissionKeys] of Object.entries(systemRolePermissionKeys)) {
      const role = await prisma.role.findFirst({
        where: {
          schoolId: school.id,
          systemRole: roleName as UserRole,
          deletedAt: null,
        },
      });
      if (!role) continue;

      await prisma.rolePermission.createMany({
        data: permissionKeys
          .map((key) => permissionByKey.get(key))
          .filter((permissionId): permissionId is string => Boolean(permissionId))
          .map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }
  }

  console.log(`Synced ${permissionCatalog.length} permissions across ${schools.length} school(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
