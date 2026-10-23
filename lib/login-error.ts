const LOGIN_ERROR_MESSAGES = new Map<string, string>([
  ["AccessDenied", "Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại."],
  ["CredentialsSignin", "Email hoặc mật khẩu không đúng."],
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
