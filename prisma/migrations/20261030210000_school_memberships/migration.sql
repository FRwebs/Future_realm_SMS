-- CreateTable
CREATE TABLE "SchoolMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "invitedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "SchoolMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolMembership_schoolId_status_idx" ON "SchoolMembership"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolMembership_userId_schoolId_key" ON "SchoolMembership"("userId", "schoolId");

