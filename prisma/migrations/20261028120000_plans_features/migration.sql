-- AlterTable
ALTER TABLE "PlatformFeatureFlag" ADD COLUMN     "area" TEXT,
ADD COLUMN     "exitCriteria" TEXT,
ADD COLUMN     "observationDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "stageStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "PlatformSubscriptionPlan" ADD COLUMN     "lifecycle" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "TierFeature" ADD COLUMN     "customAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "featureKey" TEXT,
ADD COLUMN     "professionalAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "FeatureFlagStage" (
    "id" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "fromStage" TEXT NOT NULL,
    "toStage" TEXT NOT NULL,
    "percent" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "byId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureFlagStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TierFeatureChange" (
    "id" TEXT NOT NULL,
    "featureName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "migrationPlan" TEXT,
    "affectedSchools" INTEGER NOT NULL DEFAULT 0,
    "byId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TierFeatureChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanVersion" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "changedById" TEXT,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanPriceChange" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "oldMonthly" DECIMAL(12,2) NOT NULL,
    "newMonthly" DECIMAL(12,2) NOT NULL,
    "oldAnnual" DECIMAL(12,2) NOT NULL,
    "newAnnual" DECIMAL(12,2) NOT NULL,
    "announcedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "subscribersTold" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "createdById" TEXT,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "PlanPriceChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeatureFlagStage_flagId_createdAt_idx" ON "FeatureFlagStage"("flagId", "createdAt");

-- CreateIndex
CREATE INDEX "TierFeatureChange_createdAt_idx" ON "TierFeatureChange"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlanVersion_planId_version_key" ON "PlanVersion"("planId", "version");

-- CreateIndex
CREATE INDEX "PlanPriceChange_status_effectiveAt_idx" ON "PlanPriceChange"("status", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "TierFeature_featureKey_key" ON "TierFeature"("featureKey");

-- AddForeignKey
ALTER TABLE "FeatureFlagStage" ADD CONSTRAINT "FeatureFlagStage_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "PlatformFeatureFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A plan that was switched off before lifecycles existed is archived; Professional follows Standard and Custom follows Enterprise until someone says otherwise.
UPDATE "PlatformSubscriptionPlan" SET "lifecycle" = 'ARCHIVED' WHERE "isActive" = false;
UPDATE "TierFeature" SET "professionalAccess" = "standardAccess", "customAccess" = "eliteAccess";
