-- CreateTable
CREATE TABLE "LearningSupportPlan" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "strategies" JSONB NOT NULL,
    "confidentialNote" TEXT,
    "reviewedOn" DATE NOT NULL,
    "nextReviewOn" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "authorId" TEXT NOT NULL,
    "endedAt" TIMESTAMP(3),
    "endedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningSupportPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningSupportPlan_schoolId_studentId_status_idx" ON "LearningSupportPlan"("schoolId", "studentId", "status");

-- CreateIndex
CREATE INDEX "LearningSupportPlan_schoolId_nextReviewOn_idx" ON "LearningSupportPlan"("schoolId", "nextReviewOn");

-- AddForeignKey
ALTER TABLE "LearningSupportPlan" ADD CONSTRAINT "LearningSupportPlan_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

