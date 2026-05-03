-- Add onboardedAt timestamp to gate new users through an onboarding wizard.
-- Existing users are backfilled to NOW() so they bypass the wizard.
ALTER TABLE "User" ADD COLUMN "onboardedAt" TIMESTAMP(3);
UPDATE "User" SET "onboardedAt" = CURRENT_TIMESTAMP WHERE "onboardedAt" IS NULL;
