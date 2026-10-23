import { describe, expect, it } from "vitest";
import { sortRatingsForProjector } from "./projector";
import type { RatingInput } from "./stats";

const at = (seconds: number) => new Date(seconds * 1000);
const rating = (code: string, score: number, createdAt: Date, extra: Partial<RatingInput> = {}): RatingInput => ({
  studentCode: code,
  studentName: `Tên ${code}`,
  score,
  createdAt,
  excluded: false,
  flags: [],
  ...extra,
});

describe("sortRatingsForProjector (D3)", () => {
  it("sorts by score descending, earlier submission first on ties, and hides excluded ratings", () => {
    const list = sortRatingsForProjector([
      rating("A", 7, at(1)),
      rating("B", 9, at(3)),
      rating("C", 9, at(2)),
      rating("D", 10, at(4), { excluded: true, flags: ["DEVICE_MULTI_STUDENT"] }),
      rating("E", 8, at(5), { flags: ["NAME_MISMATCH"] }),
    ]);

    expect(list.map((r) => r.studentCode)).toEqual(["C", "B", "E", "A"]);
    expect(list[2]).toEqual({ studentCode: "E", studentName: "Tên E", score: 8, flags: ["NAME_MISMATCH"] });
  });
});
