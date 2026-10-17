-- AlterTable
ALTER TABLE "FeeStructure" ADD COLUMN     "familyNote" TEXT,
ADD COLUMN     "listState" TEXT NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN     "ownerName" TEXT;

-- AlterTable
ALTER TABLE "FeeStructureItem" ADD COLUMN     "audience" TEXT NOT NULL DEFAULT 'EVERYONE',
ADD COLUMN     "showPrice" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "supplier" TEXT;

