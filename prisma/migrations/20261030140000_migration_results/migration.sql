-- AlterTable
ALTER TABLE "MigrationJob" ADD COLUMN     "filesCount" INTEGER,
ADD COLUMN     "rejectedNote" TEXT,
ADD COLUMN     "resultsImported" INTEGER,
ADD COLUMN     "retentionApprovedById" TEXT,
ADD COLUMN     "retentionDays" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "retentionExtendReason" TEXT,
ADD COLUMN     "retentionExtendedTo" TIMESTAMP(3),
ADD COLUMN     "rowsRejected" INTEGER,
ADD COLUMN     "sourceFilesDeletedAt" TIMESTAMP(3),
ADD COLUMN     "sourceFilesDeletedNote" TEXT,
ADD COLUMN     "studentsImported" INTEGER;

-- AlterTable
ALTER TABLE "MigrationSourceAdapter" ADD COLUMN     "formats" TEXT,
ADD COLUMN     "quirks" TEXT;

