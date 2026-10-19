-- AlterTable
ALTER TABLE "ReportCard" ADD COLUMN     "deliveryState" TEXT,
ADD COLUMN     "publishedById" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "withheldAt" TIMESTAMP(3),
ADD COLUMN     "withheldById" TEXT,
ADD COLUMN     "withheldReason" TEXT;

-- CreateTable
CREATE TABLE "ReportRemark" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "classId" TEXT,
    "author" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "tone" TEXT,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "state" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "authorId" TEXT NOT NULL,
    "onBehalf" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportRemark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportCardRevision" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdById" TEXT,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportCardRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardBatch" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "cards" INTEGER NOT NULL,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "byId" TEXT NOT NULL,
    "cardIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportRemark_schoolId_termId_classId_idx" ON "ReportRemark"("schoolId", "termId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportRemark_studentId_termId_author_key" ON "ReportRemark"("studentId", "termId", "author");

-- CreateIndex
CREATE INDEX "ReportCardRevision_schoolId_cardId_revision_idx" ON "ReportCardRevision"("schoolId", "cardId", "revision");

-- CreateIndex
CREATE INDEX "ReportCardRevision_schoolId_termId_idx" ON "ReportCardRevision"("schoolId", "termId");

-- CreateIndex
CREATE INDEX "CardBatch_schoolId_termId_createdAt_idx" ON "CardBatch"("schoolId", "termId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReportRemark" ADD CONSTRAINT "ReportRemark_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardRevision" ADD CONSTRAINT "ReportCardRevision_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardBatch" ADD CONSTRAINT "CardBatch_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

