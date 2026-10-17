-- AlterTable
ALTER TABLE "TimetableVersion" ADD COLUMN     "scheduleOptions" JSONB,
ADD COLUMN     "scheduledById" TEXT,
ADD COLUMN     "scheduledFor" TIMESTAMP(3);

