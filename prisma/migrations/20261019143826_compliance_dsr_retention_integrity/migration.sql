-- CreateEnum
CREATE TYPE "ComplianceReturnStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'FILED', 'AMENDED');

-- CreateEnum
CREATE TYPE "DataSubjectRequestKind" AS ENUM ('ACCESS', 'CORRECTION', 'ERASURE', 'PORTABILITY', 'OBJECTION');

-- CreateEnum
CREATE TYPE "DataSubjectRequestStatus" AS ENUM ('OPEN', 'RESPONDED', 'CLOSED', 'REFUSED');

-- CreateEnum
CREATE TYPE "IntegritySeverity" AS ENUM ('NORMAL', 'ATTENTION', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IntegrityFlagStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "ComplianceReturn" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "dueOn" TIMESTAMP(3) NOT NULL,
    "format" TEXT NOT NULL,
    "covers" TEXT NOT NULL,
    "status" "ComplianceReturnStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "filedOn" TIMESTAMP(3),
    "ownerRole" TEXT,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSubjectRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "kind" "DataSubjectRequestKind" NOT NULL,
    "requesterName" TEXT NOT NULL,
    "subjectName" TEXT,
    "status" "DataSubjectRequestStatus" NOT NULL DEFAULT 'OPEN',
    "receivedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDays" INTEGER NOT NULL DEFAULT 30,
    "closedOn" TIMESTAMP(3),
    "outcome" TEXT,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSubjectRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionPolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "dataClass" TEXT NOT NULL,
    "years" INTEGER,
    "untilAge" INTEGER,
    "basis" TEXT NOT NULL,
    "hostedIn" TEXT NOT NULL DEFAULT 'Nigeria',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrityFlag" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "monitor" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "severity" "IntegritySeverity" NOT NULL DEFAULT 'ATTENTION',
    "status" "IntegrityFlagStatus" NOT NULL DEFAULT 'OPEN',
    "entityType" TEXT,
    "entityId" TEXT,
    "resolution" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrityFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceReturn_schoolId_status_dueOn_idx" ON "ComplianceReturn"("schoolId", "status", "dueOn");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceReturn_schoolId_name_period_key" ON "ComplianceReturn"("schoolId", "name", "period");

-- CreateIndex
CREATE INDEX "DataSubjectRequest_schoolId_status_receivedOn_idx" ON "DataSubjectRequest"("schoolId", "status", "receivedOn");

-- CreateIndex
CREATE UNIQUE INDEX "DataSubjectRequest_schoolId_reference_key" ON "DataSubjectRequest"("schoolId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionPolicy_schoolId_dataClass_key" ON "RetentionPolicy"("schoolId", "dataClass");

-- CreateIndex
CREATE INDEX "IntegrityFlag_schoolId_status_createdAt_idx" ON "IntegrityFlag"("schoolId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "ComplianceReturn" ADD CONSTRAINT "ComplianceReturn_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceReturn" ADD CONSTRAINT "ComplianceReturn_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSubjectRequest" ADD CONSTRAINT "DataSubjectRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSubjectRequest" ADD CONSTRAINT "DataSubjectRequest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrityFlag" ADD CONSTRAINT "IntegrityFlag_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrityFlag" ADD CONSTRAINT "IntegrityFlag_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

