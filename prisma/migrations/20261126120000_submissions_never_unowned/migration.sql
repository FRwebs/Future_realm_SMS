-- A request from a family went to the role the school's list names, and when the school had nobody in that role it
-- went to nobody: the school saw "Nobody yet" and the family was told it was not yet with anyone, though it had been
-- promised an owner. A request still open with no owner now goes to the school's owner, as new ones do.
UPDATE "GuardianSubmission" s
SET "ownerUserId" = u."id",
    "ownerName" = u."firstName" || ' ' || u."lastName",
    "ownerRole" = 'Proprietor',
    "state" = CASE WHEN s."state" = 'NEW' THEN 'ASSIGNED' ELSE s."state" END
FROM (
  SELECT DISTINCT ON ("schoolId") "id", "schoolId", "firstName", "lastName"
  FROM "User"
  WHERE "role"::text IN ('PROPRIETOR', 'SCHOOL_OWNER') AND "isActive" = true AND "deletedAt" IS NULL
  ORDER BY "schoolId", "createdAt"
) u
WHERE s."schoolId" = u."schoolId"
  AND s."ownerUserId" IS NULL
  AND s."state" IN ('NEW', 'ASSIGNED', 'IN_PROGRESS');
