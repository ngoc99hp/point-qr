// Pure roster parser shared by the preview (client) and the import action (server).
import { matchesStudentCodePattern, normalizeCode, normalizeName } from "@/lib/normalize";

export interface RosterRow {
  line: number;
  code: string;
  fullName: string;
  groupName: string;
}

export interface RosterError {
  line: number;
  message: string;
}

export interface RosterParseResult {
  rows: RosterRow[];
  errors: RosterError[];
}

type Column = "code" | "fullName" | "groupName";

const HEADER_ALIASES: Record<Column, readonly string[]> = {
  code: ["msv", "mssv", "masv", "masinhvien", "ma"],
  fullName: ["hoten", "hovaten", "ten", "hotensinhvien"],
  groupName: ["nhom", "tennhom", "group"],
};
const COLUMN_LABEL: Record<Column, string> = { code: "MSV", fullName: "Họ tên", groupName: "Nhóm" };

const headerKey = (cell: string) => normalizeName(cell).replace(/[^a-z0-9]/g, "");
const collapse = (value: string) => value.trim().replace(/\s+/g, " ");

function detectDelimiter(headerLine: string): string {
  if (headerLine.includes("\t")) return "\t";
  const semicolons = headerLine.split(";").length;
  const commas = headerLine.split(",").length;
  return semicolons > commas ? ";" : ",";
}

/** Splits one line, honoring "quoted" cells with "" escapes (RFC 4180 style). */
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell.trim() === "") {
      inQuotes = true;
      cell = "";
    } else if (char === delimiter) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function mapColumns(headers: readonly string[]): { indexes: Partial<Record<Column, number>>; missing: Column[] } {
  const keys = headers.map(headerKey);
  const indexes: Partial<Record<Column, number>> = {};
  for (const column of Object.keys(HEADER_ALIASES) as Column[]) {
    const index = keys.findIndex((key) => HEADER_ALIASES[column].includes(key));
    if (index !== -1) indexes[column] = index;
  }
  const missing = (Object.keys(HEADER_ALIASES) as Column[]).filter((column) => indexes[column] === undefined);
  return { indexes, missing };
}

function validateRow(row: RosterRow, pattern: string, firstLineByCode: Map<string, number>): string | null {
  if (!row.code) return "Thiếu MSV.";
  if (!matchesStudentCodePattern(row.code, pattern)) return "MSV không đúng định dạng.";
  const firstLine = firstLineByCode.get(row.code);
  if (firstLine !== undefined) return `MSV trùng với dòng ${firstLine}.`;
  if (!row.fullName) return "Thiếu họ tên.";
  if (!row.groupName) return "Thiếu nhóm.";
  return null;
}

/** Parses pasted TSV or CSV with a header row (MSV, Họ tên, Nhóm). Line numbers are 1-based. */
export function parseRoster(text: string, studentCodePattern: string): RosterParseResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim() !== "");
  if (headerIndex === -1) {
    return { rows: [], errors: [{ line: 1, message: "Chưa có dữ liệu. Dán bảng có dòng tiêu đề MSV, Họ tên, Nhóm." }] };
  }

  const headerLine = lines[headerIndex] ?? "";
  const delimiter = detectDelimiter(headerLine);
  const { indexes, missing } = mapColumns(splitLine(headerLine, delimiter));
  if (missing.length > 0) {
    const labels = missing.map((column) => COLUMN_LABEL[column]).join(", ");
    return { rows: [], errors: [{ line: headerIndex + 1, message: `Thiếu cột bắt buộc: ${labels}.` }] };
  }

  const rows: RosterRow[] = [];
  const errors: RosterError[] = [];
  const firstLineByCode = new Map<string, number>();
  lines.forEach((line, index) => {
    if (index <= headerIndex || line.trim() === "") return;
    const cells = splitLine(line, delimiter);
    const cell = (column: Column) => cells[indexes[column] ?? -1] ?? "";
    const row: RosterRow = {
      line: index + 1,
      code: normalizeCode(cell("code")),
      fullName: collapse(cell("fullName")),
      groupName: collapse(cell("groupName")),
    };
    const error = validateRow(row, studentCodePattern, firstLineByCode);
    if (error) {
      errors.push({ line: row.line, message: error });
      return;
    }
    firstLineByCode.set(row.code, row.line);
    rows.push(row);
  });
  return { rows, errors };
}

/** Group order from the first number in its name ("Nhóm 3" → 3), or null. */
export function groupOrderFromName(name: string): number | null {
  const match = name.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
}
