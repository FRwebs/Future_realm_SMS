-- A course is no longer always a school's own. The platform publishes courses every school is
-- given, and an accredited body's course is offered the same way, so the school is optional and
-- the origin is recorded. Everything already on file was written by its school.
ALTER TABLE "TrainingCourse" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'SCHOOL';
ALTER TABLE "TrainingCourse" ALTER COLUMN "schoolId" DROP NOT NULL;
