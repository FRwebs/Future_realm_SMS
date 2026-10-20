-- CreateTable
CREATE TABLE "SchoolConcession" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "evidence" TEXT,
    "evidenceRef" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "priorPlan" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolConcession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolConcession_schoolId_status_idx" ON "SchoolConcession"("schoolId", "status");

-- AddForeignKey
ALTER TABLE "SchoolConcession" ADD CONSTRAINT "SchoolConcession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

