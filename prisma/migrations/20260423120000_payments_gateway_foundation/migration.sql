-- Extend existing finance primitives instead of replacing the MVP finance module.

DO $$ BEGIN
  ALTER TYPE "PaymentMethod" ADD VALUE 'BANK_TRANSFER';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "PaymentMethod" ADD VALUE 'USSD';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "PaymentMethod" ADD VALUE 'CHEQUE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "PaymentMethod" ADD VALUE 'SCHOLARSHIP';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "PaymentMethod" ADD VALUE 'WAIVER';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LateFeeType" AS ENUM ('FIXED', 'PERCENTAGE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentGatewayProvider" AS ENUM ('PAYSTACK', 'FLUTTERWAVE', 'REMITA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GatewayTransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'ABANDONED', 'REVERSED', 'REFUNDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FeeWaiverStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FeeWaiverType" AS ENUM ('FULL', 'PARTIAL', 'PERCENTAGE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ScholarshipType" AS ENUM ('FULL', 'PARTIAL', 'PERCENTAGE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "classId" TEXT,
  ADD COLUMN IF NOT EXISTS "academicSessionId" TEXT,
  ADD COLUMN IF NOT EXISTS "termId" TEXT;

ALTER TABLE "InvoiceItem"
  ADD COLUMN IF NOT EXISTS "feeItemId" TEXT,
  ADD COLUMN IF NOT EXISTS "feeCategoryId" TEXT,
  ADD COLUMN IF NOT EXISTS "isWaived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "waiverReason" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "reversedById" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentChannel" TEXT,
  ADD COLUMN IF NOT EXISTS "gateway" "PaymentGatewayProvider",
  ADD COLUMN IF NOT EXISTS "gatewayReference" TEXT,
  ADD COLUMN IF NOT EXISTS "gatewayStatus" "GatewayTransactionStatus",
  ADD COLUMN IF NOT EXISTS "schoolBankReference" TEXT,
  ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "isReversed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Receipt"
  ADD COLUMN IF NOT EXISTS "filePath" TEXT,
  ADD COLUMN IF NOT EXISTS "sentToParent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "fee_categories" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isMandatory" BOOLEAN NOT NULL DEFAULT true,
  "isRecurring" BOOLEAN NOT NULL DEFAULT true,
  "appliesToCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "fee_items" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "feeCategoryId" TEXT NOT NULL,
  "classId" TEXT,
  "classLevel" TEXT,
  "classCategory" TEXT,
  "academicSessionId" TEXT,
  "termId" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "dueDate" TIMESTAMP(3),
  "lateFeeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "lateFeeType" "LateFeeType" NOT NULL DEFAULT 'FIXED',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "fee_waivers" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "feeItemId" TEXT,
  "invoiceItemId" TEXT,
  "feeCategoryId" TEXT,
  "waiverType" "FeeWaiverType" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "percentage" DECIMAL(5,2),
  "reason" TEXT NOT NULL,
  "requestedById" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "status" "FeeWaiverStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_waivers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "scholarships" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" "ScholarshipType" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "percentage" DECIMAL(5,2),
  "fundedBy" TEXT,
  "conditions" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scholarships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "student_scholarships" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "scholarshipId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "academicSessionId" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3),
  "notes" TEXT,
  CONSTRAINT "student_scholarships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "payment_gateways_config" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "gateway" "PaymentGatewayProvider" NOT NULL,
  "publicKey" TEXT,
  "secretKey" TEXT,
  "webhookSecret" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "testMode" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_gateways_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "gateway_transactions" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "paymentId" TEXT,
  "gateway" "PaymentGatewayProvider" NOT NULL,
  "eventType" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "customerEmail" TEXT,
  "customerPhone" TEXT,
  "gatewayResponse" JSONB NOT NULL,
  "processed" BOOLEAN NOT NULL DEFAULT false,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gateway_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fee_categories_schoolId_name_key" ON "fee_categories"("schoolId", "name");
CREATE INDEX IF NOT EXISTS "fee_categories_schoolId_isActive_sortOrder_idx" ON "fee_categories"("schoolId", "isActive", "sortOrder");

CREATE INDEX IF NOT EXISTS "fee_items_schoolId_academicSessionId_termId_classId_isActive_idx" ON "fee_items"("schoolId", "academicSessionId", "termId", "classId", "isActive");
CREATE INDEX IF NOT EXISTS "fee_items_schoolId_classLevel_classCategory_idx" ON "fee_items"("schoolId", "classLevel", "classCategory");

CREATE UNIQUE INDEX IF NOT EXISTS "scholarships_schoolId_name_key" ON "scholarships"("schoolId", "name");
CREATE INDEX IF NOT EXISTS "scholarships_schoolId_isActive_idx" ON "scholarships"("schoolId", "isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "student_scholarships_scholarshipId_studentId_academicSessionId_key" ON "student_scholarships"("scholarshipId", "studentId", "academicSessionId");
CREATE INDEX IF NOT EXISTS "student_scholarships_schoolId_studentId_idx" ON "student_scholarships"("schoolId", "studentId");

CREATE INDEX IF NOT EXISTS "fee_waivers_schoolId_studentId_status_idx" ON "fee_waivers"("schoolId", "studentId", "status");
CREATE INDEX IF NOT EXISTS "fee_waivers_schoolId_invoiceId_status_idx" ON "fee_waivers"("schoolId", "invoiceId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "payment_gateways_config_schoolId_gateway_key" ON "payment_gateways_config"("schoolId", "gateway");
CREATE INDEX IF NOT EXISTS "payment_gateways_config_schoolId_isActive_isPrimary_idx" ON "payment_gateways_config"("schoolId", "isActive", "isPrimary");

CREATE UNIQUE INDEX IF NOT EXISTS "gateway_transactions_gateway_reference_eventType_key" ON "gateway_transactions"("gateway", "reference", "eventType");
CREATE INDEX IF NOT EXISTS "gateway_transactions_schoolId_gateway_processed_idx" ON "gateway_transactions"("schoolId", "gateway", "processed");
CREATE INDEX IF NOT EXISTS "gateway_transactions_schoolId_reference_idx" ON "gateway_transactions"("schoolId", "reference");

CREATE INDEX IF NOT EXISTS "Invoice_schoolId_academicSessionId_termId_classId_idx" ON "Invoice"("schoolId", "academicSessionId", "termId", "classId");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_schoolId_paymentNumber_key" ON "Payment"("schoolId", "paymentNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_schoolId_gatewayReference_key" ON "Payment"("schoolId", "gatewayReference");
CREATE INDEX IF NOT EXISTS "Payment_schoolId_gateway_gatewayStatus_idx" ON "Payment"("schoolId", "gateway", "gatewayStatus");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_feeItemId_fkey" FOREIGN KEY ("feeItemId") REFERENCES "fee_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_feeCategoryId_fkey" FOREIGN KEY ("feeCategoryId") REFERENCES "fee_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fee_categories" ADD CONSTRAINT "fee_categories_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_items" ADD CONSTRAINT "fee_items_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_items" ADD CONSTRAINT "fee_items_feeCategoryId_fkey" FOREIGN KEY ("feeCategoryId") REFERENCES "fee_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_items" ADD CONSTRAINT "fee_items_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_items" ADD CONSTRAINT "fee_items_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_items" ADD CONSTRAINT "fee_items_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fee_waivers" ADD CONSTRAINT "fee_waivers_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_waivers" ADD CONSTRAINT "fee_waivers_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_waivers" ADD CONSTRAINT "fee_waivers_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_waivers" ADD CONSTRAINT "fee_waivers_feeItemId_fkey" FOREIGN KEY ("feeItemId") REFERENCES "fee_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_waivers" ADD CONSTRAINT "fee_waivers_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_waivers" ADD CONSTRAINT "fee_waivers_feeCategoryId_fkey" FOREIGN KEY ("feeCategoryId") REFERENCES "fee_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_waivers" ADD CONSTRAINT "fee_waivers_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_waivers" ADD CONSTRAINT "fee_waivers_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "scholarships" ADD CONSTRAINT "scholarships_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_scholarships" ADD CONSTRAINT "student_scholarships_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_scholarships" ADD CONSTRAINT "student_scholarships_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "scholarships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_scholarships" ADD CONSTRAINT "student_scholarships_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_scholarships" ADD CONSTRAINT "student_scholarships_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_scholarships" ADD CONSTRAINT "student_scholarships_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_gateways_config" ADD CONSTRAINT "payment_gateways_config_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_gateways_config" ADD CONSTRAINT "payment_gateways_config_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gateway_transactions" ADD CONSTRAINT "gateway_transactions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gateway_transactions" ADD CONSTRAINT "gateway_transactions_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
