import { describe, it, expect } from "vitest";
import { scheduleReview } from "@/lib/srs/rating";
import type { SchedulerInput } from "@/lib/srs/rating";

function makeInput(overrides: Partial<SchedulerInput> = {}): SchedulerInput {
  return {
    now: new Date("2024-01-01T00:00:00Z"),
    state: 0,
    reps: 0,
    lapses: 0,
    stability: 0,
    difficulty: 0,
    rating: 3,
    ...overrides,
  };
}

describe("scheduleReview — new card with Good (3) rating", () => {
  it("advances state from New (0) to Learning (1)", () => {
    const result = scheduleReview(makeInput({ state: 0, rating: 3 }));
    expect(result.state).toBe(1);
  });

  it("sets a due date in the future", () => {
    const now = new Date("2024-01-01T00:00:00Z");
    const result = scheduleReview(makeInput({ now, state: 0, rating: 3 }));
    expect(result.dueDate.getTime()).toBeGreaterThan(now.getTime());
  });

  it("increments reps by 1", () => {
    const result = scheduleReview(makeInput({ state: 0, reps: 0, rating: 3 }));
    expect(result.reps).toBe(1);
  });
});

describe("scheduleReview — Again (1) rating on a Review card", () => {
  it("resets state from Review (2) to Relearning (3)", () => {
    const result = scheduleReview(makeInput({ state: 2, rating: 1 }));
    expect(result.state).toBe(3);
  });

  it("increments lapses", () => {
    const result = scheduleReview(makeInput({ state: 2, lapses: 0, rating: 1 }));
    expect(result.lapses).toBe(1);
  });

  it("sets a short due date (minutes, not days)", () => {
    const now = new Date("2024-01-01T00:00:00Z");
    const result = scheduleReview(makeInput({ now, state: 2, rating: 1 }));
    const diffMs = result.dueDate.getTime() - now.getTime();
    // Should be ~10 minutes, definitely less than 1 hour
    expect(diffMs).toBeLessThan(60 * 60 * 1000);
    expect(diffMs).toBeGreaterThan(0);
  });
});

describe("scheduleReview — difficulty stays in 0-10 range", () => {
  it("difficulty is within bounds after Good rating on new card", () => {
    const result = scheduleReview(makeInput({ state: 0, rating: 3 }));
    expect(result.difficulty).toBeGreaterThanOrEqual(1);
    expect(result.difficulty).toBeLessThanOrEqual(10);
  });

  it("difficulty is within bounds after Again rating", () => {
    const result = scheduleReview(makeInput({ state: 2, difficulty: 9, rating: 1 }));
    expect(result.difficulty).toBeGreaterThanOrEqual(1);
    expect(result.difficulty).toBeLessThanOrEqual(10);
  });

  it("difficulty is within bounds after Easy (4) rating", () => {
    const result = scheduleReview(makeInput({ state: 2, difficulty: 1.5, rating: 4 }));
    expect(result.difficulty).toBeGreaterThanOrEqual(1);
    expect(result.difficulty).toBeLessThanOrEqual(10);
  });

  it("difficulty is within bounds after Hard (2) rating repeatedly", () => {
    let input = makeInput({ state: 1, difficulty: 8, stability: 1, rating: 2 });
    for (let i = 0; i < 10; i++) {
      const result = scheduleReview(input);
      expect(result.difficulty).toBeGreaterThanOrEqual(1);
      expect(result.difficulty).toBeLessThanOrEqual(10);
      input = { ...input, difficulty: result.difficulty, stability: result.stability, state: result.state };
    }
  });
});

describe("scheduleReview — Again (1) on a New card", () => {
  it("moves to Learning (1), not Relearning (3)", () => {
    const result = scheduleReview(makeInput({ state: 0, rating: 1 }));
    expect(result.state).toBe(1);
  });
});
