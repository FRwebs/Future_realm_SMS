-- AlterTable
ALTER TABLE "School" ADD COLUMN     "sampleDataClearedAt" TIMESTAMP(3),
ADD COLUMN     "sampleDataLoadedAt" TIMESTAMP(3),
ADD COLUMN     "trialStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN     "userCode" TEXT;

-- CreateTable
CREATE TABLE "PasswordHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolJoinRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "nameClaimed" TEXT NOT NULL,
    "subjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "levels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasswordHistory_userId_createdAt_idx" ON "PasswordHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SchoolJoinRequest_schoolId_status_idx" ON "SchoolJoinRequest"("schoolId", "status");

-- CreateIndex
CREATE INDEX "SchoolJoinRequest_userId_idx" ON "SchoolJoinRequest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_userCode_key" ON "User"("userCode");

-- AddForeignKey
ALTER TABLE "PasswordHistory" ADD CONSTRAINT "PasswordHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolJoinRequest" ADD CONSTRAINT "SchoolJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolJoinRequest" ADD CONSTRAINT "SchoolJoinRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

