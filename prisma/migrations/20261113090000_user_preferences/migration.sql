-- How the product opens and behaves for one person (landing page, density, confirmations, offline keeping, notification choices).
ALTER TABLE "User" ADD COLUMN "preferences" JSONB;
