// Pure statistics for one group's ratings (SPEC §8). P1 subset: n, mean, median,
// highest, lowest. P2 adds trimmedMean, stdDev, histogram, flagged/excluded counts.

export interface RatingInput {
  score: number;
  studentCode: string;
  studentName: string;
  createdAt: Date;
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
  median: number | null;
  highest: Extreme | null;
  lowest: Extreme | null;
}

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

function extreme(ratings: readonly RatingInput[], score: number): Extreme {
  const raters = ratings
    .filter((rating) => rating.score === score)
    .toSorted((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((rating) => ({ code: rating.studentCode, name: rating.studentName }));
  return { score, raters };
}

/** Values are not rounded here; round only when displaying (2 decimals). */
export function computeStats(ratings: readonly RatingInput[]): GroupStats {
  if (ratings.length === 0) {
    return { n: 0, mean: null, median: null, highest: null, lowest: null };
  }

  const sortedScores = ratings.map((rating) => rating.score).toSorted((a, b) => a - b);
  const lowestScore = sortedScores[0] ?? 0;
  const highestScore = sortedScores[sortedScores.length - 1] ?? 0;

  return {
    n: ratings.length,
    mean: mean(sortedScores),
    median: median(sortedScores),
    highest: extreme(ratings, highestScore),
    lowest: extreme(ratings, lowestScore),
  };
}
