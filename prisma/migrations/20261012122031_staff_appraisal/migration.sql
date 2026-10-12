-- CreateEnum
CREATE TYPE "StaffAppraisalStatus" AS ENUM ('DRAFT', 'SHARED', 'ACKNOWLEDGED');

-- CreateTable
CREATE TABLE "StaffAppraisal" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "termId" TEXT,
    "cycle" TEXT NOT NULL,
    "status" "StaffAppraisalStatus" NOT NULL DEFAULT 'DRAFT',
    "overallScore" DOUBLE PRECISION,
    "strengths" TEXT,
    "improvements" TEXT,
    "reviewerComment" TEXT,
    "staffComment" TEXT,
    "sharedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAppraisal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAppraisalRating" (
    "id" TEXT NOT NULL,
    "appraisalId" TEXT NOT NULL,
    "criterion" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,

    CONSTRAINT "StaffAppraisalRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffAppraisal_schoolId_status_createdAt_idx" ON "StaffAppraisal"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "StaffAppraisal_schoolId_reviewerId_status_idx" ON "StaffAppraisal"("schoolId", "reviewerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAppraisal_staffId_cycle_key" ON "StaffAppraisal"("staffId", "cycle");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAppraisalRating_appraisalId_criterion_key" ON "StaffAppraisalRating"("appraisalId", "criterion");

-- AddForeignKey
ALTER TABLE "StaffAppraisal" ADD CONSTRAINT "StaffAppraisal_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAppraisal" ADD CONSTRAINT "StaffAppraisal_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAppraisal" ADD CONSTRAINT "StaffAppraisal_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAppraisal" ADD CONSTRAINT "StaffAppraisal_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAppraisalRating" ADD CONSTRAINT "StaffAppraisalRating_appraisalId_fkey" FOREIGN KEY ("appraisalId") REFERENCES "StaffAppraisal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

