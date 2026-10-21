-- CreateTable
CREATE TABLE "TriggerRule" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "plan" TEXT,
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "templateId" TEXT,
    "sendHour" INTEGER NOT NULL DEFAULT 9,
    "groupName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabledAt" TIMESTAMP(3),
    "lastFiredAt" TIMESTAMP(3),

    CONSTRAINT "TriggerRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TriggerRuleFire" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT NOT NULL,
    "firedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerRuleFire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TriggerRule_enabled_idx" ON "TriggerRule"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerRuleFire_ruleId_entityId_key" ON "TriggerRuleFire"("ruleId", "entityId");

-- CreateIndex
CREATE INDEX "TriggerRuleFire_firedAt_idx" ON "TriggerRuleFire"("firedAt");

-- AddForeignKey
ALTER TABLE "TriggerRuleFire" ADD CONSTRAINT "TriggerRuleFire_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TriggerRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
