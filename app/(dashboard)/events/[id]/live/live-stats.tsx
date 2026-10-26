import { Badge } from "@/components/ui/badge";
import { formatScore } from "@/lib/format";
import { SCORE_SOFT_CLASS, scoreTier } from "@/lib/score-color";
import type { GroupStats } from "@/lib/stats";
import type { LiveRating } from "@/lib/types/live";
import { RATING_FLAG_LABEL } from "@/lib/types/rating";
import { cn } from "@/lib/utils";

/** D3: large mean with counts. Numbers are ≥ text-5xl for the back row (SPEC §12). */
export function LiveSummary({ stats }: { stats: GroupStats }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 rounded-3xl border bg-card p-6 shadow-sm">
      <div className="flex flex-col">
        <span className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Điểm trung bình</span>
        <span className="text-brand-gradient text-8xl font-extrabold leading-[1.05] tabular-nums md:text-9xl">
          {formatScore(stats.mean)}
        </span>
      </div>
      <div className="flex flex-col items-end gap-1 pb-2 text-right">
        <span className="rounded-2xl bg-secondary px-4 py-2 text-secondary-foreground">
          <strong className="text-5xl font-extrabold tabular-nums">{stats.n}</strong>
          <span className="ml-2 text-xl font-semibold">phiếu</span>
        </span>
        {stats.excludedCount > 0 ? (
          <span className="text-base text-muted-foreground">{stats.excludedCount} phiếu bị loại</span>
        ) : null}
      </div>
    </div>
  );
}

/** A score in a pill coloured by tier (low → coral … top → violet). */
export function ScorePill({ score, className }: { score: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-16 justify-center rounded-xl border px-3 py-0.5 font-extrabold tabular-nums",
        SCORE_SOFT_CLASS[scoreTier(score)],
        className,
      )}
    >
      {formatScore(score)}
    </span>
  );
}

/** D3: everyone who rated, highest score first (already sorted by the API). */
export function RaterList({ ratings }: { ratings: readonly LiveRating[] }) {
  if (ratings.length === 0) {
    return (
      <p className="rounded-3xl border-2 border-dashed p-8 text-center text-xl text-muted-foreground">
        Chưa có phiếu nào — mời các bạn quét mã QR 📱
      </p>
    );
  }
  return (
    <div className="max-h-[52vh] overflow-auto rounded-3xl border bg-card shadow-sm">
      <table className="w-full text-left text-lg">
        <thead className="sticky top-0 z-10 bg-card/95 text-xs font-semibold uppercase tracking-widest text-muted-foreground backdrop-blur">
          <tr className="border-b">
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">MSV</th>
            <th className="px-4 py-3">Họ tên</th>
            <th className="px-4 py-3 text-right">Điểm</th>
          </tr>
        </thead>
        <tbody>
          {ratings.map((rating, index) => (
            <tr key={rating.studentCode} className="border-b border-border/60 last:border-0 odd:bg-muted/30">
              <td className="px-4 py-2 font-semibold tabular-nums text-muted-foreground">{index + 1}</td>
              <td className="px-4 py-2 font-mono text-base">{rating.studentCode}</td>
              <td className="px-4 py-2 font-semibold">
                {rating.studentName}
                {rating.flags.map((flag) => (
                  <Badge key={flag} variant="outline" className="ml-2 border-coral/40 align-middle text-xs text-coral-ink">
                    {RATING_FLAG_LABEL[flag]}
                  </Badge>
                ))}
              </td>
              <td className="px-4 py-2 text-right text-2xl">
                <ScorePill score={rating.score} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
