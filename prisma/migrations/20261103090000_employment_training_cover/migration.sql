-- AlterTable
ALTER TABLE "ProfileDocument" ADD COLUMN     "expiresOn" TIMESTAMP(3),
ADD COLUMN     "issuedBy" TEXT;

-- AlterTable
ALTER TABLE "StaffAppraisal" ADD COLUMN     "selfSubmittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StaffAbsence" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "coverUserId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'REGISTER_AND_SCORES',
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoverAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingCourse" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "section" TEXT NOT NULL DEFAULT 'School courses',
    "provider" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'Self-paced',
    "certificateName" TEXT NOT NULL,
    "validMonths" INTEGER,
    "pathway" TEXT,
    "outcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "task" TEXT,
    "personas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredFor" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredBy" TIMESTAMP(3),
    "requiredNote" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingLesson" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 10,
    "body" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT,

    CONSTRAINT "TrainingLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingEnrolment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedLessons" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TrainingEnrolment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingCertificate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "name" TEXT NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "code" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'VALID',
    "external" BOOLEAN NOT NULL DEFAULT false,
    "evidence" TEXT,
    "note" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSuggestion" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "why" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffAbsence_schoolId_day_idx" ON "StaffAbsence"("schoolId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAbsence_userId_day_key" ON "StaffAbsence"("userId", "day");

-- CreateIndex
CREATE INDEX "CoverAssignment_schoolId_coverUserId_endsOn_idx" ON "CoverAssignment"("schoolId", "coverUserId", "endsOn");

-- CreateIndex
CREATE INDEX "CoverAssignment_schoolId_classId_idx" ON "CoverAssignment"("schoolId", "classId");

-- CreateIndex
CREATE INDEX "TrainingCourse_schoolId_archivedAt_idx" ON "TrainingCourse"("schoolId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingLesson_courseId_position_key" ON "TrainingLesson"("courseId", "position");

-- CreateIndex
CREATE INDEX "TrainingEnrolment_schoolId_userId_idx" ON "TrainingEnrolment"("schoolId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingEnrolment_courseId_userId_key" ON "TrainingEnrolment"("courseId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingCertificate_code_key" ON "TrainingCertificate"("code");

-- CreateIndex
CREATE INDEX "TrainingCertificate_schoolId_userId_idx" ON "TrainingCertificate"("schoolId", "userId");

-- CreateIndex
CREATE INDEX "TrainingSuggestion_schoolId_createdAt_idx" ON "TrainingSuggestion"("schoolId", "createdAt");

-- AddForeignKey
ALTER TABLE "StaffAbsence" ADD CONSTRAINT "StaffAbsence_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverAssignment" ADD CONSTRAINT "CoverAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCourse" ADD CONSTRAINT "TrainingCourse_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingLesson" ADD CONSTRAINT "TrainingLesson_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingEnrolment" ADD CONSTRAINT "TrainingEnrolment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingEnrolment" ADD CONSTRAINT "TrainingEnrolment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCertificate" ADD CONSTRAINT "TrainingCertificate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSuggestion" ADD CONSTRAINT "TrainingSuggestion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

