-- A returned lesson note names who returned it, so the teacher's rework list can say
-- whose comment they are reading. Nullable: every note returned before this has nobody on it.
ALTER TABLE "LessonPlan" ADD COLUMN "returnedById" TEXT;
