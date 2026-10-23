import { Badge } from "@/components/ui/badge";
import { formatScore } from "@/lib/format";
import type { GroupStats } from "@/lib/stats";
import type { LiveRating } from "@/lib/types/live";
import { RATING_FLAG_LABEL } from "@/lib/types/rating";

/** D3: large mean with counts. Numbers are ≥ text-5xl for the back row (SPEC §12). */
export function LiveSummary({ stats }: { stats: GroupStats }) {
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
      <div className="flex flex-col">
        <span className="text-sm uppercase tracking-wide text-muted-foreground">Điểm trung bình</span>
        <span className="text-8xl font-bold leading-none tabular-nums md:text-9xl">{formatScore(stats.mean)}</span>
      </div>
      <div className="flex flex-col pb-2 text-2xl tabular-nums">
        <span>
          <strong className="text-5xl">{stats.n}</strong> phiếu
        </span>
        {stats.excludedCount > 0 ? (
          <span className="text-lg text-muted-foreground">{stats.excludedCount} phiếu bị loại</span>
        ) : null}
      </div>
    </div>
  );
}

/** D3: everyone who rated, highest score first (already sorted by the API). */
export function RaterList({ ratings }: { ratings: readonly LiveRating[] }) {
  if (ratings.length === 0) {
    return <p className="rounded-xl border border-dashed p-6 text-center text-lg text-muted-foreground">Chưa có phiếu nào.</p>;
  }
  return (
    <div className="max-h-[55vh] overflow-auto rounded-xl border">
      <table className="w-full text-left text-lg">
        <thead className="sticky top-0 bg-background text-sm uppercase tracking-wide text-muted-foreground">
          <tr className="border-b">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">MSV</th>
            <th className="px-3 py-2 font-medium">Họ tên</th>
            <th className="px-3 py-2 text-right font-medium">Điểm</th>
          </tr>
        </thead>
        <tbody>
          {ratings.map((rating, index) => (
            <tr key={rating.studentCode} className="border-b last:border-0">
              <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{index + 1}</td>
              <td className="px-3 py-1.5 font-mono">{rating.studentCode}</td>
              <td className="px-3 py-1.5">
                {rating.studentName}
                {rating.flags.map((flag) => (
                  <Badge key={flag} variant="outline" className="ml-2 align-middle text-xs">
                    {RATING_FLAG_LABEL[flag]}
                  </Badge>
                ))}
              </td>
              <td className="px-3 py-1.5 text-right text-2xl font-semibold tabular-nums">{formatScore(rating.score)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
