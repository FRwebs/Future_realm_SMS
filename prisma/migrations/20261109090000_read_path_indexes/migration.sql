-- CreateIndex
CREATE INDEX IF NOT EXISTS "GuardianSubmission_guardianId_createdAt_idx" ON "GuardianSubmission"("guardianId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GuardianSubmission_studentId_state_idx" ON "GuardianSubmission"("studentId", "state");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MessageDelivery_logId_idx" ON "MessageDelivery"("logId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationLog_schoolId_userId_sentAt_idx" ON "NotificationLog"("schoolId", "userId", "sentAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationLog_status_channel_sentAt_idx" ON "NotificationLog"("status", "channel", "sentAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StudentAttendance_classId_date_idx" ON "StudentAttendance"("classId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StudentAttendance_schoolId_termId_status_idx" ON "StudentAttendance"("schoolId", "termId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StudentGuardian_guardianId_idx" ON "StudentGuardian"("guardianId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_schoolId_role_idx" ON "User"("schoolId", "role");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_schoolId_isActive_idx" ON "User"("schoolId", "isActive");

