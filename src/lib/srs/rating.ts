export type Rating = 1 | 2 | 3 | 4;

export type ReviewState = 0 | 1 | 2 | 3;

export type SchedulerInput = {
  now: Date;
  state: number;
  reps: number;
  lapses: number;
  stability: number;
  difficulty: number;
  rating: Rating;
};

export type SchedulerOutput = {
  state: ReviewState;
  reps: number;
  lapses: number;
  stability: number;
  difficulty: number;
  dueDate: Date;
  becameReview: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// Lightweight FSRS-style scheduler used until full ts-fsrs integration is finalized.
// It preserves key dynamics: difficulty/stability adjustment, lapses, and due-date spacing.
export function scheduleReview(input: SchedulerInput): SchedulerOutput {
  const priorState = clamp(input.state, 0, 3) as ReviewState;
  const reps = input.reps + 1;

  let nextState: ReviewState = priorState;
  let nextStability = input.stability > 0 ? input.stability : 0.3;
  let nextDifficulty = input.difficulty > 0 ? input.difficulty : 5;
  let nextLapses = input.lapses;
  let dueDate = input.now;

  if (input.rating === 1) {
    nextState = priorState === 0 ? 1 : 3;
    nextLapses += 1;
    nextStability = Math.max(0.2, nextStability * 0.75);
    nextDifficulty = clamp(nextDifficulty + 0.6, 1, 10);
    dueDate = addMinutes(input.now, 10);
  } else if (input.rating === 2) {
    nextState = priorState <= 1 ? 1 : 2;
    nextStability = nextStability + 0.25;
    nextDifficulty = clamp(nextDifficulty + 0.2, 1, 10);
    const intervalDays = priorState <= 1 ? 1 : Math.max(1, Math.round(nextStability * 1.2));
    dueDate = addDays(input.now, intervalDays);
  } else if (input.rating === 3) {
    nextState = priorState === 0 ? 1 : priorState === 3 ? 2 : reps >= 2 ? 2 : 1;
    nextStability = nextStability + 0.6;
    nextDifficulty = clamp(nextDifficulty - 0.15, 1, 10);
    const intervalDays = nextState === 1 ? 2 : Math.max(2, Math.round(nextStability * 2.1));
    dueDate = addDays(input.now, intervalDays);
  } else {
    nextState = 2;
    nextStability = nextStability + 1.2;
    nextDifficulty = clamp(nextDifficulty - 0.35, 1, 10);
    const intervalDays = Math.max(4, Math.round(nextStability * 3.2));
    dueDate = addDays(input.now, intervalDays);
  }

  return {
    state: nextState,
    reps,
    lapses: nextLapses,
    stability: Number(nextStability.toFixed(3)),
    difficulty: Number(nextDifficulty.toFixed(3)),
    dueDate,
    becameReview: priorState !== 2 && nextState === 2,
  };
}
