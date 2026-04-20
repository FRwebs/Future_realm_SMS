ALTER TABLE "Subject"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "waecCode" TEXT,
  ADD COLUMN IF NOT EXISTS "necoCode" TEXT,
  ADD COLUMN IF NOT EXISTS "isWaecSubject" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "subjectCombination" TEXT,
  ADD COLUMN IF NOT EXISTS "periodsPerWeek" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "requiresLab" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "ClassSubject"
  ADD COLUMN IF NOT EXISTS "assignedById" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "SubjectTeacherHistory" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "academicSessionId" TEXT,
  "termId" TEXT,
  "assignedById" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unassignedAt" TIMESTAMP(3),
  "reason" TEXT,
  CONSTRAINT "SubjectTeacherHistory_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SubjectTeacherHistory_subjectId_fkey'
  ) THEN
    ALTER TABLE "SubjectTeacherHistory"
      ADD CONSTRAINT "SubjectTeacherHistory_subjectId_fkey"
      FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Subject_schoolId_isActive_deletedAt_idx" ON "Subject"("schoolId", "isActive", "deletedAt");
CREATE INDEX IF NOT EXISTS "Subject_schoolId_departmentId_idx" ON "Subject"("schoolId", "departmentId");
CREATE INDEX IF NOT EXISTS "ClassSubject_schoolId_teacherId_isActive_idx" ON "ClassSubject"("schoolId", "teacherId", "isActive");
CREATE INDEX IF NOT EXISTS "SubjectTeacherHistory_schoolId_subjectId_classId_termId_idx" ON "SubjectTeacherHistory"("schoolId", "subjectId", "classId", "termId");
CREATE INDEX IF NOT EXISTS "SubjectTeacherHistory_schoolId_teacherId_unassignedAt_idx" ON "SubjectTeacherHistory"("schoolId", "teacherId", "unassignedAt");
