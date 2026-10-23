import { describe, expect, it } from "vitest";
import { rankGroups, type RankableGroup } from "./ranking";

function group(id: string, stats: Partial<RankableGroup["stats"]>): RankableGroup {
  return {
    id,
    stats: { n: 3, mean: 5, trimmedMean: 5, median: 5, ...stats },
  };
}

describe("rankGroups (BR-13)", () => {
  it("ranks by the chosen metric, highest first", () => {
    const groups = [group("a", { mean: 6 }), group("b", { mean: 8 }), group("c", { mean: 7 })];
    expect(rankGroups(groups, "MEAN").map((g) => [g.id, g.rank])).toEqual([
      ["b", 1],
      ["c", 2],
      ["a", 3],
    ]);
  });

  it("uses trimmed mean or median when configured", () => {
    const groups = [group("a", { trimmedMean: 9, median: 1 }), group("b", { trimmedMean: 2, median: 8 })];
    expect(rankGroups(groups, "TRIMMED_MEAN")[0]?.id).toBe("a");
    expect(rankGroups(groups, "MEDIAN")[0]?.id).toBe("b");
  });

  it("breaks ties by mean, then by number of ratings", () => {
    const groups = [
      group("few", { median: 8, mean: 7, n: 2 }),
      group("lowMean", { median: 8, mean: 6, n: 9 }),
      group("many", { median: 8, mean: 7, n: 5 }),
    ];
    expect(rankGroups(groups, "MEDIAN").map((g) => g.id)).toEqual(["many", "few", "lowMean"]);
  });

  it("gives equal rank to fully tied groups (1, 1, 3)", () => {
    const groups = [group("a", { mean: 7 }), group("b", { mean: 7 }), group("c", { mean: 6 })];
    expect(rankGroups(groups, "MEAN").map((g) => g.rank)).toEqual([1, 1, 3]);
  });

  it("puts groups without ratings last, unranked", () => {
    const groups = [group("empty", { n: 0, mean: null, trimmedMean: null, median: null }), group("a", { mean: 4 })];
    const ranked = rankGroups(groups, "MEAN");
    expect(ranked.map((g) => [g.id, g.rank])).toEqual([
      ["a", 1],
      ["empty", null],
    ]);
  });
});
