import type { Metadata } from "next";
import { Suspense } from "react";
import { SubmitButton } from "@/components/submit-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signIn } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/routes";

export const metadata: Metadata = { title: "Đăng nhập · PeerScore" };

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied:
    "Email này không có quyền truy cập. Liên hệ quản trị viên để được cấp quyền.",
};
const FALLBACK_ERROR = "Đăng nhập thất bại. Vui lòng thử lại.";

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">PeerScore</CardTitle>
          <CardDescription>
            Đăng nhập dành cho giảng viên để quản lý buổi đánh giá.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-10 rounded-md bg-muted" />}>
            <LoginForm searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

async function LoginForm({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const error = firstParam(params.error);
  const redirectTo = safeCallbackUrl(firstParam(params.callbackUrl));

  async function signInWithGoogle() {
    "use server";
    await signIn("google", { redirectTo });
  }

  return (
    <form action={signInWithGoogle} className="flex flex-col gap-4">
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {ERROR_MESSAGES[error] ?? FALLBACK_ERROR}
        </p>
      ) : null}
      <SubmitButton size="lg" className="w-full" pendingLabel="Đang chuyển hướng…">
        Đăng nhập bằng Google
      </SubmitButton>
    </form>
  );
}
