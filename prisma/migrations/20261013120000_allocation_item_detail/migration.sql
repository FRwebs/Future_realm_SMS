-- An allocation line is what a family is asked to buy, which needs more than a
-- single figure: how many, what the one costs, what it actually is, and which
-- part of the printed list it belongs under.
--
-- Written idempotently: this database has had objects created ahead of a
-- migration before, and a deploy that cannot be re-run is a deploy that blocks.
ALTER TABLE "FeeStructureItem" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "FeeStructureItem" ADD COLUMN IF NOT EXISTS "unitAmount" DECIMAL(12,2);
ALTER TABLE "FeeStructureItem" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "FeeStructureItem" ADD COLUMN IF NOT EXISTS "category" TEXT;

-- Every line that already exists was priced as a single unit, so its unit price
-- is its amount. Nothing is invented: this only restates what is already true.
UPDATE "FeeStructureItem" SET "unitAmount" = "amount" WHERE "unitAmount" IS NULL;
