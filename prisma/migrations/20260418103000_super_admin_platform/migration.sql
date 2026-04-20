-- Super Admin tenant controls
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUSPEND';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACTIVATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'RESET_PASSWORD';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'IMPERSONATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SETTINGS_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BILLING_UPDATE';

CREATE TYPE "SubscriptionPlan" AS ENUM ('BASIC', 'STANDARD', 'ENTERPRISE');
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL', 'DELETED');
CREATE TYPE "BillingStatus" AS ENUM ('TRIAL', 'ACTIVE', 'OVERDUE', 'SUSPENDED');

ALTER TABLE "School"
  ADD COLUMN "plan" "SubscriptionPlan" NOT NULL DEFAULT 'BASIC',
  ADD COLUMN "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
  ADD COLUMN "billingStatus" "BillingStatus" NOT NULL DEFAULT 'TRIAL',
  ADD COLUMN "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN "lastPaymentAt" TIMESTAMP(3),
  ADD COLUMN "nextBillingAt" TIMESTAMP(3),
  ADD COLUMN "featureFlags" JSONB,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "User"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "suspendedAt" TIMESTAMP(3),
  ADD COLUMN "passwordResetRequired" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_schoolId_fkey";
ALTER TABLE "AuditLog" ALTER COLUMN "schoolId" DROP NOT NULL;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AuditLog_schoolId_action_createdAt_idx" ON "AuditLog"("schoolId", "action", "createdAt");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

CREATE TABLE "PlatformSetting" (
  "id" TEXT NOT NULL,
  "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
  "platformAnnouncement" TEXT,
  "defaultGradingScale" JSONB NOT NULL,
  "globalModuleAvailability" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);
