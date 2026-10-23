export interface ScoreConfig {
  minScore: number;
  maxScore: number;
  scoreStep: number;
}

/** Scores have at most one decimal place, so all checks run on tenths (integers). */
const TENTHS = 10;
const EPSILON = 1e-9;

function toTenths(value: number): number | null {
  const scaled = value * TENTHS;
  const rounded = Math.round(scaled);
  return Math.abs(scaled - rounded) < EPSILON ? rounded : null;
}

/** BR-05: score within [min, max] and a multiple of the step, compared as integers. */
export function isValidScore(score: number, config: ScoreConfig): boolean {
  if (!Number.isFinite(score)) return false;

  const value = toTenths(score);
  const min = toTenths(config.minScore);
  const max = toTenths(config.maxScore);
  const step = toTenths(config.scoreStep);
  if (value === null || min === null || max === null || step === null || step <= 0) {
    return false;
  }
  return value >= min && value <= max && value % step === 0;
}

/** Every valid score for the quick-pick grid on the student form, ascending. */
export function scoreOptions(config: ScoreConfig): number[] {
  const min = toTenths(config.minScore);
  const max = toTenths(config.maxScore);
  const step = toTenths(config.scoreStep);
  if (min === null || max === null || step === null || step <= 0 || min > max) return [];

  const first = Math.ceil(min / step) * step;
  const options: number[] = [];
  for (let tenths = first; tenths <= max; tenths += step) {
    options.push(tenths / TENTHS);
  }
  return options;
}
