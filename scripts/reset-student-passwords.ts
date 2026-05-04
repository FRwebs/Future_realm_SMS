import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = hashPassword("FutureRealm123!");
  const students = await prisma.student.findMany({
    where: { userId: { not: null } },
    select: { userId: true },
  });

  const userIds = [...new Set(students.map((item) => item.userId).filter((value): value is string => Boolean(value)))];

  const result = await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { passwordHash },
  });

  console.log(JSON.stringify({ updatedStudentUsers: result.count }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
