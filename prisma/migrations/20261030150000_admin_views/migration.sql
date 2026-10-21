-- CreateTable
CREATE TABLE "AdminView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminView_userId_viewedAt_idx" ON "AdminView"("userId", "viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminView_userId_kind_entityId_key" ON "AdminView"("userId", "kind", "entityId");

