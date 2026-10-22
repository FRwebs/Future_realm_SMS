-- A course can carry a price. Null stays free, which is what a school's own courses are.
ALTER TABLE "TrainingCourse" ADD COLUMN "priceKobo" INTEGER;
ALTER TABLE "TrainingCourse" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'NGN';

-- The basket, the request to the school, and the settled purchase are one row moving
-- through states, so a course nobody ever paid for cannot be opened by accident.
CREATE TABLE "TrainingPurchase" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "priceKobo" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "payer" TEXT NOT NULL DEFAULT 'SCHOOL',
    "state" TEXT NOT NULL DEFAULT 'BASKET',
    "reason" TEXT,
    "decision" TEXT,
    "reference" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    CONSTRAINT "TrainingPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainingPurchase_courseId_userId_key" ON "TrainingPurchase"("courseId", "userId");
CREATE INDEX "TrainingPurchase_schoolId_state_idx" ON "TrainingPurchase"("schoolId", "state");

ALTER TABLE "TrainingPurchase" ADD CONSTRAINT "TrainingPurchase_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingPurchase" ADD CONSTRAINT "TrainingPurchase_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
