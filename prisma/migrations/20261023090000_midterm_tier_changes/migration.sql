-- Mid-term tier changes.
--
-- An upgrade takes effect at once and is charged for the part of the term that
-- is left; a downgrade waits for the next term, because the current one is paid
-- for. Both need to be explainable afterwards, which is what the ledger is for:
-- it freezes the roll and the part-term ratio used, so a charge can be read
-- back rather than recomputed against a roll that has since moved.
--
-- Written idempotently — this database has had objects created ahead of a
-- migration before, and a deploy that cannot be re-run is a deploy that blocks.

ALTER TABLE "SchoolSubscription" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- A school that already has a switch scheduled to a cheaper tier is, by this
-- migration's own definition, pending a downgrade. Say so rather than leaving
-- the column uniformly ACTIVE and wrong.
UPDATE "SchoolSubscription"
   SET "status" = 'PENDING_DOWNGRADE'
 WHERE "pendingTier" IS NOT NULL
   AND "status" = 'ACTIVE';

CREATE TABLE IF NOT EXISTS "BillingLedger" (
  "id"                   TEXT NOT NULL,
  "schoolId"             TEXT NOT NULL,
  "subscriptionId"       TEXT,
  "termId"               TEXT,
  "type"                 TEXT NOT NULL,
  "amount"               DECIMAL(12,2) NOT NULL,
  "studentCountSnapshot" INTEGER NOT NULL,
  "prorationRatio"       DECIMAL(6,5) NOT NULL DEFAULT 1,
  "fromTier"             TEXT,
  "toTier"               TEXT,
  "description"          TEXT NOT NULL,
  "invoiceId"            TEXT,
  "createdById"          TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingLedger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BillingLedger_schoolId_termId_idx" ON "BillingLedger"("schoolId", "termId");
CREATE INDEX IF NOT EXISTS "BillingLedger_schoolId_createdAt_idx" ON "BillingLedger"("schoolId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "BillingLedger" ADD CONSTRAINT "BillingLedger_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "BillingLedger" ADD CONSTRAINT "BillingLedger_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "SchoolSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "BillingLedger" ADD CONSTRAINT "BillingLedger_termId_fkey"
    FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
