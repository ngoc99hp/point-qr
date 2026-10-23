import { describe, expect, it } from "vitest";
import { groupOrderFromName, parseRoster } from "./roster";

const PATTERN = "^[0-9]{5,15}$";

describe("parseRoster", () => {
  it("parses tab-separated text pasted from Excel", () => {
    const text = "MSV\tHọ tên\tNhóm\n2012345\tĐào Anh Ngọc\tNhóm 1\n2012346\tNguyễn Văn B\tNhóm 2\n";
    const result = parseRoster(text, PATTERN);

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { line: 2, code: "2012345", fullName: "Đào Anh Ngọc", groupName: "Nhóm 1" },
      { line: 3, code: "2012346", fullName: "Nguyễn Văn B", groupName: "Nhóm 2" },
    ]);
  });

  it("matches header names regardless of case, accents and column order", () => {
    const text = "nhom,ho va ten,ma sinh vien\nNhóm 3,Trần C,2012347";
    const result = parseRoster(text, PATTERN);

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ code: "2012347", fullName: "Trần C", groupName: "Nhóm 3" });
  });

  it("supports semicolons, quoted CSV cells, a BOM, CRLF and blank lines", () => {
    const text = '﻿MSV;Họ tên;Nhóm\r\n2012345;"Đào, Anh ""Ngọc""";Nhóm 1\r\n\r\n';
    const result = parseRoster(text, PATTERN);

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.fullName).toBe('Đào, Anh "Ngọc"');
  });

  it("trims cells, normalizes codes and collapses spaces in names", () => {
    const result = parseRoster("MSV\tHọ tên\tNhóm\n 2012345 \t  Đào   Anh  \t Nhóm 1 ", PATTERN);
    expect(result.rows[0]).toMatchObject({ code: "2012345", fullName: "Đào Anh", groupName: "Nhóm 1" });
  });

  it("reports per-line errors for bad codes, duplicates and missing cells", () => {
    const text = [
      "MSV\tHọ tên\tNhóm",
      "2012345\tA\tNhóm 1",
      "SV123\tB\tNhóm 1",
      "2012345\tC\tNhóm 2",
      "2012346\t\tNhóm 2",
      "2012347\tD\t",
    ].join("\n");
    const result = parseRoster(text, PATTERN);

    expect(result.errors).toEqual([
      { line: 3, message: "MSV không đúng định dạng." },
      { line: 4, message: "MSV trùng với dòng 2." },
      { line: 5, message: "Thiếu họ tên." },
      { line: 6, message: "Thiếu nhóm." },
    ]);
    expect(result.rows.map((row) => row.line)).toEqual([2]);
  });

  it("reports missing required columns", () => {
    const result = parseRoster("MSV\tHọ tên\n2012345\tA", PATTERN);
    expect(result.errors).toEqual([{ line: 1, message: "Thiếu cột bắt buộc: Nhóm." }]);
    expect(result.rows).toEqual([]);
  });

  it("reports empty input", () => {
    expect(parseRoster("  \n ", PATTERN).errors).toEqual([
      { line: 1, message: "Chưa có dữ liệu. Dán bảng có dòng tiêu đề MSV, Họ tên, Nhóm." },
    ]);
  });
});

describe("groupOrderFromName", () => {
  it.each([
    ["Nhóm 3", 3],
    ["Nhom 12", 12],
    ["Group 1A", 1],
    ["N07", 7],
  ])("reads %s as %s", (name, order) => {
    expect(groupOrderFromName(name)).toBe(order);
  });

  it("returns null when the name has no number", () => {
    expect(groupOrderFromName("Nhóm A")).toBeNull();
  });
});
