-- Module 9 (Academic & Curriculum Configuration Library): curriculum, grading scale, report card templates.

CREATE TABLE IF NOT EXISTS "CurriculumTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "subjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "classStructure" JSONB,
  "calendarType" TEXT NOT NULL DEFAULT 'THREE_TERM',
  "version" TEXT NOT NULL DEFAULT '1.0',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CurriculumTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CurriculumTemplate_name_key" ON "CurriculumTemplate"("name");

CREATE TABLE IF NOT EXISTS "GradingScaleTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "gradeBands" JSONB NOT NULL,
  "passMark" DOUBLE PRECISION NOT NULL DEFAULT 40,
  "applicableCurricula" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GradingScaleTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GradingScaleTemplate_name_key" ON "GradingScaleTemplate"("name");

CREATE TABLE IF NOT EXISTS "ReportCardTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "layoutConfig" JSONB,
  "applicableCurricula" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "availableToTiers" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReportCardTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReportCardTemplate_name_key" ON "ReportCardTemplate"("name");
