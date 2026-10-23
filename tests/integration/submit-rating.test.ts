import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { MANUAL_INCLUDE } from "@/lib/rating-rules";
import { checkStudentCodeStatus } from "@/lib/ratings/check-student-code";
import { processRating, type SaveRatingInput } from "@/lib/ratings/submit-rating";

// Runs against the main Neon DB (SPEC §13, D11). All data hangs off a throwaway
// Lecturer, so deleting it in afterAll cascades to every row this file created.

const RUN = randomUUID().slice(0, 8);
let lecturerId = "";
let eventId = "";
let eventCode = "";
let groupA = "";
let groupB = "";
let roundA = "";

const STUDENT_IN_A = { code: `1${RUN.replace(/\D/g, "").padEnd(6, "1").slice(0, 6)}1`, name: "Đào Anh Ngọc" };
const STUDENT_B1 = { code: STUDENT_IN_A.code.replace(/.$/, "2"), name: "Nguyễn Văn Bình" };
const STUDENT_B2 = { code: STUDENT_IN_A.code.replace(/.$/, "3"), name: "Trần Thị Cúc" };
const UNKNOWN_CODE = STUDENT_IN_A.code.replace(/.$/, "9");

function input(overrides: Partial<SaveRatingInput>): SaveRatingInput {
  return {
    eventCode,
    roundId: roundA,
    studentCode: STUDENT_B1.code,
    studentName: STUDENT_B1.name,
    score: 8,
    deviceId: randomUUID(),
    ipHash: "test",
    userAgent: "vitest",
    ...overrides,
  };
}

async function storedRating(studentCode: string) {
  return db.rating.findUnique({
    where: { roundId_studentCode: { roundId: roundA, studentCode } },
    select: { score: true, flags: true, excluded: true, excludedBy: true, editCount: true, studentId: true },
  });
}

beforeAll(async () => {
  const lecturer = await db.lecturer.create({
    data: { email: `integration-${RUN}@test.invalid`, name: "[TEST]" },
    select: { id: true },
  });
  lecturerId = lecturer.id;
  eventCode = `T${RUN.toUpperCase().replace(/[^A-Z2-9]/g, "Z").slice(0, 5).padEnd(5, "Z")}`;
  const event = await db.event.create({
    data: { ownerId: lecturerId, title: `[TEST] integration ${RUN}`, code: eventCode, rotatingQr: false },
    select: { id: true },
  });
  eventId = event.id;
  groupA = (await db.group.create({ data: { eventId, name: "Nhóm 1", order: 1 }, select: { id: true } })).id;
  groupB = (await db.group.create({ data: { eventId, name: "Nhóm 2", order: 2 }, select: { id: true } })).id;
  await db.student.createMany({
    data: [
      { eventId, code: STUDENT_IN_A.code, fullName: STUDENT_IN_A.name, groupId: groupA },
      { eventId, code: STUDENT_B1.code, fullName: STUDENT_B1.name, groupId: groupB },
      { eventId, code: STUDENT_B2.code, fullName: STUDENT_B2.name, groupId: groupB },
    ],
  });
  roundA = (await db.round.create({ data: { eventId, groupId: groupA, status: "OPEN" }, select: { id: true } })).id;
});

afterAll(async () => {
  if (lecturerId) await db.lecturer.delete({ where: { id: lecturerId } });
  const leftover = await db.event.count({ where: { id: eventId } });
  expect(leftover).toBe(0);
});

beforeEach(async () => {
  await db.rating.deleteMany({ where: { roundId: roundA } });
  await db.round.update({ where: { id: roundA }, data: { status: "OPEN", closedAt: null } });
  await db.event.update({ where: { id: eventId }, data: { strictRoster: true } });
});

describe("submitRating against the database", () => {
  it("BR-08: rejects a code outside the roster when strictRoster is on", async () => {
    const result = await processRating(input({ studentCode: UNKNOWN_CODE }));
    expect(result).toMatchObject({ success: false, error: { code: "NOT_IN_ROSTER", field: "studentCode" } });
    expect(await storedRating(UNKNOWN_CODE)).toBeNull();
  });

  it("BR-08: accepts an unknown code with UNKNOWN_STUDENT when strictRoster is off", async () => {
    await db.event.update({ where: { id: eventId }, data: { strictRoster: false } });
    const result = await processRating(input({ studentCode: UNKNOWN_CODE, studentName: "Ai Đó" }));
    expect(result.success).toBe(true);
    expect(await storedRating(UNKNOWN_CODE)).toMatchObject({
      flags: ["UNKNOWN_STUDENT"],
      excluded: false,
      studentId: null,
    });
  });

  it("BR-07: rejects a student rating their own group", async () => {
    const result = await processRating(input({ studentCode: STUDENT_IN_A.code, studentName: STUDENT_IN_A.name }));
    expect(result).toMatchObject({ success: false, error: { code: "SELF_RATING" } });
  });

  it("BR-09: accepts a name typed without accents, flags a different name", async () => {
    expect((await processRating(input({ studentName: "nguyen van binh" }))).success).toBe(true);
    expect(await storedRating(STUDENT_B1.code)).toMatchObject({ flags: [], excluded: false });

    expect((await processRating(input({ studentCode: STUDENT_B2.code, studentName: "Lê Văn Khác" }))).success).toBe(true);
    expect(await storedRating(STUDENT_B2.code)).toMatchObject({ flags: ["NAME_MISMATCH"], excluded: false });
  });

  it("BR-06: resubmitting updates the score and increments editCount", async () => {
    const first = await processRating(input({ score: 7 }));
    const second = await processRating(input({ score: 9.5 }));

    expect(first).toMatchObject({ success: true, data: { status: "created", groupName: "Nhóm 1" } });
    expect(second).toMatchObject({ success: true, data: { status: "updated" } });
    const stored = await storedRating(STUDENT_B1.code);
    expect(stored?.score.toNumber()).toBe(9.5);
    expect(stored?.editCount).toBe(1);
  });

  it("BR-10: a device rating for a second student is flagged and auto-excluded", async () => {
    const device = randomUUID();
    await processRating(input({ deviceId: device }));
    const second = await processRating(input({ deviceId: device, studentCode: STUDENT_B2.code, studentName: STUDENT_B2.name }));

    expect(second.success).toBe(true);
    expect(await storedRating(STUDENT_B1.code)).toMatchObject({ flags: [], excluded: false });
    expect(await storedRating(STUDENT_B2.code)).toMatchObject({
      flags: ["DEVICE_MULTI_STUDENT"],
      excluded: true,
      excludedBy: "AUTO",
    });

    // Resubmitting from the student's own device lifts the AUTO exclusion.
    await processRating(input({ studentCode: STUDENT_B2.code, studentName: STUDENT_B2.name }));
    expect(await storedRating(STUDENT_B2.code)).toMatchObject({ flags: [], excluded: false, excludedBy: null });
  });

  it("BR-11: a manual exclusion by the lecturer survives a resubmission", async () => {
    await processRating(input({}));
    await db.rating.updateMany({
      where: { roundId: roundA, studentCode: STUDENT_B1.code },
      data: { excluded: true, excludedBy: lecturerId },
    });
    await processRating(input({ score: 10 }));
    expect(await storedRating(STUDENT_B1.code)).toMatchObject({ excluded: true, excludedBy: lecturerId });
  });

  it("BR-11: a rating the lecturer restored stays included even if the device flag still applies", async () => {
    const device = randomUUID();
    await processRating(input({ deviceId: device }));
    await processRating(input({ deviceId: device, studentCode: STUDENT_B2.code, studentName: STUDENT_B2.name }));
    await db.rating.updateMany({
      where: { roundId: roundA, studentCode: STUDENT_B2.code },
      data: { excluded: false, excludedBy: MANUAL_INCLUDE },
    });

    await processRating(input({ deviceId: device, studentCode: STUDENT_B2.code, studentName: STUDENT_B2.name, score: 6 }));
    expect(await storedRating(STUDENT_B2.code)).toMatchObject({
      flags: ["DEVICE_MULTI_STUDENT"],
      excluded: false,
      excludedBy: MANUAL_INCLUDE,
    });
  });

  it("BR-03: rejects ratings once the round is closed", async () => {
    await db.round.update({ where: { id: roundA }, data: { status: "CLOSED", closedAt: new Date() } });
    const result = await processRating(input({}));
    expect(result).toMatchObject({ success: false, error: { code: "ROUND_CLOSED" } });
  });

  it("BR-04/05: rejects a malformed code and an off-step score", async () => {
    expect(await processRating(input({ studentCode: "SV12345" }))).toMatchObject({
      success: false,
      error: { field: "studentCode" },
    });
    expect(await processRating(input({ score: 7.3 }))).toMatchObject({ success: false, error: { field: "score" } });
  });
});

describe("checkStudentCodeStatus (D4)", () => {
  const check = (studentCode: string, roundId = roundA) => checkStudentCodeStatus({ eventCode, roundId, studentCode });

  it("reports each roster status without exposing roster data", async () => {
    expect(await check(STUDENT_B1.code)).toBe("OK");
    expect(await check(UNKNOWN_CODE)).toBe("NOT_IN_ROSTER");
    expect(await check(STUDENT_IN_A.code)).toBe("SELF_RATING");
    expect(await check("ABC")).toBe("INVALID_FORMAT");
    expect(await check(STUDENT_B1.code, "no-such-round")).toBe("ROUND_CLOSED");
  });
});
