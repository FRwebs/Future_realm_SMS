-- CreateTable
CREATE TABLE "InternalProfile" (
    "userId" TEXT NOT NULL,
    "departmentId" TEXT,
    "level" TEXT,
    "scopeStates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "managerId" TEXT,
    "staffNumber" TEXT,
    "isExternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "InternalAnomaly" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "InternalAnomaly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InternalAnomaly_status_detectedAt_idx" ON "InternalAnomaly"("status", "detectedAt");

-- CreateIndex
CREATE INDEX "InternalAnomaly_userId_kind_detectedAt_idx" ON "InternalAnomaly"("userId", "kind", "detectedAt");

