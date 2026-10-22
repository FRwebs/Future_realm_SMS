-- CreateTable
CREATE TABLE "ChildObservation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "halfTerm" INTEGER NOT NULL,
    "areas" JSONB NOT NULL,
    "note" TEXT,
    "observedById" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChildObservation_schoolId_classId_termId_idx" ON "ChildObservation"("schoolId", "classId", "termId");

-- CreateIndex
CREATE INDEX "ChildObservation_studentId_termId_idx" ON "ChildObservation"("studentId", "termId");

-- AddForeignKey
ALTER TABLE "ChildObservation" ADD CONSTRAINT "ChildObservation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

