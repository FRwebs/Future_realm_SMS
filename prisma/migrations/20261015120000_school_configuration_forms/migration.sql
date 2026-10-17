-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "allDay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "endTime" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "reminder" TEXT,
ADD COLUMN     "reminderChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "schoolClosed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "secondReminder" TEXT,
ADD COLUMN     "startTime" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'School event',
ADD COLUMN     "visibleTo" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "approvalExpiresAt" TIMESTAMP(3),
ADD COLUMN     "attendancePattern" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "brandingAppliesTo" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "composition" TEXT,
ADD COLUMN     "foundedYear" INTEGER,
ADD COLUMN     "mainPhone" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "regulatingAuthority" TEXT,
ADD COLUMN     "showMottoUnderLogo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "signatureUrl" TEXT,
ADD COLUMN     "stagesOperated" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "stampUrl" TEXT;

-- AlterTable
ALTER TABLE "Term" ADD COLUMN     "breakEnd" TIMESTAMP(3),
ADD COLUMN     "breakStart" TIMESTAMP(3),
ADD COLUMN     "schoolDays" TEXT[] DEFAULT ARRAY['MON', 'TUE', 'WED', 'THU', 'FRI']::TEXT[];

-- CreateTable
CREATE TABLE "AssessmentWindow" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "releaseAt" TIMESTAMP(3) NOT NULL,
    "appliesTo" TEXT NOT NULL DEFAULT 'Every class',
    "remindTeachers" BOOLEAN NOT NULL DEFAULT true,
    "allowLateEntry" BOOLEAN NOT NULL DEFAULT false,
    "reopenedAt" TIMESTAMP(3),
    "reopenedReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentWindow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssessmentWindow_schoolId_termId_idx" ON "AssessmentWindow"("schoolId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentWindow_termId_componentId_key" ON "AssessmentWindow"("termId", "componentId");

-- AddForeignKey
ALTER TABLE "AssessmentWindow" ADD CONSTRAINT "AssessmentWindow_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentWindow" ADD CONSTRAINT "AssessmentWindow_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentWindow" ADD CONSTRAINT "AssessmentWindow_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "AssessmentComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

