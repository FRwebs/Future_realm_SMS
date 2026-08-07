-- Module 2 (School Account Management): full status lifecycle, manual interventions, contacts.

DO $$ BEGIN
  ALTER TYPE "TenantStatus" ADD VALUE 'GRACE_PERIOD';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "School"
  ADD COLUMN IF NOT EXISTS "prioritySupport" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "dataExportedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "statusReason" TEXT,
  ADD COLUMN IF NOT EXISTS "statusChangedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "SchoolContact" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SchoolContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SchoolContact_schoolId_idx" ON "SchoolContact"("schoolId");

DO $$ BEGIN
  ALTER TABLE "SchoolContact" ADD CONSTRAINT "SchoolContact_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
