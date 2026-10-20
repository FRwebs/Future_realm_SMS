-- CreateTable
CREATE TABLE "PageLoadSample" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "path" TEXT NOT NULL,
    "loadMs" INTEGER NOT NULL,
    "connection" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageLoadSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageLoadSample_createdAt_idx" ON "PageLoadSample"("createdAt");

-- CreateIndex
CREATE INDEX "PageLoadSample_connection_createdAt_idx" ON "PageLoadSample"("connection", "createdAt");

