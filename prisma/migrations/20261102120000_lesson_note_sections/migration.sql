-- A lesson note is written once per topic and serves every arm that takes it; its sections, and what a reviewer asked to change.
ALTER TABLE "LessonPlan" ADD COLUMN "classIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "sections" JSONB,
ADD COLUMN "returnedSection" TEXT,
ADD COLUMN "resubmitReply" TEXT;
