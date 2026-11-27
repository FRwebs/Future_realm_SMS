-- The welcome line the seed script wrote into the platform announcement showed as a "From FutureRealm" banner on every portal.
-- It was a placeholder, not a message from the platform. Clear it where it is still exactly that text; a real announcement, or one
-- an operator has edited, is left alone.
UPDATE "PlatformSetting"
SET "platformAnnouncement" = NULL
WHERE "platformAnnouncement" = 'Welcome to FutureRealm SMS. Review term data and pending approvals before publishing reports.';
