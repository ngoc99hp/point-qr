/** UTF-8 BOM so Excel opens Vietnamese text correctly (SPEC §6.3). */
export const CSV_BOM = "﻿";

export type CsvCell = string | number | null;

const NEEDS_QUOTES = /[",\r\n]/;
/** OWASP CSV injection triggers, including tab/CR and whitespace-prefixed formulas. */
const FORMULA_START = /^(?:[=+\-@\t\r]|\s+[=+\-@])/;

function formatCell(cell: CsvCell): string {
  if (cell === null) return "";
  if (typeof cell === "number") return Number.isFinite(cell) ? String(cell) : "";
  // Prevent spreadsheet formula injection from user-entered text.
  const text = FORMULA_START.test(cell) ? `'${cell}` : cell;
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  const lines = [headers, ...rows].map((row) => row.map(formatCell).join(","));
  return `${CSV_BOM}${lines.join("\r\n")}\r\n`;
}
