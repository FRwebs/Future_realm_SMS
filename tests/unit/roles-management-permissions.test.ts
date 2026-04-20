import { describe, expect, it, vi } from "vitest";

import type { SessionPayload } from "@/lib/auth/session-core";
import { systemRolePermissionKeys } from "@/lib/permissions/catalog";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

describe("roles management permission resolution", () => {
  it("falls back to the signed session role when the database user lookup misses", async () => {
    const { RolesManagementService } = await import("../../backend/src/modules/roles-management/roles-management.service");
    const service = new RolesManagementService();
    const session: SessionPayload = {
      userId: "user_principal",
      schoolId: "school_greenfield",
      role: "PRINCIPAL",
      email: "principal@greenfieldcollege.ng",
      name: "Tunde Adeyemi",
      csrfToken: "csrf",
      iat: 1,
      exp: 9_999_999_999,
    };

    const permissions = await service.resolveUserPermissions(session.userId, session.schoolId, session);

    expect(permissions.length).toBeGreaterThan(0);
    expect(permissions).toEqual(expect.arrayContaining(systemRolePermissionKeys.PRINCIPAL ?? []));
    expect(permissions).toContain("students.view");
    expect(permissions).toContain("classes.view");
    expect(permissions).toContain("timetable.view");
  });
});
