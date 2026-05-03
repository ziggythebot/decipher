-- AlterTable
ALTER TABLE "GrammarProfile" ADD COLUMN     "deconstructionCardState" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "deconstructionProgress" INTEGER NOT NULL DEFAULT 0;
