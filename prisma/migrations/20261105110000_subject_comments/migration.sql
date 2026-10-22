-- CreateTable
CREATE TABLE "SubjectComment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubjectComment_schoolId_termId_classId_subjectId_idx" ON "SubjectComment"("schoolId", "termId", "classId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectComment_termId_subjectId_studentId_key" ON "SubjectComment"("termId", "subjectId", "studentId");

-- AddForeignKey
ALTER TABLE "SubjectComment" ADD CONSTRAINT "SubjectComment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

