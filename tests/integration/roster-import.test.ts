import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { writeRoster } from "@/lib/data/roster-import";
import { parseRoster } from "@/lib/roster";

// Main Neon DB (D11): everything hangs off a throwaway Lecturer deleted in afterAll.
const RUN = randomUUID().slice(0, 8);
const PATTERN = "^[0-9]{5,15}$";
let lecturerId = "";
let eventId = "";

const rosterOf = (text: string) => {
  const parsed = parseRoster(text, PATTERN);
  expect(parsed.errors).toEqual([]);
  return parsed.rows;
};

async function snapshot() {
  const [groups, students] = await Promise.all([
    db.group.findMany({ where: { eventId }, orderBy: { order: "asc" }, select: { name: true, order: true } }),
    db.student.findMany({
      where: { eventId },
      orderBy: { code: "asc" },
      select: { code: true, fullName: true, group: { select: { name: true } } },
    }),
  ]);
  return { groups, students: students.map((s) => [s.code, s.fullName, s.group?.name ?? null]) };
}

beforeAll(async () => {
  lecturerId = (await db.lecturer.create({ data: { email: `roster-${RUN}@test.invalid` }, select: { id: true } })).id;
  eventId = (
    await db.event.create({
      data: { ownerId: lecturerId, title: `[TEST] roster ${RUN}`, code: `R${RUN.toUpperCase().replace(/[^A-Z2-9]/g, "Q").slice(0, 5).padEnd(5, "Q")}` },
      select: { id: true },
    })
  ).id;
});

afterAll(async () => {
  if (lecturerId) await db.lecturer.delete({ where: { id: lecturerId } });
});

describe("writeRoster", () => {
  it("replace: creates groups ordered by the number in their name, and students", async () => {
    const summary = await writeRoster(
      eventId,
      rosterOf("MSV\tHọ tên\tNhóm\n1000001\tAn\tNhóm 2\n1000002\tBình\tNhóm 1\n1000003\tCúc\tNhóm 2"),
      "replace",
    );

    expect(summary).toEqual({ created: 3, updated: 0, groupsCreated: 2 });
    expect(await snapshot()).toEqual({
      groups: [
        { name: "Nhóm 1", order: 1 },
        { name: "Nhóm 2", order: 2 },
      ],
      students: [
        ["1000001", "An", "Nhóm 2"],
        ["1000002", "Bình", "Nhóm 1"],
        ["1000003", "Cúc", "Nhóm 2"],
      ],
    });
  });

  it("append: updates existing codes, adds new students and groups", async () => {
    const summary = await writeRoster(
      eventId,
      rosterOf("MSV\tHọ tên\tNhóm\n1000001\tAn Mới\tNhóm 3\n1000004\tDũng\tNhóm 3"),
      "append",
    );

    expect(summary).toEqual({ created: 1, updated: 1, groupsCreated: 1 });
    const { groups, students } = await snapshot();
    expect(groups.map((g) => g.name)).toEqual(["Nhóm 1", "Nhóm 2", "Nhóm 3"]);
    expect(students).toContainEqual(["1000001", "An Mới", "Nhóm 3"]);
    expect(students).toContainEqual(["1000004", "Dũng", "Nhóm 3"]);
    expect(students).toHaveLength(4);
  });

  it("replace: drops the previous roster and groups entirely", async () => {
    await writeRoster(eventId, rosterOf("MSV\tHọ tên\tNhóm\n2000001\tEm\tNhóm A"), "replace");
    expect(await snapshot()).toEqual({
      groups: [{ name: "Nhóm A", order: 1 }],
      students: [["2000001", "Em", "Nhóm A"]],
    });
  });
});
