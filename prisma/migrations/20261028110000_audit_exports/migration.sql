-- CreateTable
CREATE TABLE "AuditExport" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "reason" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'CSV',
    "filters" JSONB NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditExport_createdAt_idx" ON "AuditExport"("createdAt");

-- AddForeignKey
ALTER TABLE "AuditExport" ADD CONSTRAINT "AuditExport_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

