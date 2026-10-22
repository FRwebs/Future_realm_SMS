-- A worry about a child, raised by any member of staff, read by the safeguarding lead and nobody else.
CREATE TABLE "SafeguardingConcern" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "leadId" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafeguardingConcern_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SafeguardingConcern_schoolId_status_createdAt_idx" ON "SafeguardingConcern"("schoolId", "status", "createdAt");
CREATE INDEX "SafeguardingConcern_schoolId_studentId_idx" ON "SafeguardingConcern"("schoolId", "studentId");

ALTER TABLE "SafeguardingConcern" ADD CONSTRAINT "SafeguardingConcern_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
