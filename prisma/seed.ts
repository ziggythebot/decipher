import { PrismaClient } from "@prisma/client";
import { FRENCH_TOP_100 } from "../src/data/french-top100";
import { ACHIEVEMENTS } from "../src/lib/achievements";

const db = new PrismaClient();

async function main() {
  console.log("Seeding French word list...");

  for (const word of FRENCH_TOP_100) {
    await db.languageWord.upsert({
      where: { languageCode_frequencyRank: { languageCode: "fr", frequencyRank: word.frequencyRank } },
      update: {
        word: word.word,
        translation: word.translation,
        category: word.category,
        pronunciation: word.pronunciation,
        exampleSentence: word.exampleSentence,
        mnemonicHint: word.mnemonicHint ?? null,
      },
      create: {
        languageCode: "fr",
        frequencyRank: word.frequencyRank,
        word: word.word,
        translation: word.translation,
        category: word.category,
        pronunciation: word.pronunciation,
        exampleSentence: word.exampleSentence,
        mnemonicHint: word.mnemonicHint ?? null,
      },
    });
  }

  console.log(`Seeded ${FRENCH_TOP_100.length} French words`);

  console.log("Seeding achievements...");
  for (const achievement of ACHIEVEMENTS) {
    await db.achievement.upsert({
      where: { slug: achievement.slug },
      update: {
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        xpReward: achievement.xpReward,
        category: achievement.category,
      },
      create: {
        slug: achievement.slug,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        xpReward: achievement.xpReward,
        category: achievement.category,
      },
    });
  }

  console.log(`Seeded ${ACHIEVEMENTS.length} achievements`);
  console.log("Done!");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
