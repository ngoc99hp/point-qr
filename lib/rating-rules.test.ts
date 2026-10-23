import { describe, expect, it } from "vitest";
import { evaluateRoster, evaluateFlags } from "./rating-rules";

const ROSTER_STUDENT = { id: "s1", fullName: "Đào Anh Ngọc", groupId: "g2" };

describe("evaluateRoster (BR-07, BR-08)", () => {
  it("rejects a code that is not in the roster when strictRoster is on", () => {
    expect(evaluateRoster({ student: null, strictRoster: true, ratedGroupId: "g1" })).toEqual({
      ok: false,
      code: "NOT_IN_ROSTER",
    });
  });

  it("accepts an unknown code with a flag when strictRoster is off", () => {
    expect(evaluateRoster({ student: null, strictRoster: false, ratedGroupId: "g1" })).toEqual({
      ok: true,
      unknownStudent: true,
    });
  });

  it("rejects a student rating their own group", () => {
    expect(evaluateRoster({ student: ROSTER_STUDENT, strictRoster: true, ratedGroupId: "g2" })).toEqual({
      ok: false,
      code: "SELF_RATING",
    });
  });

  it("accepts a roster student rating another group", () => {
    expect(evaluateRoster({ student: ROSTER_STUDENT, strictRoster: true, ratedGroupId: "g1" })).toEqual({
      ok: true,
      unknownStudent: false,
    });
  });

  it("accepts a roster student who has no group", () => {
    expect(
      evaluateRoster({ student: { ...ROSTER_STUDENT, groupId: null }, strictRoster: true, ratedGroupId: "g1" }),
    ).toEqual({ ok: true, unknownStudent: false });
  });
});

describe("evaluateFlags (BR-08, BR-09, BR-10)", () => {
  const base = {
    unknownStudent: false,
    enteredName: "dao anh ngoc",
    rosterName: "Đào Anh Ngọc",
    deviceUsedByOtherStudent: false,
    previous: null,
  };

  it("returns no flags for a clean rating", () => {
    expect(evaluateFlags(base)).toEqual({ flags: [], excluded: false, excludedBy: null });
  });

  it("flags NAME_MISMATCH without excluding", () => {
    expect(evaluateFlags({ ...base, enteredName: "Nguyễn Văn B" })).toEqual({
      flags: ["NAME_MISMATCH"],
      excluded: false,
      excludedBy: null,
    });
  });

  it("flags UNKNOWN_STUDENT without excluding (no roster name to compare)", () => {
    expect(evaluateFlags({ ...base, unknownStudent: true, rosterName: null })).toEqual({
      flags: ["UNKNOWN_STUDENT"],
      excluded: false,
      excludedBy: null,
    });
  });

  it("flags and auto-excludes DEVICE_MULTI_STUDENT (D5)", () => {
    expect(evaluateFlags({ ...base, deviceUsedByOtherStudent: true })).toEqual({
      flags: ["DEVICE_MULTI_STUDENT"],
      excluded: true,
      excludedBy: "AUTO",
    });
  });

  it("keeps a manual exclusion by the lecturer on resubmission", () => {
    expect(evaluateFlags({ ...base, previous: { excluded: true, excludedBy: "lecturer-1" } })).toEqual({
      flags: [],
      excluded: true,
      excludedBy: "lecturer-1",
    });
  });

  it("restores an AUTO exclusion once the device flag no longer applies", () => {
    expect(evaluateFlags({ ...base, previous: { excluded: true, excludedBy: "AUTO" } })).toEqual({
      flags: [],
      excluded: false,
      excludedBy: null,
    });
  });
});
