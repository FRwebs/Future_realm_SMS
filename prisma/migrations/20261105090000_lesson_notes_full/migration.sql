-- AlterTable
ALTER TABLE "LessonPlan" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "SchemeOfWork" ADD COLUMN     "addedByTeacher" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "book" TEXT,
ADD COLUMN     "curriculum" TEXT,
ADD COLUMN     "lessonMinutes" INTEGER,
ADD COLUMN     "periodsPerWeek" INTEGER,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "startWeek" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "SowTopic" ADD COLUMN     "assessment" TEXT,
ADD COLUMN     "coveredSubtopics" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "periods" INTEGER,
ADD COLUMN     "resourceList" JSONB,
ADD COLUMN     "statusOverride" TEXT;

-- CreateTable
CREATE TABLE "LessonNoteComment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "section" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonNoteComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonNoteComment_schoolId_planId_createdAt_idx" ON "LessonNoteComment"("schoolId", "planId", "createdAt");

-- AddForeignKey
ALTER TABLE "LessonNoteComment" ADD CONSTRAINT "LessonNoteComment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

