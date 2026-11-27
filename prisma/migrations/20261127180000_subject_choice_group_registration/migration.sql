-- A subject can belong to a choice group ("Trade · pick exactly 1") and can be held back from registration until the term it opens in.
ALTER TABLE "Subject" ADD COLUMN "choiceGroup" TEXT;
ALTER TABLE "Subject" ADD COLUMN "registrationOpen" BOOLEAN NOT NULL DEFAULT true;
