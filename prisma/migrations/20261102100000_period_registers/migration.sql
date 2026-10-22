-- A register taken for one period by the teacher who teaches it. Subordinate to the daily register.
CREATE TABLE "PeriodRegister" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "draft" JSONB,
    "markedById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "roll" INTEGER NOT NULL DEFAULT 0,
    "inPeriod" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodRegister_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PeriodRegister_classId_date_periodNumber_key" ON "PeriodRegister"("classId", "date", "periodNumber");
CREATE INDEX "PeriodRegister_schoolId_markedById_date_idx" ON "PeriodRegister"("schoolId", "markedById", "date");
CREATE INDEX "PeriodRegister_schoolId_termId_subjectId_idx" ON "PeriodRegister"("schoolId", "termId", "subjectId");

ALTER TABLE "PeriodRegister" ADD CONSTRAINT "PeriodRegister_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
