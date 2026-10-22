-- AlterTable
ALTER TABLE "TrainingCourse" ADD COLUMN     "topics" TEXT[] DEFAULT ARRAY[]::TEXT[];

