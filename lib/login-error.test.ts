import { describe, expect, it } from "vitest";
import { getLoginErrorMessage } from "./login-error";

describe("getLoginErrorMessage", () => {
  it("returns null when there is no error", () => {
    expect(getLoginErrorMessage(undefined)).toBeNull();
  });

  it("explains a revoked session", () => {
    expect(getLoginErrorMessage("AccessDenied")).toMatch(/đăng nhập lại/);
  });

  it("explains invalid credentials", () => {
    expect(getLoginErrorMessage("CredentialsSignin")).toBe("Email hoặc mật khẩu không đúng.");
  });

  it.each(["Configuration", "__proto__", "constructor", "toString", "hasOwnProperty"])(
    "falls back to a generic string message for %s",
    (code) => {
      expect(getLoginErrorMessage(code)).toBe("Đăng nhập thất bại. Vui lòng thử lại.");
    },
  );
});
