-- AlterTable
ALTER TABLE "School" ADD COLUMN     "cacNumber" TEXT,
ADD COLUMN     "ministryApprovalNumber" TEXT,
ADD COLUMN     "verificationRejectedAt" TIMESTAMP(3),
ADD COLUMN     "verificationRejectionReason" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

