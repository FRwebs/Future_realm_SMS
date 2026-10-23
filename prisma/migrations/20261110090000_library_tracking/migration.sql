-- AlterTable
ALTER TABLE "CurriculumTemplate" ADD COLUMN     "effectiveTo" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GradingScaleTemplate" ADD COLUMN     "creditGrade" TEXT,
ADD COLUMN     "distinctionGrade" TEXT,
ADD COLUMN     "failingGrade" TEXT,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scaleType" TEXT NOT NULL DEFAULT 'PERCENTAGE';

-- AlterTable
ALTER TABLE "ReportCardTemplate" ADD COLUMN     "authorId" TEXT,
ADD COLUMN     "baseOnId" TEXT,
ADD COLUMN     "reviewNotes" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewerId" TEXT,
ADD COLUMN     "spec" JSONB,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'LIVE',
ADD COLUMN     "targetRelease" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "AssessmentFrameworkTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "components" JSONB NOT NULL,
    "typicalUser" TEXT,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentFrameworkTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortabilityRun" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "ranById" TEXT,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortabilityRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentFrameworkTemplate_name_key" ON "AssessmentFrameworkTemplate"("name");

-- CreateIndex
CREATE INDEX "PortabilityRun_kind_targetId_idx" ON "PortabilityRun"("kind", "targetId");


-- A layout that was not live before this change is a draft.
UPDATE "ReportCardTemplate" SET "status" = 'DRAFT' WHERE "isActive" = false;
