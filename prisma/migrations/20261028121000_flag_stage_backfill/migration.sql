-- Flags that existed before stages were kept entered their stage when they were last changed, not when the column was added.
UPDATE "PlatformFeatureFlag" SET "stageStartedAt" = "updatedAt";
