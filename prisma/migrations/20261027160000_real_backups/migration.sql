-- AlterTable
ALTER TABLE "BackupRecord" ADD COLUMN     "note" TEXT,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "restoreResult" TEXT,
ADD COLUMN     "restoreTestedAt" TIMESTAMP(3),
ADD COLUMN     "sha256" TEXT,
ADD COLUMN     "startedById" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

