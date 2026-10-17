-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "cover" TEXT,
ADD COLUMN     "coverState" TEXT NOT NULL DEFAULT 'Not arranged',
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "days" INTEGER,
ADD COLUMN     "decidedById" TEXT,
ADD COLUMN     "decisionNote" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'REQUEST',
ADD COLUMN     "stage" TEXT;

-- AlterTable
ALTER TABLE "PayrollItem" ADD COLUMN     "bandCode" TEXT,
ADD COLUMN     "method" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "statusNote" TEXT,
ADD COLUMN     "step" INTEGER;

-- AlterTable
ALTER TABLE "StaffAppraisalRating" ADD COLUMN     "autoScore" DOUBLE PRECISION,
ADD COLUMN     "evidence" TEXT,
ADD COLUMN     "selfScore" INTEGER,
ADD COLUMN     "weight" INTEGER;

-- AlterTable
ALTER TABLE "StaffProfile" ADD COLUMN     "payBandId" TEXT,
ADD COLUMN     "payMappedAt" TIMESTAMP(3),
ADD COLUMN     "payMethod" TEXT,
ADD COLUMN     "payStep" INTEGER;

-- CreateTable
CREATE TABLE "PayBand" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "covers" TEXT NOT NULL,
    "coversGroup" TEXT NOT NULL DEFAULT 'Other',
    "steps" JSONB NOT NULL,
    "allowances" JSONB NOT NULL,
    "employerPension" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "nextReview" TIMESTAMP(3),
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OffCyclePayment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "payOn" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "recover" TEXT NOT NULL DEFAULT 'Not recoverable',
    "statutory" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_APPROVAL',
    "createdById" TEXT,
    "approvedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OffCyclePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayBand_schoolId_isOpen_idx" ON "PayBand"("schoolId", "isOpen");

-- CreateIndex
CREATE UNIQUE INDEX "PayBand_schoolId_code_key" ON "PayBand"("schoolId", "code");

-- CreateIndex
CREATE INDEX "OffCyclePayment_schoolId_status_payOn_idx" ON "OffCyclePayment"("schoolId", "status", "payOn");

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_payBandId_fkey" FOREIGN KEY ("payBandId") REFERENCES "PayBand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayBand" ADD CONSTRAINT "PayBand_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffCyclePayment" ADD CONSTRAINT "OffCyclePayment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffCyclePayment" ADD CONSTRAINT "OffCyclePayment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

