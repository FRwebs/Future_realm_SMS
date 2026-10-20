-- AlterTable
ALTER TABLE "CustomReport" ADD COLUMN     "compare" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "frequency" TEXT,
ADD COLUMN     "groupName" TEXT,
ADD COLUMN     "lastSentAt" TIMESTAMP(3),
ADD COLUMN     "lockFilters" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "periodDays" INTEGER,
ADD COLUMN     "question" TEXT,
ADD COLUMN     "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "suppressUnder" INTEGER,
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'ALL';

-- CreateTable
CREATE TABLE "SchoolSnapshot" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleSnapshot" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "using" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,

    CONSTRAINT "ModuleSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunnelStageOwner" (
    "stage" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FunnelStageOwner_pkey" PRIMARY KEY ("stage")
);

-- CreateIndex
CREATE INDEX "SchoolSnapshot_day_idx" ON "SchoolSnapshot"("day");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolSnapshot_day_schoolId_key" ON "SchoolSnapshot"("day", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleSnapshot_day_module_key" ON "ModuleSnapshot"("day", "module");

