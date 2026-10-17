-- AlterEnum
ALTER TYPE "InvoiceAdjustmentType" ADD VALUE 'WRITE_OFF';

-- AlterTable
ALTER TABLE "FeeStructure" ADD COLUMN     "allClasses" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'Day',
ADD COLUMN     "ref" TEXT;

-- AlterTable
ALTER TABLE "FeeStructureItem" ADD COLUMN     "frequency" TEXT NOT NULL DEFAULT 'Termly',
ADD COLUMN     "itemType" TEXT NOT NULL DEFAULT 'Mandatory';

-- CreateTable
CREATE TABLE "FeeStructureLevel" (
    "id" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "classLevelId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'Day',

    CONSTRAINT "FeeStructureLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeContact" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "guardianId" TEXT,
    "studentId" TEXT,
    "kind" TEXT NOT NULL,
    "channel" TEXT,
    "summary" TEXT NOT NULL,
    "detail" JSONB,
    "meetingAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashUpDay" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "countedAmount" DECIMAL(15,2),
    "note" TEXT,
    "countedById" TEXT,
    "countedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "CashUpDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeeStructureLevel_classLevelId_kind_idx" ON "FeeStructureLevel"("classLevelId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "FeeStructureLevel_feeStructureId_classLevelId_key" ON "FeeStructureLevel"("feeStructureId", "classLevelId");

-- CreateIndex
CREATE INDEX "FeeContact_schoolId_guardianId_createdAt_idx" ON "FeeContact"("schoolId", "guardianId", "createdAt");

-- CreateIndex
CREATE INDEX "FeeContact_schoolId_kind_createdAt_idx" ON "FeeContact"("schoolId", "kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashUpDay_schoolId_day_key" ON "CashUpDay"("schoolId", "day");

-- AddForeignKey
ALTER TABLE "FeeStructureLevel" ADD CONSTRAINT "FeeStructureLevel_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "FeeStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructureLevel" ADD CONSTRAINT "FeeStructureLevel_classLevelId_fkey" FOREIGN KEY ("classLevelId") REFERENCES "ClassLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeContact" ADD CONSTRAINT "FeeContact_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashUpDay" ADD CONSTRAINT "CashUpDay_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

