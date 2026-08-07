-- Module 5 (Cross-Platform User Management): suspicious activity, duplicate accounts, account recovery.

CREATE TABLE IF NOT EXISTS "SuspiciousActivityFlag" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "flagType" TEXT NOT NULL,
  "detail" TEXT,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "adminAction" TEXT,
  "resolvedAt" TIMESTAMP(3),

  CONSTRAINT "SuspiciousActivityFlag_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SuspiciousActivityFlag_userId_resolvedAt_idx" ON "SuspiciousActivityFlag"("userId", "resolvedAt");

DO $$ BEGIN
  ALTER TABLE "SuspiciousActivityFlag" ADD CONSTRAINT "SuspiciousActivityFlag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "DuplicateFlag" (
  "id" TEXT NOT NULL,
  "userIdA" TEXT NOT NULL,
  "userIdB" TEXT NOT NULL,
  "matchCriteria" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),

  CONSTRAINT "DuplicateFlag_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DuplicateFlag_status_idx" ON "DuplicateFlag"("status");

DO $$ BEGIN
  ALTER TABLE "DuplicateFlag" ADD CONSTRAINT "DuplicateFlag_userIdA_fkey" FOREIGN KEY ("userIdA") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DuplicateFlag" ADD CONSTRAINT "DuplicateFlag_userIdB_fkey" FOREIGN KEY ("userIdB") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AccountRecoveryRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "verifiedById" TEXT,
  "verificationMethod" TEXT NOT NULL,
  "newEmail" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AccountRecoveryRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AccountRecoveryRecord_userId_idx" ON "AccountRecoveryRecord"("userId");

DO $$ BEGIN
  ALTER TABLE "AccountRecoveryRecord" ADD CONSTRAINT "AccountRecoveryRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AccountRecoveryRecord" ADD CONSTRAINT "AccountRecoveryRecord_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
