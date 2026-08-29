-- AlterTable
ALTER TABLE "School" ADD COLUMN     "riskScore" INTEGER,
ADD COLUMN     "riskSignals" JSONB,
ADD COLUMN     "signupIp" TEXT;

