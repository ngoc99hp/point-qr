const LOGIN_ERROR_MESSAGES = new Map<string, string>([
  [
    "AccessDenied",
    "Email này không có quyền truy cập. Liên hệ quản trị viên để được cấp quyền.",
  ],
]);

const FALLBACK_LOGIN_ERROR = "Đăng nhập thất bại. Vui lòng thử lại.";

/**
 * Maps the Auth.js `?error=` code to a Vietnamese message. Uses a Map so that
 * user-controlled codes such as `__proto__` can never resolve to prototype members.
 */
export function getLoginErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return LOGIN_ERROR_MESSAGES.get(code) ?? FALLBACK_LOGIN_ERROR;
}
