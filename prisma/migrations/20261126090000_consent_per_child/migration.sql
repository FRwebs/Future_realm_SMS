-- A consent was kept once per guardian, so withdrawing photography on one child also withdrew it for that
-- child's brothers and sisters, and enrolling a second child overwrote the first child's core consent date.
-- Every consent except notification channels is now kept per child, with the wording it was given under.
ALTER TABLE "FamilyConsent" ADD COLUMN "studentId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FamilyConsent" ADD COLUMN "noticeVersion" TEXT;

DROP INDEX "FamilyConsent_guardianId_typeCode_key";
CREATE UNIQUE INDEX "FamilyConsent_guardianId_typeCode_studentId_key" ON "FamilyConsent"("guardianId", "typeCode", "studentId");
CREATE INDEX "FamilyConsent_studentId_idx" ON "FamilyConsent"("studentId");

-- What a family answered before this change was said for every child it had then. Copy that answer, with who
-- gave it, when and how, onto each of those children; the family-wide row is then retired. A guardian with no
-- child on record keeps the family-wide row, and notification channels stay with the guardian.
INSERT INTO "FamilyConsent" ("id", "schoolId", "guardianId", "typeCode", "status", "means", "note", "recordedById", "recordedAt", "studentId")
SELECT 'c' || substr(md5(random()::text || clock_timestamp()::text || fc."id" || sg."studentId"), 1, 24),
       fc."schoolId", fc."guardianId", fc."typeCode", fc."status", fc."means", fc."note", fc."recordedById", fc."recordedAt", sg."studentId"
FROM "FamilyConsent" fc
JOIN "StudentGuardian" sg ON sg."guardianId" = fc."guardianId"
WHERE fc."studentId" = '' AND fc."typeCode" <> 'channels'
ON CONFLICT DO NOTHING;

DELETE FROM "FamilyConsent" fc
WHERE fc."studentId" = '' AND fc."typeCode" <> 'channels'
  AND EXISTS (SELECT 1 FROM "StudentGuardian" sg WHERE sg."guardianId" = fc."guardianId");
