import { describe, expect, it } from "vitest";
import { CSV_BOM, toCsv } from "./csv";

describe("toCsv", () => {
  it("starts with a UTF-8 BOM and uses CRLF line endings", () => {
    const csv = toCsv(["A", "B"], [["1", "2"]]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv).toBe(`${CSV_BOM}A,B\r\n1,2\r\n`);
  });

  it("quotes cells containing commas, quotes or newlines", () => {
    const csv = toCsv(["Tên"], [['Đào, "Ngọc"'], ["dòng 1\ndòng 2"]]);
    expect(csv).toBe(`${CSV_BOM}Tên\r\n"Đào, ""Ngọc"""\r\n"dòng 1\ndòng 2"\r\n`);
  });

  it("prefixes formula-like cells to prevent CSV injection", () => {
    const csv = toCsv(["X"], [["=SUM(A1)"], ["+1"], ["-2"], ["@cmd"]]);
    expect(csv).toBe(`${CSV_BOM}X\r\n'=SUM(A1)\r\n'+1\r\n'-2\r\n'@cmd\r\n`);
  });

  it("writes numbers with a dot decimal separator and blanks for null", () => {
    const csv = toCsv(["N", "M"], [[7.25, null]]);
    expect(csv).toBe(`${CSV_BOM}N,M\r\n7.25,\r\n`);
  });

  it("does not prefix negative numbers passed as numbers", () => {
    expect(toCsv(["N"], [[-1]])).toBe(`${CSV_BOM}N\r\n-1\r\n`);
  });
});
