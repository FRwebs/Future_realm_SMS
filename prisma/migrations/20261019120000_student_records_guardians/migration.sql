-- AlterTable
ALTER TABLE "BehaviorLog" ADD COLUMN     "actionTaken" TEXT,
ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "recordedById" TEXT,
ADD COLUMN     "visibleTo" TEXT;

-- AlterTable
ALTER TABLE "Guardian" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'English',
ADD COLUMN     "mergedAt" TIMESTAMP(3),
ADD COLUMN     "mergedIntoId" TEXT,
ADD COLUMN     "phoneOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phoneOnlyMode" TEXT,
ADD COLUMN     "phoneOnlyReason" TEXT,
ADD COLUMN     "secondContactName" TEXT,
ADD COLUMN     "secondContactPhone" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "address" TEXT,
ADD COLUMN     "houseName" TEXT,
ADD COLUMN     "languageAtHome" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "previousSchool" TEXT;

-- AlterTable
ALTER TABLE "StudentDocument" ADD COLUMN     "documentOn" TIMESTAMP(3),
ADD COLUMN     "note" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT;

-- AlterTable
ALTER TABLE "StudentGuardian" ADD COLUMN     "canCollect" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "relation" TEXT,
ADD COLUMN     "visibility" JSONB;

-- CreateTable
CREATE TABLE "StudentChangeRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT NOT NULL,
    "reason" TEXT,
    "evidence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorisedCollector" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT,
    "guardianId" TEXT,
    "name" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "photoFile" TEXT,
    "until" TIMESTAMP(3),
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthorisedCollector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianSubmission" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "studentId" TEXT,
    "type" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'NEW',
    "ownerUserId" TEXT,
    "ownerName" TEXT,
    "ownerRole" TEXT,
    "outcome" TEXT,
    "channel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "GuardianSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyConsent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "typeCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GIVEN',
    "means" TEXT,
    "note" TEXT,
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianContact" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "channel" TEXT,
    "summary" TEXT NOT NULL,
    "detail" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentChangeRequest_schoolId_status_createdAt_idx" ON "StudentChangeRequest"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "StudentChangeRequest_studentId_idx" ON "StudentChangeRequest"("studentId");

-- CreateIndex
CREATE INDEX "AuthorisedCollector_schoolId_studentId_idx" ON "AuthorisedCollector"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "GuardianSubmission_schoolId_state_createdAt_idx" ON "GuardianSubmission"("schoolId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "FamilyConsent_schoolId_typeCode_status_idx" ON "FamilyConsent"("schoolId", "typeCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyConsent_guardianId_typeCode_key" ON "FamilyConsent"("guardianId", "typeCode");

-- CreateIndex
CREATE INDEX "GuardianContact_schoolId_guardianId_createdAt_idx" ON "GuardianContact"("schoolId", "guardianId", "createdAt");

-- AddForeignKey
ALTER TABLE "StudentChangeRequest" ADD CONSTRAINT "StudentChangeRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentChangeRequest" ADD CONSTRAINT "StudentChangeRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorisedCollector" ADD CONSTRAINT "AuthorisedCollector_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorisedCollector" ADD CONSTRAINT "AuthorisedCollector_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorisedCollector" ADD CONSTRAINT "AuthorisedCollector_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianSubmission" ADD CONSTRAINT "GuardianSubmission_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianSubmission" ADD CONSTRAINT "GuardianSubmission_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianSubmission" ADD CONSTRAINT "GuardianSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyConsent" ADD CONSTRAINT "FamilyConsent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyConsent" ADD CONSTRAINT "FamilyConsent_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianContact" ADD CONSTRAINT "GuardianContact_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianContact" ADD CONSTRAINT "GuardianContact_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

