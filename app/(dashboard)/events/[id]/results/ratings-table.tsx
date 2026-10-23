import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ResultGroup, ResultRating } from "@/lib/data/results";
import { formatDateTime, formatScore } from "@/lib/format";
import { RATING_FLAG_LABEL, type RatingFlag } from "@/lib/types/rating";
import { cn } from "@/lib/utils";
import { ExcludeToggle } from "./exclude-toggle";

export type RatingFilter = "all" | "flagged" | "excluded";

/** SPEC §12: UNKNOWN_STUDENT yellow, NAME_MISMATCH orange, DEVICE_MULTI_STUDENT red. */
const FLAG_CLASS: Record<RatingFlag, string> = {
  UNKNOWN_STUDENT: "border-yellow-500/50 bg-yellow-400/20 text-yellow-900 dark:text-yellow-200",
  NAME_MISMATCH: "border-orange-500/50 bg-orange-400/20 text-orange-900 dark:text-orange-200",
  DEVICE_MULTI_STUDENT: "border-red-500/50 bg-red-500/15 text-red-900 dark:text-red-200",
};

const FILTER_LABEL: Record<RatingFilter, string> = { all: "Tất cả", flagged: "Có cờ", excluded: "Bị loại" };

function applyFilter(ratings: readonly ResultRating[], filter: RatingFilter) {
  if (filter === "flagged") return ratings.filter((rating) => rating.flags.length > 0);
  if (filter === "excluded") return ratings.filter((rating) => rating.excluded);
  return ratings;
}

interface RatingsTableProps {
  eventId: string;
  group: ResultGroup;
  filter: RatingFilter;
}

export function RatingsTable({ eventId, group, filter }: RatingsTableProps) {
  const ratings = applyFilter(group.ratings, filter);
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Lọc phiếu" className="flex gap-2">
        {(Object.keys(FILTER_LABEL) as RatingFilter[]).map((value) => (
          <Link
            key={value}
            href={`/events/${eventId}/results?group=${group.id}&filter=${value}`}
            aria-current={filter === value ? "page" : undefined}
            className={cn(
              "rounded-md border px-3 py-1 text-sm",
              filter === value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {FILTER_LABEL[value]}
          </Link>
        ))}
      </nav>
      {ratings.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Không có phiếu nào.</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>MSV</TableHead>
                <TableHead>Tên nhập</TableHead>
                <TableHead>Tên trong danh sách</TableHead>
                <TableHead className="text-right">Điểm</TableHead>
                <TableHead>Cờ</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead className="text-right">Sửa</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ratings.map((rating) => (
                <TableRow key={rating.id} className={rating.excluded ? "text-muted-foreground line-through decoration-1" : undefined}>
                  <TableCell className="font-mono">{rating.studentCode}</TableCell>
                  <TableCell>{rating.studentName}</TableCell>
                  <TableCell>{rating.rosterName ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatScore(rating.score)}</TableCell>
                  <TableCell className="space-x-1 no-underline">
                    {rating.flags.map((flag) => (
                      <Badge key={flag} variant="outline" className={FLAG_CLASS[flag]}>
                        {RATING_FLAG_LABEL[flag]}
                      </Badge>
                    ))}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTime(rating.createdAt)}</TableCell>
                  <TableCell className="text-right tabular-nums">{rating.editCount}</TableCell>
                  <TableCell className="text-right">
                    <ExcludeToggle ratingId={rating.id} excluded={rating.excluded} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
