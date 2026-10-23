import { describe, expect, it } from "vitest";
import { CSV_BOM } from "./csv";
import { rawCsv, summaryCsv } from "./export-csv";
import { computeStats } from "./stats";

const ratings = [
  {
    id: "r1",
    studentCode: "2012345",
    studentName: "Đào Anh Ngọc",
    rosterName: "Đào Anh Ngọc",
    score: 9,
    flags: [] as const,
    excluded: false,
    createdAt: new Date("2026-10-23T01:05:00Z"),
    editCount: 1,
  },
  {
    id: "r2",
    studentCode: "2012346",
    studentName: "=HACK()",
    rosterName: "Nguyễn Văn B",
    score: 3,
    flags: ["NAME_MISMATCH", "DEVICE_MULTI_STUDENT"] as const,
    excluded: true,
    createdAt: new Date("2026-10-23T01:06:00Z"),
    editCount: 0,
  },
].map((r) => ({ ...r, flags: [...r.flags] }));

const results = {
  groups: [
    { id: "g1", name: "Nhóm 1", order: 1, rank: 1, ratings, stats: computeStats(ratings, 0.1) },
    { id: "g2", name: "Nhóm 2", order: 2, rank: null, ratings: [], stats: computeStats([], 0.1) },
  ],
};

describe("summaryCsv", () => {
  it("writes one row per group with rank and excluded count, with a BOM", () => {
    const lines = summaryCsv(results).split("\r\n");
    expect(lines[0]).toBe(`${CSV_BOM}Hạng,Nhóm,Số phiếu,TB,TB cắt,Trung vị,Độ lệch chuẩn,Min,Max,Số phiếu bị loại`);
    expect(lines[1]).toBe("1,Nhóm 1,1,9,9,9,,9,9,1");
    expect(lines[2]).toBe(",Nhóm 2,0,,,,,,,0");
  });
});

describe("rawCsv", () => {
  it("writes every rating with flags, exclusion and Vietnam time; guards formulas", () => {
    const lines = rawCsv(results).split("\r\n");
    expect(lines[1]).toBe("Nhóm 1,2012345,Đào Anh Ngọc,Đào Anh Ngọc,9,,Không,08:05 23/10/2026,1");
    expect(lines[2]).toBe("Nhóm 1,2012346,'=HACK(),Nguyễn Văn B,3,Sai tên; Trùng thiết bị,Có,08:06 23/10/2026,0");
  });
});
