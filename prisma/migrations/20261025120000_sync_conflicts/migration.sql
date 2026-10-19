-- AlterTable
ALTER TABLE "SyncDraft" ADD COLUMN     "capturedAt" TIMESTAMP(3),
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "conflict" JSONB,
ADD COLUMN     "deviceLabel" TEXT,
ADD COLUMN     "message" TEXT,
ADD COLUMN     "resolution" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedById" TEXT,
ADD COLUMN     "state" TEXT NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "SyncDraft_schoolId_state_idx" ON "SyncDraft"("schoolId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "SyncDraft_userId_clientId_key" ON "SyncDraft"("userId", "clientId");


-- Drafts that had already reached the record before states were kept.
UPDATE "SyncDraft" SET "state" = 'APPLIED' WHERE "syncedAt" IS NOT NULL;
