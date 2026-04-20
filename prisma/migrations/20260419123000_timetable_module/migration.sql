-- Timetable module: richer period definitions, editable slots, and publish history.

CREATE TABLE IF NOT EXISTS "PeriodDefinition" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "periodNumber" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "startsAt" TEXT NOT NULL,
  "endsAt" TEXT NOT NULL,
  "slotType" TEXT NOT NULL DEFAULT 'lesson',
  "category" TEXT NOT NULL DEFAULT 'secondary',
  "displayOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PeriodDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PeriodDefinition_schoolId_periodNumber_category_key"
  ON "PeriodDefinition"("schoolId", "periodNumber", "category");
CREATE INDEX IF NOT EXISTS "PeriodDefinition_schoolId_category_displayOrder_idx"
  ON "PeriodDefinition"("schoolId", "category", "displayOrder");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'PeriodDefinition_schoolId_fkey'
  ) THEN
    ALTER TABLE "PeriodDefinition"
      ADD CONSTRAINT "PeriodDefinition_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "TimetableEntry" ADD COLUMN IF NOT EXISTS "academicSessionId" TEXT;
ALTER TABLE "TimetableEntry" ADD COLUMN IF NOT EXISTS "periodNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "TimetableEntry" ADD COLUMN IF NOT EXISTS "slotType" TEXT NOT NULL DEFAULT 'lesson';
ALTER TABLE "TimetableEntry" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "TimetableEntry" ADD COLUMN IF NOT EXISTS "isPublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TimetableEntry" ADD COLUMN IF NOT EXISTS "isDoublePeriod" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TimetableEntry" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "TimetableEntry" ADD COLUMN IF NOT EXISTS "updatedById" TEXT;
ALTER TABLE "TimetableEntry" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TimetableEntry" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TimetableEntry" ALTER COLUMN "subjectId" DROP NOT NULL;

UPDATE "TimetableEntry"
SET "periodNumber" = CASE
  WHEN "startsAt" = '07:30' THEN 0
  WHEN "startsAt" = '07:45' THEN 1
  WHEN "startsAt" = '07:50' THEN 1
  WHEN "startsAt" = '08:00' THEN 1
  WHEN "startsAt" = '08:25' THEN 2
  WHEN "startsAt" = '08:30' THEN 2
  WHEN "startsAt" = '08:40' THEN 2
  WHEN "startsAt" = '09:05' THEN 3
  WHEN "startsAt" = '09:10' THEN 3
  WHEN "startsAt" = '09:20' THEN 3
  WHEN "startsAt" IN ('09:45', '09:50', '10:00') THEN 99
  WHEN "startsAt" IN ('10:05', '10:10', '10:20') THEN 4
  WHEN "startsAt" IN ('10:45', '10:50', '11:00') THEN 5
  WHEN "startsAt" IN ('11:25', '11:30', '12:20') THEN 6
  WHEN "startsAt" IN ('12:05', '12:10', '11:40') THEN 98
  WHEN "startsAt" IN ('12:45', '12:40') THEN 7
  WHEN "startsAt" = '13:25' THEN 8
  WHEN "startsAt" IN ('14:05', '13:20', '13:00') THEN 97
  ELSE "periodNumber"
END;

CREATE INDEX IF NOT EXISTS "TimetableEntry_schoolId_termId_idx" ON "TimetableEntry"("schoolId", "termId");
CREATE INDEX IF NOT EXISTS "TimetableEntry_classId_idx" ON "TimetableEntry"("classId");
CREATE INDEX IF NOT EXISTS "TimetableEntry_teacherId_idx" ON "TimetableEntry"("teacherId");
CREATE INDEX IF NOT EXISTS "TimetableEntry_dayOfWeek_idx" ON "TimetableEntry"("dayOfWeek");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname = 'TimetableEntry_classId_dayOfWeek_periodNumber_termId_key'
  ) THEN
    CREATE UNIQUE INDEX "TimetableEntry_classId_dayOfWeek_periodNumber_termId_key"
      ON "TimetableEntry"("classId", "dayOfWeek", "periodNumber", "termId");
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TimetableEntry_subjectId_fkey'
  ) THEN
    ALTER TABLE "TimetableEntry" DROP CONSTRAINT "TimetableEntry_subjectId_fkey";
  END IF;
  ALTER TABLE "TimetableEntry"
    ADD CONSTRAINT "TimetableEntry_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TimetableEntry_academicSessionId_fkey'
  ) THEN
    ALTER TABLE "TimetableEntry"
      ADD CONSTRAINT "TimetableEntry_academicSessionId_fkey"
      FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TimetableEntry_createdById_fkey'
  ) THEN
    ALTER TABLE "TimetableEntry"
      ADD CONSTRAINT "TimetableEntry_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TimetableEntry_updatedById_fkey'
  ) THEN
    ALTER TABLE "TimetableEntry"
      ADD CONSTRAINT "TimetableEntry_updatedById_fkey"
      FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "TimetablePublishLog" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "classId" TEXT,
  "academicSessionId" TEXT,
  "termId" TEXT,
  "action" TEXT NOT NULL,
  "publishedById" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  CONSTRAINT "TimetablePublishLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TimetablePublishLog_schoolId_termId_idx"
  ON "TimetablePublishLog"("schoolId", "termId");
CREATE INDEX IF NOT EXISTS "TimetablePublishLog_schoolId_classId_idx"
  ON "TimetablePublishLog"("schoolId", "classId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TimetablePublishLog_schoolId_fkey'
  ) THEN
    ALTER TABLE "TimetablePublishLog"
      ADD CONSTRAINT "TimetablePublishLog_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TimetablePublishLog_classId_fkey'
  ) THEN
    ALTER TABLE "TimetablePublishLog"
      ADD CONSTRAINT "TimetablePublishLog_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TimetablePublishLog_academicSessionId_fkey'
  ) THEN
    ALTER TABLE "TimetablePublishLog"
      ADD CONSTRAINT "TimetablePublishLog_academicSessionId_fkey"
      FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TimetablePublishLog_termId_fkey'
  ) THEN
    ALTER TABLE "TimetablePublishLog"
      ADD CONSTRAINT "TimetablePublishLog_termId_fkey"
      FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TimetablePublishLog_publishedById_fkey'
  ) THEN
    ALTER TABLE "TimetablePublishLog"
      ADD CONSTRAINT "TimetablePublishLog_publishedById_fkey"
      FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
