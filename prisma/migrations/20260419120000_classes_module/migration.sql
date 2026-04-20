-- Extend the existing ClassRoom model for the production Classes module.
ALTER TABLE "ClassRoom"
  ADD COLUMN IF NOT EXISTS "shortName" TEXT,
  ADD COLUMN IF NOT EXISTS "section" TEXT,
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "assistantClassTeacherId" TEXT,
  ADD COLUMN IF NOT EXISTS "room" TEXT,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassRoom_classTeacherId_fkey') THEN
    ALTER TABLE "ClassRoom"
      ADD CONSTRAINT "ClassRoom_classTeacherId_fkey"
      FOREIGN KEY ("classTeacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassRoom_assistantClassTeacherId_fkey') THEN
    ALTER TABLE "ClassRoom"
      ADD CONSTRAINT "ClassRoom_assistantClassTeacherId_fkey"
      FOREIGN KEY ("assistantClassTeacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SkillDefinition" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SkillDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SkillDefinition_schoolId_category_name_key"
  ON "SkillDefinition"("schoolId", "category", "name");
CREATE INDEX IF NOT EXISTS "SkillDefinition_schoolId_category_displayOrder_idx"
  ON "SkillDefinition"("schoolId", "category", "displayOrder");

CREATE TABLE IF NOT EXISTS "StudentSkill" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "remark" TEXT,
  "assessedById" TEXT,
  "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StudentSkill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudentSkill_studentId_termId_skillId_key"
  ON "StudentSkill"("studentId", "termId", "skillId");
CREATE INDEX IF NOT EXISTS "StudentSkill_schoolId_classId_termId_idx"
  ON "StudentSkill"("schoolId", "classId", "termId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SkillDefinition_schoolId_fkey') THEN
    ALTER TABLE "SkillDefinition" ADD CONSTRAINT "SkillDefinition_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentSkill_schoolId_fkey') THEN
    ALTER TABLE "StudentSkill" ADD CONSTRAINT "StudentSkill_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentSkill_studentId_fkey') THEN
    ALTER TABLE "StudentSkill" ADD CONSTRAINT "StudentSkill_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentSkill_classId_fkey') THEN
    ALTER TABLE "StudentSkill" ADD CONSTRAINT "StudentSkill_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentSkill_termId_fkey') THEN
    ALTER TABLE "StudentSkill" ADD CONSTRAINT "StudentSkill_termId_fkey"
      FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentSkill_skillId_fkey') THEN
    ALTER TABLE "StudentSkill" ADD CONSTRAINT "StudentSkill_skillId_fkey"
      FOREIGN KEY ("skillId") REFERENCES "SkillDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ClassRoom_schoolId_isActive_deletedAt_idx"
  ON "ClassRoom"("schoolId", "isActive", "deletedAt");
CREATE INDEX IF NOT EXISTS "ClassRoom_schoolId_category_idx"
  ON "ClassRoom"("schoolId", "category");
CREATE INDEX IF NOT EXISTS "ClassRoom_schoolId_classTeacherId_idx"
  ON "ClassRoom"("schoolId", "classTeacherId");
CREATE INDEX IF NOT EXISTS "ClassRoom_schoolId_displayOrder_idx"
  ON "ClassRoom"("schoolId", "displayOrder");

CREATE TABLE IF NOT EXISTS "ClassAcademicAssignment" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "academicSessionId" TEXT NOT NULL,
  "termId" TEXT,
  "classTeacherId" TEXT,
  "assistantClassTeacherId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClassAcademicAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClassAcademicAssignment_classId_academicSessionId_termId_key"
  ON "ClassAcademicAssignment"("classId", "academicSessionId", "termId");
CREATE INDEX IF NOT EXISTS "ClassAcademicAssignment_schoolId_academicSessionId_termId_idx"
  ON "ClassAcademicAssignment"("schoolId", "academicSessionId", "termId");
CREATE INDEX IF NOT EXISTS "ClassAcademicAssignment_schoolId_classTeacherId_idx"
  ON "ClassAcademicAssignment"("schoolId", "classTeacherId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassAcademicAssignment_schoolId_fkey') THEN
    ALTER TABLE "ClassAcademicAssignment" ADD CONSTRAINT "ClassAcademicAssignment_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassAcademicAssignment_classId_fkey') THEN
    ALTER TABLE "ClassAcademicAssignment" ADD CONSTRAINT "ClassAcademicAssignment_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassAcademicAssignment_academicSessionId_fkey') THEN
    ALTER TABLE "ClassAcademicAssignment" ADD CONSTRAINT "ClassAcademicAssignment_academicSessionId_fkey"
      FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassAcademicAssignment_termId_fkey') THEN
    ALTER TABLE "ClassAcademicAssignment" ADD CONSTRAINT "ClassAcademicAssignment_termId_fkey"
      FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassAcademicAssignment_classTeacherId_fkey') THEN
    ALTER TABLE "ClassAcademicAssignment" ADD CONSTRAINT "ClassAcademicAssignment_classTeacherId_fkey"
      FOREIGN KEY ("classTeacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassAcademicAssignment_assistantClassTeacherId_fkey') THEN
    ALTER TABLE "ClassAcademicAssignment" ADD CONSTRAINT "ClassAcademicAssignment_assistantClassTeacherId_fkey"
      FOREIGN KEY ("assistantClassTeacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
