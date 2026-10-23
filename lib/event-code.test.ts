import { describe, expect, it } from "vitest";
import {
  EVENT_CODE_ALPHABET,
  EVENT_CODE_LENGTH,
  generateEventCode,
  parseEventCode,
} from "./event-code";

describe("generateEventCode", () => {
  it("produces 6 characters from [A-Z2-9]", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateEventCode()).toMatch(/^[A-Z2-9]{6}$/);
    }
  });

  it("uses the documented alphabet and length", () => {
    expect(EVENT_CODE_LENGTH).toBe(6);
    expect(EVENT_CODE_ALPHABET).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789");
  });

  it("is random enough not to repeat in a small sample", () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateEventCode()));
    expect(codes.size).toBeGreaterThan(495);
  });

  it("uses the injected random source", () => {
    expect(generateEventCode(() => 0)).toBe("AAAAAA");
    expect(generateEventCode((max) => max - 1)).toBe("999999");
  });
});

describe("parseEventCode", () => {
  it("normalizes case and whitespace", () => {
    expect(parseEventCode(" abc234 ")).toBe("ABC234");
  });

  it.each(["ABC23", "ABC2345", "ABC10O", "ABC-23", ""])("rejects %s", (raw) => {
    expect(parseEventCode(raw)).toBeNull();
  });
});
