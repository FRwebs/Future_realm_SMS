-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "calls" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "lastUsedAt" TIMESTAMP(3),
ADD COLUMN     "prefix" TEXT;

