-- Homework carries its own maximum mark. Existing homework stays out of 100, as it always was.
ALTER TABLE "Assignment" ADD COLUMN "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100;
