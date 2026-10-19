-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AutomationTrigger" ADD VALUE 'RESULT_REVISED';
ALTER TYPE "AutomationTrigger" ADD VALUE 'PAYMENT_REVERSAL';
ALTER TYPE "AutomationTrigger" ADD VALUE 'EMERGENCY_BROADCAST';
ALTER TYPE "AutomationTrigger" ADD VALUE 'APPROVAL_DECISION';
ALTER TYPE "AutomationTrigger" ADD VALUE 'ABSENCE_RECORDED';
ALTER TYPE "AutomationTrigger" ADD VALUE 'INVOICE_PUBLISHED';

