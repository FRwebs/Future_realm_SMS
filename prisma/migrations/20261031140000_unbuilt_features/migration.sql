ALTER TABLE "InternalProfile" ADD COLUMN "customRoleId" TEXT;
ALTER TABLE "ComputationRun" ADD COLUMN "traceChecked" INTEGER, ADD COLUMN "traceMatched" INTEGER;
ALTER TABLE "MigrationJob" ADD COLUMN "moveReason" TEXT;
ALTER TABLE "CurriculumTemplate" ADD COLUMN "layers" JSONB;
ALTER TABLE "SchoolSubscription" ADD COLUMN "lockedMonthlyPrice" DECIMAL(12,2), ADD COLUMN "priceLockedUntil" TIMESTAMP(3), ADD COLUMN "priceLockReason" TEXT;

CREATE TABLE "InternalRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseRole" TEXT NOT NULL DEFAULT 'PLATFORM_ADMIN',
    "grid" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InternalRole_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InternalRole_name_key" ON "InternalRole"("name");

CREATE TABLE "IntegrationOwner" (
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IntegrationOwner_pkey" PRIMARY KEY ("name")
);

CREATE TABLE "RegressionRun" (
    "id" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passed" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "failures" JSONB NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'MANUAL',
    "ranById" TEXT,
    CONSTRAINT "RegressionRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RegressionRun_ranAt_idx" ON "RegressionRun"("ranAt");

CREATE TABLE "ClassTemplateAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassTemplateAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClassTemplateAssignment_classId_key" ON "ClassTemplateAssignment"("classId");
CREATE INDEX "ClassTemplateAssignment_schoolId_idx" ON "ClassTemplateAssignment"("schoolId");
CREATE INDEX "ClassTemplateAssignment_templateId_idx" ON "ClassTemplateAssignment"("templateId");
