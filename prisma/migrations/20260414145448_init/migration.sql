-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3),
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "targetLanguage" TEXT NOT NULL DEFAULT 'fr',
    "goalType" TEXT NOT NULL DEFAULT 'social',
    "deadlineDate" TIMESTAMP(3),
    "dailyMinutes" INTEGER NOT NULL DEFAULT 15,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrammarProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deconstructionDone" BOOLEAN NOT NULL DEFAULT false,
    "cheatSheetMd" TEXT,
    "patternScores" JSONB NOT NULL DEFAULT '{}',
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "GrammarProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LanguageWord" (
    "id" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "frequencyRank" INTEGER NOT NULL,
    "word" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "pronunciation" TEXT,
    "exampleSentence" TEXT,
    "mnemonicHint" TEXT,
    "audioUrl" TEXT,
    "category" TEXT,

    CONSTRAINT "LanguageWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserVocabulary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "stability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReview" TIMESTAMP(3),
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "state" INTEGER NOT NULL DEFAULT 0,
    "timesCorrect" INTEGER NOT NULL DEFAULT 0,
    "timesFailed" INTEGER NOT NULL DEFAULT 0,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserVocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,
    "mode" TEXT NOT NULL DEFAULT 'guided',
    "scenarioType" TEXT,
    "transcript" TEXT,
    "wordsEncountered" TEXT[],
    "errorsLogged" JSONB NOT NULL DEFAULT '[]',
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "newWordsCount" INTEGER NOT NULL DEFAULT 0,
    "accuracyPct" INTEGER,

    CONSTRAINT "ConversationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreakEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StreakEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GrammarProfile_userId_key" ON "GrammarProfile"("userId");

-- CreateIndex
CREATE INDEX "LanguageWord_languageCode_frequencyRank_idx" ON "LanguageWord"("languageCode", "frequencyRank");

-- CreateIndex
CREATE UNIQUE INDEX "LanguageWord_languageCode_frequencyRank_key" ON "LanguageWord"("languageCode", "frequencyRank");

-- CreateIndex
CREATE UNIQUE INDEX "UserVocabulary_userId_wordId_key" ON "UserVocabulary"("userId", "wordId");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_slug_key" ON "Achievement"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "StreakEntry_userId_date_key" ON "StreakEntry"("userId", "date");

-- AddForeignKey
ALTER TABLE "GrammarProfile" ADD CONSTRAINT "GrammarProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVocabulary" ADD CONSTRAINT "UserVocabulary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVocabulary" ADD CONSTRAINT "UserVocabulary_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "LanguageWord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationSession" ADD CONSTRAINT "ConversationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreakEntry" ADD CONSTRAINT "StreakEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
