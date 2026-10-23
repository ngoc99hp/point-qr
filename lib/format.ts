/** BR-14: stored in UTC, displayed in Vietnam time. */
const VN_DATE_TIME = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const VN_DECIMAL = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

export function formatDateTime(value: Date | string): string {
  return VN_DATE_TIME.format(typeof value === "string" ? new Date(value) : value);
}

/** Round only for display (SPEC §8): at most 2 decimals, Vietnamese separators. */
export function formatScore(value: number | null): string {
  return value === null ? "—" : VN_DECIMAL.format(value);
}
