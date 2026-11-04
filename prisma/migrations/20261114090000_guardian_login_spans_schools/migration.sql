-- A parent whose children are at two schools has a guardian record at each,
-- both pointing at the same login. The old unique on userId alone allowed only
-- one, so it becomes unique per school instead.
DROP INDEX IF EXISTS "Guardian_userId_key";
CREATE UNIQUE INDEX "Guardian_schoolId_userId_key" ON "Guardian"("schoolId", "userId");
CREATE INDEX "Guardian_userId_idx" ON "Guardian"("userId");
