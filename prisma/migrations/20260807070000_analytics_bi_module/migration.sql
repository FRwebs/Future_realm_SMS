-- Module 7 (Platform Analytics & BI): churn reason records, custom report builder.

CREATE TABLE IF NOT EXISTS "ChurnRecord" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "notes" TEXT,
  "loggedById" TEXT,
  "churnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ChurnRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChurnRecord_schoolId_idx" ON "ChurnRecord"("schoolId");
CREATE INDEX IF NOT EXISTS "ChurnRecord_churnedAt_idx" ON "ChurnRecord"("churnedAt");

DO $$ BEGIN
  ALTER TABLE "ChurnRecord" ADD CONSTRAINT "ChurnRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ChurnRecord" ADD CONSTRAINT "ChurnRecord_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CustomReport" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "dimension" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "filters" JSONB,
  "createdById" TEXT,
  "generatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomReport_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "CustomReport" ADD CONSTRAINT "CustomReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
