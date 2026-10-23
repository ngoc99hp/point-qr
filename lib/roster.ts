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

export const MAX_ROSTER_ROWS = 2000;
const MAX_NAME_LENGTH = 100;
const MAX_GROUP_NAME_LENGTH = 50;
/** Orders above this are ignored when read from a name (Postgres int4 safety). */
const MAX_GROUP_ORDER = 10_000;

const BOM = "﻿";
const LINE_FEED = "\n";
const CARRIAGE_RETURN = "\r";

const headerKey = (cell: string) => normalizeName(cell).replace(/[^a-z0-9]/g, "");
const collapse = (value: string) => value.trim().replace(/\s+/g, " ");

function detectDelimiter(headerLine: string): string {
  if (headerLine.includes("\t")) return "\t";
  const semicolons = headerLine.split(";").length;
  const commas = headerLine.split(",").length;
  return semicolons > commas ? ";" : ",";
}

interface RosterRecord {
  /** 1-based physical line where the record starts. */
  line: number;
  cells: string[];
}

/**
 * Splits the whole text into records, honoring "quoted" cells with "" escapes and
 * embedded newlines (RFC 4180 style; Excel pastes multi-line cells this way).
 */
function parseRecords(text: string, delimiter: string): RosterRecord[] {
  const records: RosterRecord[] = [];
  let cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  const endRecord = () => {
    cells.push(cell);
    if (cells.some((value) => value.trim() !== "")) records.push({ line: recordLine, cells });
    cells = [];
    cell = "";
  };
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === LINE_FEED) line += 1;
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
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
    } else if (char === LINE_FEED) {
      endRecord();
      recordLine = line;
    } else if (char !== CARRIAGE_RETURN) {
      cell += char;
    }
  }
  endRecord();
  return records;
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
  if (row.fullName.length > MAX_NAME_LENGTH) return `Họ tên tối đa ${MAX_NAME_LENGTH} ký tự.`;
  if (!row.groupName) return "Thiếu nhóm.";
  if (row.groupName.length > MAX_GROUP_NAME_LENGTH) return `Tên nhóm tối đa ${MAX_GROUP_NAME_LENGTH} ký tự.`;
  return null;
}

/** Parses pasted TSV or CSV with a header row (MSV, Họ tên, Nhóm). Line numbers are 1-based. */
export function parseRoster(text: string, studentCodePattern: string): RosterParseResult {
  const content = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  const firstLine = content.split(LINE_FEED).find((line) => line.trim() !== "");
  if (firstLine === undefined) {
    return { rows: [], errors: [{ line: 1, message: "Chưa có dữ liệu. Dán bảng có dòng tiêu đề MSV, Họ tên, Nhóm." }] };
  }

  const [header, ...records] = parseRecords(content, detectDelimiter(firstLine));
  const { indexes, missing } = mapColumns(header?.cells ?? []);
  if (missing.length > 0) {
    const labels = missing.map((column) => COLUMN_LABEL[column]).join(", ");
    return { rows: [], errors: [{ line: header?.line ?? 1, message: `Thiếu cột bắt buộc: ${labels}.` }] };
  }
  if (records.length > MAX_ROSTER_ROWS) {
    return { rows: [], errors: [{ line: 1, message: `Tối đa ${MAX_ROSTER_ROWS} sinh viên mỗi lần nhập.` }] };
  }

  const rows: RosterRow[] = [];
  const errors: RosterError[] = [];
  const firstLineByCode = new Map<string, number>();
  for (const record of records) {
    const cell = (column: Column) => record.cells[indexes[column] ?? -1] ?? "";
    const row: RosterRow = {
      line: record.line,
      code: normalizeCode(cell("code")),
      fullName: collapse(cell("fullName")),
      groupName: collapse(cell("groupName")),
    };
    const error = validateRow(row, studentCodePattern, firstLineByCode);
    if (error) {
      errors.push({ line: row.line, message: error });
      continue;
    }
    firstLineByCode.set(row.code, row.line);
    rows.push(row);
  }
  return { rows, errors };
}

/** Group order from the first number in its name ("Nhóm 3" → 3), or null. */
export function groupOrderFromName(name: string): number | null {
  const match = name.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
}

export interface PlannedGroup {
  name: string;
  order: number;
}

/**
 * Groups to create for an import (SPEC §6.4). First pass: a group takes the
 * number in its name when that order is free. Second pass: the rest go after
 * the highest order. Result keeps the input order of first appearance.
 */
export function planNewGroups(
  existing: readonly PlannedGroup[],
  groupNames: readonly string[],
): PlannedGroup[] {
  const existingNames = new Set(existing.map((group) => group.name));
  const names = [...new Set(groupNames)].filter((name) => !existingNames.has(name));
  const takenOrders = new Set(existing.map((group) => group.order));

  const preferred = new Map<string, number>();
  for (const name of names) {
    const order = groupOrderFromName(name);
    if (order !== null && order > 0 && order <= MAX_GROUP_ORDER && !takenOrders.has(order)) {
      preferred.set(name, order);
      takenOrders.add(order);
    }
  }

  let next = Math.max(0, ...takenOrders) + 1;
  return names.map((name) => {
    const order = preferred.get(name);
    if (order !== undefined) return { name, order };
    const assigned = next;
    next += 1;
    return { name, order: assigned };
  });
}
