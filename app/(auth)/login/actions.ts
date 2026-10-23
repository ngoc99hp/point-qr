"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/routes";
import { loginSchema } from "@/lib/validations/auth";

export type LoginFormState =
  | { success: true }
  | { success: false; error: string }
  | null;

const INVALID_INPUT = "Vui lòng nhập email hợp lệ và mật khẩu.";
const INVALID_CREDENTIALS = "Email hoặc mật khẩu không đúng.";
const UNEXPECTED_ERROR = "Đăng nhập thất bại. Vui lòng thử lại.";

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function loginAction(
  _previous: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const parsed = loginSchema.safeParse({
    email: readField(formData, "email"),
    password: readField(formData, "password"),
  });
  if (!parsed.success) return { success: false, error: INVALID_INPUT };

  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: safeCallbackUrl(readField(formData, "callbackUrl") || undefined),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        success: false,
        error: error.type === "CredentialsSignin" ? INVALID_CREDENTIALS : UNEXPECTED_ERROR,
      };
    }
    throw error; // NEXT_REDIRECT on success must propagate.
  }
  return { success: true };
}
