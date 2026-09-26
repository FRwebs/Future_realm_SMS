-- CreateEnum
CREATE TYPE "ApprovalKind" AS ENUM ('SCORE_CORRECTION', 'RESULTS_PUBLICATION', 'FEE_WAIVER', 'RECORD_CHANGE', 'STAFF_ACCESS', 'MASS_COMMUNICATION', 'LEAVE', 'TIMETABLE_CHANGE', 'OTHER');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'RETURNED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "kind" "ApprovalKind" NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "blocking" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "requestedById" TEXT,
    "assigneeId" TEXT,
    "assigneeRole" "UserRole",
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decisionNote" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "escalatesAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprovalRequest_schoolId_assigneeId_status_priority_idx" ON "ApprovalRequest"("schoolId", "assigneeId", "status", "priority");

-- CreateIndex
CREATE INDEX "ApprovalRequest_schoolId_assigneeRole_status_priority_idx" ON "ApprovalRequest"("schoolId", "assigneeRole", "status", "priority");

-- CreateIndex
CREATE INDEX "ApprovalRequest_schoolId_subjectType_subjectId_idx" ON "ApprovalRequest"("schoolId", "subjectType", "subjectId");

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
