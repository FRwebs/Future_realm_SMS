-- AlterTable
ALTER TABLE "ClassLevel" ADD COLUMN     "visibleToParents" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ClassRoom" ADD COLUMN     "stream" TEXT;

-- AlterTable
ALTER TABLE "ClassSubject" ADD COLUMN     "assistantTeacherId" TEXT,
ADD COLUMN     "countsToAverage" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "periodsPerWeek" INTEGER;

-- CreateTable
CREATE TABLE "TimetableVersion" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "termId" TEXT,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "periodsPerDay" INTEGER NOT NULL DEFAULT 8,
    "periodMinutes" INTEGER NOT NULL DEFAULT 40,
    "firstStarts" TEXT NOT NULL DEFAULT '08:00',
    "breakAfter" INTEGER,
    "schoolDays" TEXT[] DEFAULT ARRAY['MON', 'TUE', 'WED', 'THU', 'FRI']::TEXT[],
    "appliesTo" TEXT NOT NULL DEFAULT 'Every arm',
    "checkClashes" BOOLEAN NOT NULL DEFAULT true,
    "grid" JSONB NOT NULL DEFAULT '{}',
    "builtById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "publishSummary" JSONB,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimetableVersion_schoolId_termId_state_idx" ON "TimetableVersion"("schoolId", "termId", "state");

-- AddForeignKey
ALTER TABLE "TimetableVersion" ADD CONSTRAINT "TimetableVersion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableVersion" ADD CONSTRAINT "TimetableVersion_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

