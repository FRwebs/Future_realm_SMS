-- CreateTable
CREATE TABLE "ApprovalMessage" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "authorId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'COMMENT',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprovalMessage_schoolId_itemKey_createdAt_idx" ON "ApprovalMessage"("schoolId", "itemKey", "createdAt");

-- AddForeignKey
ALTER TABLE "ApprovalMessage" ADD CONSTRAINT "ApprovalMessage_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalMessage" ADD CONSTRAINT "ApprovalMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

