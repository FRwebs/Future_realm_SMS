-- Module 3 (Subscription & Billing Management): promo campaigns, notification wallets, churn signal logs.

ALTER TABLE "PlatformDiscount"
  ADD COLUMN IF NOT EXISTS "promoCodeId" TEXT;

CREATE INDEX IF NOT EXISTS "PlatformDiscount_promoCodeId_idx" ON "PlatformDiscount"("promoCodeId");

DO $$ BEGIN
  ALTER TABLE "PlatformDiscount" ADD CONSTRAINT "PlatformDiscount_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "PromoCode"
  ADD COLUMN IF NOT EXISTS "campaignName" TEXT;

CREATE TABLE IF NOT EXISTS "NotificationWallet" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "smsBalance" INTEGER NOT NULL DEFAULT 0,
  "whatsappBalance" INTEGER NOT NULL DEFAULT 0,
  "lowBalanceThreshold" INTEGER NOT NULL DEFAULT 50,
  "lastToppedUpAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationWallet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationWallet_schoolId_key" ON "NotificationWallet"("schoolId");

DO $$ BEGIN
  ALTER TABLE "NotificationWallet" ADD CONSTRAINT "NotificationWallet_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ChurnSignalLog" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "signals" JSONB NOT NULL,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ChurnSignalLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChurnSignalLog_schoolId_calculatedAt_idx" ON "ChurnSignalLog"("schoolId", "calculatedAt");

DO $$ BEGIN
  ALTER TABLE "ChurnSignalLog" ADD CONSTRAINT "ChurnSignalLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
