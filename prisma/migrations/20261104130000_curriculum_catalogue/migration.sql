-- CreateTable
CREATE TABLE "CurriculumCatalogueEntry" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "curriculum" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "term" INTEGER NOT NULL,
    "source" TEXT,
    "book" TEXT,
    "topics" JSONB NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1',
    "importedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumCatalogueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CurriculumCatalogueEntry_scopeKey_idx" ON "CurriculumCatalogueEntry"("scopeKey");

-- CreateIndex
CREATE INDEX "CurriculumCatalogueEntry_subject_stage_idx" ON "CurriculumCatalogueEntry"("subject", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumCatalogueEntry_scopeKey_curriculum_subject_stage__key" ON "CurriculumCatalogueEntry"("scopeKey", "curriculum", "subject", "stage", "term");

