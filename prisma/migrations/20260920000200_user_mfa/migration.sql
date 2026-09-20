-- Real TOTP-based MFA: a secret (set once enrollment starts, only "live" once mfaEnabled is
-- true), single-use backup codes stored as hashes, and when enrollment actually completed.
ALTER TABLE "User" ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "mfaSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "mfaBackupCodeHashes" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "User" ADD COLUMN "mfaEnrolledAt" TIMESTAMP(3);
