-- Track whether a partner has been alerted that a registration is about to expire, so the
-- manual "send expiry alerts" action never emails the same partner twice for the same deal.
ALTER TABLE "PartnerDeal" ADD COLUMN "expiryAlertSentAt" TIMESTAMP(3);
