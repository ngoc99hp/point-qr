import { describe, expect, it } from "vitest";
import { getLoginErrorMessage } from "./login-error";

describe("getLoginErrorMessage", () => {
  it("returns null when there is no error", () => {
    expect(getLoginErrorMessage(undefined)).toBeNull();
  });

  it("explains an AccessDenied error in Vietnamese", () => {
    expect(getLoginErrorMessage("AccessDenied")).toMatch(/không có quyền truy cập/);
  });

  it.each(["Configuration", "__proto__", "constructor", "toString", "hasOwnProperty"])(
    "falls back to a generic string message for %s",
    (code) => {
      expect(getLoginErrorMessage(code)).toBe("Đăng nhập thất bại. Vui lòng thử lại.");
    },
  );
});
