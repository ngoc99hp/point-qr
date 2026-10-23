// Client-safe mirror of the Prisma enums (no Prisma import in client bundles).

export type RatingFlag = "UNKNOWN_STUDENT" | "NAME_MISMATCH" | "DEVICE_MULTI_STUDENT";

export type RankingMetric = "MEAN" | "TRIMMED_MEAN" | "MEDIAN";

export const RATING_FLAG_LABEL: Record<RatingFlag, string> = {
  UNKNOWN_STUDENT: "Ngoài danh sách",
  NAME_MISMATCH: "Sai tên",
  DEVICE_MULTI_STUDENT: "Trùng thiết bị",
};

export const RANKING_METRIC_LABEL: Record<RankingMetric, string> = {
  MEAN: "Trung bình",
  TRIMMED_MEAN: "Trung bình cắt",
  MEDIAN: "Trung vị",
};
