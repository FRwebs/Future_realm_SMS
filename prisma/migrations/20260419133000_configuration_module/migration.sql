CREATE TABLE IF NOT EXISTS "ConfigurationItem" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "description" TEXT,
  "data" JSONB,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ConfigurationItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConfigurationItem_schoolId_resource_name_key"
  ON "ConfigurationItem"("schoolId", "resource", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "ConfigurationItem_schoolId_resource_code_key"
  ON "ConfigurationItem"("schoolId", "resource", "code");
CREATE INDEX IF NOT EXISTS "ConfigurationItem_schoolId_resource_status_idx"
  ON "ConfigurationItem"("schoolId", "resource", "status");
CREATE INDEX IF NOT EXISTS "ConfigurationItem_schoolId_resource_displayOrder_idx"
  ON "ConfigurationItem"("schoolId", "resource", "displayOrder");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ConfigurationItem_schoolId_fkey'
  ) THEN
    ALTER TABLE "ConfigurationItem"
      ADD CONSTRAINT "ConfigurationItem_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "ClassLevel" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
