import { describe, expect, it } from "vitest";
import { nextGroupName } from "./groups";

describe("nextGroupName", () => {
  it("starts at Nhóm 1", () => {
    expect(nextGroupName([])).toBe("Nhóm 1");
  });

  it("continues after the existing count", () => {
    expect(nextGroupName(["Nhóm 1", "Nhóm 2"])).toBe("Nhóm 3");
  });

  it("skips names that are already taken", () => {
    expect(nextGroupName(["Nhóm 3", "Nhóm A"])).toBe("Nhóm 4");
  });
});
