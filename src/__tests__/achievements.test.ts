import { describe, it, expect } from "vitest";
import { ACHIEVEMENTS } from "@/lib/achievements";

const VALID_CATEGORIES = ["vocab", "streak", "conversation", "grammar"] as const;

describe("ACHIEVEMENTS array", () => {
  it("has no duplicate slugs", () => {
    const slugs = ACHIEVEMENTS.map((a) => a.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it("all achievements have required fields", () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.slug).toBeTruthy();
      expect(achievement.name).toBeTruthy();
      expect(achievement.description).toBeTruthy();
      expect(achievement.icon).toBeTruthy();
      expect(achievement.xpReward).toBeDefined();
      expect(achievement.category).toBeDefined();
    }
  });

  it("xpReward is a positive number for all achievements", () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(typeof achievement.xpReward).toBe("number");
      expect(achievement.xpReward).toBeGreaterThan(0);
    }
  });

  it("category is one of: vocab, streak, conversation, grammar", () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(VALID_CATEGORIES).toContain(achievement.category);
    }
  });

  it("has at least one achievement per valid category", () => {
    for (const category of VALID_CATEGORIES) {
      const found = ACHIEVEMENTS.some((a) => a.category === category);
      expect(found, `No achievement found for category: ${category}`).toBe(true);
    }
  });

  it("slug format is lowercase with underscores (no spaces or uppercase)", () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.slug).toMatch(/^[a-z0-9_]+$/);
    }
  });
});
