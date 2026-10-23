import type { RatingInput } from "@/lib/stats";
import type { LiveRating } from "@/lib/types/live";

/** D3: projector list — valid ratings, highest score first, ties by submission time. */
export function sortRatingsForProjector(ratings: readonly RatingInput[]): LiveRating[] {
  return ratings
    .filter((rating) => !rating.excluded)
    .toSorted((a, b) => b.score - a.score || a.createdAt.getTime() - b.createdAt.getTime())
    .map((rating) => ({
      studentCode: rating.studentCode,
      studentName: rating.studentName,
      score: rating.score,
      flags: [...rating.flags],
    }));
}
