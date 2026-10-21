-- A session score is not simply "the terms, somehow": a school either averages
-- them, reads the final one, or weights them. Recording which lets a report
-- card show a session figure that means the same thing every time.
ALTER TABLE "GradingScheme" ADD COLUMN "sessionAggregation" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "GradingScheme" ADD COLUMN "termWeights" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "GradingScheme" ADD COLUMN "cumulativeDisplay" BOOLEAN NOT NULL DEFAULT false;
