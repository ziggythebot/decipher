-- Migration: add_multilanguage_foundation
-- Phase 0+1 of multi-language rollout.
--
-- Step 1: Add languageCode to GrammarProfile with default "fr".
--         Existing rows get "fr" automatically before the constraint changes.
ALTER TABLE "GrammarProfile" ADD COLUMN IF NOT EXISTS "languageCode" TEXT NOT NULL DEFAULT 'fr';

-- Step 2: Drop old single-field unique on userId, add compound unique.
ALTER TABLE "GrammarProfile" DROP CONSTRAINT IF EXISTS "GrammarProfile_userId_key";
ALTER TABLE "GrammarProfile" ADD CONSTRAINT "GrammarProfile_userId_languageCode_key" UNIQUE ("userId", "languageCode");

-- Step 3: Add languageCode to ConversationSession with default "fr".
ALTER TABLE "ConversationSession" ADD COLUMN IF NOT EXISTS "languageCode" TEXT NOT NULL DEFAULT 'fr';

-- Step 4: Add index on ConversationSession for per-language analytics queries.
CREATE INDEX IF NOT EXISTS "ConversationSession_userId_languageCode_createdAt_idx"
  ON "ConversationSession" ("userId", "languageCode", "createdAt");

-- Step 5: Create UserLanguage table.
CREATE TABLE IF NOT EXISTS "UserLanguage" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "languageCode" TEXT NOT NULL,
  "startedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActiveAt" TIMESTAMP(3),
  "isActive"     BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "UserLanguage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UserLanguage"
  ADD CONSTRAINT "UserLanguage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "UserLanguage_userId_languageCode_key"
  ON "UserLanguage" ("userId", "languageCode");

CREATE INDEX IF NOT EXISTS "UserLanguage_userId_isActive_idx"
  ON "UserLanguage" ("userId", "isActive");

-- Step 6: Seed UserLanguage for all existing users (one active French row each).
--         ON CONFLICT is a no-op so this is safe to re-run.
INSERT INTO "UserLanguage" ("id", "userId", "languageCode", "isActive", "startedAt")
SELECT
  'ul_seed_' || REPLACE(u."id", '-', ''),
  u."id",
  'fr',
  true,
  NOW()
FROM "User" u
ON CONFLICT ("userId", "languageCode") DO NOTHING;
