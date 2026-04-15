import { Injectable } from "@nestjs/common";

import { prisma } from "../../../../src/lib/db/prisma";
import { hashPassword, verifyPassword } from "../../../../src/lib/auth/password";
import { demoCredentials } from "../../../../src/lib/demo/data";
import { SessionUser } from "../../../../src/lib/domain/types";
import { env } from "../../../../src/lib/utils/env";

const demoPasswordHashes = new Map(
  demoCredentials.map((credential) => [credential.email, hashPassword(credential.password)])
);

@Injectable()
export class AuthService {
  async authenticateUser(email: string, password: string): Promise<Omit<SessionUser, "csrfToken"> | null> {
    if (env.DEMO_MODE) {
      const credential = demoCredentials.find((user) => user.email.toLowerCase() === email.toLowerCase());
      if (!credential) return null;
      const expectedPasswordHash = demoPasswordHashes.get(credential.email);
      if (!expectedPasswordHash || !verifyPassword(password, expectedPasswordHash)) return null;

      return {
        userId: `user_${credential.role.toLowerCase()}`,
        schoolId: "school_greenfield",
        role: credential.role,
        email: credential.email,
        name: credential.name
      };
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
      return null;
    }

    return {
      userId: user.id,
      schoolId: user.schoolId,
      role: user.role,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`
    };
  }
}
