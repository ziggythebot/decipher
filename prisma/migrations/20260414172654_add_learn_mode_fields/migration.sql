-- AlterTable
ALTER TABLE "UserVocabulary" ADD COLUMN     "initialConfidence" INTEGER,
ADD COLUMN     "seenCount" INTEGER NOT NULL DEFAULT 0;
