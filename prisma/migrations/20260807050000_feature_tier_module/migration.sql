-- Module 8 (Feature Configuration and Tier Management): tier matrix, override workflow, staged rollout, branding.

ALTER TABLE "PlatformFeatureFlag"
  ADD COLUMN IF NOT EXISTS "rolloutStatus" TEXT NOT NULL DEFAULT 'OFF',
  ADD COLUMN IF NOT EXISTS "pilotSchoolIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "PlatformFeatureFlagOverride"
  ADD COLUMN IF NOT EXISTS "overrideStatus" TEXT NOT NULL DEFAULT 'GRANTED',
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "reason" TEXT,
  ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "requestedById" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedById" TEXT;

ALTER TABLE "PlatformFeatureFlagOverride" ALTER COLUMN "enabled" SET DEFAULT true;

CREATE INDEX IF NOT EXISTS "PlatformFeatureFlagOverride_status_idx" ON "PlatformFeatureFlagOverride"("status");

DO $$ BEGIN
  ALTER TABLE "PlatformFeatureFlagOverride" ADD CONSTRAINT "PlatformFeatureFlagOverride_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PlatformFeatureFlagOverride" ADD CONSTRAINT "PlatformFeatureFlagOverride_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "TierFeature" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "starterAccess" BOOLEAN NOT NULL DEFAULT false,
  "standardAccess" BOOLEAN NOT NULL DEFAULT false,
  "eliteAccess" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TierFeature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TierFeature_name_key" ON "TierFeature"("name");

CREATE TABLE IF NOT EXISTS "BrandingAsset" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "logoUrl" TEXT,
  "primaryColour" TEXT NOT NULL,
  "secondaryColour" TEXT NOT NULL,
  "appliedTo" TEXT NOT NULL DEFAULT 'report_card',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "approvedById" TEXT,
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BrandingAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BrandingAsset_schoolId_status_idx" ON "BrandingAsset"("schoolId", "status");

DO $$ BEGIN
  ALTER TABLE "BrandingAsset" ADD CONSTRAINT "BrandingAsset_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BrandingAsset" ADD CONSTRAINT "BrandingAsset_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
