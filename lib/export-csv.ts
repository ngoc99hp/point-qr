import { toCsv } from "@/lib/csv";
import type { EventResults } from "@/lib/data/results";
import { formatDateTime } from "@/lib/format";
import { RATING_FLAG_LABEL } from "@/lib/types/rating";

const SUMMARY_HEADERS = ["Hạng", "Nhóm", "Số phiếu", "TB", "TB cắt", "Trung vị", "Độ lệch chuẩn", "Min", "Max", "Số phiếu bị loại"];
const RAW_HEADERS = ["Nhóm", "MSV", "Tên nhập", "Tên roster", "Điểm", "Cờ", "Bị loại", "Thời gian", "Số lần sửa"];

/** Numbers are written unrounded except for 4-decimal float noise trimming. */
const round4 = (value: number | null) => (value === null ? null : Math.round(value * 10_000) / 10_000);

export function summaryCsv(results: Pick<EventResults, "groups">): string {
  return toCsv(
    SUMMARY_HEADERS,
    results.groups.map((group) => [
      group.rank,
      group.name,
      group.stats.n,
      round4(group.stats.mean),
      round4(group.stats.trimmedMean),
      round4(group.stats.median),
      round4(group.stats.stdDev),
      group.stats.lowest?.score ?? null,
      group.stats.highest?.score ?? null,
      group.stats.excludedCount,
    ]),
  );
}

export function rawCsv(results: Pick<EventResults, "groups">): string {
  const sortedGroups = results.groups.toSorted((a, b) => a.order - b.order);
  return toCsv(
    RAW_HEADERS,
    sortedGroups.flatMap((group) =>
      group.ratings.map((rating) => [
        group.name,
        rating.studentCode,
        rating.studentName,
        rating.rosterName,
        rating.score,
        rating.flags.map((flag) => RATING_FLAG_LABEL[flag]).join("; "),
        rating.excluded ? "Có" : "Không",
        formatDateTime(rating.createdAt),
        rating.editCount,
      ]),
    ),
  );
}
