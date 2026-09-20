-- Add a contact email to Partner so a deal-registration confirmation can be sent to someone.
ALTER TABLE "Partner" ADD COLUMN "email" TEXT;
