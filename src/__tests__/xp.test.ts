import { describe, it, expect } from "vitest";
import { levelFromTotalXp, levelTitle, xpForLevel, XP } from "@/lib/xp";

describe("levelFromTotalXp", () => {
  it("returns 1 for 0 XP", () => {
    expect(levelFromTotalXp(0)).toBe(1);
  });

  it("returns 1 for XP less than the first threshold", () => {
    expect(levelFromTotalXp(50)).toBe(1);
  });

  it("advances to level 2 when XP meets the first threshold", () => {
    // xpForLevel(1) = 100 * 1.5^0 = 100
    const threshold = xpForLevel(1); // 100
    expect(levelFromTotalXp(threshold)).toBe(2);
  });

  it("advances to level 3 at the correct cumulative threshold", () => {
    // level 2 requires xpForLevel(1) + xpForLevel(2) = 100 + 150 = 250
    const threshold = xpForLevel(1) + xpForLevel(2);
    expect(levelFromTotalXp(threshold)).toBe(3);
  });

  it("returns correct level for very high XP", () => {
    const level = levelFromTotalXp(100000);
    expect(level).toBeGreaterThan(5);
  });
});

describe("levelTitle", () => {
  it("returns a string for all levels 1 to 20", () => {
    for (let level = 1; level <= 20; level++) {
      const title = levelTitle(level);
      expect(typeof title).toBe("string");
      expect(title.length).toBeGreaterThan(0);
    }
  });

  it("returns 'Absolute Beginner' for level 1", () => {
    expect(levelTitle(1)).toBe("Absolute Beginner");
  });

  it("caps at 'Master' for levels above 8", () => {
    expect(levelTitle(9)).toBe("Master");
    expect(levelTitle(20)).toBe("Master");
  });
});

describe("XP constants", () => {
  it("all XP values are positive numbers", () => {
    for (const [, value] of Object.entries(XP)) {
      expect(typeof value).toBe("number");
      expect(value).toBeGreaterThan(0);
    }
  });

  it("WORD_CORRECT is defined and positive", () => {
    expect(XP.WORD_CORRECT).toBeGreaterThan(0);
  });

  it("SESSION_COMPLETE is defined and positive", () => {
    expect(XP.SESSION_COMPLETE).toBeGreaterThan(0);
  });
});

describe("xpForLevel", () => {
  it("returns 100 for level 1", () => {
    expect(xpForLevel(1)).toBe(100);
  });

  it("increases with each level", () => {
    expect(xpForLevel(2)).toBeGreaterThan(xpForLevel(1));
    expect(xpForLevel(5)).toBeGreaterThan(xpForLevel(4));
  });
});
