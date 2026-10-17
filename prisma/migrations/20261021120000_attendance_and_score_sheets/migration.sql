-- AlterTable
ALTER TABLE "StudentAttendance" ADD COLUMN     "evidence" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "markedAt" TIMESTAMP(3),
ADD COLUMN     "reasonCode" TEXT;

-- CreateTable
CREATE TABLE "AttendanceRegister" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "draft" JSONB,
    "markedById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "roll" INTEGER NOT NULL DEFAULT 0,
    "late" BOOLEAN NOT NULL DEFAULT false,
    "backdated" BOOLEAN NOT NULL DEFAULT false,
    "backdateReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRegister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCorrection" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "evidence" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCase" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "classId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAtRate" DOUBLE PRECISION NOT NULL,
    "automatic" BOOLEAN NOT NULL DEFAULT true,
    "openedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "outcome" TEXT,
    "outcomeNote" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,

    CONSTRAINT "AttendanceCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreSheet" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "framework" JSONB NOT NULL,
    "frameworkAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "absences" JSONB NOT NULL DEFAULT '{}',
    "flagOutcomes" JSONB NOT NULL DEFAULT '{}',
    "enteredByIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "returnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreCorrection" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sheetId" TEXT,
    "componentId" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "fromScore" DOUBLE PRECISION,
    "toScore" DOUBLE PRECISION NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "evidence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AWAITING',
    "reachedParent" BOOLEAN NOT NULL DEFAULT false,
    "requestedById" TEXT NOT NULL,
    "stepOneById" TEXT,
    "stepOneAt" TIMESTAMP(3),
    "stepOneNote" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "effect" JSONB,
    "revision" INTEGER,
    "approvalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceRegister_schoolId_date_idx" ON "AttendanceRegister"("schoolId", "date");

-- CreateIndex
CREATE INDEX "AttendanceRegister_schoolId_markedById_date_idx" ON "AttendanceRegister"("schoolId", "markedById", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRegister_classId_date_key" ON "AttendanceRegister"("classId", "date");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_schoolId_status_createdAt_idx" ON "AttendanceCorrection"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_schoolId_studentId_date_idx" ON "AttendanceCorrection"("schoolId", "studentId", "date");

-- CreateIndex
CREATE INDEX "AttendanceCase_schoolId_status_idx" ON "AttendanceCase"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceCase_studentId_termId_key" ON "AttendanceCase"("studentId", "termId");

-- CreateIndex
CREATE INDEX "ScoreSheet_schoolId_termId_status_idx" ON "ScoreSheet"("schoolId", "termId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreSheet_termId_classId_subjectId_key" ON "ScoreSheet"("termId", "classId", "subjectId");

-- CreateIndex
CREATE INDEX "ScoreCorrection_schoolId_status_createdAt_idx" ON "ScoreCorrection"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ScoreCorrection_schoolId_classId_subjectId_idx" ON "ScoreCorrection"("schoolId", "classId", "subjectId");

-- AddForeignKey
ALTER TABLE "AttendanceRegister" ADD CONSTRAINT "AttendanceRegister_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCase" ADD CONSTRAINT "AttendanceCase_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreSheet" ADD CONSTRAINT "ScoreSheet_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreCorrection" ADD CONSTRAINT "ScoreCorrection_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: every day an arm already has marks for was a register that was taken. Marks that
-- predate the clock have no time, so they are never counted late or on time.
INSERT INTO "AttendanceRegister" ("id", "schoolId", "classId", "termId", "date", "status", "markedById", "startedAt", "submittedAt", "roll", "updatedAt")
SELECT 'reg' || substr(md5(a."classId" || a."date"::text || random()::text), 1, 22),
       a."schoolId", a."classId", min(a."termId"), a."date", 'SUBMITTED', min(a."markedById"),
       a."date", NULL, count(*)::int, CURRENT_TIMESTAMP
FROM "StudentAttendance" a
WHERE a."subjectId" IS NULL
GROUP BY a."schoolId", a."classId", a."date"
ON CONFLICT ("classId", "date") DO NOTHING;

-- Backfill: each subject in each arm that already has scores becomes a sheet, pinned to the
-- components its scores were actually entered under, and as far along as its result sheets are.
INSERT INTO "ScoreSheet" ("id", "schoolId", "termId", "classId", "subjectId", "status", "framework", "enteredByIds", "submittedById", "submittedAt", "decidedById", "decidedAt", "updatedAt")
SELECT 'sht' || substr(md5(rs."classId" || se."subjectId" || rs."termId" || random()::text), 1, 22),
       rs."schoolId", rs."termId", rs."classId", se."subjectId",
       CASE
         WHEN bool_or(rs."status" = 'DRAFT') THEN 'IN_PROGRESS'
         WHEN bool_or(rs."status" IN ('RETURNED', 'REJECTED')) THEN 'RETURNED'
         WHEN bool_or(rs."status" IN ('SUBMITTED', 'UNDER_REVIEW')) THEN 'SUBMITTED'
         ELSE 'APPROVED'
       END,
       (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', c."id", 'code', c."code", 'name', c."name", 'max', c."maxScore", 'weight', c."weight") ORDER BY c."order"), '[]'::jsonb)
          FROM "AssessmentComponent" c
         WHERE c."id" IN (SELECT DISTINCT se2."assessmentComponentId" FROM "ScoreEntry" se2
                           JOIN "ResultSheet" rs2 ON rs2."id" = se2."resultSheetId"
                          WHERE rs2."classId" = rs."classId" AND rs2."termId" = rs."termId" AND se2."subjectId" = se."subjectId")),
       COALESCE(array_agg(DISTINCT se."enteredById"), ARRAY[]::text[]),
       min(se."enteredById"),
       min(se."submittedAt"),
       max(rs."approvedById"),
       max(rs."approvedAt"),
       CURRENT_TIMESTAMP
FROM "ScoreEntry" se
JOIN "ResultSheet" rs ON rs."id" = se."resultSheetId"
GROUP BY rs."schoolId", rs."termId", rs."classId", se."subjectId"
ON CONFLICT ("termId", "classId", "subjectId") DO NOTHING;
