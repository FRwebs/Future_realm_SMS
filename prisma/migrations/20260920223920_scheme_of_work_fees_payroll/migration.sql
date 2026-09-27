-- Made idempotent after a production deploy failed on 42710 "type already
-- exists". That database was built with `prisma db push` before this migration
-- existed, so it already holds every object below. The guards let the migration
-- apply cleanly whether an object is there or not, and re-running it is a no-op.

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "SchemeOfWorkStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "SchemeOfWorkWeekType" AS ENUM ('TEACHING', 'REVISION', 'EXAM', 'HOLIDAY', 'ACTIVITY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TopicUnderstanding" AS ENUM ('EXCELLENT', 'GOOD', 'AVERAGE', 'BELOW_AVERAGE', 'POOR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "FeeAssignmentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'PROCESSED', 'PUBLISHED', 'REVERSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DropIndex
DROP INDEX IF EXISTS "FeeStructure_schoolId_academicSessionId_termId_classId_isAc_idx";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS     "ipAddress" TEXT,
ADD COLUMN IF NOT EXISTS     "newValue" JSONB,
ADD COLUMN IF NOT EXISTS     "oldValue" JSONB;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS     "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS     "paidTo" TEXT,
ADD COLUMN IF NOT EXISTS     "paymentMethod" TEXT,
ADD COLUMN IF NOT EXISTS     "receiptUrl" TEXT,
ADD COLUMN IF NOT EXISTS     "recordedById" TEXT;

-- AlterTable
ALTER TABLE "FeeStructure" ADD COLUMN IF NOT EXISTS     "createdById" TEXT,
ADD COLUMN IF NOT EXISTS     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LessonPlan" ADD COLUMN IF NOT EXISTS     "schemeOfWorkId" TEXT,
ADD COLUMN IF NOT EXISTS     "sowTopicId" TEXT;

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS     "subjectCategoryId" TEXT;

-- AlterTable
ALTER TABLE "fee_items" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payment_gateways_config" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SubjectCategory" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SchemeOfWork" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "teacherId" TEXT,
    "status" "SchemeOfWorkStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "returnReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchemeOfWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SowTopic" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "schemeOfWorkId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "subtopics" JSONB,
    "behaviouralObjectives" TEXT,
    "content" TEXT,
    "teachingMethods" JSONB,
    "teachingAids" JSONB,
    "referenceMaterials" JSONB,
    "evaluation" TEXT,
    "assignment" TEXT,
    "isCovered" BOOLEAN NOT NULL DEFAULT false,
    "coveredDate" TIMESTAMP(3),
    "coveredById" TEXT,
    "actualTopicTaught" TEXT,
    "coverageNotes" TEXT,
    "weekType" "SchemeOfWorkWeekType" NOT NULL DEFAULT 'TEACHING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SowTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SowTopicResource" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sowTopicId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "filePath" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SowTopicResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StudentTopicProgress" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sowTopicId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "understanding" "TopicUnderstanding",
    "assessedById" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "StudentTopicProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FeeAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "academicSessionId" TEXT,
    "termId" TEXT,
    "amountDue" DECIMAL(15,2) NOT NULL,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "finalAmount" DECIMAL(15,2) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "FeeAssignmentStatus" NOT NULL DEFAULT 'UNPAID',
    "discountReason" TEXT,
    "approvalStatus" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PayrollRun" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSessionId" TEXT,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "processedById" TEXT,
    "processedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PayrollItem" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "basicSalary" DECIMAL(15,2) NOT NULL,
    "allowances" JSONB,
    "deductions" JSONB,
    "netSalary" DECIMAL(15,2) NOT NULL,
    "payslipSent" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BudgetAllocation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "academicSessionId" TEXT,
    "allocatedAmount" DECIMAL(15,2) NOT NULL,
    "spentAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SubjectCategory_schoolId_sortOrder_idx" ON "SubjectCategory"("schoolId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SubjectCategory_schoolId_name_key" ON "SubjectCategory"("schoolId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchemeOfWork_schoolId_termId_status_idx" ON "SchemeOfWork"("schoolId", "termId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchemeOfWork_schoolId_teacherId_termId_idx" ON "SchemeOfWork"("schoolId", "teacherId", "termId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchemeOfWork_schoolId_classId_subjectId_idx" ON "SchemeOfWork"("schoolId", "classId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SchemeOfWork_subjectId_classId_termId_key" ON "SchemeOfWork"("subjectId", "classId", "termId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SowTopic_schoolId_schemeOfWorkId_isCovered_idx" ON "SowTopic"("schoolId", "schemeOfWorkId", "isCovered");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SowTopic_schoolId_weekType_weekNumber_idx" ON "SowTopic"("schoolId", "weekType", "weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SowTopic_schemeOfWorkId_weekNumber_key" ON "SowTopic"("schemeOfWorkId", "weekNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SowTopicResource_schoolId_sowTopicId_createdAt_idx" ON "SowTopicResource"("schoolId", "sowTopicId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StudentTopicProgress_schoolId_studentId_assessedAt_idx" ON "StudentTopicProgress"("schoolId", "studentId", "assessedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StudentTopicProgress_sowTopicId_studentId_key" ON "StudentTopicProgress"("sowTopicId", "studentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FeeAssignment_schoolId_studentId_status_idx" ON "FeeAssignment"("schoolId", "studentId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FeeAssignment_schoolId_academicSessionId_termId_idx" ON "FeeAssignment"("schoolId", "academicSessionId", "termId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FeeAssignment_schoolId_feeStructureId_idx" ON "FeeAssignment"("schoolId", "feeStructureId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PayrollRun_schoolId_status_year_month_idx" ON "PayrollRun"("schoolId", "status", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollRun_schoolId_month_year_key" ON "PayrollRun"("schoolId", "month", "year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PayrollItem_schoolId_payrollRunId_idx" ON "PayrollItem"("schoolId", "payrollRunId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PayrollItem_schoolId_staffId_idx" ON "PayrollItem"("schoolId", "staffId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BudgetAllocation_schoolId_department_idx" ON "BudgetAllocation"("schoolId", "department");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BudgetAllocation_schoolId_academicSessionId_idx" ON "BudgetAllocation"("schoolId", "academicSessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Expense_schoolId_category_expenseDate_idx" ON "Expense"("schoolId", "category", "expenseDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FeeStructure_schoolId_academicSessionId_termId_classId_isAc_idx" ON "FeeStructure"("schoolId", "academicSessionId", "termId", "classId", "isActive", "deletedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Subject_schoolId_subjectCategoryId_idx" ON "Subject"("schoolId", "subjectCategoryId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "SubjectCategory" ADD CONSTRAINT "SubjectCategory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Subject" ADD CONSTRAINT "Subject_subjectCategoryId_fkey" FOREIGN KEY ("subjectCategoryId") REFERENCES "SubjectCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "SowTopic" ADD CONSTRAINT "SowTopic_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "SowTopic" ADD CONSTRAINT "SowTopic_schemeOfWorkId_fkey" FOREIGN KEY ("schemeOfWorkId") REFERENCES "SchemeOfWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "SowTopic" ADD CONSTRAINT "SowTopic_coveredById_fkey" FOREIGN KEY ("coveredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "SowTopicResource" ADD CONSTRAINT "SowTopicResource_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "SowTopicResource" ADD CONSTRAINT "SowTopicResource_sowTopicId_fkey" FOREIGN KEY ("sowTopicId") REFERENCES "SowTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "SowTopicResource" ADD CONSTRAINT "SowTopicResource_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "StudentTopicProgress" ADD CONSTRAINT "StudentTopicProgress_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "StudentTopicProgress" ADD CONSTRAINT "StudentTopicProgress_sowTopicId_fkey" FOREIGN KEY ("sowTopicId") REFERENCES "SowTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "StudentTopicProgress" ADD CONSTRAINT "StudentTopicProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "StudentTopicProgress" ADD CONSTRAINT "StudentTopicProgress_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "FeeAssignment" ADD CONSTRAINT "FeeAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "FeeAssignment" ADD CONSTRAINT "FeeAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "FeeAssignment" ADD CONSTRAINT "FeeAssignment_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "FeeStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "FeeAssignment" ADD CONSTRAINT "FeeAssignment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "FeeAssignment" ADD CONSTRAINT "FeeAssignment_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "FeeAssignment" ADD CONSTRAINT "FeeAssignment_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "BudgetAllocation" ADD CONSTRAINT "BudgetAllocation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "BudgetAllocation" ADD CONSTRAINT "BudgetAllocation_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "LessonPlan" ADD CONSTRAINT "LessonPlan_schemeOfWorkId_fkey" FOREIGN KEY ("schemeOfWorkId") REFERENCES "SchemeOfWork"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "LessonPlan" ADD CONSTRAINT "LessonPlan_sowTopicId_fkey" FOREIGN KEY ("sowTopicId") REFERENCES "SowTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- RenameIndex
DO $$ BEGIN
    ALTER INDEX "fee_items_schoolId_academicSessionId_termId_classId_isActive_id" RENAME TO "fee_items_schoolId_academicSessionId_termId_classId_isActiv_idx";
EXCEPTION WHEN undefined_table THEN NULL;
    WHEN undefined_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

-- RenameIndex
DO $$ BEGIN
    ALTER INDEX "student_scholarships_scholarshipId_studentId_academicSessionId_" RENAME TO "student_scholarships_scholarshipId_studentId_academicSessio_key";
EXCEPTION WHEN undefined_table THEN NULL;
    WHEN undefined_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;
