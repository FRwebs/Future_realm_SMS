ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "username" TEXT,
  ADD COLUMN IF NOT EXISTS "middleName" TEXT,
  ADD COLUMN IF NOT EXISTS "preferredName" TEXT,
  ADD COLUMN IF NOT EXISTS "gender" "Gender",
  ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "nationality" TEXT,
  ADD COLUMN IF NOT EXISTS "stateOfOrigin" TEXT,
  ADD COLUMN IF NOT EXISTS "lga" TEXT,
  ADD COLUMN IF NOT EXISTS "religion" TEXT,
  ADD COLUMN IF NOT EXISTS "maritalStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "bloodGroup" TEXT,
  ADD COLUMN IF NOT EXISTS "genotype" TEXT,
  ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "alternateEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "secondaryPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "homeAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "residentialAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "country" TEXT,
  ADD COLUMN IF NOT EXISTS "accountStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "nextOfKinFirstName" TEXT,
  ADD COLUMN IF NOT EXISTS "nextOfKinLastName" TEXT,
  ADD COLUMN IF NOT EXISTS "nextOfKinOtherName" TEXT,
  ADD COLUMN IF NOT EXISTS "nextOfKinPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "nextOfKinEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "nextOfKinRelationship" TEXT,
  ADD COLUMN IF NOT EXISTS "nextOfKinAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "nextOfKinOccupation" TEXT;

ALTER TABLE "StaffProfile"
  ADD COLUMN IF NOT EXISTS "staffType" TEXT NOT NULL DEFAULT 'ACADEMIC',
  ADD COLUMN IF NOT EXISTS "employmentType" TEXT,
  ADD COLUMN IF NOT EXISTS "staffCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "qualification" TEXT,
  ADD COLUMN IF NOT EXISTS "yearsOfExperience" INTEGER,
  ADD COLUMN IF NOT EXISTS "supervisorId" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

CREATE TABLE IF NOT EXISTS "ProfileDocument" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "fileName" TEXT,
  "fileUrl" TEXT,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "uploadedById" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfileDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProfileEditRequest" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "fields" JSONB NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewComment" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfileEditRequest_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProfileDocument_schoolId_fkey') THEN
    ALTER TABLE "ProfileDocument" ADD CONSTRAINT "ProfileDocument_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProfileDocument_userId_fkey') THEN
    ALTER TABLE "ProfileDocument" ADD CONSTRAINT "ProfileDocument_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProfileDocument_uploadedById_fkey') THEN
    ALTER TABLE "ProfileDocument" ADD CONSTRAINT "ProfileDocument_uploadedById_fkey"
      FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProfileEditRequest_schoolId_fkey') THEN
    ALTER TABLE "ProfileEditRequest" ADD CONSTRAINT "ProfileEditRequest_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProfileEditRequest_targetUserId_fkey') THEN
    ALTER TABLE "ProfileEditRequest" ADD CONSTRAINT "ProfileEditRequest_targetUserId_fkey"
      FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProfileEditRequest_requestedById_fkey') THEN
    ALTER TABLE "ProfileEditRequest" ADD CONSTRAINT "ProfileEditRequest_requestedById_fkey"
      FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProfileEditRequest_reviewedById_fkey') THEN
    ALTER TABLE "ProfileEditRequest" ADD CONSTRAINT "ProfileEditRequest_reviewedById_fkey"
      FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ProfileDocument_schoolId_userId_deletedAt_idx" ON "ProfileDocument"("schoolId", "userId", "deletedAt");
CREATE INDEX IF NOT EXISTS "ProfileDocument_schoolId_type_verificationStatus_idx" ON "ProfileDocument"("schoolId", "type", "verificationStatus");
CREATE INDEX IF NOT EXISTS "ProfileEditRequest_schoolId_targetUserId_status_idx" ON "ProfileEditRequest"("schoolId", "targetUserId", "status");
CREATE INDEX IF NOT EXISTS "ProfileEditRequest_schoolId_requestedById_createdAt_idx" ON "ProfileEditRequest"("schoolId", "requestedById", "createdAt");
CREATE INDEX IF NOT EXISTS "ProfileEditRequest_schoolId_status_createdAt_idx" ON "ProfileEditRequest"("schoolId", "status", "createdAt");
