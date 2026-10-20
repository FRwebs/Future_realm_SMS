-- AlterTable
ALTER TABLE "PlatformSetting" ADD COLUMN     "policies" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "addressReleaseDueAt" TIMESTAMP(3),
ADD COLUMN     "dormancyNoticeAt" TIMESTAMP(3),
ADD COLUMN     "dormantAt" TIMESTAMP(3),
ADD COLUMN     "lifecycleAt" TIMESTAMP(3),
ADD COLUMN     "lifecycleNote" TEXT;

