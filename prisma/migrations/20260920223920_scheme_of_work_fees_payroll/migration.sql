-- CreateEnum
CREATE TYPE "SchemeOfWorkStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED');

-- CreateEnum
CREATE TYPE "SchemeOfWorkWeekType" AS ENUM ('TEACHING', 'REVISION', 'EXAM', 'HOLIDAY', 'ACTIVITY');

-- CreateEnum
CREATE TYPE "TopicUnderstanding" AS ENUM ('EXCELLENT', 'GOOD', 'AVERAGE', 'BELOW_AVERAGE', 'POOR');

-- CreateEnum
CREATE TYPE "FeeAssignmentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'PROCESSED', 'PUBLISHED', 'REVERSED');

-- DropIndex
DROP INDEX "FeeStructure_schoolId_academicSessionId_termId_classId_isAc_idx";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "newValue" JSONB,
ADD COLUMN     "oldValue" JSONB;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "paidTo" TEXT,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "receiptUrl" TEXT,
ADD COLUMN     "recordedById" TEXT;

-- AlterTable
ALTER TABLE "FeeStructure" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LessonPlan" ADD COLUMN     "schemeOfWorkId" TEXT,
ADD COLUMN     "sowTopicId" TEXT;

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "subjectCategoryId" TEXT;

-- AlterTable
ALTER TABLE "fee_items" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payment_gateways_config" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "SubjectCategory" (
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
CREATE TABLE "SchemeOfWork" (
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
CREATE TABLE "SowTopic" (
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
CREATE TABLE "SowTopicResource" (
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
CREATE TABLE "StudentTopicProgress" (
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
CREATE TABLE "FeeAssignment" (
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
CREATE TABLE "PayrollRun" (
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
CREATE TABLE "PayrollItem" (
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
CREATE TABLE "BudgetAllocation" (
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
CREATE INDEX "SubjectCategory_schoolId_sortOrder_idx" ON "SubjectCategory"("schoolId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectCategory_schoolId_name_key" ON "SubjectCategory"("schoolId", "name");

-- CreateIndex
CREATE INDEX "SchemeOfWork_schoolId_termId_status_idx" ON "SchemeOfWork"("schoolId", "termId", "status");

-- CreateIndex
CREATE INDEX "SchemeOfWork_schoolId_teacherId_termId_idx" ON "SchemeOfWork"("schoolId", "teacherId", "termId");

-- CreateIndex
CREATE INDEX "SchemeOfWork_schoolId_classId_subjectId_idx" ON "SchemeOfWork"("schoolId", "classId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "SchemeOfWork_subjectId_classId_termId_key" ON "SchemeOfWork"("subjectId", "classId", "termId");

-- CreateIndex
CREATE INDEX "SowTopic_schoolId_schemeOfWorkId_isCovered_idx" ON "SowTopic"("schoolId", "schemeOfWorkId", "isCovered");

-- CreateIndex
CREATE INDEX "SowTopic_schoolId_weekType_weekNumber_idx" ON "SowTopic"("schoolId", "weekType", "weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SowTopic_schemeOfWorkId_weekNumber_key" ON "SowTopic"("schemeOfWorkId", "weekNumber");

-- CreateIndex
CREATE INDEX "SowTopicResource_schoolId_sowTopicId_createdAt_idx" ON "SowTopicResource"("schoolId", "sowTopicId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentTopicProgress_schoolId_studentId_assessedAt_idx" ON "StudentTopicProgress"("schoolId", "studentId", "assessedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentTopicProgress_sowTopicId_studentId_key" ON "StudentTopicProgress"("sowTopicId", "studentId");

-- CreateIndex
CREATE INDEX "FeeAssignment_schoolId_studentId_status_idx" ON "FeeAssignment"("schoolId", "studentId", "status");

-- CreateIndex
CREATE INDEX "FeeAssignment_schoolId_academicSessionId_termId_idx" ON "FeeAssignment"("schoolId", "academicSessionId", "termId");

-- CreateIndex
CREATE INDEX "FeeAssignment_schoolId_feeStructureId_idx" ON "FeeAssignment"("schoolId", "feeStructureId");

-- CreateIndex
CREATE INDEX "PayrollRun_schoolId_status_year_month_idx" ON "PayrollRun"("schoolId", "status", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_schoolId_month_year_key" ON "PayrollRun"("schoolId", "month", "year");

-- CreateIndex
CREATE INDEX "PayrollItem_schoolId_payrollRunId_idx" ON "PayrollItem"("schoolId", "payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollItem_schoolId_staffId_idx" ON "PayrollItem"("schoolId", "staffId");

-- CreateIndex
CREATE INDEX "BudgetAllocation_schoolId_department_idx" ON "BudgetAllocation"("schoolId", "department");

-- CreateIndex
CREATE INDEX "BudgetAllocation_schoolId_academicSessionId_idx" ON "BudgetAllocation"("schoolId", "academicSessionId");

-- CreateIndex
CREATE INDEX "Expense_schoolId_category_expenseDate_idx" ON "Expense"("schoolId", "category", "expenseDate");

-- CreateIndex
CREATE INDEX "FeeStructure_schoolId_academicSessionId_termId_classId_isAc_idx" ON "FeeStructure"("schoolId", "academicSessionId", "termId", "classId", "isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "Subject_schoolId_subjectCategoryId_idx" ON "Subject"("schoolId", "subjectCategoryId");

-- AddForeignKey
ALTER TABLE "SubjectCategory" ADD CONSTRAINT "SubjectCategory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_subjectCategoryId_fkey" FOREIGN KEY ("subjectCategoryId") REFERENCES "SubjectCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SowTopic" ADD CONSTRAINT "SowTopic_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SowTopic" ADD CONSTRAINT "SowTopic_schemeOfWorkId_fkey" FOREIGN KEY ("schemeOfWorkId") REFERENCES "SchemeOfWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SowTopic" ADD CONSTRAINT "SowTopic_coveredById_fkey" FOREIGN KEY ("coveredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SowTopicResource" ADD CONSTRAINT "SowTopicResource_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SowTopicResource" ADD CONSTRAINT "SowTopicResource_sowTopicId_fkey" FOREIGN KEY ("sowTopicId") REFERENCES "SowTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SowTopicResource" ADD CONSTRAINT "SowTopicResource_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTopicProgress" ADD CONSTRAINT "StudentTopicProgress_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTopicProgress" ADD CONSTRAINT "StudentTopicProgress_sowTopicId_fkey" FOREIGN KEY ("sowTopicId") REFERENCES "SowTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTopicProgress" ADD CONSTRAINT "StudentTopicProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTopicProgress" ADD CONSTRAINT "StudentTopicProgress_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAssignment" ADD CONSTRAINT "FeeAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAssignment" ADD CONSTRAINT "FeeAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAssignment" ADD CONSTRAINT "FeeAssignment_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "FeeStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAssignment" ADD CONSTRAINT "FeeAssignment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAssignment" ADD CONSTRAINT "FeeAssignment_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAssignment" ADD CONSTRAINT "FeeAssignment_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAllocation" ADD CONSTRAINT "BudgetAllocation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAllocation" ADD CONSTRAINT "BudgetAllocation_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPlan" ADD CONSTRAINT "LessonPlan_schemeOfWorkId_fkey" FOREIGN KEY ("schemeOfWorkId") REFERENCES "SchemeOfWork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPlan" ADD CONSTRAINT "LessonPlan_sowTopicId_fkey" FOREIGN KEY ("sowTopicId") REFERENCES "SowTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "fee_items_schoolId_academicSessionId_termId_classId_isActive_id" RENAME TO "fee_items_schoolId_academicSessionId_termId_classId_isActiv_idx";

-- RenameIndex
ALTER INDEX "student_scholarships_scholarshipId_studentId_academicSessionId_" RENAME TO "student_scholarships_scholarshipId_studentId_academicSessio_key";
