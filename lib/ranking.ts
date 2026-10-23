import type { RankingMetric } from "@/lib/types/rating";

export interface RankableGroup {
  id: string;
  stats: { n: number; mean: number | null; trimmedMean: number | null; median: number | null };
}

export type Ranked<T> = T & { rank: number | null };

function metricValue(stats: RankableGroup["stats"], metric: RankingMetric): number | null {
  if (metric === "MEAN") return stats.mean;
  if (metric === "TRIMMED_MEAN") return stats.trimmedMean;
  return stats.median;
}

/**
 * BR-13: sort by the event's ranking metric (desc); ties fall back to mean, then
 * number of ratings. Fully tied groups share a rank (1, 1, 3). Groups without
 * ratings come last with rank null.
 */
export function rankGroups<T extends RankableGroup>(groups: readonly T[], metric: RankingMetric): Ranked<T>[] {
  const keyOf = (group: T) => [metricValue(group.stats, metric) ?? 0, group.stats.mean ?? 0, group.stats.n] as const;
  const compare = (a: T, b: T) => {
    const [ka, kb] = [keyOf(a), keyOf(b)];
    return kb[0] - ka[0] || kb[1] - ka[1] || kb[2] - ka[2];
  };

  const rated = groups.filter((group) => group.stats.n > 0 && metricValue(group.stats, metric) !== null);
  const unrated = groups.filter((group) => !rated.includes(group));
  const sorted = rated.toSorted(compare);

  const ranked = sorted.map((group, index) => {
    const tiedIndex = sorted.findIndex((other) => compare(other, group) === 0);
    return { ...group, rank: (tiedIndex === -1 ? index : tiedIndex) + 1 };
  });
  return [...ranked, ...unrated.map((group) => ({ ...group, rank: null }))];
}
