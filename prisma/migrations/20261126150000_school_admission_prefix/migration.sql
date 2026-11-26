-- Admission numbers started with "GFC" in every school, because the number was built from the first school's own. A school now
-- numbers with letters of its own, set in School Configuration; until it chooses, they come from its name.
ALTER TABLE "School" ADD COLUMN "admissionPrefix" TEXT;

-- A school already numbering keeps the letters it has been using, so the next child is numbered like the last one. A school that
-- finds those letters are wrong (they are another school's) changes them in School Configuration; only new numbers change.
UPDATE "School" s
SET "admissionPrefix" = p."prefix"
FROM (
  SELECT DISTINCT ON ("schoolId") "schoolId", split_part("admissionNumber", '/', 1) AS "prefix", count(*) AS "n"
  FROM "Student"
  WHERE "admissionNumber" ~ '^[A-Z0-9]{2,6}/[0-9]{2}/[0-9]+$'
  GROUP BY "schoolId", split_part("admissionNumber", '/', 1)
  ORDER BY "schoolId", count(*) DESC
) p
WHERE s."id" = p."schoolId" AND s."admissionPrefix" IS NULL;
