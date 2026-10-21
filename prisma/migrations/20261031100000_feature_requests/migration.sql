-- CreateTable
CREATE TABLE "FeatureRequestLog" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "module" TEXT,
    "schoolId" TEXT NOT NULL,
    "personName" TEXT,
    "channel" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "blocksRenewal" BOOLEAN NOT NULL DEFAULT false,
    "raisedOn" TIMESTAMP(3) NOT NULL,
    "mergedIntoId" TEXT,
    "tellSchool" BOOLEAN NOT NULL DEFAULT true,
    "roadmapFlag" BOOLEAN NOT NULL DEFAULT false,
    "ticketRef" TEXT,
    "loggedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeatureRequestLog_mergedIntoId_idx" ON "FeatureRequestLog"("mergedIntoId");

-- CreateIndex
CREATE INDEX "FeatureRequestLog_schoolId_idx" ON "FeatureRequestLog"("schoolId");
