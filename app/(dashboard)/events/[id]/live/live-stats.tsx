import { formatScore } from "@/lib/format";
import type { Extreme, GroupStats } from "@/lib/stats";

function raterLine(extreme: Extreme): string {
  const [first, ...others] = extreme.raters;
  if (!first) return "";
  return others.length > 0 ? `${first.name} và ${others.length} người khác` : first.name;
}

function ExtremeCard({ label, extreme }: { label: string; extreme: Extreme | null }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border p-4">
      <span className="text-sm uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-5xl font-semibold tabular-nums">
        {formatScore(extreme?.score ?? null)}
      </span>
      <span className="truncate text-lg text-muted-foreground">
        {extreme ? raterLine(extreme) : "Chưa có phiếu"}
      </span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border p-4">
      <span className="text-sm uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-5xl font-semibold tabular-nums">{formatScore(value)}</span>
    </div>
  );
}

/** Projector stats (P1 subset). Numbers are ≥ text-5xl for the back row (SPEC §12). */
export function LiveStats({ stats }: { stats: GroupStats }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-4">
        <span className="text-8xl font-bold tabular-nums leading-none md:text-9xl">{stats.n}</span>
        <span className="text-2xl text-muted-foreground">phiếu</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Metric label="Trung bình" value={stats.mean} />
        <Metric label="Trung vị" value={stats.median} />
        <ExtremeCard label="Cao nhất" extreme={stats.highest} />
        <ExtremeCard label="Thấp nhất" extreme={stats.lowest} />
      </div>
    </div>
  );
}
