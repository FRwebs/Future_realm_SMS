-- CreateTable
CREATE TABLE "TeacherApproach" (
    "id" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "teacherIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'LISTED',
    "dealId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherApproach_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherApproach_schoolName_idx" ON "TeacherApproach"("schoolName");

