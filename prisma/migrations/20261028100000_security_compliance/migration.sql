-- AlterEnum
ALTER TYPE "DataPrivacyRequestType" ADD VALUE 'GRIEVANCE';

-- AlterTable
ALTER TABLE "LoginAttempt" ADD COLUMN     "location" TEXT,
ADD COLUMN     "newDevice" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SecurityIncident" ADD COLUMN     "affectedSchoolIds" TEXT[],
ADD COLUMN     "assessment" TEXT,
ADD COLUMN     "containedAt" TIMESTAMP(3),
ADD COLUMN     "containment" TEXT,
ADD COLUMN     "regulatorNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "regulatorReference" TEXT,
ADD COLUMN     "schoolsNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "schoolsNotifiedCount" INTEGER;

-- CreateTable
CREATE TABLE "ComplianceObligation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cadence" TEXT NOT NULL,
    "ownerRole" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "dueAt" TIMESTAMP(3),
    "lastDoneAt" TIMESTAMP(3),
    "reference" TEXT,
    "notes" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DpaVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DpaVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionRule" (
    "id" TEXT NOT NULL,
    "dataClass" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "basis" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetentionRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceObligation_code_key" ON "ComplianceObligation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DpaVersion_version_key" ON "DpaVersion"("version");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionRule_dataClass_key" ON "RetentionRule"("dataClass");

