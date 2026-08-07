-- Module 6 (Support and Ticketing): full lifecycle statuses/categories, CSAT, canned responses, data correction workflow.

DO $$ BEGIN
  ALTER TYPE "PlatformTicketStatus" ADD VALUE 'TRIAGED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "PlatformTicketStatus" ADD VALUE 'AWAITING_SCHOOL_RESPONSE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "PlatformTicketStatus" ADD VALUE 'ESCALATED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "PlatformTicketCategory" ADD VALUE 'RESULT_COMPUTATION';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "PlatformTicketCategory" ADD VALUE 'NOTIFICATION_DELIVERY';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "PlatformTicketCategory" ADD VALUE 'SYNC_OFFLINE_ISSUE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "PlatformTicketCategory" ADD VALUE 'DATA_CORRECTION_REQUEST';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "TicketCsatResponse" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "comment" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TicketCsatResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TicketCsatResponse_ticketId_key" ON "TicketCsatResponse"("ticketId");

DO $$ BEGIN
  ALTER TABLE "TicketCsatResponse" ADD CONSTRAINT "TicketCsatResponse_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CannedResponse" (
  "id" TEXT NOT NULL,
  "category" "PlatformTicketCategory" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CannedResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CannedResponse_category_idx" ON "CannedResponse"("category");

DO $$ BEGIN
  ALTER TABLE "CannedResponse" ADD CONSTRAINT "CannedResponse_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "DataCorrectionRecord" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "fieldCorrected" TEXT NOT NULL,
  "oldValue" TEXT NOT NULL,
  "newValue" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT,
  "approvedById" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DataCorrectionRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DataCorrectionRecord_ticketId_idx" ON "DataCorrectionRecord"("ticketId");
CREATE INDEX IF NOT EXISTS "DataCorrectionRecord_status_idx" ON "DataCorrectionRecord"("status");

DO $$ BEGIN
  ALTER TABLE "DataCorrectionRecord" ADD CONSTRAINT "DataCorrectionRecord_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DataCorrectionRecord" ADD CONSTRAINT "DataCorrectionRecord_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DataCorrectionRecord" ADD CONSTRAINT "DataCorrectionRecord_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
