// Pure statistics for one group's ratings (SPEC §8).
import type { RatingFlag } from "@/lib/types/rating";

export interface RatingInput {
  score: number;
  studentCode: string;
  studentName: string;
  createdAt: Date;
  excluded: boolean;
  flags: readonly RatingFlag[];
}

export interface Rater {
  code: string;
  name: string;
}

export interface Extreme {
  score: number;
  /** Every rater who gave this score, ordered by createdAt. */
  raters: Rater[];
}

export interface GroupStats {
  n: number;
  mean: number | null;
  trimmedMean: number | null;
  median: number | null;
  /** Sample standard deviation (n - 1); null when n < 2. */
  stdDev: number | null;
  highest: Extreme | null;
  lowest: Extreme | null;
  /** 11 buckets: floor(score), with 10 in bucket 10. */
  histogram: number[];
  flaggedCount: number;
  excludedCount: number;
}

const HISTOGRAM_BUCKETS = 11;

function mean(scores: readonly number[]): number {
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function median(sortedScores: readonly number[]): number {
  const middle = Math.floor(sortedScores.length / 2);
  const upper = sortedScores[middle] ?? 0;
  if (sortedScores.length % 2 === 1) return upper;
  const lower = sortedScores[middle - 1] ?? upper;
  return (lower + upper) / 2;
}

/** k = floor(n * ratio) from each end; falls back to the mean if nothing would remain. */
function trimmedMean(sortedScores: readonly number[], trimRatio: number): number {
  const k = Math.floor(sortedScores.length * trimRatio);
  if (sortedScores.length - 2 * k < 1) return mean(sortedScores);
  return mean(sortedScores.slice(k, sortedScores.length - k));
}

function sampleStdDev(scores: readonly number[]): number | null {
  if (scores.length < 2) return null;
  const average = mean(scores);
  const squared = scores.reduce((sum, score) => sum + (score - average) ** 2, 0);
  return Math.sqrt(squared / (scores.length - 1));
}

function histogram(scores: readonly number[]): number[] {
  const buckets = new Array<number>(HISTOGRAM_BUCKETS).fill(0);
  for (const score of scores) {
    const bucket = Math.min(HISTOGRAM_BUCKETS - 1, Math.max(0, Math.floor(score)));
    buckets[bucket] = (buckets[bucket] ?? 0) + 1;
  }
  return buckets;
}

function extreme(ratings: readonly RatingInput[], score: number): Extreme {
  const raters = ratings
    .filter((rating) => rating.score === score)
    .toSorted((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((rating) => ({ code: rating.studentCode, name: rating.studentName }));
  return { score, raters };
}

/**
 * Score statistics use only ratings with excluded = false; flaggedCount and
 * excludedCount cover every rating. Values are not rounded (round when displaying).
 */
export function computeStats(ratings: readonly RatingInput[], trimRatio: number): GroupStats {
  const valid = ratings.filter((rating) => !rating.excluded);
  const counts = {
    flaggedCount: ratings.filter((rating) => rating.flags.length > 0).length,
    excludedCount: ratings.length - valid.length,
  };

  if (valid.length === 0) {
    return {
      n: 0,
      mean: null,
      trimmedMean: null,
      median: null,
      stdDev: null,
      highest: null,
      lowest: null,
      histogram: histogram([]),
      ...counts,
    };
  }

  const sortedScores = valid.map((rating) => rating.score).toSorted((a, b) => a - b);
  return {
    n: valid.length,
    mean: mean(sortedScores),
    trimmedMean: trimmedMean(sortedScores, trimRatio),
    median: median(sortedScores),
    stdDev: sampleStdDev(sortedScores),
    highest: extreme(valid, sortedScores[sortedScores.length - 1] ?? 0),
    lowest: extreme(valid, sortedScores[0] ?? 0),
    histogram: histogram(sortedScores),
    ...counts,
  };
}
