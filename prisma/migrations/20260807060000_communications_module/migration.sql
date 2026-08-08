-- Module 4 (Notification & Communication Command Center): campaigns, message templates, consent.

CREATE TABLE IF NOT EXISTS "Campaign" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'OPERATIONAL',
  "channel" TEXT NOT NULL,
  "audienceFilter" JSONB,
  "templateId" TEXT,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "scheduledAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "recipientCount" INTEGER NOT NULL DEFAULT 0,
  "deliveredCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "openedCount" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "approvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Campaign_status_type_idx" ON "Campaign"("status", "type");

DO $$ BEGIN
  ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "MessageTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "placeholders" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING_META_APPROVAL',
  "metaTemplateId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MessageTemplate_category_channel_idx" ON "MessageTemplate"("category", "channel");

CREATE TABLE IF NOT EXISTS "ConsentRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "optedIn" BOOLEAN NOT NULL DEFAULT true,
  "optedOutAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConsentRecord_userId_channel_key" ON "ConsentRecord"("userId", "channel");

DO $$ BEGIN
  ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
