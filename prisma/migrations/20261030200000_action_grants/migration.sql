-- AlterTable
ALTER TABLE "InternalPermissionGrid" ADD COLUMN     "actions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "customActions" BOOLEAN NOT NULL DEFAULT false;

