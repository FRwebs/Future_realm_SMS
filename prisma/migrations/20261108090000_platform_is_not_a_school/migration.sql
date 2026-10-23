-- The platform owns this product; it is not one of its schools. Its back-office logins still need a school row to belong to (User.schoolId is
-- required), so that row is marked and every list of schools leaves it out.
ALTER TABLE "School" ADD COLUMN "isPlatform" BOOLEAN NOT NULL DEFAULT false;

-- A database that already has the platform's own home row (production, after it was emptied): just mark it.
UPDATE "School" SET "isPlatform" = true WHERE "slug" = 'futurerealm-platform';

-- A database whose back-office logins were created inside a customer's school (the demo seed put them in Greenfield): give them a home of
-- their own and move them there, so that school is only a school.
INSERT INTO "School" ("id", "name", "slug", "category", "updatedAt", "isPlatform")
SELECT 'platform-home', 'FutureRealm', 'futurerealm-platform', 'MIXED', CURRENT_TIMESTAMP, true
WHERE NOT EXISTS (SELECT 1 FROM "School" WHERE "slug" = 'futurerealm-platform')
  AND EXISTS (SELECT 1 FROM "User" WHERE "role" IN ('PLATFORM_OWNER', 'PLATFORM_ADMIN', 'SUPPORT_AGENT', 'SALES_MANAGER', 'FINANCE_MANAGER', 'DEVELOPER', 'SUPER_ADMIN'));

UPDATE "User"
SET "schoolId" = (SELECT "id" FROM "School" WHERE "slug" = 'futurerealm-platform')
WHERE "role" IN ('PLATFORM_OWNER', 'PLATFORM_ADMIN', 'SUPPORT_AGENT', 'SALES_MANAGER', 'FINANCE_MANAGER', 'DEVELOPER', 'SUPER_ADMIN')
  AND "schoolId" <> (SELECT "id" FROM "School" WHERE "slug" = 'futurerealm-platform');
