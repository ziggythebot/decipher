-- Add session objective tracking fields to ConversationSession
ALTER TABLE "ConversationSession" ADD COLUMN "sessionObjective" JSONB;
ALTER TABLE "ConversationSession" ADD COLUMN "patternUses" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ConversationSession" ADD COLUMN "objectiveReached" BOOLEAN;
