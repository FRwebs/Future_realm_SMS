-- AlterTable
ALTER TABLE "School" ADD COLUMN     "website" TEXT,
ADD COLUMN     "schoolType" TEXT,
ADD COLUMN     "curriculumPreference" TEXT,
ADD COLUMN     "estimatedStudentCount" INTEGER,
ADD COLUMN     "lga" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "jobTitle" TEXT;
