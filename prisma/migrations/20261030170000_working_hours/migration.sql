-- AlterTable
ALTER TABLE "CountryProfile" ADD COLUMN     "holidayDates" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "timeZone" TEXT,
ADD COLUMN     "workDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
ADD COLUMN     "workEnd" TEXT,
ADD COLUMN     "workStart" TEXT;

