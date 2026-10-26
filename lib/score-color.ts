// Semantic colour tier for a score (SPEC §12 spirit: colour carries meaning).
// Shared by the student score grid and the projector/results score pills.

export type ScoreTier = "low" | "mid" | "high" | "top";

const MID_FROM = 5;
const HIGH_FROM = 7;
const TOP_FROM = 9;

/** Thresholds assume the default 0–10 scale; other ranges are normalised to it. */
export function scoreTier(score: number, minScore = 0, maxScore = 10): ScoreTier {
  const span = maxScore - minScore;
  const onTen = span > 0 ? ((score - minScore) / span) * 10 : score;
  if (onTen >= TOP_FROM) return "top";
  if (onTen >= HIGH_FROM) return "high";
  if (onTen >= MID_FROM) return "mid";
  return "low";
}

/** Soft background + strong text (pills, unselected grid buttons). */
export const SCORE_SOFT_CLASS: Record<ScoreTier, string> = {
  low: "bg-score-low-soft text-score-low-ink border-score-low/30",
  mid: "bg-score-mid-soft text-score-mid-ink border-score-mid/40",
  high: "bg-score-high-soft text-score-high-ink border-score-high/30",
  top: "bg-score-top-soft text-score-top-ink border-score-top/30",
};

/** Solid fill (selected grid button); "ink" shades keep text contrast ≥ 4.5:1. */
export const SCORE_SOLID_CLASS: Record<ScoreTier, string> = {
  low: "bg-score-low-ink text-score-on-solid border-score-low-ink",
  mid: "bg-score-mid-ink text-score-on-solid border-score-mid-ink",
  high: "bg-score-high-ink text-score-on-solid border-score-high-ink",
  top: "bg-score-top-ink text-score-on-solid border-score-top-ink",
};
