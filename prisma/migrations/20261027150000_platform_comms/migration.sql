-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "lastRunAt" TIMESTAMP(3),
ADD COLUMN     "recurrence" TEXT;

-- AlterTable
ALTER TABLE "ConsentRecord" ADD COLUMN     "schoolId" TEXT,
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "MessageTemplate" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "retiredAt" TIMESTAMP(3),
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "supersedesId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;


-- Existing answers belong to the school their person was in.
UPDATE "ConsentRecord" c SET "schoolId" = u."schoolId" FROM "User" u WHERE c."userId" = u.id AND c."schoolId" IS NULL;
